"""
Which weapon types each class can use, read from the user's own game files and checked in each game's program code. Nothing here is
written to the repo; the generators can import it. Run: python scripts/class_weapons.py [fe3|fe15]

Mystery of the Emblem (FE3): the user's ROM through scripts/fe3_rom.py (LoROM: $BB:AAAA is file offset (BB & 0x7F) * 0x8000 +
(AAAA & 0x7FFF)); English names from the translation patch (scripts/fe3_names.py).
  - The game has no per-class weapon table: every item names the classes that can use it. The check is $83:EE68 (20 callers: the
    item, trade and battle menus, the AI): item +12 (14 bytes per item at $88:A6E9) picks a u16 pointer at $88:A4B1, to a list of class
    ids ended by FF ($83:EEBD), compared with the unit's class ($7F:4401). A class can use a weapon type when some weapon of that type
    lists it, so this reader takes each item's type (+0: a bit each, 1 sword, 2 lance, 4 bow, 8 staff, 0x10 tome, 0x20 item, 0x40 axe,
    0x80 breath; 0 a ballista; the Levin Sword's 0x11 is a sword) over every item id.
  - Then ($83:EF20): a weapon whose level (+2) has bit 7 set is locked to the name ids in its list (u16 pointers at $88:A48E by the low
    bits, ended by FF, against $7F:4416) and skips the weapon-level check; any other weapon needs +2 <= the unit's weapon level
    ($7F:440F). Items from id 0x57 on (the non-weapons) compare +2 with the unit's level ($7F:4402) instead: the promotion items' 10.
  - Tomes and staves (ids 0x2D-0x4E) fail under Silence ($07F4 bit 0), Imhullu (0x37) aside ($83:EE7D).
  - Dragonstones are items (type 0x20): the stones listed at $83:84A6 (7 ids), each turning its user into the class at $83:849F
    ($93:D305). They're counted here as "Dragonstone" for the classes their lists name.
  - $83:EE59 is a second entry with a flag ($0AA0) that would also let Cavaliers, Paladins, Pegasus and Dragon Knights and both Knights
    use any sword or lance. Nothing calls it (no JSL, JML or pointer to it in the ROM): dead code, not the game's rule.
  - On foot ($93:D9BD, called as a unit goes indoors and around a promotion, $83:D3F8): Cavalier, Paladin, Pegasus Knight and Dragon
    Knight become Knight (5), or Knight (F) (6) for the portraits listed at $93:FFE5 (the women: Caeda, Midia, Catria, Minerva, Est,
    Palla, Cecil); a Horseman becomes a Hunter. The class it rides as is kept at $7F:4414.

Shadows of Valentia (FE15): data-raw/fe15/romfs (scripts/fe15_extract.py); the tables describe themselves (a MOD_ block of field names
and types, then the DAT_ records; read by name below).
  - Job.bin (MOD_兵種), `武器` (u16 at +34): a bit per item kind, bit k for kind k: 2 sword, 4 lance, 8 axe, 16 bow, 32 black magic,
    64 white magic, 128 monster weapons (claws, fangs, breath...). 0x100 is set on every humanoid class and on no monster; kind 8 is
    "valuable", and the equip check stops at kind 8 before reading the mask, so it isn't a weapon type (the Armory reads it as items).
  - Item.bin (MOD_アイテム): `種類` (s8 at +36) the kind (1 sword, 2 lance, 3 axe, 4 bow, 5 black magic, 6 white magic, 7 monster;
    8 and on not weapons); `フラグ` (u32 at +140).
  - The check (code.bin, loaded at 0x100000): 0x44fe64 takes the unit and the item; a kind of 8 or more fails, and so does white magic
    unless the caller asks for it (its third argument); then 0x4487b8 tests the class's `武器` (job +0x22) against 1 << kind. After that,
    flag 0x80 needs the royal skill (SID_リゲル王家 Alm's or SID_ソフィア王家 Celica's), 0x20 a man and 0x40 a woman (person +0x1c,
    0x458f08): the Royal Sword and Falchion (0xa1) are Alm's alone, Beloved Zofia (0xc1) Celica's. A spell also needs more HP than its
    cost (item +136), unless the unit has SID_魔法ＨＰ消費無し.
  - The class introduction screen (0x1e9f68) shows them as the game groups them: Sword, Lance, Axe, Bow, and one "Magic" for black or
    white (MID_SYS_剣/槍/斧/弓/魔法; "Weapons: $a0, $a1" for two). Spells aren't equipped: a unit learns its own (Person.bin
    `習得魔法系` / `習得神聖系`, MSID_ lists by level and class rank) and the class's magic bits say which kinds it can cast.
"""
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FE15_ROMFS = os.path.join(ROOT, 'data-raw', 'fe15', 'romfs')

# ---------------------------------------------------------------------------------------------------------------------------- FE3

