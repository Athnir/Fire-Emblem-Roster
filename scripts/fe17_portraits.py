"""
Make Fire Emblem Engage's portraits from the user's own dump, ready for the app's Bulk Upload (Edit Mode -> Bulk Upload ->
Engage -> select the folder). The images are the user's and stay on their machine: the output goes to data-raw/fe17/art/, which is
git-ignored, and nothing here is ever committed.

Engage draws its units in 3D on the status screen; the hand-drawn 2D art it has for every unit is the face shown when a unit levels
up: the Addressables key Telop/LevelUp/FaceThumb/<name>, the bundle fe_assets_telop/levelup/facethumb/<name>.bundle, one Texture2D
(640x340, ASTC 4x4, Tegra block-linear swizzled; UnityPy and texture2ddecoder decode it). <name> is the person's Name label less
"MPID_" (person.xml), which the catalog's keys match for every playable person (Rafal: MPID_Rafale, though his UnitIconID is
049Il). Alear's person record is male (Gender 1): Lueur; the female Alear's art is LueurW (written only with --alear-female).

Each image is cropped to a square around the face (its full height, centred on the opaque pixels' middle) and scaled to 256x256
(Lanczos, on premultiplied alpha so the edges keep no dark fringe). The file name is the app's (src/tellius/logic.ts, artId): the
English name with its accents dropped, lower-cased, each run of anything but a-z and 0-9 as one "_" (Céline -> celine.png).

Each Bond Ring's face goes in rings/, named the same way after the ring (Black Knight -> rings/black_knight.png): the Ring Chamber's
faces, fe_assets_ui/hub/godroom/face/face.bundle, one SpriteAtlas with a Sprite per hero named by ring.xml's Icon (Seeda: Caeda).
Each Sprite is 300x300, but the atlas keeps only its opaque part (textureRect, placed at textureRectOffset from the bottom left), so
it's put back on its 300x300 before it's scaled to 128x128, as the face shows small beside the ring's stats.

Run: python scripts/fe17_portraits.py [out folder] [--sheet sheet.png] [--alear-female]
Needs: pip install UnityPy (it brings texture2ddecoder).
"""
import io
import os
import re
import sys
import unicodedata

import numpy as np
import UnityPy
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fe17_data as D  # noqa: E402
import fe17_units as U  # noqa: E402
from fe17_extract import AA, merged_romfs  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'data-raw', 'fe17', 'art')
FOLDER = AA + 'fe_assets_telop/levelup/facethumb/'
RING_FACES = AA + 'fe_assets_ui/hub/godroom/face/face.bundle'
SIZE = 256
RING_SIZE = 128


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


def portraits(rom, files, alear_female=False):
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


def ring_faces(rom, files):
    """[(file stem, ring name, the sprite's name, PIL image)] for every bond ring, in ring.xml's order: its Icon names the
    sprite, each put back on its full rect."""
    off, size = files[RING_FACES]
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
    female = '--alear-female' in argv
    argv = [a for a in argv if a != '--alear-female']
    out = argv[0] if argv else OUT
    os.makedirs(os.path.join(out, 'rings'), exist_ok=True)
    _update, rom, files = merged_romfs()
    made = []
    for stem, label, key, im in portraits(rom, files, female):
        bust = premultiplied_resize(square_bust(im), (SIZE, SIZE))
        bust.save(os.path.join(out, stem + '.png'))
        made.append((stem, f'{label} ({key})', bust))
    print(f'{len(made)} portraits written to {os.path.abspath(out)}')
    faces = 0
    for stem, label, key, im in ring_faces(rom, files):
        face = premultiplied_resize(im, (RING_SIZE, RING_SIZE))
        face.save(os.path.join(out, 'rings', stem + '.png'))
        made.append(('rings/' + stem, f'{label} ({key})', face))
        faces += 1
    print(f'{faces} Bond Ring faces written to {os.path.abspath(os.path.join(out, "rings"))}')
    if sheet:
        contact_sheet(made, sheet)


if __name__ == '__main__':
    main(sys.argv[1:])
