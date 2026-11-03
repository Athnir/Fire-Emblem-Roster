"""Read the unit data of Fire Emblem: Shadow Dragon and the Blade of Light (FE1: the Switch release of 2020, which runs the 1990
Famicom cartridge in an emulator and draws Nintendo's English over its Japanese) from the user's own dump, and print it as JSON.

Input: the program `main` (the Program NCA's ExeFS has no RomFS; everything is in main). Either the NSO as extracted (header
'NSO0'; its segments are laid out at their memory offsets, LZ4 where flagged, and its R_AARCH64_RELATIVE relocations applied as
if loaded at 0), or an image already laid out that way (the Armory's data-raw/fe1/rom/main.bin).

    python scripts/fe1_units.py [path to main] [-o out.json]      (no path: read straight from the NSP)

Formats (bank:$addr; MMC4, bank n at $8000-$BFFF, bank 15 fixed at $C000-$FFFF):
- the cartridge: a record 'FA5J' + the Shift-JIS title, emulator settings at +0x3C (+3 mapper 0x0A, +5 PRG banks, +6 CHR banks),
  PRG from +0x4C (16 x 16 KB), CHR after it (16 x 8 KB), then 'FA5J' again.
- a unit (27 bytes; army in battery RAM from $6A90, 54 slots): +0 character (a foe: 0x80 + foe name), +1 class, +2 level, +3 HP,
  +4 max HP, +5 EXP (a foe: what it's worth), +6 the map tile under it, +7 Str, +8 Skl, +9 weapon level, +10 Spd, +11 Lck, +12 Def,
  +13 Mov, +14 ? (only the unused telescope item raises it), +15 Res (bit 7: permanent, the Talisman's), +16 row, +17 column,
  +18 0xFF once gone, +19..+22 items (item + 1), +23..+26 their uses (a foe: AI).
- growths 15:$E1E0 (u16 pointers by character - 1): 7 bytes Str, Skl, WLv, Spd, Lck, Def, HP, in tenths (read by 15:$D0D7).
- class bases 15:$EC04 (u16 pointers by class - 1, classes 1-22): Str, Skl, WLv, Spd, Lck, Def, Mov, HP, EXP.
- per chapter: your units it brings 8:$8490 (27-byte records, a 0 character ends), foes 8:$8AA3 (11 bytes: character, class,
  level, item, item, row, column, AI x4; +8 doubles as a reinforcement's turn), reinforcements 3:$959C, village recruits 3:$9466
  (27-byte records), places to visit 3:$A0F1 (5 bytes: row, column, a, b, c; a 0x80 the village recruit, 0x81/0x82 the first/second
  record unless Samson/Arran is in the army), recruits that come to Marth 3:$A3C1 -> 3:$A3DA (4 bytes: foe, character, conversation,
  required character), talks 15:$EDB5 talker / $EDC4 foe / $EDE0 character / $EDD2 conversation.
- promotions 6:$989D / $98A2 the two classes each item takes, $98A7 the class it gives; item 79 + index; Lv 10 or more (6:$980B).
- weapons 6:$A3D1 (9 upper bounds of item + 1) and 6:$A3DA (class lists ended by 0xEF) (6:$A35E); an item whose weapon level has
  bit 7 belongs to the character in its low bits, whatever the class.
"""
import argparse
import json
import os
import struct
import sys

# The user's own dump (nxdumptool); FE1_NSP overrides it. The keys are in ~/.switch (see switch_nsp.py).
NSP = os.environ.get('FE1_NSP', os.path.join(os.path.expanduser('~'), 'Documents', 'FE Games', 'Switch dumps', 'NSP',
                                             'Fire Emblem_ Shadow Dragon and the Blade of Light [0100A12011CC8000][v0][BASE].nsp'))
TITLE_ID = 0x0100A12011CC8000
TITLE = 'ファイアーエムブレム　暗黒竜と光の剣'
PRG_BANK, CHR_BANK, FIXED = 0x4000, 0x2000, 15
STATS = ['hp', 'str', 'skl', 'wlv', 'spd', 'lck', 'def', 'res', 'mov']


# --- the program image ------------------------------------------------------------------------------------------------------

