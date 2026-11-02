"""Decode 3DS (CTR) textures and CTPK texture packages into Pillow images: the formats Awakening's portraits use (ETC1, ETC1A4)
and the plain ones. Reads only what the user's own dump holds; the images it makes are theirs and are never committed.

CTPK: 'CTPK', u16 version, u16 count, u32 data offset, u32 data size, ... then one 0x20-byte entry per texture: u32 name offset, u32
size, u32 offset (from the data offset), u32 format, u16 width, u16 height, u8 mip levels.
"""
import struct

from PIL import Image

# The PICA200's texture formats, as CTPK and BCH number them.
FORMATS = {0: 'RGBA8', 1: 'RGB8', 2: 'RGBA5551', 3: 'RGB565', 4: 'RGBA4', 5: 'LA8', 7: 'L8', 8: 'A8', 9: 'LA4', 10: 'L4', 11: 'A4',
           12: 'ETC1', 13: 'ETC1A4'}

ETC1_MODIFIERS = [(2, 8), (5, 17), (9, 29), (13, 42), (18, 60), (24, 80), (33, 106), (47, 183)]


def _clamp(v):
    return 0 if v < 0 else 255 if v > 255 else v


def _etc1_block(block):
    """One 4x4 ETC1 block (a 64-bit integer, the standard bit layout) -> 16 RGB tuples, indexed [x * 4 + y]."""
    flip = (block >> 32) & 1
    diff = (block >> 33) & 1
    tables = (ETC1_MODIFIERS[(block >> 37) & 7], ETC1_MODIFIERS[(block >> 34) & 7])
    if diff:
        def signed3(v):
            return v - 8 if v & 4 else v
        c1 = [(block >> s) & 0x1f for s in (59, 51, 43)]
        c2 = [c + signed3((block >> s) & 7) for c, s in zip(c1, (56, 48, 40))]
        bases = [tuple((c << 3) | (c >> 2) for c in cs) for cs in (c1, c2)]
    else:
        c1 = [(block >> s) & 0xf for s in (60, 52, 44)]
        c2 = [(block >> s) & 0xf for s in (56, 48, 40)]
        bases = [tuple(c * 17 for c in cs) for cs in (c1, c2)]
    out = []
    for i in range(16):
        x, y = i // 4, i % 4
        sub = (y >= 2) if flip else (x >= 2)
        small, large = tables[sub]
        index = (((block >> (16 + i)) & 1) << 1) | ((block >> i) & 1)
        mod = (small, large, -small, -large)[index]
        out.append(tuple(_clamp(c + mod) for c in bases[sub]))
    return out


def decode(data, width, height, fmt):
    """A texture's pixels -> an RGBA image: 8x8 tiles, left to right and top to bottom, as Awakening's portraits are stored."""
    img = Image.new('RGBA', (width, height))
    px = img.load()
    name = FORMATS.get(fmt)
    if name in ('ETC1', 'ETC1A4'):
        alpha = name == 'ETC1A4'
        p = 0
        for ty in range(0, height, 8):
            for tx in range(0, width, 8):
                # Each 8x8 tile holds four 4x4 blocks: top left, top right, bottom left, bottom right.
                for bx, by in ((0, 0), (4, 0), (0, 4), (4, 4)):
                    a = 0xffffffffffffffff
                    if alpha:
                        a = struct.unpack_from('<Q', data, p)[0]
                        p += 8
                    block = struct.unpack_from('<Q', data, p)[0]
                    p += 8
                    colours = _etc1_block(block)
                    for i, (r, g, b) in enumerate(colours):
                        x, y = i // 4, i % 4
                        av = ((a >> (4 * i)) & 0xf) * 17 if alpha else 255
                        px[tx + bx + x, ty + by + y] = (r, g, b, av)
        return img
    raise ValueError(f'texture format {fmt} ({name}) not handled')


def ctpk(d):
    """A decompressed CTPK -> {texture name: image}."""
    assert d[:4] == b'CTPK', 'not a CTPK'
    _, _, count, data_off = struct.unpack_from('<4sHHI', d, 0)
    out = {}
    for i in range(count):
        name_off, size, off, fmt, w, h = struct.unpack_from('<IIIIHH', d, 0x20 + i * 0x20)
        name = d[name_off:d.index(b'\0', name_off)].decode('shift_jis')
        out[name] = decode(d[data_off + off:data_off + off + size], w, h, fmt)
    return out
