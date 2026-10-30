"""
Build src/data/fe8/fe8Units.ts from the user's own Sacred Stones ROM (see data-raw/fe8/README.md): the playable units of both routes and
the postgame, when and how they join, their classes and branched promotions, supports and affinities.

Run: python scripts/build-fe8-units.py   (FE8_ROM overrides where the ROM is)
"""
import json
import os
import struct

from fe8_joins import ROUTES, joins, story
from gba_rom import rom

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'data', 'fe8', 'fe8Units.ts')
r = rom('fe8')
R = r.R
WEAPONS = ('sword', 'lance', 'axe', 'bow', 'staff', 'anima', 'light', 'dark')
RANKS = [(251, 'S'), (181, 'A'), (121, 'B'), (71, 'C'), (31, 'D'), (1, 'E')]
AFFINITIES = {1: 'Fire', 2: 'Thunder', 3: 'Wind', 4: 'Ice', 5: 'Dark', 6: 'Light', 7: 'Anima'}
# The promotion options, two bytes per class (read at 0x080CC7D0): each class's one or two classes to promote to.
PROMOTIONS = 0x95DFA4
PROMOTED, TRAINEE = 0x100, 0x80000  # class abilities (+0x28)
# Support levels from points (0x0802823C): three `cmp rN, #n` (A, B, C); a level needs more than n.
SUPPORT_LEVELS_CODE = 0x2823C
STORY_IDS = {'Eirika': 'eirika', 'Ephraim': 'ephraim'}
STORY_LABELS = {'Eirika': "Eirika's route", 'Ephraim': "Ephraim's route"}
# The postgame's units (0x23-0x2C): the game's code adds them once a floor of the Tower of Valni or the Lagdou Ruins is cleared;
# no script places them, so when is Serenes Forest's (its recruitment page). Their stats are their own records'.
POSTGAME = {
    41: 'Tower of Valni: clear the 3rd floor', 36: 'Tower of Valni: clear the 6th floor',
    40: 'Tower of Valni: defeat 200 or more enemies in one run', 43: 'Tower of Valni: clear the 8th floor',
    38: 'Tower of Valni: clear the 8th floor three times', 37: 'Lagdou Ruins: clear the 5th floor',
    44: 'Lagdou Ruins: defeat 200 or more enemies in one run', 39: 'Lagdou Ruins: clear the 7th floor',
    42: 'Lagdou Ruins: clear the 10th floor', 35: 'Lagdou Ruins: clear the 10th floor three times',
}
# What the scripts leave to the player or a check routine, in Serenes Forest's words (its recruitment page).
NOTES = {
    15: 'He, Forde and Kyle leave after Chapter 5x and come back on turn 2 of Chapter 8 (Serenes Forest).',
    16: 'He leaves after Chapter 5x and comes back on turn 2 of Chapter 8 (Serenes Forest).',
    17: 'He leaves after Chapter 5x and comes back on turn 2 of Chapter 8 (Serenes Forest).',
    ('Eirika', 18): 'If not recruited, she leaves before turn 12 and comes back in Chapter 13 (Serenes Forest).',
    ('Eirika', 20): 'If Tethys dies in this chapter, he leaves (Serenes Forest).',
    ('Eirika', 21): 'If Gerik dies in this chapter, she leaves (Serenes Forest).',
}


def personal(c):
    e = r.character_record(c)
    b = dict(zip(('hp', 'str', 'skl', 'spd', 'def', 'res', 'lck', 'con'), (r.s8(e + 0x0C + i) for i in range(8))))
    g = dict(zip(('hp', 'str', 'skl', 'spd', 'def', 'res', 'lck'), R[e + 0x1C:e + 0x23]))
    return {'bases': b, 'growths': g, 'ranks': list(R[e + 0x14:e + 0x1C]), 'affinity': R[e + 9], 'supports': r.u32(e + 0x2C),
            'class': R[e + 5], 'level': R[e + 0xB]}


