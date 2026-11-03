"""
Make Shadows of Valentia's portraits from the user's own cartridge image, for the app's Bulk Upload (Edit Mode -> Bulk Upload ->
Shadows of Valentia -> select the folder). The images are the user's and stay on their machine: the output goes to data-raw/fe15/art/,
which is git-ignored, and nothing here is ever committed.

A person's face is Person.bin +12 (FID_<name>). face/FaceData.bin (Awakening's container, 88 bytes a face) has a record per use,
FSID_BU_<name> the bust-up the status screen draws (the program builds the label as FSID_BU_%s, and FSID_BU_%s%s for a variant: Alm's
and Celica's 上級 once promoted, 下画面 on the lower screen); its +12 names the archive, face/face/<+12>.arc (player/アルム_bu). The
archive is Awakening's container: from its Info table, one [name, index, size, offset] per expression (offsets from the Data label),
each an LZ11 BCH (`通常.bch.lz` the normal one). The BCH holds one texture: its GPU commands set texture unit 0's size (register 0x82:
width << 16 | height), address in the data section (0x85) and format (0x8e: 13, ETC1A4); 256x256, decoded by scripts/ctr_texture.py.
Each unit's portrait is the one they join with (not the promoted Alm's or Celica's), written as <name>.png, named as the app names them
(src/data/fe15/fe15Units.ts). The game's "bust-up" is the figure down to the waist; the file is cut to the head and shoulders (a
136-pixel square from just above the head, centred on it, scaled to 256), as the app's small square boxes show the other games'.
--full keeps the whole texture.

Run: python scripts/fe15_portraits.py [out folder] [--full]
"""
import os
import struct
import sys
import unicodedata

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ctr_formats as F  # noqa: E402
import fates_text  # noqa: E402
import fe15_joins as J  # noqa: E402
from fates_lz import decompress  # noqa: E402
from fe13_bin import Bin  # noqa: E402
from fe15_extract import CART  # noqa: E402
from ncch_romfs import RomFS, ncsd_partitions  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ROMFS = os.path.join(ROOT, 'data-raw', 'fe15', 'romfs')
OUT = os.path.join(ROOT, 'data-raw', 'fe15', 'art')


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


def bch_textures(d):
    """A BCH's textures as images, from its GPU commands: texture unit 0's size (0x82), address (0x85, in the data section) and format
    (0x8e), each set taken when the format is written."""
    assert d[:4] == b'BCH\0', 'not a BCH'
    backward = d[4]
    words = struct.unpack_from('<%dI' % (14 if backward > 0x20 else 12), d, 8)
    gpu_off, data_off = words[2], words[3]
    gpu_len = words[8] if backward > 0x20 else words[7]
    out, regs, seen = [], {}, set()
    p, end = gpu_off, gpu_off + gpu_len
    while p < end:
        param, header = struct.unpack_from('<II', d, p)
        reg, extra = header & 0xffff, (header >> 20) & 0x7ff
        consecutive = header >> 31
        params = [param, *struct.unpack_from('<%dI' % extra, d, p + 8)]
        for k, v in enumerate(params):
            regs[reg + k if consecutive else reg] = v
        if reg == 0x8e or (consecutive and reg <= 0x8e < reg + len(params)):
            dims, addr, fmt = regs.get(0x82, 0), regs.get(0x85, 0), regs[0x8e] & 0xf
            key = (dims, addr, fmt)
            if key not in seen:
                seen.add(key)
                w, h = dims >> 16, dims & 0xffff
                size = w * h * F.BPP[fmt] // 8
                out.append(F.decode(d[data_off + addr:data_off + addr + size], w, h, fmt))
        p += 8 + 4 * extra
        p += p % 8
    return out


BUST = 136


def bust(im):
    """The head and shoulders: a BUST-pixel square from just above the head, centred on the head's opaque pixels, scaled to 256."""
    a = np.array(im.convert('RGBA'))[:, :, 3]
    rows = np.where(a.max(axis=1) > 128)[0]
    top = max(0, int(rows[0]) - 6)
    head = a[top:top + 70] > 128
    xs = np.where(head.any(axis=0))[0]
    weights = head.sum(axis=0)[xs]
    cx = int(round((xs * weights).sum() / weights.sum()))
    left = min(max(0, cx - BUST // 2), im.width - BUST)
    top = min(top, im.height - BUST)
    return im.crop((left, top, left + BUST, top + BUST)).resize((256, 256), Image.LANCZOS)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    out = args[0] if args else OUT
    full = '--full' in sys.argv
    os.makedirs(out, exist_ok=True)
    part = dict((i, o) for i, o, _ in ncsd_partitions(CART))[0]
    rom = RomFS(CART, part)
    files = {p: (off, size) for p, off, size in rom.walk() if p.startswith('/face/')}

    def read(path):
        off, size = files[path]
        return rom.read(off, size)

    fd = Bin(decompress(read('/face/FaceData.bin.lz')))
    faces = {name: o for o, name in fd.labels}
    names = fates_text.read(os.path.join(ROMFS, 'm', '@NOA_EN', 'Name.bin.lz'))
    pb = Bin(decompress(open(os.path.join(ROMFS, 'Data', 'Person.bin.lz'), 'rb').read()))
    # The units as scripts/build-fe15-units.py finds them: who joins (the event sheets), by name, each name's first PID.
    people = {}
    for o, n in pb.labels:
        if n.startswith('PID_') and (o + 4) in pb.ptrs:
            nm = names.get(pb.str(o + 4))
            if nm and nm not in people:
                people[nm] = o
    made = 0
    for key in J.joins():
        nm = names.get('MPID_' + key)
        o = people.get(nm)
        if o is None:
            continue
        fid = pb.str(o + 12)
        face = faces.get('FSID_BU_' + fid[4:])
        if face is None:
            print('no bust-up face:', nm, fid)
            continue
        arc = Bin(read('/face/face/' + fd.str(face + 12) + '.arc'))
        base = 0x20 + arc.at['Data']
        lo = arc.at['通常.bch.lz']
        size, start = arc.u32(lo + 8), arc.u32(lo + 12)
        textures = bch_textures(decompress(arc.d[base + start:base + start + size]))
        (textures[0] if full else bust(textures[0])).save(os.path.join(out, f'{slug(nm)}.png'))
        made += 1
    print(f'{made} portraits -> {os.path.abspath(out)}')


if __name__ == '__main__':
    main()
