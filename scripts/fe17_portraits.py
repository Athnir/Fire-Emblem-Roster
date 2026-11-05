"""
Make Fire Emblem Engage's portraits from the user's own dump, ready for the app's Bulk Upload (Edit Mode -> Bulk Upload ->
Engage -> select the folder). The images are the user's and stay on their machine: the output goes to data-raw/fe17/art/, which is
git-ignored, and nothing here is ever committed.

Engage draws its units in 3D on the status and inventory screens; by default each portrait is that model, waist up
(scripts/fe17_models.py: the unit's pieces from the asset table, posed at the first frame of their status loop, lit by the menu
model's own lights), a 384x384 square from the hips to above the head (the user asked for waist up, 2026-11-04). Alear's person
record is male (Gender 1); the female Alear (the 女装 models) is written too, as alear_female.png: the female Alear's portrait (a unit
of her own, beside the male Alear).

--level-up writes the hand-drawn 2D art instead, the only 2D art every unit has, which ends at the neck: the face shown when a
unit levels up, the Addressables key Telop/LevelUp/FaceThumb/<name>, the bundle fe_assets_telop/levelup/facethumb/<name>.bundle,
one Texture2D (640x340, ASTC 4x4, Tegra block-linear swizzled; UnityPy and texture2ddecoder decode it). <name> is the person's
Name label less "MPID_" (person.xml), which the catalog's keys match for every playable person (Rafal: MPID_Rafale, though his
UnitIconID is 049Il); the female Alear's is LueurW (alear_female.png). Each is cropped to a square around the face (its full
height, centred on the opaque pixels' middle) and scaled to 256x256 (Lanczos, on premultiplied alpha so the edges keep no dark
fringe).

The file name is the app's (src/tellius/logic.ts, artId): the English name with its accents dropped, lower-cased, each run of
anything but a-z and 0-9 as one "_" (Céline -> celine.png).

Each Bond Ring's face goes in rings/, named the same way after the ring (Black Knight -> rings/black_knight.png): the Ring Chamber's
faces, fe_assets_ui/hub/godroom/face/face.bundle, one SpriteAtlas with a Sprite per hero named by ring.xml's Icon (Seeda: Caeda).
Each Sprite is 300x300, but the atlas keeps only its opaque part (textureRect, placed at textureRectOffset from the bottom left), so
it's put back on its 300x300 before it's scaled to 128x128, as the face shows small beside the ring's stats.

Each Emblem's face goes in emblems/, named after the Emblem (Sigurd -> emblems/sigurd.png): the ring book's,
fe_assets_ui/hub/ringbook/godface/godface.bundle, one SpriteAtlas with a Sprite per Emblem named by god.xml's AsciiName (Siglud,
Kamui, Reflet; Lueur and LueurW for the two Alears: alear.png, alear_female.png), 388x388 and trimmed the same way, scaled to
192x192. Ephraim has none in the ring book (he shows on his own in the Night and Day switch and engaged), so his is drawn from his
Emblem model as the ring book frames them (fe17_models.bust: uRig_GodM1, uBody_Eph0AM_c536, his status loop), its colours deepened a
little (gamma 1.18) and given the ring book's blue glow.

Each skill's icon goes in skills/, named after the skill with each "+" as "plus" (Lunar Brace+ -> skills/lunar_brace_plus.png, apart
from Lunar Brace): the skill atlas,
fe_assets_ui/icon/skill/skill.bundle (one SpriteAtlas, 516 Sprites of 56x56). A skill's sprite is skill.xml's IconLabel, or with
none its Sid less "SID_" (IconKind 1 is an effectiveness icon from another atlas, none of the app's); every skill the app lists
(named, described, not hidden: the same as build-fe17-units.py) has one.

Run: python scripts/fe17_portraits.py [out folder] [--sheet sheet.png] [--level-up]
Needs: pip install UnityPy numba (UnityPy brings texture2ddecoder).
"""
import io
import os
import re
import sys
import unicodedata

