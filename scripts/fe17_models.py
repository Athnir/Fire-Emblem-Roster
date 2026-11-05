"""
Fire Emblem Engage's units drawn from their 3D models as the unit-info model shows them (App.UnitInfoWindowCharaModel: the status
screen, the inventory, the ring menus), from the user's own dump. For the Roster's portraits only (scripts/fe17_portraits.py): the
images stay on the user's machine and are never committed.

- Which pieces: the asset table (gamedata/assettable.xml, アセット) is walked in order and every row whose Conditions match the
  unit's context overwrites the fields it sets (a row of Mode 2 is the detailed models the menus use; Mode 0 rows apply to every
  mode). The context: the person's Name label (MPID_), Pid, their class (Jid), 男装 or 女装 by Gender, and 情報 (the info screen).
  Accessories (AccN.Locator / AccN.Model) are kept by attach point, so a later row clearing the sword box doesn't drop a hair
  piece. The fields used: BodyModel (the rig), DressModel, HeadModel, HairModel (uHair_null: none), the accessories, InfoAnim
  (AOC_Info_cXXX) and SkinR/G/B.
- Pose: the status loop (fe_assets_unit/anim/info/cXXX/ianim_cXXX_statusloop), at its first frame; the face from the head's own
  fAnim_<head>_Status. Clips are generic: a streamed part (keys of cubic segments), a dense part and constants, curves in the order
  of m_ClipBindingConstant's bindings (a position 3 curves, a rotation 4, a scale 3), each binding's path the CRC32 of the bone's
  path under the rig's root.
- Assembly: dress and hair pieces carry their own copy of the skeleton and bind to the rig's bones by name (the cloth and hair
  spring bones, not in the rig, follow their parents as they sit). The head and a hair model sit on the rig's c_head_loc: their root
  bone (c_root_jnt; some hair's c_hairroot_jnt) goes there times the orientation it was bound in (some hair was bound turned 90
  degrees), a hair with no bones by its prefab root. Other accessories hang from their locator by their prefab root. Bone weights
  are 16-bit fractions.
- Materials (Engage's toon shader, from the properties alone; the shader itself is compiled): _BaseMap times _BaseColor; a face
  with _Makeup has its skin painted in already (its middle is the unit's skin colour), so it isn't tinted again; other skin
  (_S_Key_StandardSkin) takes the table's SkinR/G/B, as the game sets it. Hair has no base map: _BaseColor toward
  _GradationColor by the vertex colour's green, plus _AngelRingMap on the second UV set in _AngelRingColor. Eyes flatten their
  decals (each one's red is its mask, blended toward _DecalColorN, or added for TEXn_OP_ADD). Shadow: the _ToonRamp's colour.
  Outlines: an inverted hull, _OutlineScale times the vertex colour's red, in _OutlineColor, cut through a texture's holes.
- Lights: the menu model's own (fe_assets_ui/common/unitinfo/prefabs/unitinfowindowcharamodel): a white directional light at
  intensity 1 and a (0.769, 0.692, 0.792) one at 0.5 below it, worked in linear light; that camera's post-processing is bloom
  alone (no tone mapping or grading).

Needs: pip install UnityPy numba.
"""
import io
import os
import struct
import sys
import zlib

import numpy as np
import UnityPy
from PIL import Image
from UnityPy.helpers.MeshHelper import MeshHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fe17_data as D  # noqa: E402
import fe17_raster as R  # noqa: E402
from fe17_extract import AA, merged_romfs  # noqa: E402

# ---------------------------------------------------------------------------------------------------------------------------
# Bundles

_ROMFS = None


def romfs():
    global _ROMFS
    if _ROMFS is None:
        _update, rom, files = merged_romfs()
        models = {}
        for p in files:
            rel = p[len(AA):]
            if p.endswith('.bundle') and rel.startswith(('fe_assets_unit/', 'fe_assets_item/acc/')):
                models[rel.rsplit('/', 1)[-1][:-len('.bundle')]] = rel
        common = sorted(rel for rel in models.values() if rel.startswith('fe_assets_unit/model/common/'))
        _ROMFS = (rom, files, models, common)
    return _ROMFS


