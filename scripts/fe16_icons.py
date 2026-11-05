"""
Make Fire Emblem: Three Houses' ability and combat art icons from the user's own dump, ready for the app's Bulk Upload (a "skills"
folder in the game's folder). The images are the user's and stay on their machine: the output goes to data-raw/fe16/art/skills/,
which is git-ignored, and nothing here is ever committed.

Where the game keeps them (traced in the 1.2.0 program, the update's main NSO, relocated at 0):

- A UI sprite id names a 16-byte record: u16 texture (in its bank's G1T), u16 index in the bank, u16 x, y, w, h, u16 the
  texture's w, h. The id's range picks the bank (0x5c5540): 0-725 bank 0, from 31572 bank 9. Bank k's records are at the
  pointer main.bin keeps at 0x1ab0b78 + 8k: bank 0 at 0xd52d64 (725 records), bank 9 at 0x11991c4 (75).
- Bank 0's textures are archive file 6026 + the language (0x69b010; 6027 US English), a G1T of 15 BC3 textures; bank 9's the
  update's /patch4/nx/ui/700_patch/700_patch.g1t.gz (file 31503, INFO1 entry 343; 0x69b938). BC3, stored linear, one mip.
- An ability's icon (0x5d9160): fixed_skill.bin section 0 +8 is its icon number i; the sprite is 146 + i for i < 238 (bank 0,
  texture 2, the 2048x2048 icon sheet, 96x96 cells) and 31335 + i from 238 on (bank 9, texture 1: the DLC's abilities). Several
  abilities share one. Ability 0xF0 (a "TBD") gets 146 whatever its record says. Six abilities (the two "On Hold" ones and four
  monster abilities) point at the sheet's empty-slot tile; it's written for them, as the game would draw it.
- A combat art's icon (0x5d8fe0): fixed_data.bin section 7 +13, its weapon bits. One weapon k gives sprite 548 + k (sword,
  lance, axe, bow, gauntlets), several (the arts any weapon can use) 546, a star. So every art of one weapon has the same icon,
  the round red one with that weapon.
- Spells have none of their own (their +13 is 255), and aren't written.

Each icon is written at its native 96x96 as skills/<name>.png, the name as the app keeps it (src/tellius/art.ts skillIconId): the
unit's-name rule with each "+" spelled out, so Alert Stance and Alert Stance+ stay apart (alert_stance_plus.png). Every ability
and combat art the app lists (scripts/build-fe16-units.py: every one with a name) gets one; a name two records share takes the
first record's icon.

Run: python scripts/fe16_icons.py [out folder] [--sheet sheet.png]
Needs: pip install texture2ddecoder (BC3 decoding; scripts/g1t.py reads the G1T).
"""
import os
import re
import struct
import sys
import unicodedata

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fe16_units as U  # noqa: E402
import g1t  # noqa: E402
from fe16_extract import Archive, koei_unzip, merged_romfs, patch_index  # noqa: E402
from switch_nsp import nso_image  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'data-raw', 'fe16', 'art', 'skills')
ENGLISH = 1                      # the UI language (US English): bank 0's file is 6026 + it
UI_COMMON = 6026
UI_PATCH = 31503                 # the update's 700_patch.g1t.gz (31160 + INFO1 entry 343)
BANK_TABLES = 0x1ab0b78          # main.bin: a u64 pointer per sprite bank to its 16-byte records

# The instruction words the mapping above rests on (the 1.2.0 program); anything else stops the script.
CODE = {
    0x5d9164: '40128052',        # mov w0, #0x92          (ability: sprite 146 + icon)
    0x5d9168: '1fc10371',        # cmp w8, #0xf0          (ability 0xF0: 146 as it is)
    0x5d91cc: '08214039',        # ldrb w8, [x8, #8]      (the ability record's icon)
    0x5d91d0: '1fb90371',        # cmp w8, #0xee
    0x5d91d4: 'e94c8f52',        # mov w9, #0x7a67        (icon >= 238: sprite 31335 + icon)
    0x5d9020: '08354039',        # ldrb w8, [x8, #0xd]    (combat art: weapon bits)
    0x5d9050: '20910811',        # add w0, w9, #0x224     (one weapon kind: 548 + kind)
    0x5d90cc: '40448052',        # mov w0, #0x222         (several kinds: 546)
    0x69b040: '4af18252',        # mov w10, #0x178a       (bank 0: file 6026 + language)
    0x69b938: 'e0618f52',        # mov w0, #0x7b0f        (bank 9: file 31503)
}


def art_id(name):
    """The app's file name for a skill's icon (src/tellius/art.ts skillIconId): each "+" spelled " plus", accents dropped,
    lower-cased, runs of anything else as "_"."""
    s = unicodedata.normalize('NFD', name.replace('+', ' plus'))
    s = re.sub('[̀-ͯ]', '', s).lower()
    return re.sub(r'[^a-z0-9]+', '_', s).strip('_')


