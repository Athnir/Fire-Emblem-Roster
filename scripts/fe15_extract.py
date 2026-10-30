"""Copy the files the Roster reads out of the user's own Shadows of Valentia dump into data-raw/fe15/romfs (git-ignored, never committed).

The cartridge image (`Fire Emblem Echoes Shadows of Valentia.3ds`, decrypted: its NCCH has the NoCrypto flag) sits in Documents\\FE
Games. Kept: Data/ (the tables, placements, events), Scripts/ (the chapter scripts), the North American English text (m/@NOA_EN), and
the program (.code, decompressed) for checking mechanics.

    python scripts/fe15_extract.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fe13_extract import exefs_code  # noqa: E402
from ncch_romfs import RomFS, ncsd_partitions  # noqa: E402

GAMES = os.path.join(os.path.expanduser('~'), 'Documents', 'FE Games')
CART = os.environ.get('FE15_ROM', os.path.join(GAMES, 'Fire Emblem Echoes Shadows of Valentia.3ds'))
OUT = os.path.join(os.path.dirname(__file__), '..', 'data-raw', 'fe15', 'romfs')
KEEP = ('/Data/', '/Scripts/', '/m/@NOA_EN/')


def main():
    part = dict((i, o) for i, o, _ in ncsd_partitions(CART))[0]
    RomFS(CART, part).extract(OUT, KEEP)
    code = exefs_code(CART, part)
    open(os.path.join(OUT, 'code.bin'), 'wb').write(code)
    print('code', len(code))


if __name__ == '__main__':
    main()
