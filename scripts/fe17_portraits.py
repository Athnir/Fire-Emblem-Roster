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
English name lower-cased, each run of anything but a-z and 0-9 as one "_" (Céline -> c_line.png).

Run: python scripts/fe17_portraits.py [out folder] [--sheet sheet.png] [--alear-female]
Needs: pip install UnityPy (it brings texture2ddecoder).
"""
import io
import os
import re
import sys

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
SIZE = 256


def art_id(name):
    """src/tellius/logic.ts artId: lower case, runs of anything but a-z0-9 as '_', trimmed."""
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


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


def portraits(alear_female=False):
    """[(file stem, display name, the art's name, PIL image)] for every playable person, in the support table's order."""
    _update, rom, files = merged_romfs()
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
    os.makedirs(out, exist_ok=True)
    made = []
    for stem, label, key, im in portraits(female):
        bust = premultiplied_resize(square_bust(im), (SIZE, SIZE))
        bust.save(os.path.join(out, stem + '.png'))
        made.append((stem, f'{label} ({key})', bust))
    print(f'{len(made)} portraits written to {os.path.abspath(out)}')
    if sheet:
        contact_sheet(made, sheet)


if __name__ == '__main__':
    main(sys.argv[1:])
