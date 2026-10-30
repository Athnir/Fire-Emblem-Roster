"""
Genealogy of the Holy War's characters, classes and holy blood, read from the user's clean Japanese ROM (fe4_rom.py). Names
come from the Lil' Nordion patch's tables, applied in memory (fe4_names.py). Formats are in data-raw/fe4/README.md.
"""
from fe4_rom import R, u16

# The order the game keeps a unit's stats in: personal records, growth rates and holy blood bonuses.
GAME_STATS = ('hp', 'str', 'mag', 'skl', 'spd', 'def', 'res', 'lck')
CHARACTERS = 0x38000 + 0x2DF5  # u16 count*2, then u16 offsets (from here) to each record, id 1 upward
CLASSES = 0x38FCD  # 72 records of 31 bytes
HOLY_BLOOD = 0x389E3  # 13 records of 16 bytes
PROMOTIONS = 0x3833C  # one byte per character id (from 1): the class they promote to, 255 none
# The holy bloods in the order of their bits in a character record (and of the bonus table).
# Names: the patch's spellings (Neir and Hezul aren't in its text, so they're Serenes Forest's).
BLOODS = ('Baldr', 'Naga', 'Dáinn', 'Njörun', 'Od', 'Ullr', 'Neir', 'Fjalar', 'Thrud', 'Forseti', 'Bragi', 'Hezul',
          'Loptous')
# Personal skill bits (bytes 0x1C-0x1E of a character record), matched against Serenes Forest's skill lists. Names are the
# patch's spellings where its text uses them. Bits not listed haven't been matched to a skill.
SKILL_BITS = {
    (0, 0x01): 'Wrath', (0, 0x02): 'Pursuit', (0, 0x04): 'Adept', (0, 0x10): 'Charm', (0, 0x40): 'Nihil', (0, 0x80): 'Miracle',
    (1, 0x01): 'Critical', (1, 0x02): 'Vantage', (1, 0x04): 'Accost', (1, 0x08): 'Astra', (1, 0x10): 'Luna', (1, 0x20): 'Sol',
    (2, 0x02): 'Paragon', (2, 0x10): 'Bargain',
}


def record(i):
    """The character table's record for id i (raw bytes)."""
    n = u16(CHARACTERS) // 2
    a = CHARACTERS + u16(CHARACTERS + 2 * (i - 1))
    return R[a:CHARACTERS + u16(CHARACTERS + 2 * i)] if i < n else R[a:a + 13]


def blood_of(raw4):
    """Four bytes of 2-bit fields, one per holy blood in BLOODS order: 1 minor, 2 major. [(blood, 'major'|'minor')]."""
    bits = int.from_bytes(raw4, 'little')
    out = []
    for k, name in enumerate(BLOODS):
        v = bits >> (2 * k) & 3
        if v:
            out.append((name, 'major' if v == 2 else 'minor'))
    return out


def skills_of(raw3):
    return [name for (b, bit), name in SKILL_BITS.items() if raw3[b] & bit]


def people():
    """Playable records. Kind 0 (38 bytes): +1-8 HP (absolute) then Str, Mag, Skl, Spd, Def, Res, Lck (added to the class's
    bases), +9 class, +0x0A level, +0x0B leadership stars, +0x0C gold / 1000, +0x0D id, +0x0F name index (u16), +0x11 the
    second generation's slot (a substitute shares its child's), +0x13 1 for women, +0x14-0x1B growth rates (same order), +0x1C-0x1E
    skills, +0x1F-0x22 holy blood, +0x23-0x25 item instances. Kind 1 (12 bytes, a child whose stats come from the parents): +1
    class, +2 level, +5 name index (u16), +7 slot, +9-0x0A item instances, +0x0B 1 when the child takes after the father
    (0 the mother: daughters, and Leif and Febail, whose roles swap). {id: dict}."""
    out = {}
    n = u16(CHARACTERS) // 2
    for i in range(1, n):
        r = record(i)
        if r[0] == 0 and len(r) == 38:
            out[i] = {
                'id': i, 'kind': 'fixed', 'class': r[9], 'level': r[10], 'leadership': r[11], 'gold': r[12] * 1000,
                'name_index': r[0x0F] | r[0x10] << 8, 'slot': r[0x11], 'female': bool(r[0x13]),
                'personal': dict(zip(GAME_STATS, r[1:9])), 'growths': dict(zip(GAME_STATS, r[0x14:0x1C])),
                'skills': skills_of(r[0x1C:0x1F]), 'skill_bits': bytes(r[0x1C:0x1F]), 'blood': blood_of(r[0x1F:0x23]),
                'items': [x for x in r[0x23:0x26] if x != 0xFF],
            }
        elif r[0] == 1 and len(r) == 12:
            out[i] = {'id': i, 'kind': 'child', 'class': r[1], 'level': r[2], 'name_index': r[5] | r[6] << 8, 'slot': r[7],
                      'items': [x for x in r[9:11] if x != 0xFF], 'main_father': bool(r[11])}
        if i > 63:
            break
    return out


def promotion(i):
    """The class character id i promotes to, or None (255, or their own class: Oifey's)."""
    return R[PROMOTIONS + i - 1]


def classes(count=72):
    """Class records (31 bytes): +0-6 generic units' growths, +7-0x10 weapon ranks (sword, lance, axe, bow, staff, fire, thunder,
    wind, light, dark: 0 A, 1 B, 2 C, 3 none), +0x11 Mov, +0x12 movement type, +0x13 flier, +0x14-0x15 class skills, +0x18-0x1E
    bases (HP, Str, Mag, Skl, Spd, Def, Res). A class's bases sit in the record before its own (class i's at slot i - 1; the first
    five knights share theirs, so class 0 reads slot 0). {id: dict}."""
    out = {}
    for i in range(count):
        o = CLASSES + 31 * i
        b = CLASSES + 31 * max(0, i - 1) + 0x18
        out[i] = {
            'id': i, 'ranks': list(R[o + 7:o + 0x11]), 'mov': R[o + 0x11], 'move_type': R[o + 0x12], 'flier': bool(R[o + 0x13]),
            'skill_bits': bytes(R[o + 0x14:o + 0x16]),
            'bases': dict(zip(('hp', 'str', 'mag', 'skl', 'spd', 'def', 'res'), R[b:b + 7])),
        }
    return out


def holy_bloods():
    """13 records of 16 bytes, in BLOODS order: +0 the weapon type (0 sword ... 9 dark), +1 the holy weapon's item id, +2-9 the
    growth bonuses (HP, Str, Mag, Skl, Spd, Def, Res, Lck; doubled for major blood), +10-15 not read."""
    out = []
    for k, name in enumerate(BLOODS):
        o = HOLY_BLOOD + 16 * k
        out.append({'name': name, 'weapon_type': R[o], 'weapon': R[o + 1], 'growths': dict(zip(GAME_STATS, R[o + 2:o + 10]))})
    return out