FE3_STONES = 0x8384A6        # the dragonstones' item ids ($93:D305 searches it)
FE3_STONE_CLASSES = 0x83849F  # the class each stone turns its user into, in the same order
FE3_STONE_COUNT = 7
FE3_WOMEN_ON_FOOT = 0x93FFE5  # portrait ids ($7F:4417) whose units get off as Knight (F), ended by FF
# $93:D9BD: the mounted classes that get off indoors, and what they become (5 Knight, 6 Knight (F) for the portraits above).
FE3_ON_FOOT = {3: (5, 6), 4: (5, 6), 9: (5, 6), 10: (5, 6), 14: (11, 11)}
FE3_CLASS_COUNT = 45          # class ids 0-44 (the 9-byte class records at $88:906C)
FE3_ORDER = ['Sword', 'Lance', 'Axe', 'Bow', 'Tome', 'Staff', 'Dragonstone', 'Breath', 'Ballista']


def fe3_stones():
    """{dragonstone item id: the class it turns its user into}."""
    import fe3_rom as r
    return {r.u8(FE3_STONES + k): r.u8(FE3_STONE_CLASSES + k) for k in range(FE3_STONE_COUNT)}


def fe3_class_items():
    """{class id: [item ids]}: every weapon (and dragonstone) whose class list ($88:A4B1 by item +12) names the class. Items for
    everyone (the spheres, rings, keys, Vulnerary) and the promotion items are left out."""
    import fe3_rom as r
    stones = fe3_stones()
    out = {k: [] for k in range(FE3_CLASS_COUNT)}
    for i in range(r.ITEM_COUNT):
        it = r.item(i)
        if it['type'] == 'Item' and i not in stones:
            continue
        for c in set(r.users(i)):
            out.setdefault(c, []).append(i)
    return out


def fe3_item_kind(i):
    import fe3_rom as r
    return 'Dragonstone' if i in fe3_stones() else r.item(i)['type']


def fe3_class_weapons(app_ids=False):
    """{class id: [weapon types]} for every class id (0-44), as the item lists give them. app_ids: keyed as the app's classId
    (str(class id), build-fe3-units.py). A mounted class lists what it uses mounted; fe3_on_foot() says what it gets off as."""
    kinds = {}
    for c, items in fe3_class_items().items():
        have = {fe3_item_kind(i) for i in items}
        kinds[str(c) if app_ids else c] = [k for k in FE3_ORDER if k in have]
    return kinds


def fe3_locks():
    """{item id: [name ids]}: the weapons locked to characters (item +2 with bit 7 set; the lists at $88:A48E). A locked weapon still
    needs the class in its class list ($83:EEBD runs first), but no weapon level."""
    import fe3_rom as r
    return {i: r.lock(r.item(i)['lock']) for i in range(r.ITEM_COUNT) if r.item(i)['lock'] is not None and r.item(i)['type'] != 'Item'}


def fe3_on_foot():
    """{mounted class: (the class its men get off as, its women's)} and the women's portrait ids ($93:FFE5)."""
    import fe3_rom as r
    return dict(FE3_ON_FOOT), r.ff_list(FE3_WOMEN_ON_FOOT)


# --------------------------------------------------------------------------------------------------------------------------- FE15

FE15_KINDS = {1: 'Sword', 2: 'Lance', 3: 'Axe', 4: 'Bow', 5: 'Black Magic', 6: 'White Magic', 7: 'Monster'}
FE15_ROYAL, FE15_MEN, FE15_WOMEN = 0x80, 0x20, 0x40   # Item.bin フラグ, as the equip check (0x44fe64) reads them
_SIZE = {'str': 4, 'ptr': 4, 's8': 1, 'u8': 1, 's16': 2, 'u16': 2, 'u32': 4, 's32': 4, 'f32': 4}


def _fe15_bin(path):
    from fates_lz import decompress
    from fe13_bin import Bin
    return Bin(decompress(open(os.path.join(FE15_ROMFS, path), 'rb').read()))


def _fe15_rows(b, table):
    """The records of the MOD_<table>/DAT_<table> table, one per label, as dicts by field name (a repeated name gets #2, #3)."""
    mod = b.at['MOD_' + table]
    fields, seen = [], {}
    for k in range(b.u32(mod)):
        o = mod + 4 + 20 * k
        name, typ = b.str(o), b.str(o + 4)
        seen[name] = seen.get(name, 0) + 1
        fields.append((name if seen[name] == 1 else f'{name}#{seen[name]}', typ))
    size = sum(_SIZE[t] for _, t in fields)
    dat = b.at['DAT_' + table]
    end = min([o for o, n in b.labels if n.startswith('MOD_') and o > dat] + [b.size])
    rows = []
    for o in sorted({o for o, n in b.labels if dat <= o < end and not n.startswith(('DAT_', 'MOD_'))}):
        if (o - dat) % size:
            continue
        rec, p = {}, o
        for name, typ in fields:
            if typ == 'str':
                rec[name] = b.str(p)
            elif typ == 'ptr':
                rec[name] = b.u32(p) if p in b.ptrs else None
            elif typ in ('f32', 's32'):
                rec[name] = struct.unpack_from('<f' if typ == 'f32' else '<i', b.d, 0x20 + p)[0]
            else:
                rec[name] = {'s8': b.s8, 'u8': b.u8, 's16': b.s16, 'u16': b.u16, 'u32': b.u32}[typ](p)
            p += _SIZE[typ]
        rows.append(rec)
    return rows