class Game:
    def __init__(self):
        update, rom, files = merged_romfs()
        self.archive = Archive(rom, files)
        self.replaced, self.added = patch_index(self.archive)
        exefs = update.pfs0(next(s for s in update.sections if s['fs_type'] == 'PFS0'))
        self.main, _ = nso_image(exefs.open('main'))
        for addr, words in CODE.items():
            have = self.main[addr:addr + len(words) // 2].hex()
            assert have == words, f'main.bin {addr:#x}: {have}, expected {words} (not the 1.2.0 program?)'
        self._tex = {}

    def file(self, n):
        """Archive file n as the game reads it: the update's copy where it replaces it (INFO0), its added files from 31160 (INFO1)."""
        if n >= len(self.archive.entries):
            path, size, compressed = self.added[n - len(self.archive.entries)]
        elif n in self.replaced:
            path, size, compressed = self.replaced[n]
        else:
            return self.archive.get(n)
        data = self.archive.path(path)
        return koei_unzip(data) if compressed else data

    def record(self, bank, index):
        table = struct.unpack_from('<Q', self.main, BANK_TABLES + 8 * bank)[0]
        rec = struct.unpack_from('<8H', self.main, table + 16 * index)
        assert rec[1] == index, (bank, index, rec)
        return rec

    def texture(self, file_no, tex):
        if (file_no, tex) not in self._tex:
            t = g1t.G1T(self.file(file_no)).textures[tex]
            assert t['format'] == 0x5B, hex(t['format'])
            self._tex[file_no, tex] = (g1t.decode(t, swizzled=False), t)
        return self._tex[file_no, tex]

    def icon(self, sprite):
        """A UI sprite of bank 0 or bank 9 (the only banks abilities and arts use), cropped from its texture."""
        if 0 <= sprite <= 0x2D5:
            bank, index, file_no = 0, sprite, UI_COMMON + ENGLISH
        elif sprite >= 0x7B54:
            bank, index, file_no = 9, sprite - 0x7B54, UI_PATCH
        else:
            raise ValueError(sprite)
        tex, _i, x, y, w, h, tw, th = self.record(bank, index)
        im, t = self.texture(file_no, tex)
        assert (t['width'], t['height']) == (tw, th), (sprite, t['width'], t['height'], tw, th)
        return im.crop((x, y, x + w, y + h))


def ability_sprite(ability, icon):
    """0x5d9160: ability 0xF0 gets 146 without its record being read."""
    if ability == 0xF0:
        return 0x92
    return 0x92 + icon if icon < 0xEE else 0x7A67 + icon


def art_sprite(weapons):
    """0x5d8fe0: the one weapon kind's icon (548 + kind), or 546 for several."""
    kinds = [k for k in range(8) if weapons >> k & 1]
    if len(kinds) != 1:
        return 0x222
    return 0x22B if kinds[0] == 7 else 0x224 + kinds[0]


def icons(game):
    """[(file stem, label, PIL image)]: every named ability and combat art, the first record of a name."""
    out, seen = [], set()
    for a in U.abilities():
        if a['name'] and ('ability', a['name']) not in seen:
            seen.add(('ability', a['name']))
            out.append((art_id(a['name']), f"{a['name']} (ability {a['id']}, icon {a['icon']})", game.icon(ability_sprite(a['id'], a['icon']))))
    for a in U.arts():
        if a['name'] and ('art', a['name']) not in seen:
            seen.add(('art', a['name']))
            weapons = bytes.fromhex(a['raw'])[13]
            out.append((art_id(a['name']), f"{a['name']} (art {a['id']})", game.icon(art_sprite(weapons))))
    stems = [o[0] for o in out]
    assert len(stems) == len(set(stems)), 'two skills share a file name'
    return out


def contact_sheet(items, path, cols=12, cell=112):
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cell, rows * (cell + 16)), (60, 60, 70, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (stem, label, im) in enumerate(items):
        x, y = (i % cols) * cell, (i // cols) * (cell + 16)
        sheet.alpha_composite(im, (x + (cell - im.width) // 2, y + 4))
        draw.text((x + 4, y + cell - 8), stem[:18], fill=(255, 255, 255, 255))
    sheet.save(path)


def main(argv):
    sheet = None
    if '--sheet' in argv:
        k = argv.index('--sheet')
        sheet = argv[k + 1]
        del argv[k:k + 2]
    out = argv[0] if argv else OUT
    os.makedirs(out, exist_ok=True)
    made = icons(Game())
    for stem, label, im in made:
        im.save(os.path.join(out, stem + '.png'))
    print(f'{len(made)} ability and combat art icons written to {os.path.abspath(out)}')
    if sheet:
        contact_sheet(made, sheet)


if __name__ == '__main__':
    main(sys.argv[1:])
