"""
The units' portraits from the user's own Super Famicom cartridges (Mystery of the Emblem, Genealogy of the Holy War, Thracia 776),
for the Roster's art. Nothing here is committed: the images go to data-raw/<game>/art/ (git-ignored), and whoever installs the app
loads them on their own device (ART_ASSETS.md).

    python scripts/snes_portraits.py              # all three games
    python scripts/snes_portraits.py fe4 --sheet  # one game, plus a labelled contact sheet (data-raw/fe4/portraits-sheet.png)
    python scripts/snes_portraits.py fe3 --fe3-keep-box    # Mystery's painted-in backdrop kept, as the game shows it (see below)

The three games keep a portrait the same way (traced in each game's code; the tables are in data-raw/<game>/README.md):
- the graphics are one block compressed with the game's own scheme, unpacked by the game's own routine (run on scripts/fe4_cpu.py),
  to 64 4bpp tiles (2048 bytes);
- the game copies the block to VRAM as an OBJ block 16 tiles wide and 4 tall, and shows the portrait as twelve 16x16 sprites,
  48x64 in all: the top half is the block's columns 0-5, the bottom half its columns 6-11 (columns 12-15 are the mouth and eye
  frames). Seen in Genealogy's OAM in the Ch.1 opening (Mesen): rows of sprites at tiles B+0/2/4, B+0x20/22/24, B+6/8/A,
  B+0x26/28/2A;
- the palette is 16 BGR555 colours; colour 0 is transparent (Genealogy's and Thracia's backdrop; Mystery paints its backdrop in).

The image is the one the game stores (the game flips it for a speaker on the left), at its own size. Each game's result was
matched against Mesen screenshots of its Ch.1 opening talk. Which portrait a unit has comes from the game's data, unit by unit:
see the <game>_unit_portraits() functions. A name the app lists twice (Mystery's two books) gets the first one's face; a later
one with a face of its own goes to data-raw/fe3/art-book2/.
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
sys.path.insert(0, HERE)

GAMES = ('fe3', 'fe4', 'fe5')
BLOCK = 2048  # 64 tiles


def stem(name):
    """The file name the app looks for (artId in src/tellius/logic.ts): lowercased, each run of non-alphanumerics '_'."""
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


def app_units(game):
    """[(unit id, name)] in the order the app lists them, from the generated src/data/<game>/<game>Units.ts (read only)."""
    path = os.path.join(ROOT, 'src', 'data', game, f'{game}Units.ts')
    out, inside = [], False
    for line in open(path, encoding='utf-8'):
        if line.startswith('export const '):
            inside = line.startswith(f'export const {game.upper()}_UNITS')
        elif inside and line.startswith('  {"id": '):
            u = json.loads(line.strip().rstrip(','))
            out.append((u['id'], u['name']))
    return out


def tiles(block):
    """2048 bytes -> the 128x32 VRAM block (16 tiles a row), colour indexes. SNES 4bpp: per tile, rows of planes 0/1, then 2/3."""
    b = np.frombuffer(block.ljust(BLOCK, b'\0')[:BLOCK], np.uint8).reshape(64, 2, 8, 2)  # tile, plane pair, row, plane
    bits = np.unpackbits(b, axis=-1, bitorder='big').reshape(64, 2, 8, 2, 8)  # ... plane, x
    px = bits[:, 0, :, 0] | bits[:, 0, :, 1] << 1 | bits[:, 1, :, 0] << 2 | bits[:, 1, :, 1] << 3  # tile, row, x
    return px.reshape(4, 16, 8, 8).transpose(0, 2, 1, 3).reshape(32, 128)


def portrait(block, palette, clear_box=False):
    """The 48x64 portrait as RGBA: the block's columns 0-5 over its columns 6-11, colour 0 transparent. clear_box (Mystery only,
    off unless asked): also clear the backdrop the art paints in (the colour in the top-left corner, wherever it touches the
    edge), which that game leaves opaque."""
    g = tiles(block)
    idx = np.vstack([g[:, 0:48], g[:, 48:96]])
    rgba = np.zeros((16, 4), np.uint8)
    for i in range(16):
        c = palette[2 * i] | palette[2 * i + 1] << 8
        rgba[i] = [(v << 3) | (v >> 2) for v in (c & 31, c >> 5 & 31, c >> 10 & 31)] + [0 if i == 0 else 255]
    out = rgba[idx]
    if clear_box:
        from scipy import ndimage
        parts, _ = ndimage.label(idx == idx[0, 0])
        edge = set(np.unique(np.concatenate([parts[0], parts[-1], parts[:, 0], parts[:, -1]]))) - {0}
        out[np.isin(parts, list(edge)), 3] = 0
    return Image.fromarray(out, 'RGBA')


# --- Mystery of the Emblem (LoROM) -------------------------------------------------------------------------------------------
# $81:D12B: the portrait id x 3 indexes the graphics pointers at $88:8EB0 (unpacked by $80:8F18 via $81:D920); $81:D14D copies
# 16 colours from $D7:E800 + 32 x id. A unit's portrait is byte +7 of its unit record ($83:AF80 keeps it at $7F:4417).
# Its portraits never use colour 0: the backdrop is painted in (colour 14, the talk window's blue, in most). It's cleared where it
# touches the edge, so they sit in the app like the other games'; --fe3-keep-box keeps it.
FE3_GFX, FE3_PAL = 0x888EB0, 0xD7E800
FE3_CLEAR_BOX = '--fe3-keep-box' not in sys.argv


def fe3_portrait(p):
    import fe3_rom as r
    return portrait(r.decompress(r.u24(FE3_GFX + 3 * p)), r.R[r.lo(FE3_PAL + 32 * p):][:32], clear_box=FE3_CLEAR_BOX)


def fe3_unit_portraits():
    """{unit id: portrait id}: the portrait in the unit record that makes each character join (scripts/fe3_joins.py), book by
    book. A character in both books has a record in each; Marth, Caeda, Linde, Merric and Tiki's Book 2 records name Book 2
    portraits of their own."""
    from fe3_joins import BOOKS, joins
    out = {}
    for book in BOOKS:
        for k, j in joins(book).items():
            out[f'fe3-{book}-{k}'] = j[6]['portrait']
    return out


# --- Genealogy of the Holy War (HiROM) ---------------------------------------------------------------------------------------
# $84:861C: the portrait id is the u16 at $8B:9A88 + 2 x (character id - 1); 0xF3 means a generic one, picked by class
# ($8A:B3E8, the u16 at $8B:9FF8 + 2 x class). $8A:B3FE/$8A:B452/$8A:B49A: the id x 3 indexes the graphics pointers at $8A:B4F9
# (unpacked by $80:AA02 via $95:A3FB) and the palette pointers at $8A:B7E1 (16 colours each).
FE4_PORTRAIT_OF, FE4_GENERIC, FE4_GFX, FE4_PAL = 0x8B9A88, 0xF3, 0x8AB4F9, 0x8AB7E1


def fe4_lo(a):
    return ((a >> 16) & 0x3F) << 16 | (a & 0xFFFF)


def fe4_portrait(p):
    from fe4_cpu import Cpu
    from fe4_rom import R

    def u24(a):
        o = fe4_lo(a)
        return R[o] | R[o + 1] << 8 | R[o + 2] << 16
    return portrait(Cpu().decompress(u24(FE4_GFX + 3 * p)), R[fe4_lo(u24(FE4_PAL + 3 * p)):][:32])


def fe4_unit_portraits():
    from fe4_rom import u16
    out = {}
    for uid, name in app_units('fe4'):
        char = int(uid.split('-')[1])
        p = u16(fe4_lo(FE4_PORTRAIT_OF) + 2 * (char - 1))
        if p == FE4_GENERIC:
            raise ValueError(f'{name} ({uid}) has a generic portrait')
        out[uid] = p
    return out


# --- Thracia 776 (LoROM) -----------------------------------------------------------------------------------------------------
# A character's portrait id is byte +0x2F of their record ($86:9A2D, 48 bytes from id 1). $8C:BFB1: the id x 4 indexes $8C:D12A,
# a graphics pointer (unpacked by $80:B574) and a palette number; $8C:BFC7: the palette is at $EA:C000 + 32 x that number.
FE5_CHARACTERS, FE5_PORTRAITS, FE5_PAL = 0x869A2D, 0x8CD12A, 0xEAC000


def fe5_portrait(p):
    import fe5_rom as r
    o = r.lo(FE5_PORTRAITS + 4 * p)
    gfx, pal = r.R[o] | r.R[o + 1] << 8 | r.R[o + 2] << 16, r.R[o + 3]
    return portrait(r.decompress(gfx), r.R[r.lo(FE5_PAL + 32 * pal):][:32])


def fe5_unit_portraits():
    import fe5_rom as r
    out = {}
    for uid, name in app_units('fe5'):
        char = int(uid.split('-')[1])
        out[uid] = r.u8(FE5_CHARACTERS + 48 * (char - 1) + 0x2F)
    return out


READERS = {
    'fe3': (fe3_portrait, fe3_unit_portraits),
    'fe4': (fe4_portrait, fe4_unit_portraits),
    'fe5': (fe5_portrait, fe5_unit_portraits),
}


def contact_sheet(rows, path, cols=10, scale=2):
    """rows: [(label, portrait id, image)]. Each portrait at `scale` over grey, its label above."""
    w, h = 48 * scale + 8, 64 * scale + 26
    sheet = Image.new('RGB', (cols * w, ((len(rows) + cols - 1) // cols) * h), (96, 96, 96))
    d = ImageDraw.Draw(sheet)
    for k, (label, p, im) in enumerate(rows):
        x, y = (k % cols) * w, (k // cols) * h
        d.text((x + 3, y + 1), label[:16], fill=(255, 255, 0))
        d.text((x + 3, y + 12), f'#{p}', fill=(200, 200, 200))
        big = im.resize((48 * scale, 64 * scale), Image.NEAREST)
        sheet.paste(big, (x + 4, y + 24), big)
    sheet.save(path)


def build(game, sheet=False):
    draw, unit_portraits = READERS[game]
    of_unit = unit_portraits()
    out_dir = os.path.join(ROOT, 'data-raw', game, 'art')
    os.makedirs(out_dir, exist_ok=True)
    done, rows, cache = {}, [], {}
    for uid, name in app_units(game):
        p = of_unit.get(uid)
        if p is None:
            print(f'  {game}: no portrait found for {name} ({uid})')
            continue
        s = stem(name)
        if s in done:
            # One file a name: the first record the app lists (Mystery's Book 1) keeps it; a later one with a portrait of its own
            # (Mystery's Book 2) goes to art-<story>/.
            if p != done[s] and game == 'fe3':
                alt = os.path.join(ROOT, 'data-raw', game, 'art-book2')
                os.makedirs(alt, exist_ok=True)
                img = cache.setdefault(p, draw(p))
                img.save(os.path.join(alt, f'{s}.png'))
                rows.append((f'{name} (B2)', p, img))
            continue
        img = cache.setdefault(p, draw(p))
        img.save(os.path.join(out_dir, f'{s}.png'))
        done[s] = p
        rows.append((name, p, img))
    print(f'{game}: {len(done)} portraits -> {os.path.normpath(out_dir)}')
    if sheet:
        path = os.path.join(ROOT, 'data-raw', game, 'portraits-sheet.png')
        contact_sheet(rows, path)
        print(f'  contact sheet -> {os.path.normpath(path)}')
    return done


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    for g in args or GAMES:
        build(g, sheet='--sheet' in sys.argv)
