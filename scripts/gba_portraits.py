"""
The playable units' portraits from the user's own GBA cartridge images (The Binding Blade, The Blazing Blade, The Sacred Stones), as
96x80 RGBA PNGs at the game's own size, for the user to load into the app on their device (Edit Mode -> Bulk Upload). The images go
to data-raw/<game>/art/<stem>.png, which git ignores; nothing from them is committed or shipped (see ART_ASSETS.md).

Each unit in src/data/<game>/<game>Units.ts is the character whose id ends its unit id (fe6-1, fe7-lyn-3, fe8-25); the character's
record gives its portrait id (u16 at +6), checked against the record's own name. The portrait table is indexed by that id (the game's
GetPortraitData: table + id * size), and the image is put together as the status screen draws it:

  - the sheet (128 4bpp tiles, 32 across and 4 down, as it sits in OBJ VRAM) is laid out by the game's 96x80 face sprite: the
    middle 64 pixels from the sheet's first three blocks, the bottom 32 pixels of the 16-pixel side strips from columns 20-23; the
    top 48 pixels of the side strips are empty in every portrait;
  - FE7 and FE8: the status screen (PutFace80x72) also puts the sheet's own mouth tiles (columns 28-31, rows 0-1) over the face at
    the record's mouth position. That mouth is closed but mostly the slight smile (it matches mouth frame 2, the smile's closed
    frame, more often than not); the face under it is the plain closed mouth (mouth frame 5, what a face shows in dialogue when
    nobody is talking, for every unit). --neutral keeps that one instead. FE6's status screen draws the sheet alone (its idle
    mouth is already in the face);
  - the eyes are the sheet's own, open (the blink frames are only drawn while a face blinks);
  - colour 0 is transparent; the rest are the portrait's palette (BGR555 to 8-bit).

Formats: data-raw/fe6/README.md, data-raw/fe7/README.md, data-raw/fe8/README.md (the Portraits sections).

    python scripts/gba_portraits.py                 # all three games
    python scripts/gba_portraits.py fe7 --contact DIR   # one game, plus a labelled contact sheet in DIR
    python scripts/gba_portraits.py --neutral       # FE7/FE8 with the dialogue's closed mouth, not the status screen's
"""
import argparse
import os
import re
import struct
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
GAMES = ('fe6', 'fe7', 'fe8')

# The portrait table (file offset), its record size, and where the game's code reads it (GetPortraitData).
PORTRAITS = {
    'fe6': {'table': 0x66074C, 'size': 16, 'code': 0x08007FC0},
    'fe7': {'table': 0xC96584, 'size': 28, 'code': 0x08006B20},
    'fe8': {'table': 0x8ACBC4, 'size': 28, 'code': 0x08005514},
}
W, H = 96, 80
SHEET_TILES = 128  # FE6's sheets carry 8 more (its idle mouth, row 4), not used for the face itself

# The game's 96x80 face sprite (FE6 0x5C3A94, FE7 0xB906AC, FE8 0x591040): (x, y, w, h, first tile), x from the left edge
# (the sprite's own x is from the face's centre, 48 pixels in). Tiles are 2D-mapped, 32 to a row: tile t is column t % 32,
# row t // 32 of the sheet.
SPRITE_96x80 = [(16, 0, 64, 32, 0x00), (16, 32, 64, 32, 0x08), (16, 64, 32, 16, 0x10), (48, 64, 32, 16, 0x50),
                (0, 48, 16, 32, 0x14), (80, 48, 16, 32, 0x16)]
MOUTH_TILE = 0x1C  # FE7/FE8: the sheet's mouth tiles, 4x2 from column 28, row 0


def rom_bytes(game):
    """The ROM image, checked as the unit builders check it."""
    if game == 'fe6':
        import fe6_rom
        return fe6_rom.R
    from gba_rom import rom
    return rom(game).R


def u16(R, o):
    return struct.unpack_from('<H', R, o)[0]


def u32(R, o):
    return struct.unpack_from('<I', R, o)[0]