def rel_of(model):
    """A model's bundle by its name ('uHead_c253': fe_assets_unit/model/uhead/c253/prefabs/uhead_c253.bundle)."""
    return romfs()[2][model.lower()]


def name_of(rel):
    return rel.rsplit('/', 1)[-1]


def load(*rels):
    """One UnityPy environment holding every bundle named, so the references between them resolve."""
    rom, files = romfs()[:2]
    env = UnityPy.Environment()
    for rel in rels:
        off, size = files[AA + rel]
        env.load_file(io.BytesIO(rom.open(off, size)), name=name_of(rel))
    return env


def objects(env, kind, only=None):
    """The environment's objects of a kind; only=a bundle's name keeps that bundle's."""
    if only is None:
        pool = env.objects
    else:
        pool = [o for sf in env.files[only].files.values() if hasattr(sf, 'objects') for o in sf.objects.values()]
    return [o for o in pool if o.type.name == kind]


# ---------------------------------------------------------------------------------------------------------------------------
# Transforms

class Node:
    def __init__(self, name, t, r, s):
        self.name, self.t, self.r, self.s = name, np.array(t, float), np.array(r, float), np.array(s, float)
        self.parent = None
        self.children = []

    def path(self, root):
        parts = []
        n = self
        while n is not None and n is not root:
            parts.append(n.name)
            n = n.parent
        return '/'.join(reversed(parts))


def hierarchy(env, only=None):
    """{path_id: Node} for every Transform (of one bundle), linked to their parents; and the roots."""
    tf = {o.path_id: o.read() for o in objects(env, 'Transform', only)}
    nodes = {}
    for pid, t in tf.items():
        p, q, s = t.m_LocalPosition, t.m_LocalRotation, t.m_LocalScale
        nodes[pid] = Node(t.m_GameObject.read().m_Name, (p.x, p.y, p.z), (q.x, q.y, q.z, q.w), (s.x, s.y, s.z))
    for pid, t in tf.items():
        if t.m_Father and t.m_Father.path_id:
            nodes[pid].parent = nodes[t.m_Father.path_id]
            nodes[t.m_Father.path_id].children.append(nodes[pid])
    return nodes, [n for n in nodes.values() if n.parent is None]


def quat_mat(q):
    x, y, z, w = q / np.linalg.norm(q)
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def trs(t, r, s):
    m = np.eye(4)
    m[:3, :3] = quat_mat(r) * s[None, :]
    m[:3, 3] = t
    return m


def world(node, local, memo):
    if id(node) in memo:
        return memo[id(node)]
    t, r, s = local.get(node, (node.t, node.r, node.s))
    m = trs(t, r, s)
    if node.parent is not None:
        m = world(node.parent, local, memo) @ m
    memo[id(node)] = m
    return m


def mat4(m):
    return np.array([[m.e00, m.e01, m.e02, m.e03], [m.e10, m.e11, m.e12, m.e13],
                     [m.e20, m.e21, m.e22, m.e23], [m.e30, m.e31, m.e32, m.e33]])


# ---------------------------------------------------------------------------------------------------------------------------
# AnimationClip (generic)

def _streamed_frames(words):
    raw = struct.pack(f'<{len(words)}I', *words)
    frames, pos = [], 0
    while pos < len(raw):
        time, n = struct.unpack_from('<fi', raw, pos)
        pos += 8
        keys = []
        for _ in range(n):
            idx, c0, c1, c2, c3 = struct.unpack_from('<i4f', raw, pos)
            pos += 20
            keys.append((idx, (c0, c1, c2, c3)))
        frames.append((time, keys))
    return frames


