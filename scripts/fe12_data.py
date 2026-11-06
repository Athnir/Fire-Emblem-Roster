"""
Read New Mystery of the Emblem's data (FE12, the user's Japanese cartridge, VI2J) from data-raw/fe12/rom (`scripts/fe12_extract.py`):
the database `data/FE12Data.bin` (Awakening's container, `scripts/fe13_bin.py`; its labels name the tables), the base conversations
`data/FE12BaseTalk.bin`, the Japanese text (m/*, label -> string) and the chapters' placements (dispos/). data-raw/fe12/README.md has
the formats and the program addresses.

The growth rates are stored scrambled: each byte goes through a key made from the record's index and the stat, then the database's
256-byte CipherData table (the program's decoders, arm9 0x2049280 people, 0x2049418 classes, 0x2049814 the avatar's answers).
"""
import glob
import os
import struct

from fe13_bin import Bin

ROM = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data-raw', 'fe12', 'rom')
STATS = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res']
WEAPONS = ['sword', 'lance', 'axe', 'bow', 'tome', 'staff']
PERSON, JOB, ITEM, MAP = 92, 80, 60, 44

_db = _text = _talk = None


def db():
    global _db
    if _db is None:
        _db = Bin(open(os.path.join(ROM, 'data', 'FE12Data.bin'), 'rb').read())
    return _db


def text():
    """Every message label -> its Japanese string (m/*). A label in both the male and female base conversations (BaseTalk*,
    BaseTalkF*) keeps the male one; `text_of(file)` reads one file."""
    global _text
    if _text is None:
        _text = {}
        for f in sorted(glob.glob(os.path.join(ROM, 'm', '*'))):
            t = Bin(open(f, 'rb').read())
            for o, n in t.labels:
                _text.setdefault(n, t.cstr(0x20 + o))
    return _text


def text_of(name):
    t = Bin(open(os.path.join(ROM, 'm', name), 'rb').read())
    return {n: t.cstr(0x20 + o) for o, n in t.labels}


def say(label):
    return text().get(label) if label else None


def s8(v):
    return v - 256 if v > 127 else v


def table(name, size):
    """The records of a database table: [(index, offset)]; the counts are FooterData's (persons, jobs, items)."""
    b = db()
    start = b.at[name]
    count = {'PersonData': 0, 'JobData': 1, 'ItemData': 2}
    if name in count:
        n = b.u32(b.at['FooterData'] + 4 * count[name])
    else:
        nxt = min(o for o, _ in b.labels if o > start)
        n = (nxt - start) // size
    return [(i, start + i * size) for i in range(n)]


def cipher():
    b = db()
    o = 0x20 + b.at['CipherData']
    return b.d[o:o + 256]


def person_growth(index, stat, v):
    """arm9 0x2049280: a person's growth byte (stat 0-7; +0x14 and +0x1c use the same key)."""
    k = ((((index ^ 0x3e) - 3 * stat) * 0x57) ^ 0xf5) & 0xff
    return s8(cipher()[(v - k) & 0xff])


def job_growth(index, stat, v):
    """arm9 0x2049418: a class's growth byte (+0x10 and +0x18)."""
    k = ((((index ^ 0x9d) - 7 * stat) * 0xb3) ^ 0xdb) & 0xff
    return s8(cipher()[(v - k) & 0xff])


def answer_growth(question, answer, stat, v):
    """arm9 0x2049814: the avatar's growth bonus for an answer (question 0-2, answer 0-4)."""
    k = (((((5 * question + answer) ^ 0x7b) - 9 * stat) * 0xe1) ^ 0xb7) & 0xff
    return s8(cipher()[(v - k) & 0xff])


def raw(o, n):
    b = db()
    return b.d[0x20 + o:0x20 + o + n]


