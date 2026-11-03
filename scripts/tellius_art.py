"""
Make Path of Radiance's and Radiant Dawn's portraits and skill icons from the user's own discs, ready for the app's Bulk Upload
(Edit Mode -> Bulk Upload -> the game -> select the folder). The images are the user's and stay on their machine: the output goes
to data-raw/<game>/art/, which is git-ignored, and nothing here is ever committed.

Portraits: PersonData's FID (Path of Radiance +0x0C, Radiant Dawn +16) names a record in Face/facedata.bin, which names the
face file (an LZ10-compressed TPL, scripts/gc_texture.py) and where its eyes and mouth go. The status screen's bust (192x128)
has holes there; the game draws an eye frame over each and a mouth frame over the mouth. Here: both eyes open (each eye's
first frame) and the mouth closed (the third frame of the first set: open, half, closed). The bust is then cut to a 128x128
square, its full height, centred on the face, and scaled up to 256x256. Laguz get their PersonData face, the untransformed one.

Skill icons: window/icon.tpl (Path of Radiance) or window/icon.cms (Radiant Dawn), the second texture: 32x32 icons in rows of
32. A skill's icon byte (the SID_ table's +0x19 in Path of Radiance, +31 in Radiant Dawn) is the icon's place plus one; 0 means
none (Radiant Dawn's "skill learned" message, 0x80031b64, puts byte 31 - 1 in its icon code).

The file names are the app's (artId in src/tellius/logic.ts): the unit's or skill's name in the app, lowercased, every run of
other characters turned into "_". The names are read from the generated src/data/fe9/fe9Units.ts and fe10/fe10Units.ts.

Run: python scripts/tellius_art.py [fe9] [fe10]   (both when none is named)
     --out <folder>     write <folder>/<game>/... instead of data-raw/<game>/art
     --contact <folder> also write a labelled contact sheet per game there (default: data-raw/<game>/contact_sheet.png)
"""
import os
import re
import struct
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fe9_files import FE9, lz10  # noqa: E402
from fe10_files import FE10  # noqa: E402
from gc_texture import read_tpl  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SIZE = 256  # the saved portraits' size
BUST_W, BUST_H = 192, 128  # the status screen's bust
CLOSED_MOUTH = 2  # the mouth frames: open, half, closed, then the same again (another expression)
OPEN_EYE = 0  # each eye's frames: open, half, closed

GAMES = {
    'fe9': {'root': FE9, 'units_ts': os.path.join(ROOT, 'src', 'data', 'fe9', 'fe9Units.ts'), 'units': 'FE9_UNITS',
            'skills': 'FE9_SKILLS', 'icons': ('window', 'icon.tpl')},
    'fe10': {'root': FE10, 'units_ts': os.path.join(ROOT, 'src', 'data', 'fe10', 'fe10Units.ts'), 'units': 'FE10_UNITS',
             'skills': 'FE10_SKILLS', 'icons': ('window', 'icon.cms')},
}


def art_id(name):
    """The app's file stem for a name (artId in src/tellius/logic.ts, less the game prefix)."""
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


def app_names(game):
    """The units and skills the app lists, from its generated data: ([(PID, name)], [(SID, name)])."""
    g = GAMES[game]
    src = open(g['units_ts'], encoding='utf-8').read()

    def block(const):
        start = src.index(f'export const {const}')
        end = src.find('\nexport const ', start + 1)
        return src[start:end if end > 0 else len(src)]
    units = re.findall(r'^\s*\{"id": "(PID_[A-Za-z0-9_]+)", "name": "([^"]*)"', block(g['units']), re.M)
    skills = re.findall(r'"(SID_[A-Za-z0-9_]+)": \{"id": "SID_[A-Za-z0-9_]+", "name": "([^"]*)"', block(g['skills']))
    return units, skills


def read_file(path):
    d = open(path, 'rb').read()
    return lz10(d) if d[0] == 0x10 else d