def _clip_values(clip, t):
    """Every curve's value at time t, in curve order: the streamed ones (each key a cubic in the time since it), the dense
    samples, the constants."""
    data = clip.m_MuscleClip.m_Clip.data
    sc = data.m_StreamedClip
    vals = [0.0] * sc.curveCount
    last = {}
    for time, keys in _streamed_frames(sc.data):
        if time <= t:
            for idx, coeff in keys:
                last[idx] = (time, coeff)
    for idx, (time, (c0, c1, c2, c3)) in last.items():
        dt = t - time if time > -1e30 else 0.0
        vals[idx] = ((c0 * dt + c1) * dt + c2) * dt + c3
    dc = data.m_DenseClip
    dense = []
    if dc.m_CurveCount:
        f = max(0, min(dc.m_FrameCount - 1, int(round((t - dc.m_BeginTime) * dc.m_SampleRate))))
        dense = list(dc.m_SampleArray[f * dc.m_CurveCount:(f + 1) * dc.m_CurveCount])
    return vals + dense + list(data.m_ConstantClip.data)


def clip_pose(clip, t, root, nodes):
    """{node: (t, r, s)} from the clip at time t, for the Transform bindings whose path hash names a node under root."""
    by_crc = {zlib.crc32(n.path(root).encode('utf-8')) & 0xFFFFFFFF: n for n in nodes}
    vals = _clip_values(clip, t)
    out, i = {}, 0
    for b in clip.m_ClipBindingConstant.genericBindings:
        size = {1: 3, 2: 4, 3: 3, 4: 3}.get(b.attribute, 1) if b.typeID == 4 else 1
        v = np.array(vals[i:i + size])
        i += size
        node = by_crc.get(b.path) if b.typeID == 4 else None
        if node is None or b.attribute not in (1, 2, 3):
            continue
        cur = list(out.get(node, (node.t.copy(), node.r.copy(), node.s.copy())))
        cur[b.attribute - 1] = v
        out[node] = tuple(cur)
    assert i == len(vals), (i, len(vals))
    return out


# ---------------------------------------------------------------------------------------------------------------------------
# The asset table

def _matches(cond, keys):
    for part in cond.split(';'):
        part = part.strip()
        if not part:
            continue
        neg = part.startswith('!')
        hit = any(a.strip().lstrip('!') in keys for a in part.lstrip('!').split('|') if a.strip())
        if hit == neg:
            return False
    return True


_TABLE = None


def resolve(keys):
    """The asset table's fields for a context (Mode 2 and Mode 0 rows, in order), and the accessories by attach point."""
    global _TABLE
    if _TABLE is None:
        _TABLE = [r for r in D.rows('assettable') if r.get('Conditions')]
    spec, acc = {}, {}
    for r in _TABLE:
        if (r.get('Mode') or '0') not in ('2', '0') or not _matches(r['Conditions'], keys):
            continue
        for k, v in r.items():
            if k in ('Out', 'PresetName', 'Mode', 'Conditions', 'Comment') or v == '' or k.startswith('Acc'):
                continue
            if v == '0' and k[:4] in ('Mask', 'Hair', 'Grad', 'Skin', 'Toon', 'Scal', 'Volu', 'MapS'):
                continue  # a colour or scale of 0 is "not set"
            spec[k] = v
        for n in range(1, 9):
            loc, model = r.get(f'Acc{n}.Locator', ''), r.get(f'Acc{n}.Model', '')
            if loc and model:
                if model == 'null':
                    acc.pop(loc, None)
                else:
                    acc[loc] = model
    return spec, acc


def unit_spec(person, gender=None):
    """A person on the info screen: their Name label, Pid, class, 男装 or 女装 by Gender (gender='2' for the other Alear) and 情報."""
    female = (gender or person.get('Gender')) == '2'
    return resolve({person['Name'], person['Pid'], person['Jid'], '女装' if female else '男装', '情報'})


def emblem_spec(god):
    """An Emblem (a god.xml row) on the info screen: its Gid, 男装 or 女装 by its Female flag, and 情報."""
    return resolve({god['Gid'], '女装' if god.get('Female') == '1' else '男装', '情報'})


# ---------------------------------------------------------------------------------------------------------------------------
# Meshes