def lz4_block(src, size):
    out, i = bytearray(), 0
    while i < len(src):
        token = src[i]
        i += 1
        n = token >> 4
        if n == 15:
            while True:
                b = src[i]
                i += 1
                n += b
                if b != 255:
                    break
        out += src[i:i + n]
        i += n
        if i >= len(src):
            break
        back = src[i] | src[i + 1] << 8
        i += 2
        m = token & 15
        if m == 15:
            while True:
                b = src[i]
                i += 1
                m += b
                if b != 255:
                    break
        m += 4
        start = len(out) - back
        for k in range(m):
            out.append(out[start + k])
    assert len(out) == size, (len(out), size)
    return bytes(out)


def program_image(data):
    """The program as it sits in memory, its pointers relocated to offsets in it."""
    if data[:4] != b'NSO0':
        return data
    flags = struct.unpack_from('<I', data, 0xC)[0]
    segs = [struct.unpack_from('<III', data, o) for o in (0x10, 0x20, 0x30)]
    packed = struct.unpack_from('<III', data, 0x60)
    image = bytearray(max(mem + size for _, mem, size in segs))
    for k, ((foff, mem, size), psize) in enumerate(zip(segs, packed)):
        raw = data[foff:foff + (psize if flags & (1 << k) else size)]
        image[mem:mem + size] = lz4_block(raw, size) if flags & (1 << k) else raw
    mod0 = struct.unpack_from('<I', image, 4)[0]
    assert image[mod0:mod0 + 4] == b'MOD0'
    dynamic = mod0 + struct.unpack_from('<i', image, mod0 + 4)[0]
    tags = {}
    for i in range(0, 0x1000, 16):
        tag, val = struct.unpack_from('<QQ', image, dynamic + i)
        if tag == 0:
            break
        tags[tag] = val
    rela, size = tags.get(7), tags.get(8, 0)
    for off in range(rela, rela + size, 24) if rela else ():
        where, kind, addend = struct.unpack_from('<QQq', image, off)
        if kind & 0xFFFFFFFF == 0x403:  # R_AARCH64_RELATIVE
            struct.pack_into('<Q', image, where, addend)
    return bytes(image)


class Cartridge:
    """The Famicom cartridge inside the program (the 'FA5J' record followed by the Japanese title)."""

    def __init__(self, img):
        title = TITLE.encode('shift_jis')
        t = img.index(title)
        start = img.index(b'FA5J' + img[t - 8:t])
        assert img[start + 0xC:start + 0xC + len(title)] == title
        self.settings = img[start + 0x3C:start + 0x4C]
        assert self.settings[3] == 0x0A, 'not MMC4'
        rom = start + 0x4C
        self.prg = img[rom:rom + self.settings[5] * PRG_BANK]
        self.chr = img[rom + len(self.prg):rom + len(self.prg) + self.settings[6] * CHR_BANK]
        assert img[rom + len(self.prg) + len(self.chr):][:4] == b'FA5J'
        self.offset_in_program = rom

    def off(self, bank, addr):
        if addr >= 0xC000:
            return FIXED * PRG_BANK + addr - 0xC000
        assert 0x8000 <= addr < 0xC000, hex(addr)
        return bank * PRG_BANK + addr - 0x8000

    def u8(self, bank, addr):
        return self.prg[self.off(bank, addr)]

    def u16(self, bank, addr):
        return struct.unpack_from('<H', self.prg, self.off(bank, addr))[0]

    def read(self, bank, addr, n):
        o = self.off(bank, addr)
        return self.prg[o:o + n]

    def string(self, bank, addr):
        """NES text, ended by 0xEF."""
        o = self.off(bank, addr)
        return self.prg[o:self.prg.index(0xEF, o)]

    def records(self, bank, table, ch, size):
        """A chapter's list (u16 pointers by chapter - 1) of `size`-byte records, ended by a 0 first byte."""
        p, out = self.u16(bank, table + 2 * (ch - 1)), []
        while self.u8(bank, p):
            out.append(self.read(bank, p, size))
            p += size
        return out


# --- the English (the Switch side's tables) -----------------------------------------------------------------------------------

