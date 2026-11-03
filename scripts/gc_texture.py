"""
GameCube / Wii textures: TPL files and the texture formats the GX hardware draws (big-endian). Used to read the
portraits and icons of Path of Radiance and Radiant Dawn (scripts/tellius_art.py).

TPL: magic 0x0020AF30, image count, image table offset; the table holds (image header, palette header) offset
pairs. An image header is height u16, width u16, format u32, data offset u32 (then wrap and filter settings);
a palette header is entry count u16, 2 bytes, format u32 (0 IA8, 1 RGB565, 2 RGB5A3), data offset u32.

Formats are stored in tiles (blocks): I4 and C4 8x8, I8/IA4/C8 8x4, IA8/RGB565/RGB5A3/RGBA8/C14X2 4x4, CMPR 8x8
made of four 4x4 DXT1-style sub-blocks. Each decoder returns an RGBA numpy array (height, width, 4) of uint8.
"""
import struct

import numpy as np

TPL_MAGIC = 0x0020AF30

FORMATS = {0: 'I4', 1: 'I8', 2: 'IA4', 3: 'IA8', 4: 'RGB565', 5: 'RGB5A3', 6: 'RGBA8', 8: 'C4', 9: 'C8', 10: 'C14X2',
           14: 'CMPR'}
# Block width, block height, bits per pixel.
BLOCKS = {0: (8, 8, 4), 1: (8, 4, 8), 2: (8, 4, 8), 3: (4, 4, 16), 4: (4, 4, 16), 5: (4, 4, 16), 6: (4, 4, 32),
          8: (8, 8, 4), 9: (8, 4, 8), 10: (4, 4, 16), 14: (8, 8, 4)}


def data_size(fmt, w, h):
    bw, bh, bpp = BLOCKS[fmt]
    bx, by = (w + bw - 1) // bw, (h + bh - 1) // bh
    return bx * by * bw * bh * bpp // 8


def _untile(values, w, h, bw, bh):
    """values: per-pixel array in block order (blocks row by row, pixels inside a block row by row) -> (h, w, ...)."""
    bx, by = (w + bw - 1) // bw, (h + bh - 1) // bh
    rest = values.shape[1:]
    v = values[:bx * by * bw * bh].reshape((by, bx, bh, bw) + rest)
    v = v.transpose((0, 2, 1, 3) + tuple(range(4, 4 + len(rest)))).reshape((by * bh, bx * bw) + rest)
    return v[:h, :w]


def _expand(v, bits):
    v = v.astype(np.uint16)
    if bits == 3:
        return ((v << 5) | (v << 2) | (v >> 1)).astype(np.uint8)
    if bits == 4:
        return ((v << 4) | v).astype(np.uint8)
    if bits == 5:
        return ((v << 3) | (v >> 2)).astype(np.uint8)
    if bits == 6:
        return ((v << 2) | (v >> 4)).astype(np.uint8)
    return v.astype(np.uint8)


def rgb565(v):
    v = np.asarray(v, dtype=np.uint16)
    out = np.empty(v.shape + (4,), np.uint8)
    out[..., 0] = _expand((v >> 11) & 0x1F, 5)
    out[..., 1] = _expand((v >> 5) & 0x3F, 6)
    out[..., 2] = _expand(v & 0x1F, 5)
    out[..., 3] = 255
    return out


def rgb5a3(v):
    v = np.asarray(v, dtype=np.uint16)
    out = np.empty(v.shape + (4,), np.uint8)
    opaque = (v & 0x8000) != 0
    out[..., 0] = np.where(opaque, _expand((v >> 10) & 0x1F, 5), _expand((v >> 8) & 0xF, 4))
    out[..., 1] = np.where(opaque, _expand((v >> 5) & 0x1F, 5), _expand((v >> 4) & 0xF, 4))
    out[..., 2] = np.where(opaque, _expand(v & 0x1F, 5), _expand(v & 0xF, 4))
    out[..., 3] = np.where(opaque, 255, _expand((v >> 12) & 0x7, 3))
    return out


def ia8(v):
    v = np.asarray(v, dtype=np.uint16)
    out = np.empty(v.shape + (4,), np.uint8)
    i = (v & 0xFF).astype(np.uint8)
    out[..., 0] = out[..., 1] = out[..., 2] = i
    out[..., 3] = (v >> 8).astype(np.uint8)
    return out


def palette(data, off, count, fmt):
    """A TLUT: count big-endian u16 entries -> (count, 4) RGBA."""
    v = np.frombuffer(data, '>u2', count, off)
    return {0: ia8, 1: rgb565, 2: rgb5a3}[fmt](v)