ROOT_BONES = ('c_root_jnt', 'c_hairroot_jnt')


def _mesh_arrays(mesh):
    """Positions, normals, both UV sets and vertex colours, read by the vertex count (a channel may hold 2, 3 or 4 numbers a
    vertex: some positions 4, some colours 3)."""
    h = MeshHandler(mesh)
    h.process()
    n = h.m_VertexCount

    def chan(values, want, fill):
        if values is None:
            return None
        a = np.array(values, float).reshape(n, -1)
        if a.shape[1] < want:
            a = np.concatenate([a, np.full((n, want - a.shape[1]), fill)], axis=1)
        return a[:, :want]

    V = chan(h.m_Vertices, 3, 0.0)
    N = chan(h.m_Normals, 3, 0.0)
    UV = chan(h.m_UV0, 2, 0.0)
    UV1 = chan(h.m_UV1, 2, 0.0)
    C = chan(h.m_Colors, 4, 255.0)
    return (h, V, N if N is not None else np.tile([0, 0, 1.0], (n, 1)), UV if UV is not None else np.zeros((n, 2)),
            UV1 if UV1 is not None else UV, C / 255.0 if C is not None else None)


def _prefab_draws(env, rel, rig_w, attach=None, face_clip=None):
    """A prefab's meshes, posed: skinned ones bound to the rig by bone name, plain ones placed by their GameObject; nodes named in
    attach put there."""
    only = name_of(rel)
    nodes, roots = hierarchy(env, only)
    attach = dict(attach or {})
    smrs = [o.read() for o in objects(env, 'SkinnedMeshRenderer', only)]
    for root_bone in [b for b in ROOT_BONES if b in attach]:
        for smr in smrs:
            names = [nodes[b.path_id].name for b in smr.m_Bones]
            if smr.m_Mesh.path_id and root_bone in names:
                attach[root_bone] = attach[root_bone] @ np.linalg.inv(mat4(smr.m_Mesh.read().m_BindPose[names.index(root_bone)]))
                break
    local = {}
    if face_clip:
        clips = {c.m_Name: c for c in (o.read() for o in objects(env, 'AnimationClip', only))}
        clip = next((clips[c] for c in face_clip if c in clips), None)
        if clip is not None:
            local = clip_pose(clip, 0.0, roots[0], nodes.values())
    memo = {}

    def bw(n):
        if id(n) not in memo:
            if n.name in attach:
                m = attach[n.name]
            elif n.name in rig_w:
                m = rig_w[n.name]
            elif n.parent is not None:
                m = bw(n.parent) @ trs(*local.get(n, (n.t, n.r, n.s)))
            else:
                m = trs(n.t, n.r, n.s)
            memo[id(n)] = m
        return memo[id(n)]

    draws = []
    for smr in smrs:
        if not smr.m_Mesh.path_id or not smr.m_Bones:
            continue
        mesh = smr.m_Mesh.read()
        if mesh.m_Name.startswith('ShadowMesh'):
            continue
        h, V, N, UV, UV1, C = _mesh_arrays(mesh)
        if h.m_BoneWeights is None or h.m_BoneIndices is None:
            BI, BW = np.zeros((len(V), 1), np.int64), np.ones((len(V), 1))
        else:
            BI = np.array(h.m_BoneIndices, np.int64).reshape(len(V), -1)[:, :4]
            BW = np.array(h.m_BoneWeights, float).reshape(len(V), -1)[:, :4]
            BW = BW / np.maximum(BW.sum(axis=1, keepdims=True), 1e-9)  # stored as 16-bit fractions
        M = np.stack([bw(nodes[b.path_id]) @ mat4(mesh.m_BindPose[i]) for i, b in enumerate(smr.m_Bones)])
        P, NN = np.zeros_like(V), np.zeros_like(N)
        for k in range(BI.shape[1]):
            Mk = M[BI[:, k]]
            P += BW[:, k, None] * (np.einsum('nij,nj->ni', Mk[:, :3, :3], V) + Mk[:, :3, 3])
            NN += BW[:, k, None] * np.einsum('nij,nj->ni', Mk[:, :3, :3], N)
        _add(draws, mesh, h, P, NN, UV, UV1, C, smr.m_Materials, rel)
    filters = {f.m_GameObject.path_id: f for f in (o.read() for o in objects(env, 'MeshFilter', only))}
    by_go = {o.read().m_GameObject.path_id: nodes[o.path_id] for o in objects(env, 'Transform', only)}
    for mr in (o.read() for o in objects(env, 'MeshRenderer', only)):
        mf = filters.get(mr.m_GameObject.path_id)
        if mf is None or not mf.m_Mesh.path_id:
            continue
        mesh = mf.m_Mesh.read()
        if mesh.m_Name.startswith('ShadowMesh'):
            continue
        h, V, N, UV, UV1, C = _mesh_arrays(mesh)
        W = bw(by_go[mr.m_GameObject.path_id])
        _add(draws, mesh, h, V @ W[:3, :3].T + W[:3, 3], N @ np.linalg.inv(W[:3, :3]), UV, UV1, C, mr.m_Materials, rel)
    return draws


