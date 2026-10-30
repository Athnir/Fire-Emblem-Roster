"""
Build src/data/fe3/fe3Units.ts from the user's own Mystery of the Emblem ROM (see data-raw/fe3/README.md): the playable units of both
books, when and how they join, their classes and promotions, and the supports.

Run: python scripts/build-fe3-units.py   (FE3_ROM and FE3_PATCHES override where the ROM and the name patch are)
"""
import json
import os

import fe3_names as fn
import fe3_rom as r
from fe3_joins import BOOKS, CHARACTERS, joins

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'data', 'fe3', 'fe3Units.ts')
R = r.R
# 9 bytes per class ($83:DD6E reads them): Str, Skl, Spd, Mov, Def, Res, the EXP it's worth, weapon level, HP.
CLASSES = 0x88906C
# [from class][to class] pairs ended by FF ($83:FD2B): what a promotion item changes a class into.
PROMOTIONS = 0x83FDE0
# The level-up code ($83:BAF5 and on) holds every stat at 20 and HP at 52.
CAP, HP_CAP = 20, 52
STATS = ['hp', 'str', 'skl', 'spd', 'lck', 'wlv', 'def', 'res', 'mov']
# Knights on foot: a mounted class's units get off indoors, and a record placed in a castle has the dismounted class (Knight 5 or 6) with
# the class it rides as at +6 (the unit record's "class it changes into"; a Manakete's dragon there). Their stats are given mounted.
DISMOUNTED = {5, 6}
FINAL = {41: 'Final 1', 42: 'Final 2', 43: 'Final 2 pt 2', 44: 'Final 2 pt 3'}
# What the scripts leave to the player, in Serenes Forest's words (its recruitment page).
NOTES = {
    (1, 37): 'Visiting this village shuts the other: Arran or Samson, not both (Serenes Forest).',
    (1, 38): 'Visiting this village shuts the other: Arran or Samson, not both (Serenes Forest).',
    (1, 30): 'Her talk with Marth needs Maria in your army (its script checks).',
    (1, 28): 'Only if Minerva is in your army (Serenes Forest).',
    (1, 47): 'Only if Minerva is in your army (Serenes Forest).',
    (1, 42): 'Her village needs Minerva in your army (its script checks).',
    # A talk recruit takes the HP its enemy unit had ($87:87A9 copies it into the new unit, $7F:4403); only Navarre's two records
    # differ (19 as a foe, 20 as yours).
    (1, 18): 'He joins with the HP he had as a foe (19 when unhurt; the talk keeps it), out of a max HP of 20.',
    (2, 48): 'Talk to her with Marth while your army holds the Starsphere (Serenes Forest).',
    (2, 128): 'Only if Samson and all the Gra soldiers survived (Serenes Forest).',
}


def personal(char):
    """17 bytes ($83:DD6E): +0 Str, +1 Skl, +2 Spd, +4 Def, +5 Res, added to the class's; +3 Luck, +6 HP, +7 weapon level, the
    character's own (0xFF: the class's); +8 1 for a woman; +9-+16 growths: Str, Skl, Spd, Lck, Def, Res, HP, weapon level."""
    o = r.lo(CHARACTERS + 17 * char)
    b = R[o:o + 17]
    return {'add': {'str': b[0], 'skl': b[1], 'spd': b[2], 'def': b[4], 'res': b[5]}, 'lck': b[3], 'hp': b[6], 'wlv': b[7],
            'growths': dict(zip(('str', 'skl', 'spd', 'lck', 'def', 'res', 'hp', 'wlv'), b[9:17]))}


def klass(k):
    b = R[r.lo(CLASSES + 9 * k):r.lo(CLASSES + 9 * k) + 9]
    return {'str': b[0], 'skl': b[1], 'spd': b[2], 'mov': b[3], 'def': b[4], 'res': b[5], 'wlv': b[7], 'hp': b[8]}


def promotions():
    out, a = {}, PROMOTIONS
    while r.u8(a) != 0xFF:
        out[r.u8(a)] = r.u8(a + 1)
        a += 2
    return out


def label(n):
    return FINAL.get(n) or f'Ch.{n if n <= 20 else n - 20}'