import numpy as np
import UnityPy
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fe17_data as D  # noqa: E402
import fe17_units as U  # noqa: E402
import fe17_models as M  # noqa: E402
from fe17_extract import AA  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'data-raw', 'fe17', 'art')
FOLDER = AA + 'fe_assets_telop/levelup/facethumb/'
RING_FACES = AA + 'fe_assets_ui/hub/godroom/face/face.bundle'
SIZE = 256
RING_SIZE = 128
EMBLEM_FACES = AA + 'fe_assets_ui/hub/ringbook/godface/godface.bundle'
EMBLEM_SIZE = 192
SKILL_ICONS = AA + 'fe_assets_ui/icon/skill/skill.bundle'


def art_id(name):
    """src/tellius/logic.ts artId: accents dropped (NFD, less U+0300-U+036F), lower case, runs of anything but a-z0-9 as '_',
    trimmed."""
    plain = re.sub('[\u0300-\u036f]', '', unicodedata.normalize('NFD', name))
    return re.sub(r'[^a-z0-9]+', '_', plain.lower()).strip('_')


def texture(bundle):
    env = UnityPy.load(bundle)
    found = [o.read() for o in env.objects if o.type.name == 'Texture2D']
    assert len(found) == 1, len(found)
    return found[0].image.convert('RGBA')


def premultiplied_resize(im, size):
    a = np.asarray(im, dtype=np.float32) / 255.0
    rgb = a[..., :3] * a[..., 3:4]
    planes = [Image.fromarray(rgb[..., k], 'F').resize(size, Image.LANCZOS) for k in range(3)]
    alpha = Image.fromarray(a[..., 3], 'F').resize(size, Image.LANCZOS)
    al = np.clip(np.asarray(alpha), 0, 1)
    out = np.zeros((size[1], size[0], 4), np.float32)
    for k in range(3):
        out[..., k] = np.where(al > 1e-4, np.asarray(planes[k]) / np.maximum(al, 1e-4), 0)
    out[..., 3] = al
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')


def square_bust(im):
    """A square of the image's full height, centred on the middle of its opaque columns."""
    w, h = im.size
    alpha = np.asarray(im)[..., 3]
    cols = np.nonzero(alpha.max(axis=0) > 16)[0]
    mid = (cols[0] + cols[-1]) / 2 if len(cols) else w / 2
    side = min(w, h)
    left = int(round(min(max(mid - side / 2, 0), w - side)))
    return im.crop((left, 0, left + side, side))


def portraits(rom, files, alear_female=True):
    """[(file stem, display name, the art's name, PIL image)] for every playable person, in the support table's order."""
    persons = {r['Pid']: r for r in D.rows('person')}
    roster = [r['Pid'] for r in D.rows('reliance', '支援関係')]
    out = []
    for pid in roster:
        p = persons[pid]
        key = p['Name'][len('MPID_'):]
        name = U.text(p['Name'])
        entries = [(art_id(name), name, key)]
        if pid == 'PID_リュール' and alear_female:
            entries.append((art_id(name) + '_female', name + ' (female)', key + 'W'))
        for stem, label, k in entries:
            off, size = files[FOLDER + k.lower() + '.bundle']
            out.append((stem, label, k, texture(io.BytesIO(rom.open(off, size)))))
    return out


def model_portraits(alear_female=True):
    """[(file stem, display name, the outfit's model, PIL image)] for every playable person, in the support table's order: the
    3D model, waist up (fe17_models)."""
    persons = {r['Pid']: r for r in D.rows('person')}
    for pid in [r['Pid'] for r in D.rows('reliance', '支援関係')]:
        p = persons[pid]
        name = U.text(p['Name'])
        looks = [(art_id(name), name, None)]
        if pid == 'PID_リュール' and alear_female:
            looks.append((art_id(name) + '_female', name + ' (female)', '2'))
        for stem, label, gender in looks:
            spec, acc = M.unit_spec(p, gender)
            draws, rig_w = M.assemble(spec, acc)
            yield stem, label, spec['DressModel'], M.waist_up(draws, rig_w)