def _add(draws, mesh, h, P, N, UV, UV1, C, mats, rel):
    mats = [m.read() for m in mats if m.path_id]
    if not mats:
        return
    N = N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    for si, tris in enumerate(h.get_triangles()):
        draws.append({'name': mesh.m_Name, 'P': P, 'N': N, 'UV': UV, 'UV1': UV1, 'C': C, 'src': rel,
                      'T': np.array(tris, np.int64).reshape(-1, 3), 'mat': mats[min(si, len(mats) - 1)]})


def assemble(spec, acc):
    """A unit's meshes posed at the first frame of their status loop, and the rig's bone matrices."""
    cid = spec['InfoAnim'].rsplit('_', 1)[-1]
    clip = next(o.read() for o in objects(load(rel_of(f'ianim_{cid}_statusloop')), 'AnimationClip'))
    rig_nodes, rig_roots = hierarchy(load(rel_of(spec['BodyModel'])))
    pose = clip_pose(clip, 0.0, rig_roots[0], rig_nodes.values())
    memo = {}
    rig_w = {n.name: world(n, pose, memo) for n in rig_nodes.values()}
    dress, head = rel_of(spec['DressModel']), rel_of(spec['HeadModel'])
    hair = rel_of(spec['HairModel']) if spec.get('HairModel', 'uHair_null') != 'uHair_null' else None
    accs = {loc: rel_of(m) for loc, m in acc.items()}
    env = load(dress, head, *([hair] if hair else []), *accs.values(), *romfs()[3])

    def root_of(rel):
        return hierarchy(env, name_of(rel))[1][0].name

    def on_head(rel):
        return {b: rig_w['c_head_loc'] for b in (*ROOT_BONES, root_of(rel))}

    head_id = spec['HeadModel'].split('_', 1)[1]
    draws = _prefab_draws(env, dress, rig_w)
    draws += _prefab_draws(env, head, rig_w, on_head(head),
                           face_clip=(f'fAnim_{head_id}_Status', f'fAnim_{head_id[:4]}_Status', 'fAnim_c000_Status'))
    if hair:
        draws += _prefab_draws(env, hair, rig_w, on_head(hair))
    for loc, rel in accs.items():
        draws += _prefab_draws(env, rel, rig_w, {root_of(rel): rig_w[loc]})
    skin = np.array([int(spec.get(f'Skin{c}', 0)) for c in 'RGB']) / 255.0
    for d in draws:
        d['skin'] = skin if skin.any() else None
    return draws, rig_w


# ---------------------------------------------------------------------------------------------------------------------------
# Materials

_TEX = {}


def texture(mat, prop='_BaseMap'):
    for name, env in mat.m_SavedProperties.m_TexEnvs:
        if name == prop and env.m_Texture and env.m_Texture.path_id:
            tex = env.m_Texture.read()
            key = (tex.m_Name, tex.m_Width, tex.m_Height)
            if key not in _TEX:
                _TEX[key] = np.asarray(tex.image.convert('RGBA'), np.float64) / 255.0
            return _TEX[key]
    return None


