"""
Build src/data/fe6/fe6Units.ts from the user's own Binding Blade ROM (see data-raw/fe6/README.md): the playable units, when and
how they join, their classes and promotions, supports and affinities.

Run: python scripts/build-fe6-units.py   (FE6_ROM and FE6_PATCH override where the ROM and the name patch are)
"""
import json
import os

import fe6_rom as rom
from fe6_joins import STORY, joins
from fe6_names import character_names, class_names

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'data', 'fe6', 'fe6Units.ts')
R = rom.R
WEAPONS = ('sword', 'lance', 'axe', 'bow', 'staff', 'anima', 'light', 'dark')
# Affinity ids 1-7, named by their order in the later GBA games (the game shows only icons; the Armory's notes).
AFFINITIES = {1: 'Fire', 2: 'Thunder', 3: 'Wind', 4: 'Ice', 5: 'Dark', 6: 'Light', 7: 'Anima'}
AFFINITY_TABLE = 0x66350C  # 8 bytes per affinity: id, Atk, Def, Hit, Avoid, Crit, Dodge, 0; up to a 0 id
# Points for C, B and A (over 60, 120 and 200: the support code, the Armory's build-fe6-supports.py), at most five per unit.
SUPPORT_LEVELS = [61, 121, 201]
# Cath joins on her third talk with Roy, counting one a chapter (Chapters 6, 8, 12, 16, 20, 22): Chapter 12 at the earliest.
CATH = 53
CATH_NOTE = 'Talk to her with Roy in three chapters (she appears in 6, 8, 12, 16, 20 and 22); she joins on the third talk.'
# Hugh asks for gold; the less he's paid, the lower his stats (Serenes Forest).
NOTES = {39: 'He asks to be paid: 10,000 gold, or less for lower stats (Serenes Forest).'}
# Levels the scripts' runs don't give (Dayan arrives as a green unit the plain run skips): Serenes Forest's.
LEVELS = {6: 12}
# The trial maps' bonus units (Hector, Eliwood...) are added by the game's code once it has been cleared; no group or script
# places them, so they're not read yet.


def record(c):
    return rom.CHARACTERS + 48 * (c - 1)


def personal(c):
    """+0x0C-0x13 their own bases added to the class's (HP, Str, Skl, Spd, Def, Res, Lck, Con), +0x14-0x1B weapon ranks,
    +0x1C-0x22 growths (HP, Str, Skl, Spd, Def, Res, Lck), +9 affinity, +0x2C the support data, +5 their class, +0x0B level."""
    e = record(c)
    s8 = lambda o: R[o] - 256 if R[o] > 127 else R[o]  # noqa: E731
    b = dict(zip(('hp', 'str', 'skl', 'spd', 'def', 'res', 'lck', 'con'), (s8(e + 0x0C + i) for i in range(8))))
    g = dict(zip(('hp', 'str', 'skl', 'spd', 'def', 'res', 'lck'), R[e + 0x1C:e + 0x23]))
    return {'bases': b, 'growths': g, 'ranks': list(R[e + 0x14:e + 0x1C]), 'affinity': R[e + 9], 'supports': rom.u32(e + 0x2C),
            'class': R[e + 5], 'level': R[e + 0x0B]}


def klass(k):
    """+0x0B-0x12 bases (HP, Str, Skl, Spd, Def, Res, Con, Mov), +0x13-0x19 caps (HP, Str, Skl, Spd, Def, Res, Con), +5 the class it
    promotes to, +0x28-0x2F weapon ranks."""
    e = rom.CLASSES + 72 * k
    bases = dict(zip(('hp', 'str', 'skl', 'spd', 'def', 'res', 'con', 'mov'), R[e + 0x0B:e + 0x13]))
    caps = dict(zip(('hp', 'str', 'skl', 'spd', 'def', 'res', 'con'), R[e + 0x13:e + 0x1A]))
    return {'bases': bases, 'caps': caps, 'promotes': R[e + 5]}


def rank(points):
    return next((letter for limit, letter in rom.RANKS if points >= limit), None)