def klass(k):
    """The Blazing Blade's layout; +0x22-0x27 what promoting into the class adds (0x0802BC20 adds them to the unit, each held at the
    new class's caps), the options from the promotion table."""
    e = r.cfg['classes'] + 84 * k
    abilities = r.u32(e + 0x28)
    options = [x for x in R[PROMOTIONS + 2 * k:PROMOTIONS + 2 * k + 2] if x]
    return {'bases': dict(zip(('hp', 'str', 'skl', 'spd', 'def', 'res', 'con', 'mov'), R[e + 0x0B:e + 0x13])),
            'caps': dict(zip(('hp', 'str', 'skl', 'spd', 'def', 'res', 'con'), R[e + 0x13:e + 0x1A])),
            'gains': dict(zip(('hp', 'str', 'skl', 'spd', 'def', 'res'), R[e + 0x22:e + 0x28])),
            'options': options, 'promoted': bool(abilities & PROMOTED), 'trainee': bool(abilities & TRAINEE)}


def rank(points):
    return next((letter for limit, letter in RANKS if points >= limit), None)


def support_levels():
    out = []
    for o in range(SUPPORT_LEVELS_CODE, SUPPORT_LEVELS_CODE + 0x30, 2):
        ins = struct.unpack_from('<H', R, o)[0]
        if ins >> 8 == 0x28 and ins & 0xFF > 1:
            out.append((ins & 0xFF) + 1)
    a, b, c = out
    return [c, b, a]