class English:
    """The Switch side draws its English over the cartridge's Japanese: a dictionary of 32-byte entries {length, pointer to the key
    in the NES's text codes, the Japanese in UTF-8, text number} (a key: the string's first `length` codes, without the voicing
    marks 0x0F and 0x1F), and the English text, 294 entries of 16 bytes {u32 text number, u64 pointer to UTF-8}."""
    VOICING = (0x0F, 0x1F)

    def __init__(self, img):
        self.img = img
        start = img.index(struct.pack('<IIQ', 0xC8, 0, img.index(b'\0Marth\0') + 1))
        self.text = {}
        for k in range(294):
            tid, p = struct.unpack_from('<IxxxxQ', img, start + 16 * k)
            self.text.setdefault(tid, self.cstr(p))
        ro = range(0x55000, 0xCA000)

        def entry(o):
            n, enc, ja, tid = struct.unpack_from('<QQQQ', img, o)
            if 0 < n < 64 and enc in ro and ja in ro and tid < 0x10000:
                return img[enc:enc + n], self.cstr(ja), tid
            return None
        o = img.rindex(struct.pack('<Q', img.index('てつのつるぎ'.encode()))) - 16
        while entry(o - 32):
            o -= 32
        self.dictionary = []
        while entry(o):
            self.dictionary.append(entry(o))
            o += 32
        # The class pages: {u32 ?, u32 first text number, u64 last}, then a pointer per text number to its full name.
        ptr = struct.pack('<Q', img.index(b'\0Cavalier\0A warrior') + 1)
        pages = img.index(ptr, 0xCA000)
        first, last = struct.unpack_from('<I', img, pages - 12)[0], struct.unpack_from('<Q', img, pages - 8)[0]
        self.class_pages = {first + k: self.cstr(struct.unpack_from('<Q', img, pages + 8 * k)[0]) for k in range(last - first + 1)}
        # Chapter titles: a counted table of pointers ("Marth Embarks" ...).
        ptr = struct.pack('<Q', img.index(b'\0Marth Embarks\0') + 1)
        t = img.index(ptr, 0xCA000)
        n = struct.unpack_from('<Q', img, t - 8)[0]
        self.chapter_titles = [self.cstr(struct.unpack_from('<Q', img, t + 8 * k)[0]) for k in range(n)]

    def cstr(self, p):
        return self.img[p:self.img.index(b'\0', p)].decode('utf-8')

    def text_number(self, codes):
        k = bytes(b for b in codes if b not in self.VOICING)
        best = None
        for dk, _, tid in self.dictionary:
            if k.startswith(dk) and (best is None or len(dk) > len(best[0])):
                best = (dk, tid)
        return best[1] if best else None

    def name(self, codes):
        tid = self.text_number(codes)
        return self.text.get(tid) if tid is not None else None


KANA = ('あいうえおかきくけこさしすせそ゛たちつてとなにぬねのはひふへほ゜まみむめもやゆよらりるれろわをん'
        'アイウエオカキクケコサシスセソータチツテトナニヌネノハヒフヘホ?マミムメモヤユヨラリルレロワヲン')


def kana(codes):
    return ''.join(KANA[b] if b < len(KANA) else f'[{b:02x}]' for b in codes)


# --- the game's tables ------------------------------------------------------------------------------------------------------

CHARACTER_NAMES, FOE_NAMES, CLASS_NAMES, ITEM_NAMES = 0xDE2B, 0xDFA4, 0xDA1F, 0xDAD5
GROWTHS = 0xE1E0          # by character - 1 -> Str, Skl, WLv, Spd, Lck, Def, HP (tenths); 15:$D0D7
GROWTH_ORDER = ['str', 'skl', 'wlv', 'spd', 'lck', 'def', 'hp']
CLASS_BASES = 0xEC04      # by class - 1 (1-22) -> Str, Skl, WLv, Spd, Lck, Def, Mov, HP, EXP
CLASS_ORDER = ['str', 'skl', 'wlv', 'spd', 'lck', 'def', 'mov', 'hp', 'exp']
ITEM_LEVEL, ITEM_USES = 0xD6B3, 0xD87F
ALLIES, FOES = 0x8490, 0x8AA3                         # bank 8
VILLAGE, REINFORCEMENTS, VISITS = 0x9466, 0x959C, 0xA0F1   # bank 3
COME_LIST, COME_TABLE = 0xA3C1, 0xA3DA                # bank 3
TALKERS, TALK_FOES, TALK_BECOMES = 0xEDB5, 0xEDC4, 0xEDE0
PROMO_FROM_A, PROMO_FROM_B, PROMO_TO, PROMO_ITEM0 = 0x989D, 0x98A2, 0x98A7, 79   # bank 6
WEAPON_BOUNDS, WEAPON_CLASSES = 0xA3D1, 0xA3DA        # bank 6
WEAPON_GROUPS = ['Swords', 'Lances', 'Bows', 'Ballistae', 'Axes', 'Stones', 'Tomes', 'Heal', 'Staves']
BOOST_FIELD, BOOST_AMOUNT, BOOST_CAP, BOOST_ITEM0 = 0xE3AF, 0xE3B9, 0xE3C3, 69
RECORD_FIELDS = {7: 'str', 8: 'skl', 9: 'wlv', 10: 'spd', 11: 'lck', 12: 'def', 13: 'mov', 14: '+14', 15: 'res', 4: 'hp'}
CHAPTERS = 25
LORD = 21
CAP, HP_CAP, MAX_LEVEL, PROMOTE_LEVEL = 20, 52, 20, 10   # 15:$D0FE (and 15:$D099), 6:$9812


