"""
Make Shadow Dragon and the Blade of Light's portraits (FE1, the Switch release of the 1990 Famicom game) from the user's own dump,
ready for the app's Bulk Upload (Edit Mode -> Bulk Upload -> Shadow Dragon and the Blade of Light -> select the folder). The images
are the user's and stay on their machine: the output goes to data-raw/fe1/art/, which is git-ignored, and nothing here is ever
committed.

The Switch release carries no art of its own: the program holds the cartridge whole (fe1_units.py), and the portraits are the
cartridge's, drawn as sprites from its CHR ROM. Bank 10 (bank:$addr below; MMC4, bank n at $8000-$BFFF):
- $BD70: a character's portrait (character - 1 -> portrait P; $BDA5 the foes'), read at 10:$8730 for the portrait a unit shows
  (10:$8762 draws it).
- $8A14[P]: the 4 KB CHR bank, put at pattern table $0000 (10:$817C, through 15:$C9AE / $C9B6).
- $B71C[$8A63[P]]: a PPU write: $3F10, 16 bytes (the four sprite palettes; colour 0 of each is see-through), 0.
- $89C5[P]: the portrait's metasprite; $8795[P] points to its animation frames (a list of metasprites), the first drawn with the
  face as it rests (10:$8784; the mouth, mostly, filling the face's gap).
- The metasprites (bank 10's $BFD0 -> $8AB3, u16 pointers; drawn by 15:$E759): each a u16 template pointer, then a tile per
  sprite; the template is (attribute, y, x) per 8x8 sprite until a byte F0-FF; attribute bits 0-1 the palette, 6 and 7 the flips.
  The face goes into OAM first, so it is in front where the two overlap.

The NES's colours are drawn with a standard 2C02 palette (the Switch emulator's own table wasn't found in the program). The image is
the portrait at its native size (48x48, six sprites square), transparent where no sprite or a sprite's colour 0 is; the app scales
pixel art. The sprites paint the portrait's backdrop in (an orange in most), so, as snes_portraits.py does for Mystery of the Emblem,
the colour in the top-left corner is cleared wherever it touches the edge; --keep-box keeps it as the game shows it. File names are
the app's (src/tellius/logic.ts, artId): the English name lower-cased, runs of anything else as "_".

Run: python scripts/fe1_portraits.py [out folder] [--sheet sheet.png] [--keep-box]
     (a path to `main` may be given as fe1_units.py takes it; FE1_NSP reads the package instead of the extracted main.bin)
"""
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fe1_units as F  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'data-raw', 'fe1', 'art')
EXTRACTED = os.path.join(os.path.expanduser('~'), 'Documents', 'FE Games', 'Switch dumps', 'extracted', 'fe1', 'main.bin')

BANK = 10
CHAR_PORTRAIT = 0xBD70      # character - 1 -> portrait
PORTRAIT_CHR = 0x8A14       # portrait -> 4 KB CHR bank
PORTRAIT_PAL = 0x8A63       # portrait -> palette record (index into $B71C)
PALETTES = 0xB71C           # u16 pointers to PPU writes ($3F10, 16 bytes)
PORTRAIT_SPRITE = 0x89C5    # portrait -> metasprite
PORTRAIT_FRAMES = 0x8795    # portrait -> u16 pointer to its frame list
METASPRITES = 0xBFD0        # bank 10's u16 pointer to its metasprite table

# A standard NES (2C02) palette, $00-$3F.
NES_RGB = [
    0x7C7C7C, 0x0000FC, 0x0000BC, 0x4428BC, 0x940084, 0xA80020, 0xA81000, 0x881400,
    0x503000, 0x007800, 0x006800, 0x005800, 0x004058, 0x000000, 0x000000, 0x000000,
    0xBCBCBC, 0x0078F8, 0x0058F8, 0x6844FC, 0xD800CC, 0xE40058, 0xF83800, 0xE45C10,
    0xAC7C00, 0x00B800, 0x00A800, 0x00A844, 0x008888, 0x000000, 0x000000, 0x000000,
    0xF8F8F8, 0x3CBCFC, 0x6888FC, 0x9878F8, 0xF878F8, 0xF85898, 0xF87858, 0xFCA044,
    0xF8B800, 0xB8F818, 0x58D854, 0x58F898, 0x00E8D8, 0x787878, 0x000000, 0x000000,
    0xFCFCFC, 0xA4E4FC, 0xB8B8F8, 0xD8B8F8, 0xF8B8F8, 0xF8A4C0, 0xF0D0B0, 0xFCE0A8,
    0xF8D878, 0xD8F878, 0xB8F8B8, 0xB8F8D8, 0x00FCFC, 0xF8D8F8, 0x000000, 0x000000,
]