def color(mat, prop, default=(1, 1, 1, 1)):
    for name, c in mat.m_SavedProperties.m_Colors:
        if name == prop:
            return np.array([c.r, c.g, c.b, c.a])
    return np.array(default, float)


def number(mat, prop, default=0.0):
    return next((v for name, v in mat.m_SavedProperties.m_Floats if name == prop), default)


def keywords(mat):
    kw = getattr(mat, 'm_ValidKeywords', None) or getattr(mat, 'm_ShaderKeywords', '') or ''
    return set(kw if isinstance(kw, list) else kw.split())


def shadow_tint(mat):
    ramp = texture(mat, '_ToonRamp')
    return ramp[0, 2, :3] if ramp is not None else np.array([0.8, 0.76, 0.82])


def eye_texture(mat):
    base = texture(mat, '_BaseMap')
    out = base.copy()
    out[..., :3] *= color(mat, '_BaseColor')[:3]
    alpha = base[..., 3].copy()
    kw = keywords(mat)
    for k in (1, 3, 2, 4):  # iris shading, pupil, highlights, sparkles
        d = texture(mat, f'_DecalTex{k}')
        if d is None or f'TEX{k}_OP_NONE' in kw:
            continue
        m = (d[..., 0] * d[..., 3])[..., None]
        c = color(mat, f'_DecalColor{k}')[:3]
        out[..., :3] = out[..., :3] + c * m if f'TEX{k}_OP_ADD' in kw else out[..., :3] * (1 - m) + c * m
        alpha = np.maximum(alpha, m[..., 0])
    out[..., 3] = alpha
    return np.clip(out, 0, 1)


# ---------------------------------------------------------------------------------------------------------------------------
# Rendering

class Camera:
    """At +Z looking back toward -Z, as the menu's camera looks at the unit: x to the viewer's right is -X."""

    def __init__(self, target, distance, fov, size):
        self.W, self.H = size
        self.cam = np.array([target[0], target[1], target[2] + distance])
        self.focal = (self.H / 2) / np.tan(np.radians(fov) / 2)

    def project(self, P):
        xv, yv, zv = -(P[:, 0] - self.cam[0]), P[:, 1] - self.cam[1], self.cam[2] - P[:, 2]
        return self.W / 2 + xv / zv * self.focal, self.H / 2 - yv / zv * self.focal, zv, 1.0 / zv


def _view(N):
    return np.ascontiguousarray(np.stack([-N[:, 0], N[:, 1], -N[:, 2]], axis=1))


# The menu model's lights, toward each in view space (x right, y up, z away from the camera): the white key shines along
# (0.777, -0.423, -0.467), the fill along (-0.314, 0.795, -0.52).
LIGHT = np.array([0.777, 0.423, -0.467])
FILL = np.array([-0.314, -0.795, -0.52])
FILL_COL = np.array([0.769, 0.692, 0.792]) ** 2.2 * 0.5
_EMPTY = np.zeros((1, 1, 4))
_FACE = ('Face_', 'Eye_', 'EyeLash_', 'Mucous_', 'EyeHL_', 'EyeBrow_')


def _is_hair(d):
    return texture(d['mat'], '_BaseMap') is None and texture(d['mat'], '_AngelRingMap') is not None


