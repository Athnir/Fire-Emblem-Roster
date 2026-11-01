"""
Awakening's growth rates, decoded as the program does (code.bin):

- A person's growth for stat i (0 HP to 7 Res; 0x264858 reads it, 0x2cf0ec decodes it): the byte at the record's +36 + i, less a key
  made from the record's index in its person table (0x2da13c: its offset from the table's records, which follow an 8-byte header, over
  568) and the stat, then looked up in GameData's CipherData (256 bytes, signed; the start-up routine at 0x3d52f4 finds it by name):

      key = (((index ^ 0xa7) - 33 * i) * 99) ^ 0xd9
      growth = CipherData[(byte - key) & 0xff]

- A class's (0x2cf094): the byte at its JobData record's +32 + i, the index its place in JobData (128-byte records):

      key = (((index ^ 0x46) - 241 * i) * 35) ^ 0x78

The other 8 bytes of each (a person's +44, a class's +40) aren't read for growths. Every person and class Serenes Forest lists matches.
"""
import fe13_data as D

PERSON_SIZE = 568


def _cipher():
    b = D.gamedata()
    o = b.at['CipherData']
    return b.d[0x20 + o:0x20 + o + 256]


def _s8(v):
    return v - 256 if v > 127 else v


def person_growths(raw, offset):
    """The 8 growths of a person record (`raw`, its 568 bytes) at `offset` in static.bin's data."""
    cipher = _cipher()
    index = (offset - 8) // PERSON_SIZE
    out = []
    for i in range(8):
        key = ((((index ^ 0xa7) - 33 * i) * 99) ^ 0xd9) & 0xff
        out.append(_s8(cipher[(raw[36 + i] - key) & 0xff]))
    return out


def class_growths(raw, index):
    """The 8 growths of the JobData record `raw` (its 128 bytes), the `index`th in the table."""
    cipher = _cipher()
    out = []
    for i in range(8):
        key = ((((index ^ 0x46) - 241 * i) * 35) ^ 0x78) & 0xff
        out.append(_s8(cipher[(raw[32 + i] - key) & 0xff]))
    return out