def persons():
    """Person, 92 bytes: +0 PID, +4 FID, +8 a generic's army name, +0xc their own bases (8, signed), +0x14 growths (8, scrambled),
    +0x1c the Hard modes' extra growths for a foe (8, scrambled; 0 for every unit that joins), +0x24 weapon experience (sword, lance,
    axe, bow, tome, staff), +0x2c flags (u32: 0x01 a woman, 0x4000 the avatar), +0x30 five support slots of 8 bytes (+0 the partner,
    a pointer to their Person; +4 the points they start with, +5 / +6 / +7 the points C, B and A need, 99 never)."""
    b = db()
    rows = table('PersonData', PERSON)
    at = {o: i for i, o in rows}
    out = []
    for i, o in rows:
        r = raw(o, PERSON)
        pid = b.str(o)
        gen = b.str(o + 8)
        supports = []
        for k in range(5):
            f = o + 0x30 + 8 * k
            if f in b.ptrs and b.u32(f) in at:
                supports.append({'partner': at[b.u32(f)], 'start': r[0x34 + 8 * k], 'levels': list(r[0x35 + 8 * k:0x38 + 8 * k])})
        out.append({
            'index': i, 'pid': pid, 'fid': b.str(o + 4), 'army': say(gen) if gen else None,
            'bases': dict(zip(STATS, map(s8, r[0x0c:0x14]))),
            'growths': {s: person_growth(i, k, r[0x14 + k]) for k, s in enumerate(STATS)},
            'hard_growths': {s: person_growth(i, k, r[0x1c + k]) for k, s in enumerate(STATS)},
            'wexp': dict(zip(WEAPONS, r[0x24:0x2a])), 'flags': struct.unpack_from('<I', r, 0x2c)[0], 'supports': supports,
        })
    return out


def jobs():
    """Job, 80 bytes: +0 JID, +4 name, +8 bases (8, signed), +0x10 growths added to the person's (8, scrambled), +0x18 the Hard
    modes' growths for foes, +0x20 caps, +0x28 its row of TerrainCost, +0x29 Mov, +0x2c weapon experience (sword, lance, axe, bow,
    tome, staff; 0: can't use), +0x34 the reclass set and tier, +0x35 its column (the class line the limits count, -1 none), +0x36
    kinds (0x04 armour, 0x08 ballistician, 0x10 horseback, 0x20 flier, 0x40 manakete), +0x38 flags (u32: 0x01 a woman's class, 0x800
    promoted, 0x80000000 no player has it), +0x3c the class it promotes from, +0x40 the one it promotes to (pointers to Job records),
    +0x44 its description, +0x48 a generic's face."""
    b = db()
    rows = table('JobData', JOB)
    at = {o: i for i, o in rows}
    out = []
    for i, o in rows:
        r = raw(o, JOB)

        def ptr(k):
            return at.get(b.u32(o + k)) if (o + k) in b.ptrs else None

        out.append({
            'index': i, 'jid': b.str(o), 'name': say(b.str(o + 4)),
            'bases': dict(zip(STATS, map(s8, r[8:16]))),
            'growths': {s: job_growth(i, k, r[0x10 + k]) for k, s in enumerate(STATS)},
            'caps': dict(zip(STATS, r[0x20:0x28])), 'cost_row': r[0x28], 'mov': r[0x29],
            'wexp': dict(zip(WEAPONS, r[0x2c:0x32])), 'set': r[0x34], 'column': s8(r[0x35]), 'kinds': r[0x36],
            'flags': struct.unpack_from('<I', r, 0x38)[0], 'from': ptr(0x3c), 'to': ptr(0x40),
        })
    return out


def items():
    """Item, 60 bytes: +0 IID, +4 name, +8 help, +0x10 kind (0 sword, 1 lance, 2 axe, 3 bow, 4 tome, 5 staff, 6 stone, 7 ballista,
    8 item), +0x11 use, +0x12 the weapon experience its rank needs, +0x24 / +0x28 flags."""
    b = db()
    out = []
    for i, o in table('ItemData', ITEM):
        r = raw(o, ITEM)
        out.append({'index': i, 'iid': b.str(o), 'name': say(b.str(o + 4)), 'kind': r[0x10], 'use': r[0x11], 'exp': r[0x12],
                    'flags': struct.unpack_from('<II', r, 0x24)})
    return out


def rank_thresholds():
    """WeaponLevel: the experience A, B, C, D and E need (196, 136, 76, 31, 1)."""
    b = db()
    return [b.u8(b.at['WeaponLevel'] + i) for i in range(5)]


def rank_of(exp):
    for name, need in zip('ABCDE', rank_thresholds()):
        if exp >= need:
            return name
    return ''