def atlas_sprites(rom, files, path):
    """{name: PIL image} for every Sprite of a sprite atlas's bundle, each put back on its full rect (the atlas keeps only the
    opaque part, at textureRectOffset from the bottom left)."""
    off, size = files[path]
    env = UnityPy.load(io.BytesIO(rom.open(off, size)))
    sprites = {}
    for o in env.objects:
        if o.type.name != 'Sprite':
            continue
        sprite = o.read()
        w, h = round(sprite.m_Rect.width), round(sprite.m_Rect.height)
        part = sprite.image.convert('RGBA')
        at = sprite.m_RD.textureRectOffset
        full = Image.new('RGBA', (w, h))
        full.paste(part, (round(at.x), h - round(at.y) - part.height))
        sprites[sprite.m_Name] = full
    return sprites


def ring_faces(rom, files):
    """[(file stem, ring name, the sprite's name, PIL image)] for every bond ring, in ring.xml's order: its Icon names the
    sprite."""
    sprites = atlas_sprites(rom, files, RING_FACES)
    out, stems = [], {}
    for r in D.rows('ring'):
        name = U.text(r['Name']) if r['Name'] else ''
        if not r['Icon'] or not name or r['Icon'] in stems:
            continue
        stem = art_id(name)
        assert stem not in stems.values(), (stem, r['Icon'])
        stems[r['Icon']] = stem
        out.append((stem, name, r['Icon'], sprites[r['Icon']]))
    assert set(stems) == set(sprites), set(stems) ^ set(sprites)
    return out


def ring_book_look(im):
    """A render made to sit beside the ring book's faces: colours deepened a little, and its blue glow round the figure."""
    a = np.asarray(im.convert('RGBA')).astype(float) / 255
    a[..., :3] = a[..., :3] ** 1.18
    im = Image.fromarray((a * 255 + 0.5).astype(np.uint8), 'RGBA')
    color = (80, 165, 255)
    alpha = im.getchannel('A')
    halo = Image.new('RGBA', im.size, color + (0,))
    halo.putalpha(alpha.filter(ImageFilter.GaussianBlur(9)).point(lambda v: int(v * 0.7)))
    edge = np.clip(np.asarray(alpha, float) - np.asarray(alpha.filter(ImageFilter.MinFilter(9)), float), 0, 255)
    rim = Image.new('RGBA', im.size, color + (0,))
    rim.putalpha(Image.fromarray(edge.astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)).point(lambda v: int(v * 0.5)))
    return Image.alpha_composite(Image.alpha_composite(halo, im), rim)


def emblem_faces(rom, files, alear_female=True):
    """[(file stem, Emblem name, the sprite's name, PIL image)] for every playable Emblem (GID_<name>; the story's and enemies'
    copies have GIDs of their own), in god.xml's order: the ring book's face, its AsciiName naming the sprite, or, for one it
    hasn't (Ephraim), the Emblem's model as the ring book frames them."""
    sprites = atlas_sprites(rom, files, EMBLEM_FACES)
    out, seen, drawn = [], set(), []
    for g in D.rows('god', '神将'):
        key = g.get('AsciiName')
        if not key or key in seen or g['Gid'].count('_') != 1:
            continue
        seen.add(key)
        name = U.text(g['Mid'])
        looks = [(art_id(name), name, key)]
        if key == 'Lueur' and alear_female:
            looks.append((art_id(name) + '_female', name + ' (female)', 'LueurW'))
        for stem, label, k in looks:
            if k in sprites:
                out.append((stem, label, k, sprites[k]))
            else:
                spec, acc = M.emblem_spec(g)
                draws, rig_w = M.assemble(spec, acc)
                out.append((stem, label, spec['HeadModel'], ring_book_look(M.bust(draws, rig_w))))
                drawn.append(label)
    print('  drawn from the model (no ring-book face):', ', '.join(drawn) or 'none')
    return out


def skill_stem(name):
    """A skill icon's file name: art_id with each "+" spelled out, as Engage has both Lunar Brace and Lunar Brace+ (and Unyielding++),
    which art_id alone would give one name (src/engage/art.ts, skillIconId)."""
    return art_id(name.replace('+', ' plus'))


