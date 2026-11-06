"""
Make New Mystery of the Emblem's portraits from the user's own cartridge image, for the app's Bulk Upload. The images are the user's
and stay on their machine: the output goes to data-raw/fe12/art/, which is git-ignored, and nothing here is ever committed.

A person's face (Person +4, FID_...) is a record of f/face.bin (Awakening's container, 36 bytes a face, as Shadow Dragon's: +4 the name
label, +8 the portrait's file in f/, +12 / +16 the small face and its palette in sf/). The portrait files are LZ11 (0x11), LZ10 or the
zero-run code (0x40) Shadow Dragon uses (scripts/fe11_portraits.py); decompressed, 0x200 bytes of palette and 0x6400 of 8bpp tiles, the
first 256 tiles four 64x64 blocks: 128x128, written at that size.

Kris, the avatar, has no portrait file: the game draws one from parts in av/ (the AvatarBuilder, arm9 0x200c548 at the creation and
0x200bd18 in play; data-raw/fe12/README.md):

- body  av/<outfit><mouth><frame>.<M|F>B  128x128 8bpp, 256 BGR555 colours after the pixels (index 0 clear); the face without eyes or
  hair, in the outfit (A-E: arm9 0x20fd698, picked by the starting class), mouth set A or S, frame C / H / O (closed, half, open);
- eyes  av/<style>E<frame>.<M|F>F  128x128 A3I5 (3 bits of alpha, 5 of colour), 32 colours after the pixels (A-K: 0x20fd6b0);
- hair  av/<style>.<M|F>H  the same format (by index: G A B C D E F H I J K L M N O P Q R, 0x20fd6e0). The chosen colour k turns each of
  the hair's 32 colours' hue by 36 * k degrees (arm9 0x200d494); a man's style 13 (N, bald) takes no colour.

The body goes first, then the eyes, then the hair. Written:

  <out>/<name>.png               each unit that joins (scripts/fe12_joins.py), named as the app names them (src/data/fe12/fe12Units.ts);
                                 kris_m.png / kris_f.png drawn from the creation's defaults (style 0, colour 0, eyes A, the Cavalier's
                                 outfit A; the man's mouth set A, the woman's S, as the creation's preview, 0x200c598)
  <out>/avatar/<m|f>/body_<A-E>.png   each outfit, mouth closed (the woman has no E)
  <out>/avatar/<m|f>/eyes_<A-K>.png   each eye style, open
  <out>/avatar/<m|f>/hair_<00-17>.png each hair style by the game's index, in its own colours (colour 0)

Run: python scripts/fe12_portraits.py [out folder]
"""
import os
import struct
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fe12_data as D  # noqa: E402
from fe11_portraits import portrait, slug, zero_runs  # noqa: E402
from fe12_extract import CART  # noqa: E402
from fe12_joins import joins  # noqa: E402
from fe12_names import english  # noqa: E402
from fe13_bin import Bin  # noqa: E402
from nds_rom import Nds, decompress  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data-raw', 'fe12', 'art')
HAIR = 'GABCDEFHIJKLMNOPQR'
EYES = 'ABCDEFGHIJK'
OUTFITS = 'ABCDE'


def unpack(data):
    return zero_runs(data) if data[0] == 0x40 else decompress(data)


def palette(d, n):
    out = []
    for v in struct.unpack_from(f'<{n}H', d, 0):
        out.append(((v & 31) * 255 // 31, (v >> 5 & 31) * 255 // 31, (v >> 10 & 31) * 255 // 31))
    return out


def body(d, w=128):
    """8bpp with 256 colours after the pixels; index 0 is clear."""
    h = (len(d) - 0x200) // w
    pal = palette(d[w * h:], 256)
    img = Image.new('RGBA', (w, h))
    img.putdata([(*pal[i], 0 if i == 0 else 255) for i in d[:w * h]])
    return img


def a3i5(d, w=128):
    """A3I5: 3 bits of alpha over 5 of colour index, 32 colours after the pixels."""
    h = (len(d) - 0x40) // w
    pal = palette(d[w * h:], 32)
    img = Image.new('RGBA', (w, h))
    img.putdata([(*pal[v & 31], (v >> 5) * 255 // 7) for v in d[:w * h]])
    return img


def avatar_parts(rom, out):
    made = 0
    for g, letter in (('m', 'M'), ('f', 'F')):
        folder = os.path.join(out, 'avatar', g)
        os.makedirs(folder, exist_ok=True)
        mouth = 'A' if g == 'm' else 'S'
        for o in OUTFITS:
            path = f'av/{o}{mouth}C.{letter}B'
            if path in rom.files:
                body(rom.read(path)).save(os.path.join(folder, f'body_{o}.png'))
                made += 1
        for e in EYES:
            a3i5(rom.read(f'av/{e}EO.{letter}F')).save(os.path.join(folder, f'eyes_{e}.png'))
            made += 1
        for i, hletter in enumerate(HAIR):
            a3i5(rom.read(f'av/{hletter}.{letter}H')).save(os.path.join(folder, f'hair_{i:02d}.png'))
            made += 1
    return made


def avatar_default(rom, female):
    letter = 'F' if female else 'M'
    img = body(rom.read(f'av/A{"S" if female else "A"}C.{letter}B'))
    img.alpha_composite(a3i5(rom.read(f'av/AEO.{letter}F')))
    img.alpha_composite(a3i5(rom.read(f'av/{HAIR[0]}.{letter}H')))
    return img


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else OUT
    os.makedirs(out, exist_ok=True)
    rom = Nds(CART)
    fb = Bin(rom.read('f/face.bin'))
    faces = {name: o for o, name in fb.labels}
    pid_of = {p['pid']: p for p in D.persons()}
    made = 0
    for pid in joins():
        p = pid_of[pid]
        if pid == 'PID_PLAYER':
            name = english(D.say('MPID_PLAYER_DEFAULT'))
            avatar_default(rom, False).save(os.path.join(out, f'{slug(name + " (M)")}.png'))
            avatar_default(rom, True).save(os.path.join(out, f'{slug(name + " (F)")}.png'))
            made += 2
            continue
        face = faces.get(p['fid'])
        if face is None:
            print('no face:', pid, p['fid'])
            continue
        name = english(D.say(fb.str(face + 4)) or D.say('MPID_' + p['pid'][4:]))
        portrait(unpack(rom.read('f/' + fb.str(face + 8)))).save(os.path.join(out, f'{slug(name)}.png'))
        made += 1
    parts = avatar_parts(rom, out)
    print(f'{made} portraits, {parts} avatar parts -> {os.path.abspath(out)}')


if __name__ == '__main__':
    main()