def art_id(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


def load(path=None):
    """The game from a program file (the extracted main.bin by default), else from the NSP (fe1_units.load)."""
    if not path and os.path.exists(EXTRACTED) and not os.environ.get('FE1_NSP'):
        path = EXTRACTED
    return F.load(path)


class Portraits:
    def __init__(self, game):
        self.c = game.c

    def u8(self, addr):
        return self.c.u8(BANK, addr)

    def u16(self, addr):
        return self.c.u16(BANK, addr)

    def tile(self, chr_bank, t):
        o = chr_bank * 0x1000 + t * 16
        raw = self.c.chr[o:o + 16]
        lo = np.unpackbits(np.frombuffer(raw[:8], np.uint8)).reshape(8, 8)
        hi = np.unpackbits(np.frombuffer(raw[8:], np.uint8)).reshape(8, 8)
        return lo | (hi << 1)

    def palettes(self, p):
        rec = self.u16(PALETTES + 2 * self.u8(PORTRAIT_PAL + p))
        head = self.c.read(BANK, rec, 3)
        assert (head[0], head[1], head[2]) == (0x3F, 0x10, 0x10), head.hex()
        colours = self.c.read(BANK, rec + 3, 16)
        return [[NES_RGB[colours[4 * k + i] & 0x3F] for i in range(4)] for k in range(4)]

    def sprites(self, m):
        """A metasprite's sprites: (attribute, y, x, tile)."""
        table = self.u16(METASPRITES)
        entry = self.u16(table + 2 * m)
        template = self.u16(entry)
        out, k = [], 0
        while True:
            attr = self.u8(template + 3 * k)
            if attr & 0xF0 == 0xF0:
                return out
            y, x = self.u8(template + 3 * k + 1), self.u8(template + 3 * k + 2)
            out.append((attr, y, x, self.u8(entry + 2 + k)))
            k += 1

    def portrait_of(self, character):
        return self.u8(CHAR_PORTRAIT + character - 1)

    def render(self, p):
        """Portrait p as the game draws it at rest: the face, then the first animation frame behind it (later OAM entries lose).
        A sprite's colour 0 shows what is behind it: the universal background colour ($3F00, which the write to $3F10 sets: black,
        $0F, in every portrait), which draws the outlines."""
        chr_bank = self.u8(PORTRAIT_CHR + p)
        pals = self.palettes(p)
        face = self.sprites(self.u8(PORTRAIT_SPRITE + p))
        first = self.u8(self.u16(PORTRAIT_FRAMES + 2 * p))   # 10:$8784: the list's first entry, whatever its value
        oam = face + self.sprites(first)
        w = max(x for _a, _y, x, _t in oam) + 8
        h = max(y for _a, y, _x, _t in oam) + 8
        img = np.zeros((h, w, 4), np.uint8)
        backdrop = pals[0][0]                        # $3F10 mirrors $3F00
        for _attr, y, x, _t in oam:
            img[y:y + 8, x:x + 8] = (backdrop >> 16, (backdrop >> 8) & 255, backdrop & 255, 255)
        for attr, y, x, t in reversed(oam):          # lower OAM index in front: paint the last first
            px = self.tile(chr_bank, t)
            if attr & 0x40:
                px = px[:, ::-1]
            if attr & 0x80:
                px = px[::-1, :]
            pal = pals[attr & 3]
            for yy in range(8):
                for xx in range(8):
                    v = px[yy, xx]
                    if v:
                        rgb = pal[v]
                        img[y + yy, x + xx] = (rgb >> 16, (rgb >> 8) & 255, rgb & 255, 255)
        return Image.fromarray(img, 'RGBA'), {'portrait': p, 'chr_bank': chr_bank, 'sprites': len(oam)}


def clear_box(im):
    """The backdrop the sprites paint in made see-through: the top-left corner's colour wherever it touches the edge."""
    from scipy import ndimage
    a = np.array(im)
    key = a[..., 0].astype(np.int32) << 16 | a[..., 1].astype(np.int32) << 8 | a[..., 2] | (a[..., 3] > 0) << 24
    parts, _ = ndimage.label(key == key[0, 0])
    edge = set(np.unique(np.concatenate([parts[0], parts[-1], parts[:, 0], parts[:, -1]]))) - {0}
    a[np.isin(parts, list(edge)), 3] = 0
    return Image.fromarray(a, 'RGBA')


def portraits(game):
    """[(file stem, name, info, PIL image)] for every playable unit."""
    units = F.build(game)['units']
    pr = Portraits(game)
    out = []
    for u in units:
        im, info = pr.render(pr.portrait_of(u['character']))
        info['character'] = u['character']
        out.append((art_id(u['name']), u['name'], info, im))
    return out


def contact_sheet(items, path, cols=8, scale=3):
    cell = 56 * scale
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cell, rows * (cell + 30)), (60, 60, 70, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (stem, label, im) in enumerate(items):
        x, y = (i % cols) * cell, (i // cols) * (cell + 30)
        big = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
        sheet.alpha_composite(big, (x + 4, y + 4))
        draw.text((x + 4, y + cell), stem, fill=(255, 255, 255, 255))
        draw.text((x + 4, y + cell + 12), label[:28], fill=(200, 200, 200, 255))
    sheet.save(path)


def main(argv):
    sheet = None
    keep_box = '--keep-box' in argv
    argv = [a for a in argv if a != '--keep-box']
    if '--sheet' in argv:
        k = argv.index('--sheet')
        sheet = argv[k + 1]
        del argv[k:k + 2]
    main_path = next((a for a in argv if os.path.isfile(a)), None)
    argv = [a for a in argv if a != main_path]
    out = argv[0] if argv else OUT
    os.makedirs(out, exist_ok=True)
    made = []
    for stem, name, info, im in portraits(load(main_path)):
        if not keep_box:
            im = clear_box(im)
        im.save(os.path.join(out, stem + '.png'))
        made.append((stem, f"{name} (p{info['portrait']:02X} chr{info['chr_bank']})", im))
    print(f'{len(made)} portraits written to {os.path.abspath(out)}')
    if sheet:
        contact_sheet(made, sheet)


if __name__ == '__main__':
    main(sys.argv[1:])