def lz77(R, o):
    """GBA BIOS LZ77 (type 0x10)."""
    assert R[o] == 0x10, f'no LZ77 data at {o:#x}'
    size, out, p = u32(R, o) >> 8, bytearray(), o + 4
    while len(out) < size:
        flags = R[p]
        p += 1
        for b in range(8):
            if len(out) >= size:
                break
            if flags & (0x80 >> b):
                v = (R[p] << 8) | R[p + 1]
                p += 2
                for _ in range((v >> 12) + 3):
                    out.append(out[-((v & 0xFFF) + 1)])
            else:
                out.append(R[p])
                p += 1
    return bytes(out)


def graphics(R, o):
    """The game's Decompress: LZ77 (0x10, FE6 and FE7), or stored plain after a 4-byte header whose first byte is 0 (FE8)."""
    if R[o] == 0x10:
        return lz77(R, o)
    assert R[o] == 0, f'unknown graphics format {R[o]:#x} at {o:#x}'
    size = u32(R, o) >> 8
    return bytes(R[o + 4:o + 4 + size])


def sheet(data):
    """4bpp tiles laid 32 to a row, as colour indices."""
    n = len(data) // 32
    rows = (n + 31) // 32
    a = np.zeros((rows * 8, 256), np.uint8)
    b = np.frombuffer(data[:n * 32], np.uint8).reshape(n, 32)
    px = np.empty((n, 64), np.uint8)
    px[:, 0::2] = b & 15
    px[:, 1::2] = b >> 4
    px = px.reshape(n, 8, 8)
    for t in range(n):
        y, x = divmod(t, 32)
        a[y * 8:y * 8 + 8, x * 8:x * 8 + 8] = px[t]
    return a


def tile_block(a, tile, w, h):
    y, x = divmod(tile, 32)
    return a[y * 8:y * 8 + h, x * 8:x * 8 + w]


def entry(game, R, fid):
    """The portrait record: FE6 16 bytes (image, mini, palette, mouth x, mouth y, 2 more); FE7/FE8 28 bytes (image, mini,
    palette, mouth frames, class card, mouth x, mouth y, eyes x, eyes y, blink kind)."""
    cfg = PORTRAITS[game]
    e = cfg['table'] + cfg['size'] * fid
    img, mini, pal = (u32(R, e + k) for k in (0, 4, 8))
    out = {'fid': fid, 'at': e, 'img': img, 'mini': mini, 'pal': pal}
    if cfg['size'] == 16:
        out.update(mouth=(R[e + 12], R[e + 13]))
    else:
        out.update(mouth_frames=u32(R, e + 12), card=u32(R, e + 16), mouth=(R[e + 0x14], R[e + 0x15]),
                   eyes=(R[e + 0x16], R[e + 0x17]), blink=R[e + 0x18])
    return out


def portrait(game, R, fid, neutral=False):
    """The 96x80 portrait as an RGBA image: the status screen's, or with neutral, the face's own closed mouth (FE7/FE8)."""
    info = entry(game, R, fid)
    if not info['img'] or (game == 'fe6' and not all(info['mouth'])):
        raise ValueError(f'portrait {fid} is a class card, not a face')
    a = sheet(graphics(R, info['img'] - 0x08000000))
    assert a.shape[0] >= 32, f'portrait {fid}: sheet too small'
    idx = np.zeros((H, W), np.uint8)
    for x, y, w, h, t in SPRITE_96x80:
        idx[y:y + h, x:x + w] = tile_block(a, t, w, h)
    if game != 'fe6' and not neutral:
        mx, my = info['mouth']
        idx[my * 8:my * 8 + 16, mx * 8:mx * 8 + 32] = tile_block(a, MOUTH_TILE, 32, 16)
    pal = struct.unpack_from('<16H', R, info['pal'] - 0x08000000)
    rgba = np.array([[((c >> s) & 31) << 3 | ((c >> s) & 31) >> 2 for s in (0, 5, 10)] + [255] for c in pal], np.uint8)
    rgba[0, 3] = 0
    return Image.fromarray(rgba[idx], 'RGBA'), info


def stem(name):
    """The app's artId without the game: lower case, every run of other characters one '_', none at the ends."""
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