def main():
    names, cnames = character_names(), class_names()
    joined = {c: list(v) + [None] for c, v in joins().items()}
    if CATH in joined:
        joined[CATH] = [next(i for i, s in enumerate(STORY) if s[1] == 'fe6-12'), 'talk', [1], None, joined[CATH][4], joined[CATH][5],
                        CATH_NOTE]

    used = set()
    units = []
    for c, (i, how, with_, turn, level, cls, note) in sorted(joined.items(), key=lambda x: (x[1][0], x[0])):
        p = personal(c)
        k = cls or p['class']
        kd = klass(k)
        used.add(k)
        if kd['promotes']:
            used.add(kd['promotes'])
        level = level or LEVELS.get(c) or p['level'] or 1
        if how == 'visit' and 1 in with_:
            with_ = []  # anyone can visit
        bases = {s: kd['bases'][s] + p['bases'][s] for s in ('hp', 'str', 'skl', 'spd', 'def', 'res', 'con')}
        bases['lck'] = p['bases']['lck']
        bases['mov'] = kd['bases']['mov']
        notes = [x for x in (note, NOTES.get(c)) if x]
        units.append({
            'id': f'fe6-{c}', 'name': names[c], 'classId': str(k), 'level': level,
            'joinChapter': STORY[i][1],
            'join': {'how': how, **({'with': [names[w] for w in with_]} if with_ else {}), **({'turn': turn} if turn else {}),
                     **({'note': ' '.join(notes)} if notes else {})},
            'affinity': AFFINITIES.get(p['affinity'], ''),
            'bases': bases, 'growths': p['growths'],
            'ranks': {w: rank(v) for w, v in zip(WEAPONS, p['ranks']) if rank(v)},
        })

    out_classes = {}
    for k in sorted(used):
        kd = klass(k)
        out_classes[str(k)] = {'id': str(k), 'name': cnames.get(k, f'Class {k}'), 'bases': {**kd['bases'], 'lck': 0},
                               'caps': {**kd['caps'], 'lck': 30}, **({'promotesTo': str(kd['promotes'])} if kd['promotes'] else {})}

    ids = {int(u['id'][4:]) for u in units}
    supports, seen = [], set()
    for c in sorted(ids):
        ptr = personal(c)['supports']
        if not ptr:
            continue
        o = rom.off(ptr)
        n = R[o + 30]
        for j in range(n):
            partner, start, gain = R[o + j], R[o + 10 + j], R[o + 20 + j]
            key = tuple(sorted((c, partner)))
            if partner in ids and key not in seen:
                seen.add(key)
                supports.append({'a': f'fe6-{c}', 'b': f'fe6-{partner}', 'start': start, 'perTurn': gain})

    affinities = []
    o = AFFINITY_TABLE
    while R[o]:
        b = R[o:o + 8]
        affinities.append({'name': AFFINITIES[b[0]], 'atk': b[1], 'def': b[2], 'hit': b[3], 'avoid': b[4], 'crit': b[5], 'dodge': b[6]})
        o += 8

    chapters = [{'id': cid, 'label': label} for _, cid, label in STORY]

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    lines = [
        "// Generated by scripts/build-fe6-units.py from the user's own Binding Blade ROM. Don't edit by hand.",
        "import type { GbaAffinity, GbaChapter, GbaClass, GbaSupport, GbaUnit } from '../../gba/types'",
        '',
        f'export const FE6_CHAPTERS: GbaChapter[] = {js(chapters)}',
        '',
        'export const FE6_UNITS: GbaUnit[] = [',
        *[f'  {js(u)},' for u in units],
        ']',
        '',
        'export const FE6_CLASSES: Record<string, GbaClass> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in out_classes.items()],
        '}',
        '',
        '// Each pair once: its starting points and the points it gains each turn the two spend within reach.',
        'export const FE6_SUPPORTS: GbaSupport[] = [',
        *[f'  {js(s)},' for s in supports],
        ']',
        '',
        f'export const FE6_SUPPORT_LEVELS = {js(SUPPORT_LEVELS)}',
        '',
        '// What each affinity adds per support level (Atk, Def, Hit, Avoid, Crit, Dodge), before the halving.',
        f'export const FE6_AFFINITIES: GbaAffinity[] = {js(affinities)}',
        '',
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(units)} units, {len(out_classes)} classes, {len(supports)} supports -> {OUT}')


if __name__ == '__main__':
    main()
