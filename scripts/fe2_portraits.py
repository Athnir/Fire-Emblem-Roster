"""
Make Fire Emblem Gaiden's portraits (FE2, Famicom) from the user's own ROM, ready for the app's Bulk Upload. The images are the
user's and stay on their machine: the output goes to data-raw/fe2/art/, which is git-ignored, and nothing here is ever committed.

The portraits are the cartridge's, drawn as sprites from its CHR ROM by bank 9 (bank:$addr below; MMC4, bank n at $8000-$BFFF):
- $BDBF[character]: the portrait P a character shows (9:$AE34; a dialogue's $E8 x y character, 10:$84D0). Alm once promoted shows
  the one for 36 ($24) and Celica the one for 37 ($25) (9:$AE1F, the flags $744A and $744B).
- $B014[P]: the 4 KB CHR bank, put at pattern table $0000 for sprites (9:$AC6D through 15:$CA48 / $CA50).
- $BAFD[P] (u16 pointers): 12 bytes, three colours for each of the four sprite palettes; colour 0 of each is black ($0F, 9:$AC92),
  which draws the outlines and the background.
- $AE97[P] (u16 pointers): 36 tiles, a 6 x 6 grid of 8x8 sprites row by row, at y $AE4F[k] and x $AE73[k] (9:$ACF4); $AF6B[P] (u16
  pointers): 18 bytes, two sprites' attributes each (bits 7-6 the first's flips, 5-4 its palette; 3-2 the second's flips, 1-0 its
  palette; 9:$AD8A). At rest the mouth frames ($AF01[P], 9:$ADCA) aren't drawn.

The NES's colours are drawn with a standard 2C02 palette (as fe1_portraits.py does). The image is the portrait at its native size
(48x48); the sprites paint a backdrop in (an orange in most), so, as fe1_portraits.py does, the top-left corner's colour is cleared
wherever it touches the edge; --keep-box keeps it as the game shows it. File names are the app's (src/tellius/logic.ts, artId): the
unit's name (fe2_units.py) lower-cased, runs of anything else as "_".

Run: python scripts/fe2_portraits.py [out folder] [--sheet sheet.png] [--keep-box] [--promoted]
     (--promoted also writes Alm's and Celica's promoted portraits as <name>_promoted.png)
"""
import os
import re
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fe1_portraits import NES_RGB, clear_box, contact_sheet  # noqa: E402
from fe2_rom import Rom  # noqa: E402
from fe2_units import FE2, build  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'data-raw', 'fe2', 'art')
BANK = 9
CHAR_PORTRAIT, PORTRAIT_CHR, PORTRAIT_PAL = 0xBDBF, 0xB014, 0xBAFD
PORTRAIT_TILES, PORTRAIT_ATTRS, SPRITE_Y, SPRITE_X = 0xAE97, 0xAF6B, 0xAE4F, 0xAE73
PROMOTED = {1: 0x24, 2: 0x25}      # 9:$AE24, $AE31


def art_id(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


class Portraits:
    def __init__(self, rom):
        self.r = rom

    def u8(self, addr):
        return self.r.u8(BANK, addr)

    def u16(self, addr):
        return self.r.u16(BANK, addr)

    def portrait_of(self, character):
        return self.u8(CHAR_PORTRAIT + character)

    def render(self, p):
        chr_bank = self.u8(PORTRAIT_CHR + p)
        cols = self.r.read(BANK, self.u16(PORTRAIT_PAL + 2 * p), 12)
        pals = [[0x0F] + list(cols[3 * k:3 * k + 3]) for k in range(4)]
        tiles = self.r.read(BANK, self.u16(PORTRAIT_TILES + 2 * p), 36)
        packed = self.r.read(BANK, self.u16(PORTRAIT_ATTRS + 2 * p), 18)
        attrs = []
        for b in packed:
            attrs += [(b & 0xC0) | (b & 0x30) >> 4, (b & 0x0C) << 4 | (b & 0x03)]
        ys = self.r.read(BANK, SPRITE_Y, 36)
        xs = [(x + 16) & 0xFF for x in self.r.read(BANK, SPRITE_X, 36)]     # -16..24 -> 0..40
        img = np.zeros((48, 48, 4), np.uint8)
        for k in range(36):
            px = np.array(self.r.tile(chr_bank, tiles[k]), np.uint8)
            if attrs[k] & 0x40:
                px = px[:, ::-1]
            if attrs[k] & 0x80:
                px = px[::-1, :]
            pal = pals[attrs[k] & 3]
            for yy in range(8):
                for xx in range(8):
                    rgb = NES_RGB[pal[px[yy, xx]] & 0x3F]
                    img[ys[k] + yy, xs[k] + xx] = (rgb >> 16, (rgb >> 8) & 255, rgb & 255, 255)
        return Image.fromarray(img, 'RGBA'), {'portrait': p, 'chr_bank': chr_bank}


def portraits(rom, promoted=False):
    """[(file stem, label, info, image)] for every unit that joins (Alm and Celica as they start)."""
    units = build(FE2(rom))['units']
    pr = Portraits(rom)
    out = []
    for u in units:
        im, info = pr.render(pr.portrait_of(u['character']))
        out.append((art_id(u['name']), u['name'], info, im))
        if promoted and u['character'] in PROMOTED:
            im, info = pr.render(pr.portrait_of(PROMOTED[u['character']]))
            out.append((art_id(u['name']) + '_promoted', u['name'] + ' (promoted)', info, im))
    return out


def main(argv):
    sheet = None
    keep_box = '--keep-box' in argv
    promoted = '--promoted' in argv
    argv = [a for a in argv if a not in ('--keep-box', '--promoted')]
    if '--sheet' in argv:
        k = argv.index('--sheet')
        sheet = argv[k + 1]
        del argv[k:k + 2]
    rom_path = next((a for a in argv if a.lower().endswith('.nes')), None)
    argv = [a for a in argv if a != rom_path]
    out = argv[0] if argv else OUT
    os.makedirs(out, exist_ok=True)
    made = []
    for stem, label, info, im in portraits(Rom(rom_path), promoted):
        if not keep_box:
            im = clear_box(im)
        im.save(os.path.join(out, stem + '.png'))
        made.append((stem, f"{label} (p{info['portrait']:02X} chr{info['chr_bank']})", im))
    print(f'{len(made)} portraits written to {os.path.abspath(out)}')
    if sheet:
        contact_sheet(made, sheet)


if __name__ == '__main__':
    main(sys.argv[1:])
