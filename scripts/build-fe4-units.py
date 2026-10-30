"""
Build src/data/fe4/fe4Units.ts from the user's own Genealogy of the Holy War ROM (see data-raw/fe4/README.md): the playable
units of both generations, the children whose stats come from their parents, classes and holy blood.

Run: python scripts/build-fe4-units.py   (FE4_ROM and FE4_PATCH override where the ROM and the name patch are)
"""
import json
import os

import fe4_events as ev
from fe4_names import character_names, class_names, place
from fe4_units import classes, holy_bloods, people

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'data', 'fe4', 'fe4Units.ts')
STATS = ('hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res')
WEAPONS = ('sword', 'lance', 'axe', 'bow', 'staff', 'fire', 'thunder', 'wind', 'light', 'dark')
RANKS = {0: 'A', 1: 'B', 2: 'C'}
# The second generation starts with the slot ids after the first's (the substitutes and children share theirs).
GEN2_FIRST_ID = 25
# Each mother's two children, by their records' slot (Serenes Forest's inheritance page; the game's own mother table isn't
# found yet). The substitutes in the same slots stand in when she has no children.
MOTHERS = {'Ayra': (3, 17), 'Brigid': (4, 16), 'Silvia': (7, 23), 'Erinys': (8, 21), 'Lachesis': (9, 24), 'Edain': (11, 18),
           'Tailtiu': (14, 22)}
# Children whose parents are fixed by the story: Seliph (Sigurd and Deirdre), Leif and Altena (Quan and Ethlyn).
FIXED_PARENTS = {'Seliph': ('Sigurd', 'Deirdre'), 'Leif': ('Quan', 'Ethlyn'), 'Altena': ('Quan', 'Ethlyn')}


# What the scripts' triggers don't say in a way the reader can name: Serenes Forest's recruitment page.
NOTES = {
    'Chulainn': 'By beating the arena with a melee fighter (Serenes Forest).',
    'Beowolf': 'Anyone can talk to him; he asks to be paid 10,000 gold (Serenes Forest).',
    'Ares': 'The turn after Melgen is seized (Serenes Forest).',
    'Iuchar': 'Only one of Iuchar and Iucharba joins (Serenes Forest).',
    'Iucharba': 'Only one of Iuchar and Iucharba joins (Serenes Forest).',
    'Altena': 'After Leif talks to her and Travant is defeated (Serenes Forest).',
}
# Turns that differ from Serenes Forest's recruitment page.
UNCONFIRMED = {
    **{n: "The script's turn block is turn 2; Serenes Forest says the first enemy turn."
       for n in ('Dew', 'Edain')},
    **{n: "The script's turn block is turn 3; Serenes Forest says the second turn."
       for n in ('Oifey', 'Tristan', 'Deimne', 'Diarmuid', 'Lester')},
}
CHAPTER_LABELS = ['Prologue'] + [f'Ch.{n}' for n in range(1, 11)] + ['Final']
TALKS = (0x04, 0x15, 0x16)


def joins(persons):
    """{id: (chapter, how, with ids, turn, flag)}: the first chapter each playable unit joins in, read from the event scripts
    (see data-raw/fe4/README.md). A unit the opening puts on the map, or moves to your army, starts the chapter there; one a talk's
    scene does joins by that talk; one a turn block's scene does joins on that turn (or, a block on any turn under a flag, once
    the flag is set). A first-generation unit nothing brings in starts in the home castle (Arden)."""
    found = {}

    def placed(scene_cmds):
        return [x[1] | x[2] << 8 for op, x in scene_cmds if op in ev.INLINE_OPS and x
                and (x[0] == 0x49 or (x[0] == 0x53 and len(x) > 3 and x[3] == 0))]

    for ch, (bank, opening, _) in sorted(ev.chapter_headers().items()):
        triggers, blocks = ev.event_table(ch)
        for _, op, a in ev.script(bank, opening):
            for i in placed(ev.action_scene((op, a))) + ([a[0] | a[1] << 8] if op in (0x49, 0x53) else []):
                if i in persons:
                    found.setdefault(i, (ch, 'start', [], None, None))
        for t in triggers:
            for i in placed(ev.action_scene(t['action'])):
                if i not in persons:
                    continue
                a = t['args']
                if t['op'] in TALKS:
                    speaker = a[0] | a[1] << 8
                    found.setdefault(i, (ch, 'talk', [] if speaker == 0xFFFF else [speaker], None, None))
                else:
                    found.setdefault(i, (ch, 'event', [], None, ('trigger', t['op'], bytes(a))))
        for b in blocks:
            for i in placed(ev.action_scene((b['op'], b['args']))):
                if i not in persons:
                    continue
                turn = b['turn'][1][0] if b['turn'] and b['turn'][0] == 0x21 and b['turn'][1][0] > 0 else None
                flag = b['flags'][0][1][0] if b['flags'] else None
                found.setdefault(i, (ch, 'event', [], turn, ('flag', flag, triggers) if flag is not None else None))
    for i, p in persons.items():
        if i not in found and i < GEN2_FIRST_ID:
            found[i] = (0, 'start', [], None, None)
    return found


def condition_text(ch, cond, unit_name):
    """What brings a unit in, in words, from the trigger behind it: a castle seized, a castle entered, the arena."""
    if not cond:
        return None
    if cond[0] == 'flag':
        _, flag, triggers = cond
        setter = next((t for t in triggers if t['flag'] == flag), None)
        if not setter:
            return None
        cond = ('trigger', setter['op'], bytes(setter['args']))
    _, op, a = cond
    places = {lid: place(ev.place_names()[name]) for lid, kind, name, _, _ in ev.locations(ch) if kind == 0}
    if op == 0x02 and a[2] in places:
        return f'once {places[a[2]]} is seized'
    if op == 0x07 and a[2] in places:
        return f'when {unit_name(a[0] | a[1] << 8)} enters {places[a[2]]}'
    if op == 0x0B:
        return f'when {unit_name(a[0] | a[1] << 8)} reaches a spot on the map'
    return None


