"""
Make Shadow Dragon's portraits from the user's own cartridge image, for the app's Bulk Upload (Edit Mode -> Bulk Upload -> Shadow
Dragon -> select the folder). The images are the user's and stay on their machine: the output goes to data-raw/fe11/art/, which is
git-ignored, and nothing here is ever committed.

A person's face (database Person +4, FID_...) is a record of f/face.bin (Awakening's container, 36 bytes a face: +0 the FID, +4 the
name label, +8 the portrait's file in f/, +12 and +16 the small face's in sf/ and its palette, +20 the eyes' and mouth's places). The
program loads f/<+8> (arm9 0x2007ca8) through its decompressor table (0x20ceaf8, by the first byte's top nibble): 0x10 is LZ10, and
0x40, which most portraits use, a run-length code of zeros (0x2004070, below). Decompressed, a portrait is 0x200 bytes of palette (256
BGR555 colours, the first transparent) and 0x6400 of 8bpp tiles (8x8, 64 bytes each): four 64x64 blocks of 64 tiles (each block's
tiles left to right, top to bottom), the portrait's top left, top right, bottom left and bottom right, so 128x128; then the eyes' and
mouths' frames the game draws over it when a unit blinks or talks. The portrait is written at that size (packaging scales pixel art).

Writes <out>/<name>.png for every unit that joins (scripts/fe11_joins.py), named as the app names them (src/data/fe11/fe11Units.ts).

Run: python scripts/fe11_portraits.py [out folder]
"""
import os
import struct
import sys
import unicodedata

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fe11_data as D  # noqa: E402
from fe11_extract import CART  # noqa: E402
from fe11_joins import joins  # noqa: E402
from fe13_bin import Bin  # noqa: E402
from nds_rom import Nds, lz10  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data-raw', 'fe11', 'art')
PERSON = 80
SIZE = 128


def slug(name):
    """The app's file name for a unit (artId): accents dropped, lower case, runs of anything else as _."""
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


def zero_runs(data):
    """Type 0x40 (arm9 0x2004070): the output starts as zeros; a byte other than 0 is copied, and a 0 is followed by a count of zeros to
    leave, plus one: one byte, or two (15 bits, high byte first) when the first's top bit is set."""
    size = int.from_bytes(data[1:4], 'little')
    out = bytearray(size)
    p, o = 4, 0
    while o < size:
        b = data[p]
        if b:
            out[o] = b
            o += 1
            p += 1
            continue
        n = data[p + 1]
        if n & 0x80:
            n = (n & 0x7f) << 8 | data[p + 2]
            p += 3
        else:
            p += 2
        o += n + 1
    return bytes(out)


def unpack(data):
    if data[0] == 0x40:
        return zero_runs(data)
    if data[0] == 0x10:
        return lz10(data)
    raise ValueError(f'compression {data[0]:#x} not handled')


def portrait(data):
    """A decompressed portrait -> a 128x128 RGBA image."""
    pal = []
    for i in range(256):
        v = struct.unpack_from('<H', data, 2 * i)[0]
        pal.append(((v & 31) * 255 // 31, (v >> 5 & 31) * 255 // 31, (v >> 10 & 31) * 255 // 31, 255 if i else 0))
    tiles = data[0x200:]
    img = Image.new('RGBA', (SIZE, SIZE))
    px = img.load()
    for block in range(4):
        bx, by = (block % 2) * 64, (block // 2) * 64
        for k in range(64):
            t = tiles[(block * 64 + k) * 64:(block * 64 + k + 1) * 64]
            tx, ty = bx + (k % 8) * 8, by + (k // 8) * 8
            for i, c in enumerate(t):
                px[tx + i % 8, ty + i // 8] = pal[c]
    return img


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else OUT
    os.makedirs(out, exist_ok=True)
    rom = Nds(CART)
    fb = Bin(rom.read('f/face.bin'))
    faces = {name: o for o, name in fb.labels}
    b = D.db()
    persons = {p['pid']: (p, o) for p, (_, o) in zip(D.persons(), D.table('Person', PERSON, 'Job'))}
    made = 0
    for pid in joins():
        p, o = persons[pid]
        fid = b.str(o + 4)
        face = faces.get(fid)
        if face is None:
            print('no face:', pid, fid)
            continue
        img = portrait(unpack(rom.read('f/' + fb.str(face + 8))))
        img.save(os.path.join(out, f'{slug(p["name"])}.png'))
        made += 1
    print(f'{made} portraits -> {os.path.abspath(out)}')


if __name__ == '__main__':
    main()
