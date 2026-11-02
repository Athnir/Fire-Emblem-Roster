"""
Genealogy of the Holy War's characters, classes, holy blood, children and love, read from the user's clean Japanese ROM
(fe4_rom.py). Names come from the Lil' Nordion patch's tables, applied in memory (fe4_names.py). Formats are in
data-raw/fe4/README.md; the routines named here are in the game's code ($XX:YYYY).
"""
from fe4_rom import R, u16

# The order the game keeps a unit's stats in: personal records, growth rates and holy blood bonuses.
GAME_STATS = ('hp', 'str', 'mag', 'skl', 'spd', 'def', 'res', 'lck')
CHARACTERS = 0x38000 + 0x2DF5  # u16 count*2, then u16 offsets (from here) to each record, id 1 upward
CLASSES = 0x38FC5  # 72 records of 31 bytes (the pointer table at 0x38F35 points at them)
HOLY_BLOOD = 0x389E3  # 13 records of 16 bytes
PROMOTIONS = 0x3833C  # one byte per character id (from 1): the class they promote to, 255 none
MOTHERS = 0x38993  # u16 offsets, by mother id 0x10-0x18, each to her children's ids [son, daughter] ($84:8237)
SKILL_MASKS = 0x7A975  # 3 bytes per child id from 0x19: the parents' skill bits that can pass to them ($87:A8E1)
LOVE_MEN, LOVE_WOMEN = 0x3848D, 0x384DB  # character id lists (u16, ended by a value with the top bit set)
LOVE_START, LOVE_GROWTH = 0x3850F, 0x38738  # per woman: u16 offset to a row of one byte per man
# The holy bloods in the order of their bits in a character record (and of the bonus table).
# Names: the patch's spellings (Neir and Hezul aren't in its text, so they're Serenes Forest's).
BLOODS = ('Baldr', 'Naga', 'Dáinn', 'Njörun', 'Od', 'Ullr', 'Neir', 'Fjalar', 'Thrud', 'Forseti', 'Bragi', 'Hezul',
          'Loptous')
