"""
Make Awakening's portraits from the user's own cartridge image, ready for the app's Bulk Upload (Edit Mode -> Bulk Upload ->
Awakening -> select the folder). The images are the user's and stay on their machine: the output goes to data-raw/fe13/art/,
which is git-ignored, and nothing here is ever committed.

Each unit's bust-up portrait is face/<name>_bu_通常.arc, found through face/FaceData.bin.lz (the record FSID_BU_<FID less "FID_">_通常
names the archive at +8). Its 通常.ctpk.lz is the normal expression and 髪0.ctpk.lz the hair, drawn on top and tinted with the unit's hair
colour; an adult's hair layer is a 16x16 blank, their hair being part of the face.

Writes, in the layout Bulk Upload reads:
  <out>/<name>.png                   every unit's portrait, hair in their own colour (the face record's +12)
  <out>/children/<name>/base.png     a child's portrait without hair (their hair comes from a parent; the app tints it)
  <out>/children/<name>/raw.png      that child's hair layer as the game has it

Run: python scripts/fe13_portraits.py [out folder]
     python scripts/fe13_portraits.py --public   (into public/art/, git-ignored, which the app reads when run from this folder)
"""
import os
import sys
import unicodedata

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ctr_texture as T  # noqa: E402
import fe13_data as D  # noqa: E402
from fates_lz import decompress  # noqa: E402
from fe13_bin import Bin, ROMFS  # noqa: E402
from fe13_extract import CART  # noqa: E402
from fe13_joins import joins  # noqa: E402
from ncch_romfs import RomFS, ncsd_partitions  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'data-raw', 'fe13', 'art')
# public/art's layout (src/data/portraitAssets.ts): portraits/adults/<id>.png, portraits/children/<id>/base.png and raw.png.
PUBLIC = os.path.join(ROOT, 'public', 'art', 'portraits')
NAMES = {'PID_マーク男': 'Morgan (M)', 'PID_マーク女': 'Morgan (F)'}


def slug(name):
    """The app's file name for a unit (src/awakening/screens.tsx, artId): accents dropped, lower case, runs of anything else as _."""
    s = ''.join(c for c in unicodedata.normalize('NFD', name) if not unicodedata.combining(c)).lower()
    out, gap = [], False
    for c in s:
        if c.isascii() and c.isalnum():
            out.append(c)
            gap = False
        elif not gap:
            out.append('_')
            gap = True
    return ''.join(out).strip('_')


def tint(hair, hex_colour):
    """The app's hair tint (src/logic/portraitColorize.ts, colorizeRawHairTexture): the hair's brightness stretched so its 90th
    percentile reaches 230, then multiplied by the colour."""
    a = np.asarray(hair).astype(float)
    mask = a[..., 3] > 0
    if not mask.any():
        return hair
    scale = 230 / np.sort(a[..., :3][mask].ravel())[int(mask.sum() * 3 * 90 / 100)]
    rgb = np.array([int(hex_colour[i:i + 2], 16) for i in (1, 3, 5)]) / 255
    a[..., :3] = np.clip(np.clip(a[..., :3] * scale, 0, 255) * rgb, 0, 255).round()
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def main():
    public = '--public' in sys.argv
    args = [a for a in sys.argv[1:] if a != '--public']
    out = args[0] if args else OUT

    def flat_path(stem):
        return os.path.join(PUBLIC, 'adults', 'fe13', f'{stem}.png') if public else os.path.join(out, f'{stem}.png')

    def layer_dir(stem):
        return os.path.join(PUBLIC, 'children', 'fe13', stem) if public else os.path.join(out, 'children', stem)
    part = dict((i, o) for i, o, _ in ncsd_partitions(CART))[0]
    rom = RomFS(CART, part)
    files = {p: (off, size) for p, off, size in rom.walk() if p.startswith('/face/')}
    fd = Bin(decompress(open(os.path.join(ROMFS, 'face', 'FaceData.bin.lz'), 'rb').read()))
    faces = {name: o for o, name in fd.labels}
    st = Bin(decompress(open(os.path.join(ROMFS, 'data', 'person', 'static.bin.lz'), 'rb').read()))
    ptrs = set(st.ptrs)
    rec = {name: o for o, name in st.labels}

    made, layered = 0, 0
    for pid in joins():
        o = rec[pid]
        if (o + 12) not in ptrs:
            continue
        fid = st.str(o + 12)
        name = NAMES.get(pid) or D.name_of(st.str(o + 20))
        face = faces.get(f'FSID_BU_{fid[4:]}_通常')
        if not name or face is None:
            print('no bust-up portrait:', pid, fid)
            continue
        arc_path = '/face/' + fd.str(face + 8)
        colour = '#' + fd.d[0x20 + face + 12:0x20 + face + 15].hex()
        off, size = files[arc_path]
        arc = Bin(rom.read(off, size))
        layers = {}
        for lo, label in arc.labels:
            if label in ('通常.ctpk.lz', '髪0.ctpk.lz'):
                length, start = arc.u32(lo + 8), arc.u32(lo + 12)
                layers[label] = next(iter(T.ctpk(decompress(arc.d[0x20 + start:0x20 + start + length])).values()))
        base, hair = layers['通常.ctpk.lz'], layers.get('髪0.ctpk.lz')
        stem = slug(name)
        whole = base.copy()
        # A hair layer as big as the face, with something on it: the hair is drawn and tinted separately.
        if hair is not None and hair.size == base.size and hair.getbbox():
            os.makedirs(layer_dir(stem), exist_ok=True)
            base.save(os.path.join(layer_dir(stem), 'base.png'))
            hair.save(os.path.join(layer_dir(stem), 'raw.png'))
            whole.alpha_composite(tint(hair, colour))
            layered += 1
        os.makedirs(os.path.dirname(flat_path(stem)), exist_ok=True)
        whole.save(flat_path(stem))
        made += 1
    print(f'{made} portraits, {layered} with a separate hair layer -> {os.path.abspath(PUBLIC if public else out)}')


if __name__ == '__main__':
    main()