class FE1:
    def __init__(self, img):
        self.c = Cartridge(img)
        self.en = English(img)

    # names
    def _name(self, table, n):
        codes = self.c.string(FIXED, self.c.u16(FIXED, table + 2 * n))
        return self.en.name(codes), kana(codes)

    def character_name(self, ch):
        return self._name(CHARACTER_NAMES, ch - 1)

    def foe_name(self, foe):
        return self._name(FOE_NAMES, (foe & 0x7F) - 1)

    def item_name(self, item):
        return self._name(ITEM_NAMES, item)

    def class_name(self, k):
        """(full name from the class pages, the menus' short name, Japanese)."""
        codes = self.c.string(FIXED, self.c.u16(FIXED, CLASS_NAMES + 2 * (k - 1)))
        tid = self.en.text_number(codes)
        return self.en.class_pages.get(tid), self.en.text.get(tid), kana(codes)

    # classes
    def class_bases(self, k):
        b = self.c.read(FIXED, self.c.u16(FIXED, CLASS_BASES + 2 * (k - 1)), 9)
        return dict(zip(CLASS_ORDER, b))

    def promotions(self):
        """item -> (from classes, to class)."""
        out = {}
        for i in range(5):
            a, b, to = (self.c.u8(6, t + i) for t in (PROMO_FROM_A, PROMO_FROM_B, PROMO_TO))
            out[PROMO_ITEM0 + i] = (sorted({a, b}), to)
        return out

    def weapon_groups(self):
        """[(group name, first item, last item, classes)]."""
        out, lo = [], 1
        for y in range(9):
            hi = self.c.u8(6, WEAPON_BOUNDS + y)
            p, classes = self.c.u16(6, WEAPON_CLASSES + 2 * y), []
            while (k := self.c.u8(6, p)) != 0xEF:
                classes.append(k)
                p += 1
            out.append((WEAPON_GROUPS[y], lo - 1, hi - 2, classes))
            lo = hi
        return out

    def personal_items(self):
        """Items locked to one character (weapon level bit 7: the low bits are the character), whatever the class (6:$A37E)."""
        return {i: self.c.u8(FIXED, ITEM_LEVEL + i) & 0x7F for i in range(92) if self.c.u8(FIXED, ITEM_LEVEL + i) & 0x80}

    def boosters(self):
        """item -> (stat, amount, cap) (6:$978C; the Talisman's 135 = Res 7 with the permanent bit)."""
        out = {}
        for i in range(10):
            f, a, cap = (self.c.u8(FIXED, t + i) for t in (BOOST_FIELD, BOOST_AMOUNT, BOOST_CAP))
            out[BOOST_ITEM0 + i] = (RECORD_FIELDS.get(f, f'+{f}'), a, cap)
        return out

    # characters
    def growths(self, ch):
        g = self.c.read(FIXED, self.c.u16(FIXED, GROWTHS + 2 * (ch - 1)), 7)
        return dict(zip(GROWTH_ORDER, g))

    # chapters
    def allies(self, ch):
        return self.c.records(8, ALLIES, ch, 27)

    def foes(self, ch):
        return self.c.records(8, FOES, ch, 11)

    def reinforcements(self, ch):
        return self.c.records(3, REINFORCEMENTS, ch, 11)

    def village_recruits(self, ch):
        return self.c.records(3, VILLAGE, ch, 27)

    def visits(self, ch):
        p, out = self.c.u16(3, VISITS + 2 * (ch - 1)), []
        while self.c.u8(3, p) >= 1:
            out.append(tuple(self.c.read(3, p, 5)))
            p += 5
        return out

    def come_to_marth(self, ch):
        k = self.c.u8(3, COME_LIST + ch - 1)
        if not k:
            return []
        p, out = self.c.u16(3, COME_TABLE + 2 * (k - 1)), []
        while self.c.u8(3, p):
            out.append(tuple(self.c.read(3, p, 4)))
            p += 4
        return out

    def talks(self):
        out, y = [], 0
        while t := self.c.u8(FIXED, TALKERS + y):
            out.append((t, self.c.u8(FIXED, TALK_FOES + y), self.c.u8(FIXED, TALK_BECOMES + y)))
            y += 1
        return out

    def map_tile(self, ch, row, col):
        bank, n = (2, ch) if ch <= 13 else (9, ch - 13)
        p = self.c.u16(bank, 0x8000 + 2 * (n - 1))
        cols = self.c.u8(bank, p + 1) + 1
        return self.c.u8(bank, p + 4 + row * cols + col)