def fe15_app_ids():
    """{JID: the app's classId}: 'j' and the class's place among Job.bin's JID_ labels, JID_不明 left out (build-fe15-units.py)."""
    b = _fe15_bin('Data/Job.bin.lz')
    jobs = [n for o, n in b.labels if n.startswith('JID_') and n != 'JID_不明']
    return {n: f'j{i}' for i, n in enumerate(jobs)}


def fe15_class_masks():
    """{JID: Job.bin's 武器 mask} for every class but JID_不明."""
    return {r['兵種']: r['武器'] for r in _fe15_rows(_fe15_bin('Data/Job.bin.lz'), '兵種') if r['兵種'] != 'JID_不明'}


def fe15_class_weapons(app_ids=False, split_magic=False):
    """{JID: [weapon types]} for every class. As the class introduction screen groups them: Sword, Lance, Axe, Bow, Magic (black or
    white magic, one entry), and Monster for the monsters' claws, fangs and breath. split_magic: 'Black Magic' and 'White Magic'
    instead of 'Magic'. app_ids: keyed by the app's classId ('j0'...)."""
    ids = fe15_app_ids() if app_ids else None
    out = {}
    for jid, mask in fe15_class_masks().items():
        kinds = []
        for k, name in FE15_KINDS.items():
            if mask >> k & 1:
                if not split_magic and k in (5, 6):
                    name = 'Magic'
                if name not in kinds:
                    kinds.append(name)
        out[ids[jid] if ids else jid] = kinds
    return out


def fe15_restricted_weapons():
    """{IID: (English name, who)}: the weapons the equip check keeps to someone beyond the class (Item.bin フラグ 0x80 / 0x20 / 0x40)."""
    import fates_text
    names = fates_text.read(os.path.join(FE15_ROMFS, 'm', '@NOA_EN', 'Item.bin.lz'))
    out = {}
    for r in _fe15_rows(_fe15_bin('Data/Item.bin.lz'), 'アイテム'):
        f = r['フラグ']
        if 1 <= r['種類'] <= 7 and f & (FE15_ROYAL | FE15_MEN | FE15_WOMEN):
            who = []
            if f & FE15_ROYAL:
                who.append('royal blood (SID_リゲル王家 or SID_ソフィア王家)')
            if f & FE15_MEN:
                who.append('men only')
            if f & FE15_WOMEN:
                who.append('women only')
            out[r['アイテム']] = (names.get(r['名前'] or '', r['アイテム']), ', '.join(who))
    return out


# --------------------------------------------------------------------------------------------------------------------------- main

def _show_fe3():
    import fe3_names as fn
    cn, chars, items = fn.class_names(), fn.character_names(), fn.item_names()
    stones = fe3_stones()
    class_items = fe3_class_items()
    for c, kinds in fe3_class_weapons().items():
        extra = ''
        own = [items.get(i, i) for i in class_items[c] if i in stones]
        if own and len(own) < len(stones):
            extra = f'  (stones: {", ".join(own)})'
        print(f'{c:2} {cn.get(c, c):16} {", ".join(kinds) or "-"}{extra}')
    print('\nLocked weapons (item: who):')
    locked = {}
    for i, ids in fe3_locks().items():
        locked.setdefault(items.get(i, i), ', '.join(chars.get(n, hex(n)) for n in ids))  # the two Aum records share a list
    for name, who in locked.items():
        print(f'  {name}: {who}')
    on_foot, women = fe3_on_foot()
    print('\nOn foot:', {cn[k]: (cn[a], cn[b]) for k, (a, b) in on_foot.items()}, 'women portraits', [hex(p) for p in women])


def _show_fe15():
    import fates_text
    jn = fates_text.read(os.path.join(FE15_ROMFS, 'm', '@NOA_EN', 'Job.bin.lz'))
    b = _fe15_bin('Data/Job.bin.lz')
    label = {r['兵種']: jn.get(r['名前'] or '', r['兵種']) for r in _fe15_rows(b, '兵種')}
    ids = fe15_app_ids()
    split = fe15_class_weapons(split_magic=True)
    for jid, kinds in fe15_class_weapons().items():
        print(f'{ids[jid]:4} {jid:22} {label[jid]:16} {", ".join(kinds) or "-":20} {", ".join(split[jid])}')
    print('\nRestricted weapons:')
    for iid, (name, who) in fe15_restricted_weapons().items():
        print(f'  {name}: {who}')


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    which = sys.argv[1:] or ['fe3', 'fe15']
    if 'fe3' in which:
        _show_fe3()
    if 'fe15' in which:
        if 'fe3' in which:
            print()
        _show_fe15()
