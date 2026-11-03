"""The 3DS (PICA200) texture formats ctr_texture.py leaves out: the plain ones (RGBA8, RGB8, RGBA5551, RGB565, RGBA4, LA8, L8, A8, LA4,
L4, A4), and a CTPK reader that takes any format, handing ETC1 and ETC1A4 to ctr_texture. Used for the games' icon sheets (Awakening's
`systems/icon_E.ctpk`, RGBA4) and Shadows of Valentia's textures. Reads only what the user's own dump holds.

A plain texture is stored in 8x8 tiles, left to right and top to bottom (as ctr_texture's ETC1), each tile's 64 pixels in Z order
(Morton: the bits of x and y interleaved, x lowest).
"""
import struct

from PIL import Image

import ctr_texture

BPP = {0: 32, 1: 24, 2: 16, 3: 16, 4: 16, 5: 16, 6: 16, 7: 8, 8: 8, 9: 8, 10: 4, 11: 4, 12: 4, 13: 8}


def _morton(i):
    """The (x, y) inside an 8x8 tile of the i-th pixel stored."""
    x = (i & 1) | ((i >> 1) & 2) | ((i >> 2) & 4)
    y = ((i >> 1) & 1) | ((i >> 2) & 2) | ((i >> 3) & 4)
    return x, y


MORTON = [_morton(i) for i in range(64)]


def _pixel(data, p, fmt, i):
    """The i-th pixel (from p, the tile's start) as RGBA."""
    if fmt == 0:  # RGBA8, stored A B G R
        a, b, g, r = data[p + 4 * i:p + 4 * i + 4]
        return r, g, b, a
    if fmt == 1:  # RGB8, stored B G R
        b, g, r = data[p + 3 * i:p + 3 * i + 3]
        return r, g, b, 255
    if fmt in (2, 3, 4, 5, 6):
        v = struct.unpack_from('<H', data, p + 2 * i)[0]
        if fmt == 2:  # RGBA5551
            return tuple(((v >> s) & 31) * 255 // 31 for s in (11, 6, 1)) + ((v & 1) * 255,)
        if fmt == 3:  # RGB565
            return ((v >> 11) & 31) * 255 // 31, ((v >> 5) & 63) * 255 // 63, (v & 31) * 255 // 31, 255
        if fmt == 4:  # RGBA4
            return tuple(((v >> s) & 15) * 17 for s in (12, 8, 4, 0))
        if fmt == 5:  # LA8: L in the high byte
            return (v >> 8, v >> 8, v >> 8, v & 255)
        return (v >> 8, v & 255, 0, 255)  # HILO8
    if fmt == 7:  # L8
        v = data[p + i]
        return v, v, v, 255
    if fmt == 8:  # A8
        return 255, 255, 255, data[p + i]
    if fmt == 9:  # LA4
        v = data[p + i]
        return (v >> 4) * 17, (v >> 4) * 17, (v >> 4) * 17, (v & 15) * 17
    v = (data[p + i // 2] >> (4 * (i & 1))) & 15
    if fmt == 10:  # L4
        return v * 17, v * 17, v * 17, 255
    return 255, 255, 255, v * 17  # A4


def decode(data, width, height, fmt):
    """A texture's pixels -> an RGBA image."""
    if fmt in (12, 13):
        return ctr_texture.decode(data, width, height, fmt)
    img = Image.new('RGBA', (width, height))
    px = img.load()
    tile = 64 * BPP[fmt] // 8
    p = 0
    for ty in range(0, height, 8):
        for tx in range(0, width, 8):
            for i, (x, y) in enumerate(MORTON):
                px[tx + x, ty + y] = _pixel(data, p, fmt, i)
            p += tile
    return img


def ctpk(d):
    """A decompressed CTPK -> {texture name: image}, any format."""
    assert d[:4] == b'CTPK', 'not a CTPK'
    _, _, count, data_off = struct.unpack_from('<4sHHI', d, 0)
    out = {}
    for i in range(count):
        name_off, size, off, fmt, w, h = struct.unpack_from('<IIIIHH', d, 0x20 + i * 0x20)
        name = d[name_off:d.index(b'\0', name_off)].decode('shift_jis')
        out[name] = decode(d[data_off + off:data_off + off + size], w, h, fmt)
    return out