def record_unit(rec):
    """Stats of a whole 27-byte record."""
    stats = {'hp': rec[4], 'str': rec[7], 'skl': rec[8], 'wlv': rec[9], 'spd': rec[10], 'lck': rec[11], 'def': rec[12],
             'res': rec[15] & 0x7F, 'mov': rec[13]}
    return rec[1], rec[2], stats, [i - 1 for i in rec[19:23] if i]


def foe_unit(game, foe):
    """A foe's record as the loaders build it (8:$BBF4, 3:$9271) from its class: Str, Skl, WLv, Spd and Def + (level - 1) / 2, HP +
    3 x that, Luck and Move the class's; EXP the class's + level - 1 (+10 for a chapter's first foe). Joining (3:$8E52) keeps all of it
    but the Luck, which becomes a random 0-7, and gives its two items full uses."""
    cls, level = foe[1], foe[2]
    b, bonus = game.class_bases(cls), (foe[2] - 1) >> 1
    stats = {'hp': b['hp'] + 3 * bonus, 'str': b['str'] + bonus, 'skl': b['skl'] + bonus, 'wlv': b['wlv'] + bonus,
             'spd': b['spd'] + bonus, 'lck': None, 'def': b['def'] + bonus, 'res': 0, 'mov': b['mov']}
    return cls, level, stats, [i - 1 for i in foe[3:5] if i], b['exp'] + level - 1