def main():
    names, cnames = r.character_names(), r.class_names()
    used, units = set(), []
    chapters, seen_ch = [], set()
    found = {route: joins(route) for route in ROUTES}
    for route in ROUTES:
        sid = STORY_IDS[route]
        chs = story(route)
        for _, cid, label, mode in chs:
            if cid not in seen_ch:
                seen_ch.add(cid)
                chapters.append({'id': cid, 'label': label, **({'story': sid} if mode != 'Prologue' else {})})
    chapters.append({'id': 'fe8-postgame', 'label': 'Postgame'})

    def unit(c, level, cls, join_chapter, join, story_id, auto=False):
        p = personal(c)
        kd = klass(cls)
        used.add(cls)
        bases = {s: kd['bases'][s] + p['bases'][s] for s in ('hp', 'str', 'skl', 'spd', 'def', 'res', 'con')}
        bases['lck'] = p['bases']['lck']
        bases['mov'] = kd['bases']['mov']
        if auto:
            # A record with the auto-level bit (0x08018160, from 0x08017C28): the unit starts at the character's own level (+0x0B)
            # and levels up once, for real, for each level the record is above it; below it, it just takes the character's level.
            extra = level - p['level']
            level = max(level, p['level'])
            if extra > 0:
                for s_, g in p['growths'].items():
                    bases[s_] = round(min(bases[s_] + g / 100 * extra, kd['caps'].get(s_, 30)), 2)
                join = {**join, 'note': ' '.join(x for x in (join.get('note'), f'Joins with {extra} random level-up{"s" if extra > 1 else ""} '
                                                              f"past Lv {p['level']} (the game rolls them by growth rates); shown as the average.") if x)}
        return {'id': f'fe8-{c}', **({'story': story_id} if story_id else {}), 'name': names[c], 'classId': str(cls), 'level': level,
                'joinChapter': join_chapter, 'join': join, 'affinity': AFFINITIES.get(p['affinity'], ''), 'bases': bases,
                'growths': p['growths'], 'ranks': {w: rank(v) for w, v in zip(WEAPONS, p['ranks']) if rank(v)}}

    done = set()
    for route in ROUTES:
        chs = story(route)
        for c, (i, how, with_, turn, level, cls, other, paid, auto) in sorted(found[route].items(), key=lambda x: (x[1][0], x[0])):
            shared = chs[i][3] == 'Prologue'
            if shared and c in done:
                continue
            done.add(c)
            if how == 'visit' and len(with_) > 1 and all(w in with_ for w, v in found[route].items() if v[0] < i):
                with_ = []  # anyone can visit
            notes = []
            if 'end' in other and how in ('talk', 'visit'):
                notes.append('Also joins at the end of the chapter if still alive.')
            notes += [f'Talking with {names[w]} costs {g:,} gold.' for w, g in paid.items()]
            note = NOTES.get((route, c)) or NOTES.get(c)
            if note:
                notes.append(note)
            join = {'how': how, **({'with': [names[w] for w in with_]} if with_ else {}), **({'turn': turn} if turn else {}),
                    **({'note': ' '.join(notes)} if notes else {})}
            units.append(unit(c, level, cls, chs[i][1], join, None if shared else STORY_IDS[route], auto))
    for c, how in sorted(POSTGAME.items(), key=lambda x: list(POSTGAME).index(x[0])):
        p = personal(c)
        units.append(unit(c, p['level'], p['class'], 'fe8-postgame', {'how': 'unlock', 'note': f'{how} (Serenes Forest).'}, None))

    # Every class a unit can reach, with its options.
    todo = list(used)
    while todo:
        k = todo.pop()
        for o in klass(k)['options']:
            if o not in used:
                used.add(o)
                todo.append(o)
    out_classes = {}
    targets = {o for k in used for o in klass(k)['options']}
    for k in sorted(used):
        kd = klass(k)
        out_classes[str(k)] = {
            'id': str(k), 'name': cnames.get(k, f'Class {k}'), 'bases': {**kd['bases'], 'lck': 0}, 'caps': {**kd['caps'], 'lck': 30},
            **({'promotesTo': str(kd['options'][0]), 'promotions': [str(o) for o in kd['options']]} if kd['options'] else {}),
            **({'gains': kd['gains']} if k in targets else {}),
            # A trainee class stops at Lv 10 and promotes then (Serenes Forest; the ability bit is the game's).
            **({'maxLevel': 10, 'autoPromote': True} if kd['trainee'] else {}),
        }

    ids = {int(u['id'][4:]) for u in units}
    supports, seen = [], set()
    for c in sorted(ids):
        ptr = personal(c)['supports']
        if not ptr:
            continue
        o = r.off(ptr)
        for j in range(R[o + 21]):
            partner, start, gain = R[o + j], R[o + 7 + j], R[o + 14 + j]
            key = tuple(sorted((c, partner)))
            if partner in ids and key not in seen:
                seen.add(key)
                supports.append({'a': f'fe8-{c}', 'b': f'fe8-{partner}', 'start': start, 'perTurn': gain})

    affinities = []
    o = r.cfg['affinities']
    while R[o]:
        b = R[o:o + 8]
        affinities.append({'name': AFFINITIES[b[0]], 'atk': b[1], 'def': b[2], 'hit': b[3], 'avoid': b[4], 'crit': b[5], 'dodge': b[6]})
        o += 8
    stories = [{'id': STORY_IDS[m], 'label': STORY_LABELS[m]} for m in ROUTES]

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    lines = [
        "// Generated by scripts/build-fe8-units.py from the user's own Sacred Stones ROM. Don't edit by hand.",
        "import type { GbaAffinity, GbaChapter, GbaClass, GbaStory, GbaSupport, GbaUnit } from '../../gba/types'",
        '',
        "// The two routes after Chapter 8; a unit who joins on both is listed once per route, under one id.",
        f'export const FE8_STORIES: GbaStory[] = {js(stories)}',
        '',
        f'export const FE8_CHAPTERS: GbaChapter[] = {js(chapters)}',
        '',
        'export const FE8_UNITS: GbaUnit[] = [',
        *[f'  {js(u)},' for u in units],
        ']',
        '',
        'export const FE8_CLASSES: Record<string, GbaClass> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in out_classes.items()],
        '}',
        '',
        '// Each pair once: its starting points and the points it gains each turn the two spend side by side.',
        'export const FE8_SUPPORTS: GbaSupport[] = [',
        *[f'  {js(s)},' for s in supports],
        ']',
        '',
        f'export const FE8_SUPPORT_LEVELS = {js(support_levels())}',
        '',
        '// What each affinity adds per support level (Atk, Def, Hit, Avoid, Crit, Dodge), before the halving.',
        f'export const FE8_AFFINITIES: GbaAffinity[] = {js(affinities)}',
        '',
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(units)} units, {len(out_classes)} classes, {len(supports)} supports, levels {support_levels()} -> {OUT}')


if __name__ == '__main__':
    main()