def main():
    names, cnames = character_names(), class_names()
    persons, jobs, bloods = people(), classes(), holy_bloods()

    def class_bases(j):
        b = jobs[j]['bases']
        return {**b, 'lck': 0}

    used = set()
    units = []
    by_slot = {}
    unit_of = {}
    for i, p in persons.items():
        name = names[p['name_index']]
        # Finn's second-generation record is empty (level 0): he carries on as he ended the first.
        if p['kind'] == 'fixed' and p['level'] == 0:
            continue
        gen = 1 if i < GEN2_FIRST_ID else 2
        used.add(p['class'])
        unit = {'id': f'fe4-{i}', 'name': name, 'generation': gen, 'classId': str(p['class']), 'level': p['level']}
        if p['kind'] == 'fixed':
            cb = class_bases(p['class'])
            unit.update({
                'role': 'fixed',
                'female': p['female'],
                # HP is the unit's own; the rest are the class's bases plus the unit's own (Luck has no class base).
                'bases': {s: p['personal'][s] if s == 'hp' else cb[s] + p['personal'][s] for s in STATS},
                'personal': {s: p['personal'][s] for s in STATS},
                'growths': {s: p['growths'][s] for s in STATS},
                'blood': [{'blood': b, 'level': lv} for b, lv in p['blood']],
                'skills': p['skills'], 'gold': p['gold'],
                **({'leadership': p['leadership']} if p['leadership'] else {}),
            })
        else:
            unit.update({'role': 'child'})
        if gen == 2:
            by_slot.setdefault(p['slot'], []).append(unit)
            unit['slot'] = p['slot']
        units.append(unit)
        unit_of[i] = unit

    # How and when each joins.
    def unit_name(i):
        return unit_of[i]['name'] if i in unit_of else f'unit {i}'

    for i, (ch, how, with_, turn, cond) in joins(persons).items():
        if i not in unit_of:
            continue
        unit = unit_of[i]
        unit['joinChapter'] = f'fe4-{ch}'
        join = {'how': how}
        if with_:
            join['with'] = [unit_name(w) for w in with_]
        if turn:
            join['turn'] = turn
        note = condition_text(ch, cond, unit_name)
        if note:
            join['note'] = f'Joins {note}.'
        unit['join'] = join

    # Children and the substitutes for them; a second-generation unit sharing a child's slot is that child's substitute.
    by_name = {u['name']: u for u in units}
    for mother, slots in MOTHERS.items():
        for slot in slots:
            group = by_slot[slot]
            child = next(u for u in group if u['role'] == 'child')
            child['mother'] = by_name[mother]['id']
            for u in group:
                if u is not child:
                    u['role'] = 'substitute'
                    u['substituteFor'] = child['id']
    # A talk with a child is a talk with their substitute when she had none: name both ("Patty / Daisy").
    pair_name = {}
    for u in units:
        if u['role'] == 'substitute':
            child = next(c['name'] for c in units if c['id'] == u['substituteFor'])
            pair_name[child] = pair_name[u['name']] = f"{child} / {u['name']}"
    for u in units:
        if u.get('join', {}).get('with'):
            u['join']['with'] = [pair_name.get(n, n) for n in u['join']['with']]
        if u['name'] in NOTES:
            u['join']['note'] = ' '.join(filter(None, [u['join'].get('note'), NOTES[u['name']]]))
        if u['name'] in UNCONFIRMED:
            u['unconfirmed'] = UNCONFIRMED[u['name']]
    for child, (father, mother) in FIXED_PARENTS.items():
        by_name[child]['father'] = by_name[father]['id']
        by_name[child]['mother'] = by_name[mother]['id']

    out_classes = {}
    for j in sorted(used):
        c = jobs[j]
        out_classes[str(j)] = {
            'id': str(j), 'name': cnames[j], 'mov': c['mov'], 'flier': c['flier'],
            'bases': class_bases(j),
            'ranks': {w: RANKS[r] for w, r in zip(WEAPONS, c['ranks']) if r in RANKS},
        }

    out_bloods = [{'id': b['name'], 'name': b['name'], 'weaponType': WEAPONS[b['weapon_type']],
                   'growths': {s: b['growths'][s] for s in STATS}} for b in bloods]

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    lines = [
        "// Generated by scripts/build-fe4-units.py from the user's own Genealogy of the Holy War ROM. Don't edit by hand.",
        "import type { Fe4Blood, Fe4Chapter, Fe4Class, Fe4Unit } from '../../genealogy/types'",
        '',
        f"export const FE4_CHAPTERS: Fe4Chapter[] = {js([{'id': f'fe4-{n}', 'label': label} for n, label in enumerate(CHAPTER_LABELS)])}",
        '',
        'export const FE4_UNITS: Fe4Unit[] = [',
        *[f'  {js(u)},' for u in units],
        ']',
        '',
        'export const FE4_CLASSES: Record<string, Fe4Class> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in out_classes.items()],
        '}',
        '',
        '// Each holy blood\'s growth bonuses (doubled for major blood).',
        'export const FE4_BLOODS: Fe4Blood[] = [',
        *[f'  {js(b)},' for b in out_bloods],
        ']',
        '',
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(units)} units, {len(out_classes)} classes, {len(out_bloods)} holy bloods -> {OUT}')


if __name__ == '__main__':
    main()