def build(game):
    en = game.en
    names = {ch: game.character_name(ch) for ch in range(1, 54)}
    eng = {ch: (n[0] or n[1]) for ch, n in names.items()}
    item = lambda i: game.item_name(i)[0] or game.item_name(i)[1]
    talks = game.talks()
    talk_by_foe = {}
    for talker, foe, becomes in talks:
        talk_by_foe.setdefault(foe, []).append((talker, becomes))

    units, seen = [], set()

    def add(ch, chapter, cls, level, stats, items, join, extra=None):
        if ch in seen:
            return
        seen.add(ch)
        g = game.growths(ch)
        u = {'character': ch, 'name': eng[ch], 'japanese': names[ch][1], 'class': cls, 'className': game.class_name(cls)[0],
             'level': level, 'joinChapter': chapter, 'join': join, 'bases': {s: stats[s] for s in STATS},
             'growths': {s: 10 * g[s] for s in ['hp', 'str', 'skl', 'wlv', 'spd', 'lck', 'def']},
             'growthTenths': g, 'items': [item(i) for i in items]}
        if extra:
            u.update(extra)
        units.append(u)

    for ch in range(1, CHAPTERS + 1):
        for rec in game.allies(ch):
            cls, level, stats, items = record_unit(rec)
            add(rec[0], ch, cls, level, stats, items, {'how': 'start'})
        villages = game.village_recruits(ch)
        for row, col, a, b, c in game.visits(ch):
            if a not in (0x80, 0x81, 0x82):
                continue
            rec = villages[1 if a == 0x82 else 0]
            cls, level, stats, items = record_unit(rec)
            tile = game.map_tile(ch, row, col)
            # Only Marth can visit or seize (3:$9AEA: character 1; a Thief only opens chests).
            if tile == 0xAE:  # a throne: seizing it, which ends the chapter, frees them
                join = {'how': 'end', 'with': [eng[1]], 'note': f'Seizing the throne frees {eng[rec[0]]} (3:$9B46).'}
            else:
                join = {'how': 'visit', 'with': [eng[1]], 'note': f'Only {eng[1]} can visit (3:$9AEA).'}
                if a in (0x81, 0x82):
                    other = 0x27 if a == 0x81 else 0x26   # 3:$9B51: the village gives nothing while the other is in your army
                    join['note'] += (f' Not while {eng[other]} is in your army (3:$9B46): {eng[0x26]} or {eng[0x27]}, not both.')
            add(rec[0], ch, cls, level, stats, items, join)
        come = {f: (becomes, conv, need) for f, becomes, conv, need in game.come_to_marth(ch)}
        for kind, lst in (('foe', game.foes(ch)), ('reinforcement', game.reinforcements(ch))):
            for idx, f in enumerate(lst):
                if f[0] not in talk_by_foe and f[0] not in come:
                    continue
                cls, level, stats, items, exp = foe_unit(game, f)
                if kind == 'foe' and idx == 0:
                    exp += 10  # the chapter's first foe (8:$BBE8)
                ways, notes, becomes = [], [], None
                for talker, b in talk_by_foe.get(f[0], []):
                    ways.append(eng[talker])
                    becomes = b
                join = {'how': 'talk'}
                if kind == 'reinforcement':
                    turn = f[8]   # bit 7 clear: that turn only (3:$9223)
                    join['turn'] = turn & 0x7F
                if f[0] in come:
                    becomes, conv, need = come[f[0]]
                    who = eng[becomes]
                    if need and kind == 'reinforcement':
                        notes.append(f'Arrives on turn {join["turn"]}, only with {eng[need]} in your army (3:$91EC).')
                    lead = 'Also joins' if ways else f'{who} starts the talk: joins'
                    notes.append(f'{lead} on the enemy phase on ending a move next to {eng[1]} (3:$8CE0)'
                                 + (f', only with {eng[need]} in your army' if need else '') + '.')
                    if not ways:
                        ways.append(eng[1])
                join['with'] = ways
                notes.append('Joins with the stats the foe had (its class bases and level) and a random Luck of 0-7 (3:$8E52).')
                join['note'] = ' '.join(notes)
                add(becomes, ch, cls, level, stats, items, join,
                    {'lckRange': [0, 7], 'lckAverage': 3.5, 'exp': exp, 'foe': f[0], 'foeName': game.foe_name(f[0])[0]})

    classes = {}
    promos = game.promotions()
    groups = game.weapon_groups()
    for k in range(1, 25):
        full, short, ja = game.class_name(k)
        cl = {'id': k, 'name': full, 'shortName': short, 'japanese': ja,
              'weapons': [g for g, lo, hi, cs in groups if k in cs],
              'caps': {**{s: CAP for s in ['str', 'skl', 'wlv', 'spd', 'lck', 'def']}, 'hp': HP_CAP}, 'maxLevel': MAX_LEVEL}
        if k <= 22:
            b = game.class_bases(k)
            cl['bases'] = {s: b[s] for s in ['hp', 'str', 'skl', 'wlv', 'spd', 'lck', 'def', 'mov']}
            cl['exp'] = b['exp']
        else:
            cl['note'] = 'A Manakete\'s dragon form: no class bases (15:$EC04 covers classes 1-22).'
        for it, (froms, to) in promos.items():
            if k in froms:
                cl['promotesTo'] = to
                cl['promotionItem'] = item(it)
            if k == to:
                cl['promoted'] = True
        classes[k] = cl

    chapters = [{'number': n, 'title': en.chapter_titles[n - 1], 'place': en.text.get(0x3B6 + n - 1)} for n in range(1, CHAPTERS + 1)]
    unused = [ch for ch in range(1, 54) if ch not in seen]
    return {
        'source': {'cartridge': f'program +{game.c.offset_in_program:#x}', 'settings': game.c.settings.hex()},
        'chapters': chapters,
        'units': units,
        'classes': classes,
        'promotions': {item(i): {'from': f, 'to': t, 'minLevel': PROMOTE_LEVEL} for i, (f, t) in promos.items()},
        'weaponGroups': [{'group': g, 'items': [item(i) for i in range(lo, hi + 1)], 'classes': cs} for g, lo, hi, cs in groups],
        'personalItems': {item(i): eng[ch] for i, ch in game.personal_items().items()},
        'boosters': {item(i): {'stat': s, 'amount': a, 'cap': c} for i, (s, a, c) in game.boosters().items()},
        'notJoining': {ch: names[ch][0] or names[ch][1] for ch in unused},
        'mechanics': {
            'levelUp': '15:$D085: at 100 EXP (none at Lv 20). For HP, Def, Lck, Spd, WLv, Skl, Str in that order: a random byte / 25 '
                       '(0-10, 15:$C6EB); the stat grows when that is below the growth in tenths, always at 10, so a growth of G '
                       'tenths is 25G/256 (90% -> 87.9%). Res never grows. The 7 bytes come from 7 calls in a row of 15:$C04E, '
                       'which adds 55 each time, so one level-up\'s rolls are r, r+55, r+110 ... (mod 256).',
            'mercurius': '15:$D116: with the Mercurius (item 7, Marth\'s only) equipped, each stat that grows gets +2 instead of +1 '
                         'when two bits of the frame counter ($30, by stat 15:$D12F) are both clear: 1 in 4.',
            'caps': '15:$D0FE: Str, Skl, WLv, Spd, Lck, Def 20, HP 52, every class; max level 20. Items: Boots Mov 12, Res 7 '
                    '(Talisman: permanent, bit 7; Pure Water and a used Parthia: Res 7 that falls by 1 at 6:$A234).',
            'exp': '15:$CB34, $CB73: a kill gives the foe\'s EXP value (class EXP + level - 1, +10 for a chapter\'s first foe), at '
                   'most 100; otherwise the damage dealt, at most 20, none for 0. The unit\'s own level doesn\'t matter.',
            'promotion': '6:$980B: the item for the class, Lv 10 or more; the class changes, the level becomes 1, and max HP, Str, '
                         'Skl, WLv, Spd, Lck, Def and Mov are each raised to the new class\'s base where lower (6:$9852; the bases '
                         'built by 11:$A3B0 with no bonus). Res and EXP are not touched.',
            'recruitedFoes': '8:$BBF4 / 3:$9271: class bases + (level - 1) // 2 for Str, Skl, WLv, Spd, Def; HP + 3 x that; Mov the '
                             'class\'s; joining (3:$8E52) keeps those and the EXP value, gives a random Luck 0-7 and refills the two '
                             'items.',
        },
        'talks': [{'talker': eng[t], 'foe': game.foe_name(f)[0] or game.foe_name(f)[1], 'becomes': eng.get(b, b)} for t, f, b in talks],
    }


def program_from_nsp(path=NSP):
    """The program `main` out of the package: the Program NCA's ExeFS (section 0), as it sits in memory."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from switch_nsp import Nsp

    program = Nsp(path).program()
    assert program.title_id == TITLE_ID, f'{program.title_id:016x}'
    exefs = program.pfs0(next(sec for sec in program.sections if sec['fs_type'] == 'PFS0' and sec['index'] == 0))
    return program_image(exefs.open('main'))


def load(path=None):
    """The game, from a program file when given, else from the NSP."""
    return FE1(program_image(open(path, 'rb').read()) if path else program_from_nsp())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('main', nargs='?')
    ap.add_argument('-o', '--out')
    args = ap.parse_args()
    game = load(args.main)
    data = build(game)
    text = json.dumps(data, ensure_ascii=False, indent=1)
    if args.out:
        open(args.out, 'w', encoding='utf-8', newline='\n').write(text + '\n')
        print(f"{len(data['units'])} units, {len(data['classes'])} classes, {len(data['chapters'])} chapters -> {args.out}")
    else:
        sys.stdout.reconfigure(encoding='utf-8')
        print(text)


if __name__ == '__main__':
    main()