def render(draws, cam, outline=0.0016):
    buf = np.zeros((cam.H, cam.W, 4))
    depth = np.full((cam.H, cam.W), np.inf)

    def one(d, depth_buf, out):
        mat = d['mat']
        if texture(mat, '_DecalTex1') is not None:
            tex, vcol = eye_texture(mat), np.ones((len(d['P']), 3))
        else:
            tex = texture(mat)
            if number(mat, '_Makeup'):
                base = np.ones(3)
            elif d['skin'] is not None and number(mat, '_S_Key_StandardSkin'):
                base = d['skin']
            else:
                base = color(mat, '_BaseColor')[:3]
            vcol = np.tile(base, (len(d['P']), 1))
            if tex is None and d['C'] is not None and any(n == '_GradationColor' for n, _ in mat.m_SavedProperties.m_Colors):
                g = d['C'][:, 1:2]
                vcol = base * (1 - g) + color(mat, '_GradationColor')[:3] * g
        sx, sy, sz, sw = cam.project(d['P'])
        nv = _view(d['N'])
        cutoff = 0.5 if mat.m_Name in ('MtEye', 'MtHLEye', 'MtHair_Brow', 'MtColor') else 0.35
        mode, uv, add = 0, d['UV'], np.zeros(3)
        if _is_hair(d):
            tex, mode, uv, add = texture(mat, '_AngelRingMap'), 2, d['UV1'], color(mat, '_AngelRingColor')[:3] * 0.55
        R.draw(out, depth_buf, sx, sy, sz, sw, uv, nv, np.ascontiguousarray(vcol), d['T'], tex if tex is not None else _EMPTY,
               LIGHT, shadow_tint(mat), cutoff, mode, 0, d['name'].startswith(_FACE), add, FILL, FILL_COL)
        scale = number(mat, '_OutlineScale')
        if outline and scale > 0 and not number(mat, '_DisableOutline') and not d['name'].startswith(('Eye', 'Mucous')):
            width = d['C'][:, 0:1] if d['C'] is not None else 0.4
            sx, sy, sz, sw = cam.project(d['P'] + d['N'] * outline * scale * width)
            oc = np.tile(color(mat, '_OutlineColor')[:3], (len(d['P']), 1))
            R.draw(out, depth_buf, sx, sy, sz, sw, d['UV'], nv, np.ascontiguousarray(oc), d['T'],
                   tex if tex is not None and mode == 0 else _EMPTY, LIGHT, np.ones(3), cutoff, 1, -1, True, np.zeros(3),
                   FILL, np.zeros(3))

    before_hair = None
    for d in sorted(draws, key=lambda d: (_is_hair(d), d['name'].startswith('EyeBrow'), d['mat'].m_Name == 'MtHLEye')):
        if _is_hair(d) and before_hair is None:
            before_hair = depth.copy()
        if d['name'].startswith('EyeBrow'):
            # Brows show through the bangs, as the game draws them: tested against the depth from before the hair.
            layer = np.zeros_like(buf)
            one(d, (before_hair if before_hair is not None else depth).copy(), layer)
            a = layer[..., 3:4] * 0.85
            buf[..., :3] = buf[..., :3] * (1 - a) + layer[..., :3] * a
            continue
        one(d, depth, buf)
    return buf


def _square(draws, rig_w, bottom, size, supersample, fov):
    """A square from bottom to above the head's top (hair and hats included), the camera level with its middle."""
    heads = np.concatenate([d['P'] for d in draws if any(k in d['src'] for k in ('/uhead/', '/uhair/', '/head/', '/hair'))])
    top = heads[:, 1].max()
    head = rig_w['c_head_loc'][:3, 3]
    side = (top - bottom) * 1.06
    cam = Camera((head[0], bottom + side / 2 - 0.01, head[2]), (side / 2) / np.tan(np.radians(fov) / 2), fov,
                 (size * supersample, size * supersample))
    buf = render(draws, cam)
    img = Image.fromarray((np.clip(buf, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')
    return img.resize((size, size), Image.LANCZOS)


def waist_up(draws, rig_w, size=384, supersample=3, fov=16.0):
    """From the hips' joint to above the head: the units' portraits."""
    return _square(draws, rig_w, rig_w['c_hip_jnt'][1, 3] + 0.03, size, supersample, fov)


def bust(draws, rig_w, size=388, supersample=3, fov=16.0):
    """From the upper chest to above the head, as the ring book frames the Emblems."""
    return _square(draws, rig_w, rig_w['c_spine2_jnt'][1, 3] + 0.02, size, supersample, fov)
