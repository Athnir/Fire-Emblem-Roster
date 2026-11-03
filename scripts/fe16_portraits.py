"""
Make Fire Emblem: Three Houses' portraits from the user's own dump, ready for the app's Bulk Upload (Edit Mode -> Bulk Upload ->
Three Houses -> select the folder). The images are the user's and stay on their machine: the output goes to data-raw/fe16/art/,
which is git-ignored, and nothing here is ever committed.

Each unit's portrait is its Part I "card": the bust the game shows for a unit (the student card), from nx/ui/still. The program's
still loader (main.bin 0x69f000) loads 22 still files; its slot 1 is archive file 6127 (face_school_card: 39 entries, persons 0-37
and a silhouette) and its slot 19 the update's face_school_card_DLC.bin (file 31524, INFO1 entry 364; 7 entries). Slot 2 / 20 are
the Part II cards (face_war_card, 6128), which are not used here. The index (0x69fd60): a person below 1040 is its own number in the
base file; persons 1040-1046 go to the DLC file at 0x3e6450(person, 1): person - 1040, less one from 1044 on (Aelfric has no card:
Yuri 0, Balthus 1, Constance 2, Hapi 3, Jeritza 4, Anna 5); entry 6 is Constance's shade look, used only under a flag (the default,
2, is written).

A still file is u32 count, then (u32 offset, u32 size) per entry; each entry is Koei's chunked zlib around a G1T holding one 512x512
BC3 texture, stored linear (not block-linear swizzled). Scaled to 256x256 (Lanczos on premultiplied alpha). File names are the app's
(src/houses/logic.ts labelOf, src/tellius/logic.ts artId): the unit's name lower-cased, runs of anything else as "_"; the two Byleths
as byleth_male.png and byleth_female.png (persons 0 and 1).

Run: python scripts/fe16_portraits.py [out folder] [--sheet sheet.png]
Needs: pip install texture2ddecoder (BC3 decoding; scripts/g1t.py reads the G1T).
"""
import os
import re
import struct
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fe16_units as U  # noqa: E402
import g1t  # noqa: E402
from fe16_extract import Archive, koei_unzip, merged_romfs, patch_index  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'data-raw', 'fe16', 'art')
CARD_FILE = 6127                                  # still loader slot 1 (main.bin 0x69f144: mov w2, #0x17ef)
CARD_DLC_PATH = '/patch4/nx/ui/still/face_school_card_DLC.bin'   # slot 19 (0x69f230: mov w2, #0x7b24 = 31160 + 364)
SIZE = 256


def art_id(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


def still_entries(data):
    count = struct.unpack_from('<I', data, 0)[0]
    out = []
    for k in range(count):
        off, size = struct.unpack_from('<II', data, 4 + 8 * k)
        e = data[off:off + size]
        out.append(koei_unzip(e) if e[:4] == b'\x00\x00\x01\x00' else e)
    return out


def card_index(person):
    """(DLC file?, index) as the program picks a Part I card (0x69fd60 and 0x3e6450 with its flag set)."""
    if 0x410 <= person <= 0x416:
        return True, person - (0x411 if person > 0x413 else 0x410)
    return False, person


def premultiplied_resize(im, size):
    a = np.asarray(im, dtype=np.float32) / 255.0
    rgb = a[..., :3] * a[..., 3:4]
    planes = [Image.fromarray(rgb[..., k], 'F').resize(size, Image.LANCZOS) for k in range(3)]
    al = np.clip(np.asarray(Image.fromarray(a[..., 3], 'F').resize(size, Image.LANCZOS)), 0, 1)
    out = np.zeros((size[1], size[0], 4), np.float32)
    for k in range(3):
        out[..., k] = np.where(al > 1e-4, np.asarray(planes[k]) / np.maximum(al, 1e-4), 0)
    out[..., 3] = al
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')


def portraits():
    """[(file stem, label, PIL image)] for every playable unit, in person order."""
    _update, rom, files = merged_romfs()
    archive = Archive(rom, files)
    replaced, added = patch_index(archive)
    assert CARD_FILE not in replaced
    base = still_entries(archive.get(CARD_FILE))
    (dlc_path,) = [p for p, _s, _c in added if p == CARD_DLC_PATH]
    dlc = still_entries(archive.path(dlc_path))
    assert len(base) == 39 and len(dlc) == 7, (len(base), len(dlc))
    out = []
    for c in U.characters():
        if not c['playable']:
            continue
        name = c['name']
        if c['person'] in (0, 1):
            name = f"{name} ({'female' if c['gender'] == 'F' else 'male'})"
        in_dlc, k = card_index(c['person'])
        (tex,) = g1t.G1T((dlc if in_dlc else base)[k]).textures
        assert (tex['format'], tex['width'], tex['height']) == (0x5B, 512, 512), tex['format']
        im = g1t.decode(tex, swizzled=False)
        out.append((art_id(name), f"{name} ({'DLC ' if in_dlc else ''}card {k})", im))
    return out


def contact_sheet(items, path, cols=8, cell=160):
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cell, rows * (cell + 30)), (60, 60, 70, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (stem, label, im) in enumerate(items):
        x, y = (i % cols) * cell, (i // cols) * (cell + 30)
        sheet.alpha_composite(im.resize((cell - 8, cell - 8), Image.LANCZOS), (x + 4, y + 4))
        draw.text((x + 4, y + cell), stem, fill=(255, 255, 255, 255))
        draw.text((x + 4, y + cell + 12), label[:26], fill=(200, 200, 200, 255))
    sheet.save(path)


def main(argv):
    sheet = None
    if '--sheet' in argv:
        k = argv.index('--sheet')
        sheet = argv[k + 1]
        del argv[k:k + 2]
    out = argv[0] if argv else OUT
    os.makedirs(out, exist_ok=True)
    made = []
    for stem, label, im in portraits():
        small = premultiplied_resize(im, (SIZE, SIZE))
        small.save(os.path.join(out, stem + '.png'))
        made.append((stem, label, small))
    print(f'{len(made)} portraits written to {os.path.abspath(out)}')
    if sheet:
        contact_sheet(made, sheet)


if __name__ == '__main__':
    main(sys.argv[1:])