def skill_icons(rom, files):
    """[(file stem, skill name, the sprite's name, PIL image)] for every skill the app lists (fe17_units: named, described, not
    hidden), by name: the first of its skill.xml rows whose icon the atlas has (IconLabel, or the Sid less SID_)."""
    sprites = atlas_sprites(rom, files, SKILL_ICONS)
    d = U.build()
    rows = {r['Sid']: r for r in D.rows('skill')}
    out, seen = [], set()
    for sid, sk in d['skills'].items():
        name = sk.get('name')
        if not name or not sk.get('help') or sk.get('hidden') or name in seen:
            continue
        r = rows.get(sid)
        key = None
        if r is not None and r['IconKind'] == '0':
            key = r['IconLabel'] or sid[len('SID_'):]
        if key in sprites:
            seen.add(name)
            out.append((skill_stem(name), name, key, sprites[key]))
    names = {sk['name'] for sk in d['skills'].values() if sk.get('name') and sk.get('help') and not sk.get('hidden')}
    missing = sorted(names - seen)
    print(f'  skills without an icon: {", ".join(missing) or "none"}')
    stems = [o[0] for o in out]
    assert len(stems) == len(set(stems)), 'two skills share a file name'
    return out


def contact_sheet(items, path, cols=8, cell=160):
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cell, rows * (cell + 30)), (60, 60, 70, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (stem, label, im) in enumerate(items):
        x, y = (i % cols) * cell, (i // cols) * (cell + 30)
        sheet.alpha_composite(im.resize((cell - 8, cell - 8), Image.LANCZOS), (x + 4, y + 4))
        draw.text((x + 4, y + cell), stem, fill=(255, 255, 255, 255))
        if label:
            draw.text((x + 4, y + cell + 12), label[:24], fill=(200, 200, 200, 255))
    sheet.save(path)


def main(argv):
    sheet = None
    if '--sheet' in argv:
        k = argv.index('--sheet')
        sheet = argv[k + 1]
        del argv[k:k + 2]
    level_up = '--level-up' in argv
    argv = [a for a in argv if a != '--level-up']
    out = argv[0] if argv else OUT
    os.makedirs(os.path.join(out, 'rings'), exist_ok=True)
    os.makedirs(os.path.join(out, 'emblems'), exist_ok=True)
    os.makedirs(os.path.join(out, 'skills'), exist_ok=True)
    rom, files = M.romfs()[:2]
    made = []
    if level_up:
        for stem, label, key, im in portraits(rom, files):
            bust = premultiplied_resize(square_bust(im), (SIZE, SIZE))
            bust.save(os.path.join(out, stem + '.png'))
            made.append((stem, f'{label} ({key})', bust))
    else:
        for stem, label, key, im in model_portraits():
            im.save(os.path.join(out, stem + '.png'))
            made.append((stem, f'{label} ({key})', im))
            print(' ', label, flush=True)
    print(f'{len(made)} portraits written to {os.path.abspath(out)}')
    faces = 0
    for stem, label, key, im in ring_faces(rom, files):
        face = premultiplied_resize(im, (RING_SIZE, RING_SIZE))
        face.save(os.path.join(out, 'rings', stem + '.png'))
        made.append(('rings/' + stem, f'{label} ({key})', face))
        faces += 1
    print(f'{faces} Bond Ring faces written to {os.path.abspath(os.path.join(out, "rings"))}')
    faces = 0
    for stem, label, key, im in emblem_faces(rom, files):
        face = premultiplied_resize(im, (EMBLEM_SIZE, EMBLEM_SIZE))
        face.save(os.path.join(out, 'emblems', stem + '.png'))
        made.append(('emblems/' + stem, f'{label} ({key})', face))
        faces += 1
    print(f'{faces} Emblem faces written to {os.path.abspath(os.path.join(out, "emblems"))}')
    icons = 0
    for stem, label, key, im in skill_icons(rom, files):
        im.save(os.path.join(out, 'skills', stem + '.png'))
        made.append(('skills/' + stem, f'{label} ({key})', im))
        icons += 1
    print(f'{icons} skill icons written to {os.path.abspath(os.path.join(out, "skills"))}')
    if sheet:
        contact_sheet(made, sheet)


if __name__ == '__main__':
    main(sys.argv[1:])