def main():
    names, cnames = fn.character_names(), fn.class_names()
    promo = promotions()
    units, chapters, used = [], [], set()
    for book in BOOKS:
        sid = f'book{book}'
        chapters += [{'id': f'fe3-{book}-{n}', 'label': label(n), 'story': sid} for n in BOOKS[book]]
        for k, (n, how, with_, turn, level, cls, u, starts) in sorted(joins(book).items(), key=lambda x: (x[1][0], x[1][6]['char'])):
            alt = R[r.lo(u['at']) + 6]
            dismounted = cls in DISMOUNTED and alt != 0xFF
            if dismounted:
                cls = alt
            p, c = personal(u['char']), klass(cls)
            used.add(cls)
            bases = {s: c[s] + p['add'][s] for s in p['add']}
            bases.update({'lck': p['lck'], 'hp': c['hp'] if p['hp'] == 0xFF else p['hp'], 'wlv': c['wlv'] if p['wlv'] == 0xFF else p['wlv'],
                          'mov': c['mov']})
            notes = []
            if starts:
                notes.append(f'{names[k]} starts the talk.')
            if dismounted:
                notes.append(f'Joins on foot, indoors (a {cnames[R[r.lo(u["at"]) + 1]]}); shown mounted, as a {cnames[cls]}.')
            if (book, k) in NOTES:
                notes.append(NOTES[(book, k)])
            join = {'how': how, **({'with': [names[w] for w in with_]} if with_ else {}), **({'turn': turn} if turn else {}),
                    **({'note': ' '.join(notes)} if notes else {})}
            units.append({'id': f'fe3-{book}-{k}', 'story': sid, 'name': names[k], 'classId': str(cls), 'level': level,
                          'joinChapter': f'fe3-{book}-{n}', 'join': join, 'bases': {s: bases[s] for s in STATS},
                          'growths': p['growths'], 'ranks': {}})

    for k in list(used):
        if k in promo:
            used.add(promo[k])
    classes = {}
    for k in sorted(used):
        c = klass(k)
        classes[str(k)] = {'id': str(k), 'name': cnames.get(k, f'Class {k}'), 'bases': {s: c[s] for s in ('hp', 'str', 'skl', 'spd', 'wlv',
                                                                                                           'def', 'res', 'mov')},
                           'caps': {**{s: CAP for s in ('str', 'skl', 'spd', 'lck', 'wlv', 'def', 'res')}, 'hp': HP_CAP},
                           **({'promotesTo': str(promo[k])} if k in promo else {})}

    # The supports ($88:CD31): [giver name id][receiver name id][bonus], for the books' units who are both there.
    bonuses = []
    for book in BOOKS:
        ids = {int(u['id'].split('-')[2]) for u in units if u['story'] == f'book{book}'}
        for giver, receiver, bonus in r.supports():
            if giver in ids and receiver in ids:
                bonuses.append({'giver': f'fe3-{book}-{giver}', 'receiver': f'fe3-{book}-{receiver}', 'bonus': bonus})

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    lines = [
        "// Generated by scripts/build-fe3-units.py from the user's own Mystery of the Emblem ROM, with names from the translation",
        "// patch. Don't edit by hand.",
        "import type { GbaChapter, GbaClass, GbaStory, GbaSupportBonus, GbaUnit } from '../../gba/types'",
        '',
        '// Each book is its own army.',
        "export const FE3_STORIES: GbaStory[] = [{\"id\": \"book1\", \"label\": \"Book 1\"}, {\"id\": \"book2\", \"label\": \"Book 2\"}]",
        '',
        f'export const FE3_CHAPTERS: GbaChapter[] = {js(chapters)}',
        '',
        'export const FE3_UNITS: GbaUnit[] = [',
        *[f'  {js(u)},' for u in units],
        ']',
        '',
        'export const FE3_CLASSES: Record<string, GbaClass> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in classes.items()],
        '}',
        '',
        '// With the giver within 3 steps, the receiver gets the bonus to hit, avoid, crit and crit avoid.',
        'export const FE3_SUPPORT_BONUSES: GbaSupportBonus[] = [',
        *[f'  {js(b)},' for b in bonuses],
        ']',
        '',
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(units)} units, {len(classes)} classes, {len(bonuses)} support bonuses -> {OUT}')


if __name__ == '__main__':
    main()