def relocated(d):
    """The pointer-relocated layout (facedata.bin, FE8Data.bin): data at 0x20, then the offsets of the words that are
    pointers. -> (u32 reader over the data, set of pointer offsets, string reader)."""
    _, size, n_ptrs, _ = struct.unpack_from('>4I', d, 0)
    ptrs = set(struct.unpack_from(f'>{n_ptrs}I', d, 0x20 + size))

    def u32(off):
        return struct.unpack_from('>I', d, 0x20 + off)[0]

    def string(off):
        """The string the pointer at data offset off names, or None."""
        if off not in ptrs:
            return None
        o = 0x20 + u32(off)
        return d[o:d.index(b'\0', o)].decode('shift_jis')
    return u32, ptrs, string


def face_records(game):
    """Face/facedata.bin: a count and a pointer to the records. Path of Radiance's are 32 bytes: FID, MPID, the file, then
    ten 16-bit numbers (eye 1 x, y; eye 2 x, y; mouth x, y; ...: the frames' top-left corners in the bust). Radiant Dawn's are 48 bytes: FID, FID_L_, MPID, the
    file, then sixteen (eye 1, eye 2, mouth, then where the 192x128 bust sits in the big portrait, ...). Missing eyes or
    a missing mouth are -1. {FID: dict}."""
    d = open(os.path.join(GAMES[game]['root'], 'Face', 'facedata.bin'), 'rb').read()
    u32, ptrs, string = relocated(d)
    count, at = u32(0), u32(4)
    size, n_str = (0x30, 4) if game == 'fe10' else (0x20, 3)
    out = {}
    for k in range(count):
        o = at + k * size
        strings = [string(o + 4 * j) for j in range(n_str)]
        nums = struct.unpack_from('>%dh' % ((size - 4 * n_str) // 2), d, 0x20 + o + 4 * n_str)
        rec = {'fid': strings[0], 'file': strings[-1], 'eye1': nums[0:2], 'eye2': nums[2:4], 'mouth': nums[4:6],
               'bust': tuple(nums[6:8]) if game == 'fe10' else (0, 0)}
        out[rec['fid']] = rec
    return out


def person_faces(game):
    """PersonData's FID for every PID. {PID: FID}."""
    if game == 'fe9':
        import fe9_units
        t = fe9_units.Tables()
        o = t.named['PersonData']
        return {t.ptr_string(o + 4 + k * 84): t.ptr_string(o + 4 + k * 84 + 0x0C) for k in range(t.u32(o))}
    import fe10_units
    t = fe10_units.Tables()
    o = t.named['PersonData']
    p = o + 4
    out = {}
    for _ in range(t.u32(o)):
        n_skills = t.raw(p, 1)[0]
        out[t.ptr_string(p + 4)] = t.ptr_string(p + 16)
        p += 32 + 4 * n_skills + 20 + 28  # see fe10_units.people()
    assert p == t.named['JobData'], 'PersonData should end where JobData starts'
    return out


def skill_icons(game):
    """Each skill's icon byte (0: none). {SID: icon}."""
    if game == 'fe9':
        import fe9_units
        t = fe9_units.Tables()
        return {n: t.raw(o, 40)[0x19] for n, o in t.named.items() if n.startswith('SID_')}
    import fe10_units
    t = fe10_units.Tables()
    return {n: t.raw(o, 44)[31] for n, o in t.named.items() if n.startswith('SID_')}


def over(base, frame, x, y):
    """Draw frame over base (RGBA arrays) with its top-left at (x, y), as the game draws an eye or a mouth."""
    assert x >= 0 and y >= 0, (x, y)
    h, w = frame.shape[:2]
    dst = base[y:y + h, x:x + w].astype(np.float32)
    src = frame[:dst.shape[0], :dst.shape[1]].astype(np.float32)
    a = src[..., 3:4] / 255
    out_a = a + dst[..., 3:4] / 255 * (1 - a)
    rgb = (src[..., :3] * a + dst[..., :3] * (dst[..., 3:4] / 255) * (1 - a)) / np.maximum(out_a, 1e-6)
    base[y:y + h, x:x + w, :3] = np.round(rgb).astype(np.uint8)
    base[y:y + h, x:x + w, 3] = np.round(out_a[..., 0] * 255).astype(np.uint8)


def portrait(game, rec):
    """The status screen's bust with the eyes open and the mouth closed, cut to a square centred on the face. -> (RGBA
    array 128x128, notes)."""
    imgs = read_tpl(read_file(os.path.join(GAMES[game]['root'], 'Face', rec['file'])))
    has_eyes, has_mouth = rec['eye1'][0] >= 0, rec['mouth'][0] >= 0
    # Path of Radiance: the bust, then the frames, then the 64x64 face for the map and lists. Radiant Dawn: the bust, the
    # big conversation portrait it's cut from, the frames, the small face. Radiant Dawn's positions are the big portrait's;
    # the bust sits at rec['bust'] in it (the same pixels, but a winged laguz's bust leaves the wings out).
    first = 1 if game == 'fe9' else 2
    expected = first + 6 * has_mouth + 6 * has_eyes + 1
    assert len(imgs) == expected, f"{rec['file']}: {len(imgs)} textures, expected {expected}"
    assert (imgs[0]['w'], imgs[0]['h']) == (BUST_W, BUST_H), rec['file']
    frames = imgs[first:first + 6 * has_mouth + 6 * has_eyes]
    mouths, eyes = (frames[:6], frames[6:]) if has_mouth else ([], frames)
    canvas, (bx, by) = imgs[0]['rgba'].copy(), rec['bust']

    def at(key):
        return rec[key][0] - bx, rec[key][1] - by
    centres, rects = [], []
    if has_eyes:
        e1, e2 = eyes[OPEN_EYE]['rgba'], eyes[3 + OPEN_EYE]['rgba']
        over(canvas, e1, *at('eye1'))
        over(canvas, e2, *at('eye2'))
        rects += [(*at('eye1'), e1), (*at('eye2'), e2)]
        centres.append((at('eye1')[0] + e1.shape[1] / 2 + at('eye2')[0] + e2.shape[1] / 2) / 2)
    if has_mouth:
        m = mouths[CLOSED_MOUTH]['rgba']
        over(canvas, m, *at('mouth'))
        rects.append((*at('mouth'), m))
        centres.append(at('mouth')[0] + m.shape[1] / 2)
    notes = []
    # Each frame should fill its hole. A few pixels under a frame can stay transparent where the art has a gap of its own
    # (background between the chin and the hair: Path of Radiance's Calill, Titania, Ranulf); a frame in the wrong place
    # would leave most of it open.
    from scipy import ndimage
    opaque = canvas[..., 3] > 0
    holes = ndimage.binary_fill_holes(opaque) & ~opaque
    for x, y, f in rects:
        left_open = int(holes[y:y + f.shape[0], x:x + f.shape[1]].sum())
        if left_open > f.shape[0] * f.shape[1] // 4:
            notes.append(f'{left_open} pixels left open under the {f.shape[1]}x{f.shape[0]} frame at ({x}, {y})')
    bust = canvas
    fx = np.mean(centres) if centres else BUST_W / 2
    left = int(round(min(max(fx - BUST_H / 2, 0), BUST_W - BUST_H)))
    return bust[:, left:left + BUST_H].copy(), notes


def scale(rgba, size):
    """Resize an RGBA array with Lanczos, premultiplied so the transparent pixels' colour doesn't bleed in."""
    im = Image.fromarray(rgba, 'RGBA').convert('RGBa').resize((size, size), Image.LANCZOS)
    return im.convert('RGBA')


def icon_sheet(game):
    folder, name = GAMES[game]['icons']
    return read_tpl(read_file(os.path.join(GAMES[game]['root'], folder, name)))[1]['rgba']


def contact_sheet(entries, path, title):
    """entries: [(label, PIL image)] -> a labelled grid on a mid-grey background."""
    font = ImageFont.load_default()
    cell, pad, cols = 132, 18, 8
    rows = (len(entries) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cell, rows * (cell + pad) + 20), (96, 104, 112, 255))
    d = ImageDraw.Draw(sheet)
    d.text((4, 4), title, fill=(255, 255, 255, 255), font=font)
    for k, (label, im) in enumerate(entries):
        x, y = (k % cols) * cell, 20 + (k // cols) * (cell + pad)
        thumb = im.copy()
        if thumb.width > 128:
            thumb = thumb.resize((128, 128), Image.LANCZOS)
        sheet.alpha_composite(thumb, (x + 2 + (128 - thumb.width) // 2, y + 2 + (128 - thumb.height) // 2))
        d.text((x + 2, y + cell), label[:21], fill=(255, 255, 255, 255), font=font)
    sheet.save(path)


def build(game, out_dir, contact_path):
    units, skills = app_names(game)
    faces, records = person_faces(game), face_records(game)
    icons, sheet = skill_icons(game), icon_sheet(game)
    os.makedirs(os.path.join(out_dir, 'skills'), exist_ok=True)
    made, missing, notes = [], [], []
    portraits, icon_entries = [], []
    for pid, name in units:
        stem = art_id(name)
        rec = records.get(faces.get(pid))
        if not rec:
            missing.append(f'{stem}.png ({name}: {pid} has no face record, FID {faces.get(pid)})')
            continue
        bust, warn = portrait(game, rec)
        notes += [f"{stem}.png ({rec['file']}): {w}" for w in warn]
        im = scale(bust, SIZE)
        im.save(os.path.join(out_dir, f'{stem}.png'))
        made.append(f'{stem}.png')
        portraits.append((f"{name} ({rec['file'][:-4]})", im))
    for sid, name in skills:
        stem = art_id(name)
        icon = icons.get(sid, 0)
        if not icon:
            missing.append(f'skills/{stem}.png ({name}: {sid} has no icon in the game)')
            continue
        cell = icon - 1
        x, y = (cell % 32) * 32, (cell // 32) * 32
        assert y + 32 <= sheet.shape[0], f'{sid}: icon {icon} is past the sheet'
        im = Image.fromarray(sheet[y:y + 32, x:x + 32].copy(), 'RGBA')
        im.save(os.path.join(out_dir, 'skills', f'{stem}.png'))
        made.append(f'skills/{stem}.png')
        icon_entries.append((f'{name} ({icon})', im.resize((96, 96), Image.NEAREST)))
    if contact_path:
        contact_sheet(portraits + icon_entries, contact_path, f'{game}: {len(portraits)} portraits, {len(icon_entries)} icons')
    return made, missing, notes


def main(argv):
    games = [a for a in argv if a in GAMES] or list(GAMES)
    out_root = argv[argv.index('--out') + 1] if '--out' in argv else None
    contact_root = argv[argv.index('--contact') + 1] if '--contact' in argv else None
    for game in games:
        out_dir = os.path.join(out_root, game) if out_root else os.path.join(ROOT, 'data-raw', game, 'art')
        contact = os.path.join(contact_root, f'{game}_contact_sheet.png') if contact_root else \
            os.path.join(ROOT, 'data-raw', game, 'contact_sheet.png')
        made, missing, notes = build(game, out_dir, contact)
        n_icons = sum(m.startswith('skills/') for m in made)
        print(f'{game}: {len(made) - n_icons} portraits and {n_icons} skill icons in {os.path.normpath(out_dir)}')
        print(f'  contact sheet: {os.path.normpath(contact)}')
        for m in missing:
            print('  not made:', m)
        for n in notes:
            print('  check:', n)


if __name__ == '__main__':
    main(sys.argv[1:])