# Personal skill bits (bytes 0x1C-0x1E of a character record), from the code that tests each ($87:A19D and the battle code; see
# the README). Names are the patch's spellings where its text uses them. Byte 0's 0x08 is a skill nothing uses.
SKILL_BITS = {
    (0, 0x01): 'Wrath', (0, 0x02): 'Pursuit', (0, 0x04): 'Adept', (0, 0x10): 'Charm', (0, 0x40): 'Nihil', (0, 0x80): 'Miracle',
    (1, 0x01): 'Critical', (1, 0x02): 'Vantage', (1, 0x04): 'Accost', (1, 0x08): 'Astra', (1, 0x10): 'Luna', (1, 0x20): 'Sol',
    (2, 0x01): 'Renewal', (2, 0x02): 'Paragon', (2, 0x08): 'Recover', (2, 0x10): 'Bargain', (2, 0x20): 'Return',
}
# Personal bits that aren't skills: the story keeps these units alive. 'removed': taken off the map instead of dying, but not
# in the Final Chapter ($84:B930: Deirdre, Julia); 'retreats': retreats instead ($84:B927: Quan, Ethlyn, the first Finn).
PROTECTION_BITS = {(0, 0x20): 'removed', (2, 0x04): 'retreats'}
# Class skill bits (+0x1C-0x1D of a class record), from the code that tests each.
CLASS_SKILL_BITS = {
    (0, 0x01): 'Canto', (0, 0x02): 'Pavise', (0, 0x04): 'Wrath', (0, 0x08): 'Pursuit', (0, 0x10): 'Adept', (0, 0x20): 'Steal',
    (0, 0x80): 'Dance', (1, 0x08): 'Charm', (1, 0x10): 'Critical',
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


def bits_of(raw, table):
    return [name for (b, bit), name in table.items() if raw[b] & bit]


def skills_of(raw3):
    return bits_of(raw3, SKILL_BITS)


def people():
    """Playable records. Kind 0 (38 bytes): +1-8 HP (absolute) then Str, Mag, Skl, Spd, Def, Res, Lck (added to the class's
    bases), +9 class, +0x0A level, +0x0B leadership stars, +0x0C gold / 1000, +0x0D id, +0x0F name index (u16), +0x11 the
    second generation's slot (a substitute shares its child's), +0x12 1 for women ($84:A3E5), +0x13 the father's id (a child's),
    +0x14-0x1B growth rates (same order), +0x1C-0x1E skills, +0x1F-0x22 holy blood, +0x23-0x25 item instances. Kind 1 (12 bytes,
    a child whose stats come from the parents): +1 class, +2 level, +3 id (u16), +5 name index (u16), +7 slot, +8 1 for a
    daughter, +9-0x0A item instances, +0x0B 1 when the father is the parent for holy blood and items (0 the mother). {id: dict}."""
    out = {}
    n = u16(CHARACTERS) // 2
    for i in range(1, n):
        r = record(i)
        if r[0] == 0 and len(r) == 38:
            raw = bytes(r[0x1C:0x1F])
            protection = [name for (b, bit), name in PROTECTION_BITS.items() if raw[b] & bit]
            out[i] = {
                'id': i, 'kind': 'fixed', 'class': r[9], 'level': r[10], 'leadership': r[11], 'gold': r[12] * 1000,
                'name_index': r[0x0F] | r[0x10] << 8, 'slot': r[0x11], 'female': bool(r[0x12]),
                'personal': dict(zip(GAME_STATS, r[1:9])), 'growths': dict(zip(GAME_STATS, r[0x14:0x1C])),
                'skills': skills_of(raw), 'skill_bits': raw, 'blood': blood_of(r[0x1F:0x23]),
                'protection': protection[0] if protection else None,
                'items': [x for x in r[0x23:0x26] if x != 0xFF],
            }
        elif r[0] == 1 and len(r) == 12:
            out[i] = {'id': i, 'kind': 'child', 'class': r[1], 'level': r[2], 'name_index': r[5] | r[6] << 8, 'slot': r[7],
                      'female': bool(r[8]), 'items': [x for x in r[9:11] if x != 0xFF], 'main_father': bool(r[11])}
        if i > 63:
            break
    return out


def promotion(i):
    """The class character id i promotes to, or None (255, or their own class: Oifey's)."""
    return R[PROMOTIONS + i - 1]


def classes(count=72):
    """Class records (31 bytes): +0 the level to promote into this class (20 for every promoted class; $87:A438), +1-7 bases
    (HP, Str, Mag, Skl, Spd, Def, Res; HP only for generic units), +8-0x0E generic units' growths, +0x0F-0x18 weapon ranks (sword,
    lance, axe, bow, staff, fire, thunder, wind, light, dark: 0 A, 1 B, 2 C, 3 none), +0x19 Mov, +0x1A movement type, +0x1B
    flier, +0x1C-0x1D class skills, +0x1E unknown. {id: dict}."""
    out = {}
    for i in range(count):
        o = CLASSES + 31 * i
        out[i] = {
            'id': i, 'promote_level': R[o], 'ranks': list(R[o + 0x0F:o + 0x19]), 'mov': R[o + 0x19], 'move_type': R[o + 0x1A],
            'flier': bool(R[o + 0x1B]), 'skill_bits': bytes(R[o + 0x1C:o + 0x1E]),
            'skills': bits_of(R[o + 0x1C:o + 0x1E], CLASS_SKILL_BITS),
            'bases': dict(zip(('hp', 'str', 'mag', 'skl', 'spd', 'def', 'res'), R[o + 1:o + 8])),
        }
    return out


def holy_bloods():
    """13 records of 16 bytes, in BLOODS order: +0 the weapon type (0 sword ... 9 dark), +1 the holy weapon's item id, +2-9 the
    growth bonuses (HP, Str, Mag, Skl, Spd, Def, Res, Lck; doubled for major blood), +0x0A-0x0F the holy weapon's stat bonuses."""
    out = []
    for k, name in enumerate(BLOODS):
        o = HOLY_BLOOD + 16 * k
        out.append({'name': name, 'weapon_type': R[o], 'weapon': R[o + 1], 'growths': dict(zip(GAME_STATS, R[o + 2:o + 10]))})
    return out


def mothers():
    """{mother id: [child ids]}: Deirdre has Seliph alone; the others a son and a daughter."""
    out = {}
    for k in range(9):
        o = MOTHERS + u16(MOTHERS + 2 * k)
        out[0x10 + k] = [u16(o + 2 * j) for j in range(2) if u16(o + 2 * j)]
    return out


def skill_mask(child_id):
    """The personal skill bits a child can inherit from the parents' (both parents' bits OR'ed, then this mask)."""
    o = SKILL_MASKS + 3 * (child_id - 0x19)
    return bytes(R[o:o + 3])


def _ids(o):
    out = []
    while not u16(o) & 0x8000:
        out.append(u16(o))
        o += 2
    return out


def love():
    """The love tables ($83:850F start, $83:8738 growth per player phase): {(woman id, man id): (start, growth)} for the first
    generation's 9 women and 15 men. Start is x10 (0xFE: 499); 0xFF means the pair can never be lovers (None here)."""
    men, women = _ids(LOVE_MEN), _ids(LOVE_WOMEN)
    out = {}
    for wi, w in enumerate(women[:9]):
        for mi, m in enumerate(men[:15]):
            s = R[LOVE_START + u16(LOVE_START + 2 * wi) + mi]
            g = R[LOVE_GROWTH + u16(LOVE_GROWTH + 2 * wi) + mi]
            out[(w, m)] = (None if s == 0xFF else 499 if s == 0xFE else s * 10, g - 256 if g > 127 else g)
    return out
