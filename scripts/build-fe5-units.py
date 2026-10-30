"""
Build src/data/fe5/fe5Units.ts from the user's own Thracia 776 ROM (see data-raw/fe5/README.md): the playable units, when and how
they join, their classes and the classes they can promote to, supports and the holy scrolls' growth bonuses.

Run: python scripts/build-fe5-units.py   (FE5_ROM overrides where the ROM is)
"""
import json
import os

import fe5_rom as r
from fe5_joins import HEADINGS, chapter_id, joins
from fe5_names import character_names, class_names, item_names

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'data', 'fe5', 'fe5Units.ts')
# The order of a character record's bases and growths, and of the scrolls' bonuses.
GAME_STATS = ('hp', 'str', 'mag', 'skl', 'spd', 'def', 'con', 'lck', 'mov')
# The order a class record keeps its bases in (no Luck).
CLASS_STATS = ('hp', 'str', 'mag', 'skl', 'spd', 'def', 'con', 'mov')
STATS = ('hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'con', 'mov')
WEAPONS = ('sword', 'lance', 'axe', 'bow', 'staff', 'fire', 'thunder', 'wind', 'light', 'dark')
SUPPORTS = 0x8880CD  # 5-byte entries: gets u16, gives u16, bonus u8; ended by a 0 character
SCROLLS = 0x888054  # 10-byte entries: item id, then a signed growth bonus per stat (GAME_STATS order)
SCROLL_COUNT = 12
# The dismounted classes (the Armory's build-fe5-maps.py): mounted units and fliers become these indoors.
DISMOUNTED = {0x28, 0x2B, *range(0x42, 0x55), 0x56, 0x58, 0x5A, 0x5C, 0x5E, 0x60, 0x74}
# Joins the scripts' runner doesn't find: Misha is talked to by Karin, then captured, and joins at the chapter's end if Karin lives
# (Serenes Forest's recruitment page; level from its base stats).
EXTRA_JOINS = {39: (22, 'event', [], None, 4, 'Talk to her with Karin, then capture her; she joins at the end of the chapter if '
                                              'Karin is alive (Serenes Forest).')}


def signed(b):
    return b - 256 if b > 127 else b


def character(c):
    """48 bytes from id 1 at $86:9A2D: +0-8 their own bases (GAME_STATS, added to the class's), +9 movement stars x 5, +0x0A the
    pursuit critical coefficient, +0x0B-0x13 growth rates (GAME_STATS), +0x14 unknown, +0x15-0x1E weapon ranks (sword ... dark),
    +0x28 1 for women, +0x29-0x2B skills (bits), +0x2C class, +0x2D leadership stars, +0x2E portrait."""
    o = r.lo(r.CHARACTERS + 48 * (c - 1))
    b = r.R[o:o + 48]
    return {
        'personal': dict(zip(GAME_STATS, (signed(x) for x in b[0:9]))), 'move_stars': b[9] // 5, 'pcc': b[10],
        'growths': dict(zip(GAME_STATS, b[11:20])), 'ranks': dict(zip(WEAPONS, b[21:31])), 'female': bool(b[0x28]),
        'class': b[0x2C], 'leadership': b[0x2D],
    }


def class_record(c):
    """36 bytes from id 1 at $86:8000: +0-7 bases (CLASS_STATS), +9-0x12 weapon ranks, +0x13-0x15 skills, +0x23 the class it
    promotes from (0 none)."""
    o = r.lo(r.CLASSES + 36 * (c - 1))
    b = r.R[o:o + 36]
    return {'bases': dict(zip(CLASS_STATS, b[0:8])), 'ranks': dict(zip(WEAPONS, b[9:19])), 'lower': b[35]}


def rank_letter(points):
    """Weapon experience -> rank, as Serenes Forest lists Thracia 776's: E 1, D 51, C 101, B 151, A 201, S 251 (unconfirmed)."""
    for limit, letter in ((251, 'S'), (201, 'A'), (151, 'B'), (101, 'C'), (51, 'D'), (1, 'E')):
        if points >= limit:
            return letter
    return None


def main():
    names, cnames, inames = character_names(), class_names(), item_names()
    joined = {c: (*v, None) for c, v in joins().items()}
    joined.update(EXTRA_JOINS)
    order = sorted(joined, key=lambda c: (joined[c][0], c))
    lowers = {}
    for k in range(1, 0x78):
        rec = class_record(k)
        if rec['lower']:
            lowers.setdefault(rec['lower'], []).append(k)

    used = set()
    units = []
    for c in order:
        n, how, with_, turn, level, note = joined[c]
        p = character(c)
        # A unit joining on an indoor map comes in its dismounted class (a second class of the same name, later in the table);
        # it's listed in its mounted one, as Serenes Forest does.
        mounted = next((k for k in range(1, p['class']) if cnames.get(k) == cnames[p['class']]), None)
        if mounted and p['class'] in DISMOUNTED:
            p['class'] = mounted
        cls = class_record(p['class'])
        used.add(p['class'])
        promos = lowers.get(p['class'], [])
        used |= set(promos)
        cb = {**cls['bases'], 'lck': 0}
        unit = {
            'id': f'fe5-{c}', 'name': names[c], 'classId': str(p['class']), 'level': level or 1,
            'joinChapter': chapter_id(n), 'join': {'how': how, **({'with': [names[w] for w in with_]} if with_ else {}),
                                                   **({'turn': turn} if turn else {}), **({'note': note} if note else {})},
            'female': p['female'],
            'bases': {s: cb[s] + p['personal'][s] for s in STATS},
            'growths': {s: p['growths'][s] for s in STATS},
            'ranks': {w: rank_letter(v) for w, v in p['ranks'].items() if rank_letter(v)},
            **({'leadership': p['leadership']} if p['leadership'] else {}),
            'moveStars': p['move_stars'], 'pcc': p['pcc'],
            **({'promotesTo': [str(k) for k in promos]} if promos else {}),
        }
        units.append(unit)

    out_classes = {str(k): {'id': str(k), 'name': cnames[k], 'bases': {**class_record(k)['bases'], 'lck': 0}} for k in sorted(used)}

    ids = {u['id'] for u in units}
    supports, a = [], SUPPORTS
    while r.u16(a):
        gets, gives, bonus = r.u16(a), r.u16(a + 2), r.u8(a + 4)
        if f'fe5-{gets}' in ids and f'fe5-{gives}' in ids:
            supports.append({'gets': f'fe5-{gets}', 'gives': f'fe5-{gives}', 'bonus': bonus})
        a += 5

    scrolls = []
    for k in range(SCROLL_COUNT):
        o = r.lo(SCROLLS + 10 * k)
        b = r.R[o:o + 10]
        bonus = dict(zip(GAME_STATS, (signed(x) for x in b[1:10])))
        scrolls.append({'id': str(b[0]), 'name': inames[b[0]], 'growths': {s: bonus[s] for s in STATS}})

    chapters = [{'id': chapter_id(i), 'label': h} for i, h in enumerate(HEADINGS)]

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    lines = [
        "// Generated by scripts/build-fe5-units.py from the user's own Thracia 776 ROM. Don't edit by hand.",
        "import type { Fe5Chapter, Fe5Class, Fe5Scroll, Fe5Support, Fe5Unit } from '../../thracia/types'",
        '',
        f'export const FE5_CHAPTERS: Fe5Chapter[] = {js(chapters)}',
        '',
        'export const FE5_UNITS: Fe5Unit[] = [',
        *[f'  {js(u)},' for u in units],
        ']',
        '',
        'export const FE5_CLASSES: Record<string, Fe5Class> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in out_classes.items()],
        '}',
        '',
        '// Who gets a bonus to hit, avoid, crit and crit avoid from whom (within 3 tiles), one way per entry.',
        'export const FE5_SUPPORTS: Fe5Support[] = [',
        *[f'  {js(s)},' for s in supports],
        ']',
        '',
        '// The holy scrolls: growth bonuses while carried.',
        'export const FE5_SCROLLS: Fe5Scroll[] = [',
        *[f'  {js(s)},' for s in scrolls],
        ']',
        '',
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(units)} units, {len(out_classes)} classes, {len(supports)} supports, {len(scrolls)} scrolls -> {OUT}')


if __name__ == '__main__':
    main()