def units(game):
    """(unit id, character id, display name) for each playable unit, from the generated unit file."""
    text = open(os.path.join(ROOT, 'src', 'data', game, f'{game}Units.ts'), encoding='utf-8').read()
    out, seen = [], set()
    for uid, name in re.findall(r'\{"id": "(' + game + r'-[^"]+)"(?:, "story": "[^"]*")?, "name": "([^"]*)"', text):
        if uid not in seen:
            seen.add(uid)
            out.append((uid, int(uid.rsplit('-', 1)[1]), name))
    return out


def characters(game):
    """character id -> (portrait id, the record's name)."""
    if game == 'fe6':
        import fe6_rom
        from fe6_names import character_names
        names = character_names()
        R = fe6_rom.R

        def rec(c):
            e = fe6_rom.CHARACTERS + 48 * (c - 1)
            assert R[e + 4] == c, f'FE6 record {c} holds id {R[e + 4]}'
            return u16(R, e + 6), names.get(c)
        return rec
    from gba_rom import rom
    r = rom(game)

    def rec(c):
        ch = r.character(c)
        assert ch['id'] == c, f'{game} record {c} holds id {ch["id"]}'
        return ch['portrait'], r.text(ch['name_id'])
    return rec


def build(game, out_dir=None, contact=None, neutral=False):
    R = rom_bytes(game)
    rec = characters(game)
    out_dir = out_dir or os.path.join(ROOT, 'data-raw', game, 'art')
    os.makedirs(out_dir, exist_ok=True)
    by_stem = {}
    for uid, c, name in units(game):
        fid, rname = rec(c)
        if rname != name:
            print(f'  note: {uid} is "{name}" in the app, "{rname}" in the record')
        by_stem.setdefault(stem(name), []).append((uid, c, fid, name))
    written = []
    for s, us in by_stem.items():
        fids = {fid for _, _, fid, _ in us}
        if len(fids) > 1:
            print(f'  note: {s} has portraits {sorted(fids)} ({", ".join(u for u, *_ in us)}); keeping the last unit\'s')
        uid, c, fid, name = us[-1]
        img, info = portrait(game, R, fid, neutral)
        img.save(os.path.join(out_dir, f'{s}.png'))
        written.append((s, name, uid, c, fid, img, info))
    print(f'{game}: {len(written)} portraits -> {os.path.relpath(out_dir, ROOT)}')
    if contact:
        os.makedirs(contact, exist_ok=True)
        path = os.path.join(contact, f'{game}_portraits.png')
        contact_sheet(written).save(path)
        print(f'  contact sheet: {path}')
    return written


def contact_sheet(written, cols=8, scale=2):
    cw, ch = W * scale + 8, H * scale + 30
    rows = (len(written) + cols - 1) // cols
    sheet_img = Image.new('RGBA', (cols * cw, rows * ch), (40, 40, 48, 255))
    d = ImageDraw.Draw(sheet_img)
    for i, (s, name, uid, c, fid, img, info) in enumerate(written):
        x, y = (i % cols) * cw + 4, (i // cols) * ch + 4
        bg = Image.new('RGBA', (W * scale, H * scale), (90, 120, 150, 255))
        bg.alpha_composite(img.resize((W * scale, H * scale), Image.NEAREST))
        sheet_img.paste(bg, (x, y))
        d.text((x, y + H * scale + 2), f'{name}', fill=(255, 255, 255, 255))
        d.text((x, y + H * scale + 13), f'{uid} face {fid}', fill=(180, 180, 180, 255))
    return sheet_img


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('games', nargs='*', metavar='game', help='fe6, fe7 or fe8 (all three if none given)')
    ap.add_argument('--contact', help='also write a labelled contact sheet per game into this folder')
    ap.add_argument('--neutral', action='store_true',
                    help="FE7/FE8: keep the face's own closed mouth instead of the status screen's (usually a slight smile)")
    args = ap.parse_args()
    bad = [g for g in args.games if g not in GAMES]
    if bad:
        ap.error(f'unknown game {", ".join(bad)} (fe6, fe7 or fe8)')
    for g in args.games or GAMES:
        build(g, contact=args.contact, neutral=args.neutral)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