def maps():
    """MapTableData, 44 bytes a chapter: +0 its file, +4 the chapter it's a variant of (bmap204B: bmap204), +8 its title, +0x18 the
    battle preparations' menus (0x02 items, 0x04 the armory, 0x08 reclassing, 0x10 the clock events, 0x20 the training grounds),
    +0x1c-+0x27 the class limits, one per column (the reclass list's +0x35)."""
    b = db()
    start, end = b.at['MapTableData'], b.at['TerrainData']
    out = []
    for o in range(start, end - MAP + 1, MAP):
        r = raw(o, MAP)
        out.append({'key': b.str(o), 'base': b.str(o + 4), 'title': say(b.str(o + 8)), 'prep': r[0x18], 'limits': list(r[0x1c:0x28])})
    return out


def avatar():
    """PCData: +0 / +4 the classes the creation offers a man / a woman (4 bytes each, ending in -1: u16 the starting weapon, u8 the
    class, u8 the portrait's outfit), then 15 answers of 16 bytes (question 1's five, then 2's, then 3's): 8 base bonuses, 8 growth
    bonuses (scrambled)."""
    b = db()
    start = b.at['PCData']

    def classes(k):
        o = b.u32(start + k)
        out = []
        while b.u32(o) != 0xffffffff:
            r = raw(o, 4)
            out.append({'item': struct.unpack_from('<H', r, 0)[0], 'job': r[2], 'outfit': r[3]})
            o += 4
        return out

    answers = []
    for q in range(3):
        for a in range(5):
            o = start + 8 + 16 * (5 * q + a)
            r = raw(o, 16)
            answers.append({'question': q, 'answer': a, 'bases': dict(zip(STATS, map(s8, r[:8]))),
                            'growths': {s: answer_growth(q, a, k, r[8 + k]) for k, s in enumerate(STATS)}})
    return {'male': classes(0), 'female': classes(4), 'answers': answers}


def base_talks():
    """FE12BaseTalk.bin: 64-byte records. +0 / +4 the chapter (and its variant) a story conversation is in, +8 its title, +0xc the
    music, +0x10-+0x24 its messages, +0x28 a script function run first, +0x2c / +0x30 the two people of a support conversation (the
    second is always the avatar), +0x34 the item it gives, +0x39 the support points it needs, +0x3a the conversation it follows
    (-1 none)."""
    global _talk
    if _talk is None:
        _talk = Bin(open(os.path.join(ROM, 'data', 'FE12BaseTalk.bin'), 'rb').read())
    b = _talk
    out = []
    o = 0
    while o + 64 <= b.size:
        r = b.d[0x20 + o:0x20 + o + 64]
        if not any(r):
            break

        def s(k):
            return b.str(o + k)

        out.append({'index': o // 64, 'map': s(0), 'map2': s(4), 'title': s(8), 'messages': [s(k) for k in range(0x10, 0x28, 4) if s(k)],
                    'precall': s(0x28), 'a': s(0x2c), 'b': s(0x30), 'item': s(0x34), 'x38': r[0x38], 'points': r[0x39],
                    'after': struct.unpack_from('<h', r, 0x3a)[0], 'x3c': r[0x3c], 'x3d': r[0x3d]})
        o += 64
    return out


def dispos(key):
    """{group: [unit]} from a placement file: 88-byte records (+0 person, +2 class, +4 / +6 tiles, +8 the army (0 yours, 1 the
    foe's), +9 level, +0xa the Hard modes' level, +0xc flags for the unit (+0x90), +0x10 five items (u16 item, u16 flags), +0x24 preset
    gains, +0x2c flags (u32: 0x80 creates the unit if it isn't in the army; 0x02 / 0x04 / 0x08 / 0x200 only place an existing one;
    0x400 / 0x800 / 0x1000 / 0x10000 / 0x2000 / 0x4000 / 0x8000 gate it by difficulty, overlay 00 0x2205b5c))."""
    b = Bin(open(os.path.join(ROM, 'dispos', key), 'rb').read())
    out, o = {}, 0
    while True:
        n, rec, cnt = struct.unpack_from('<3I', b.d, 0x20 + o)
        if not n and not rec:
            return out
        units = []
        for k in range(cnt):
            r = b.d[0x20 + rec + k * 88:0x20 + rec + k * 88 + 88]
            p, j = struct.unpack_from('<HH', r, 0)
            units.append({'person': p, 'job': j, 'from': (r[4], r[5]), 'at': (r[6], r[7]), 'army': r[8], 'level': r[9],
                          'flags': struct.unpack_from('<I', r, 0x2c)[0], 'raw': r})
        out[b.cstr(0x20 + n)] = units
        o += 12
