"""Read Koei Tecmo's G1T texture files (Fire Emblem: Three Houses, Switch) without other tools but numpy and texture2ddecoder.

Layout (little-endian; version '0600' in Three Houses):
  +0x00 'GT1G', +0x04 version (4 ASCII digits), +0x08 file size, +0x0C the offset table's offset, +0x10 texture count,
  +0x14 platform (0x10 the Switch), +0x18 extra size; from +0x1C a u32 of flags per texture; at the table, a u32 per texture: its
  header's offset from the table.
  A texture's header (8 bytes): +0 mip count (high nibble), +1 format, +2 log2 width (low nibble) and height (high nibble), +3 -,
  +4..+7 flags; when the last flag byte's bit 0 is set (0x10000000 as a u32) a u32 extended-header size follows (including itself),
  then the extension: from 0x10 bytes on, u32 width and height that override the log2 dimensions. The image data follows.
  Switch textures are block-linear (Tegra X1): 64-byte x 8-row GOBs, gathered into blocks of 1-16 GOBs high.

    G1T(data).textures     [{'format', 'width', 'height', 'mips', 'data'}]
    decode(texture)        a PIL RGBA image of mip 0
"""
import struct

import numpy as np
import texture2ddecoder as T
from PIL import Image

# format -> (block width, block height, bytes per block, decoder)
FORMATS = {
    0x00: (1, 1, 4, 'rgba'),
    0x01: (1, 1, 4, 'bgra'),
    0x06: (4, 4, 8, 'bc1'),
    0x08: (4, 4, 16, 'bc3'),
    0x59: (4, 4, 8, 'bc1'),
    0x5B: (4, 4, 16, 'bc3'),
    0x5C: (4, 4, 8, 'bc4'),
    0x5D: (4, 4, 16, 'bc5'),
    0x5F: (4, 4, 16, 'bc7'),
}


class G1T:
    def __init__(self, data):
        assert data[:4] == b'GT1G', data[:4]
        self.version = data[4:8].decode()
        _size, table, count, self.platform, _extra = struct.unpack_from('<5I', data, 8)
        offsets = struct.unpack_from(f'<{count}I', data, table)
        self.textures = []
        for k, off in enumerate(offsets):
            p = table + off
            mips_z, fmt, dims, _x = data[p:p + 4]
            flags = struct.unpack_from('<I', data, p + 4)[0]
            w, h = 1 << (dims & 15), 1 << (dims >> 4)
            q = p + 8
            if flags & 0x10000000:
                ext = struct.unpack_from('<I', data, q)[0]
                if ext >= 0x14:
                    w, h = struct.unpack_from('<II', data, q + 0xC)
                q += ext
            end = table + offsets[k + 1] if k + 1 < len(offsets) else len(data)
            self.textures.append({'format': fmt, 'width': w, 'height': h, 'mips': mips_z >> 4, 'flags': flags,
                                  'data': data[q:end]})


def _gobs_per_block(height_in_blocks):
    """The block height the Tegra driver picks for a surface: the smallest power of two GOBs (1-16) covering it."""
    b = 1
    while b < 16 and b * 8 < height_in_blocks:
        b *= 2
    return b


def deswizzle(data, bw, bh, bpp, gobs=None):
    """Tegra X1 block-linear to linear: bw x bh elements of bpp bytes each."""
    gobs = gobs or _gobs_per_block(bh)
    width_bytes = bw * bpp
    gobs_x = (width_bytes + 63) // 64
    padded_h = (bh + 8 * gobs - 1) // (8 * gobs) * (8 * gobs)
    need = gobs_x * 512 * padded_h // 8
    src = np.frombuffer(data[:need].ljust(need, b'\0'), np.uint8)
    x = np.arange(width_bytes)[None, :]
    y = np.arange(bh)[:, None]
    addr = ((y // (8 * gobs)) * 512 * gobs * gobs_x + (x // 64) * 512 * gobs + ((y % (8 * gobs)) // 8) * 512 +
            ((x % 64) // 32) * 256 + ((y % 8) // 2) * 64 + ((x % 32) // 16) * 32 + (y % 2) * 16 + (x % 16))
    return src[addr].tobytes()


def decode(tex, swizzled=True, gobs=None):
    bw_px, bh_px, bpp, kind = FORMATS[tex['format']]
    w, h = tex['width'], tex['height']
    bw, bh = (w + bw_px - 1) // bw_px, (h + bh_px - 1) // bh_px
    raw = deswizzle(tex['data'], bw, bh, bpp, gobs) if swizzled else tex['data'][:bw * bh * bpp]
    pw, ph = bw * bw_px, bh * bh_px
    if kind in ('rgba', 'bgra'):
        im = Image.frombytes('RGBA', (pw, ph), raw)
        if kind == 'bgra':
            b, g, r, a = im.split()
            im = Image.merge('RGBA', (r, g, b, a))
        return im.crop((0, 0, w, h))
    fn = {'bc1': T.decode_bc1, 'bc3': T.decode_bc3, 'bc4': T.decode_bc4, 'bc5': T.decode_bc5, 'bc7': T.decode_bc7}[kind]
    out = fn(raw, pw, ph)
    b, g, r, a = Image.frombytes('RGBA', (pw, ph), out).split()   # texture2ddecoder gives BGRA
    return Image.merge('RGBA', (r, g, b, a)).crop((0, 0, w, h))
