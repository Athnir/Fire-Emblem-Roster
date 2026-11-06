"""Copy the files the Roster reads out of the user's own New Mystery of the Emblem cartridge into data-raw/fe12/rom (git-ignored, never
committed), decompressed.

The cartridge image (`Fire Emblem - Shin Monshou no Nazo - Hikari to Kage no Eiyuu.nds`, Japanese, VI2J, clean) sits in
Documents\\FE Games. From it: data/ (the database FE12Data.bin, the base conversations' table FE12BaseTalk.bin, the dictionary),
dispos/ (each chapter's placements), script/ (the chapters' scripts: Shadow Dragon's bytecode, scripts/fe11_cmb.py), m/ (the Japanese
text, label -> string), cpu/, pcmake/ (the avatar's creation screens), plus the ARM9 program and its overlays for checking mechanics.
Everything in those folders is LZ11 (or LZ10) packed; script/ files are stored as they are.

    python scripts/fe12_extract.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nds_rom import Nds, decompress  # noqa: E402

GAMES = os.path.join(os.path.expanduser('~'), 'Documents', 'FE Games')
CART = os.path.join(GAMES, 'Fire Emblem - Shin Monshou no Nazo - Hikari to Kage no Eiyuu.nds')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data-raw', 'fe12', 'rom')
KEEP = ('data/', 'dispos/', 'script/', 'm/', 'cpu/', 'pcmake/')
# LZ10 / LZ11-compressed; script/ files are stored as they are.
PACKED = ('data/', 'dispos/', 'm/', 'cpu/', 'pcmake/')


def main():
    rom = Nds(CART)
    assert rom.code == 'VI2J', rom.code
    n = 0
    for path in rom.files:
        if not path.startswith(KEEP):
            continue
        dst = os.path.join(OUT, path)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        data = rom.read(path)
        open(dst, 'wb').write(decompress(data) if path.startswith(PACKED) else data)
        n += 1
    open(os.path.join(OUT, 'arm9.bin'), 'wb').write(rom.arm9())
    os.makedirs(os.path.join(OUT, 'overlay'), exist_ok=True)
    for oid, (ram, data) in rom.overlays().items():
        open(os.path.join(OUT, 'overlay', f'{oid:02d}_{ram:08x}.bin'), 'wb').write(data)
    print(n, 'files; arm9 loaded at', hex(rom.arm9_ram))


if __name__ == '__main__':
    main()