def decode(data, off, fmt, w, h, tlut=None):
    """One texture at data[off:] -> RGBA array (h, w, 4). tlut: an (n, 4) RGBA palette for C4/C8/C14X2."""
    bw, bh, bpp = BLOCKS[fmt]
    n_pix = ((w + bw - 1) // bw) * ((h + bh - 1) // bh) * bw * bh
    raw = np.frombuffer(data, np.uint8, n_pix * bpp // 8, off)
    if fmt == 14:
        return _cmpr(raw, w, h)
    if bpp == 4:
        nib = np.empty(n_pix, np.uint8)
        nib[0::2] = raw >> 4
        nib[1::2] = raw & 0xF
        if fmt == 0:
            i = _expand(nib, 4)
            px = np.stack([i, i, i, i], -1)
        else:
            px = tlut[nib]
    elif bpp == 8:
        if fmt == 1:
            px = np.stack([raw, raw, raw, raw], -1)
        elif fmt == 2:
            i = _expand(raw & 0xF, 4)
            a = _expand(raw >> 4, 4)
            px = np.stack([i, i, i, a], -1)
        else:
            px = tlut[raw]
    elif bpp == 16:
        v = raw.view('>u2')
        if fmt == 3:
            px = ia8(v)
        elif fmt == 4:
            px = rgb565(v)
        elif fmt == 5:
            px = rgb5a3(v)
        else:
            px = tlut[v & 0x3FFF]
    else:  # RGBA8: each 4x4 block is 32 bytes of AR pairs then 32 bytes of GB pairs
        blocks = raw.reshape(-1, 2, 16, 2)
        ar, gb = blocks[:, 0], blocks[:, 1]
        px = np.stack([ar[..., 1], gb[..., 0], gb[..., 1], ar[..., 0]], -1).reshape(-1, 4)
    return np.ascontiguousarray(_untile(px, w, h, bw, bh))


def _cmpr(raw, w, h):
    """CMPR: 8x8 tiles of four 4x4 sub-blocks (top-left, top-right, bottom-left, bottom-right), each two RGB565
    colours then 2-bit indices (big-endian, most significant pixel first)."""
    sub = raw.reshape(-1, 8)
    c0 = sub[:, 0].astype(np.uint16) << 8 | sub[:, 1]
    c1 = sub[:, 2].astype(np.uint16) << 8 | sub[:, 3]
    p0, p1 = rgb565(c0).astype(np.int32), rgb565(c1).astype(np.int32)
    more = c0 > c1
    pal = np.zeros((len(sub), 4, 4), np.int32)
    pal[:, 0], pal[:, 1] = p0, p1
    # c0 > c1: 2/3 and 1/3 blends (the hardware rounds as (2a + b) / 3); otherwise the half blend and transparent.
    pal[:, 2] = np.where(more[:, None], (2 * p0 + p1) // 3, (p0 + p1) // 2)
    pal[:, 3] = np.where(more[:, None], (p0 + 2 * p1) // 3, 0)
    pal[:, 2, 3] = 255
    pal[:, 3, 3] = np.where(more, 255, 0)
    idx = sub[:, 4:8]
    bits = np.stack([(idx >> s) & 3 for s in (6, 4, 2, 0)], -1).reshape(-1, 16)  # 16 pixels per sub-block
    px = np.take_along_axis(pal, bits[..., None].repeat(4, -1).astype(np.intp), 1).astype(np.uint8)  # (n, 16, 4)
    # Sub-blocks -> 8x8 tiles: (tiles, 2 rows of sub-blocks, 2 sub-blocks, 4, 4) -> (tiles, 8, 8)
    t = px.reshape(-1, 2, 2, 4, 4, 4).transpose(0, 1, 3, 2, 4, 5).reshape(-1, 64, 4)
    return np.ascontiguousarray(_untile(t.reshape(-1, 4), w, h, 8, 8))


def read_tpl(data, base=0):
    """A TPL at data[base:] -> [{'w', 'h', 'fmt', 'rgba'}] for each image."""
    magic, count, table = struct.unpack_from('>3I', data, base)
    assert magic == TPL_MAGIC, 'not a TPL'
    out = []
    for k in range(count):
        img_hdr, pal_hdr = struct.unpack_from('>2I', data, base + table + k * 8)
        h, w, fmt, off = struct.unpack_from('>HHII', data, base + img_hdr)
        tlut = None
        if pal_hdr and fmt in (8, 9, 10):
            n, _, _, pfmt, poff = struct.unpack_from('>HBBII', data, base + pal_hdr)
            tlut = palette(data, base + poff, n, pfmt)
            if len(tlut) < (16 if fmt == 8 else 256 if fmt == 9 else 16384):
                tlut = np.concatenate([tlut, np.zeros(((16 if fmt == 8 else 256 if fmt == 9 else 16384) - len(tlut), 4),
                                                      np.uint8)])
        out.append({'w': w, 'h': h, 'fmt': fmt, 'rgba': decode(data, base + off, fmt, w, h, tlut)})
    return out
