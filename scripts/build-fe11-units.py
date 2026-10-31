"""
Build src/data/fe11/fe11Units.ts from the user's own Shadow Dragon dump (data-raw/fe11/rom, from scripts/fe11_extract.py; see
data-raw/fe11/README.md): who joins, where and how (scripts/fe11_joins.py), their bases, growths and weapon ranks, and the classes.

Run: python scripts/build-fe11-units.py
"""
import json
import os

import fe11_data as D
from fe11_joins import chapter_id, chapter_label, joins, story

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'data', 'fe11', 'fe11Units.ts')
STATS = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res']
WEAPONS = ['sword', 'lance', 'axe', 'bow', 'tome', 'staff']
PERSON, JOB = 80, 92
# The class's name where the English text spells it with glyphs it can't show.
NAMES = {'JID_SWORDMASTER': 'Swordmaster', 'JID_SWORDMASTER_F': 'Swordmaster'}
# The reclass sets (Serenes Forest's reclassing page; not found in the program): a unit's set is the one its starting class is in.
SETS = {
    'male A': ['SOCIALKNIGHT', 'ARCHER', 'SWORDFIGHTER', 'MAGE', 'PRIEST', 'PALADIN', 'DRAGONKNIGHT', 'SNIPER', 'SWORDMASTER', 'SAGE',
               'BISHOP'],
    'male B': ['ARMORKNIGHT', 'MERCENARY', 'FIGHTER', 'HUNTER', 'PIRATES', 'DARKMAGE', 'GENERAL', 'HERO', 'WARRIOR', 'HORSEMEN',
               'BERSERKER', 'SORCERER'],
    'female': ['PEGASUSKNIGHT_F', 'ARCHER_F', 'SWORDFIGHTER_F', 'MAGE_F', 'SISTER_F', 'PALADIN_F', 'DRAGONKNIGHT_F', 'SNIPER_F',
               'SWORDMASTER_F', 'SAGE_F', 'BISHOP_F'],
}
# What a script leaves to the player, or decides by counting the army (Serenes Forest's recruitment page unless it says the file).
NOTES = {
    'Frey': 'Only with the prologue (Normal mode).',
    'Norne': 'Only with the prologue (Normal mode), and only if 4 or fewer of your units are left after it (Serenes Forest).',
    'Minerva': 'Must have recruited Maria first (Serenes Forest).',
    'Jake': "Only after visiting Anna's village in the same chapter (the talk checks it).",
    'Arran': 'Only one of Arran and Samson: visiting one village closes the other (the terrain script).',
    'Samson': 'Only one of Arran and Samson: visiting one village closes the other (the terrain script).',
    'Horace': 'Clear the chapter without killing him (the ending checks).',
    'Etzel': 'Only if he survives the chapter (the ending checks).',
    'Ymir': 'Talk to him with Marth, then clear the chapter (the ending checks the talk).',
    'Nagi': 'Only if Chapter 24x was played (the opening checks).',
    'Gotoh': "Only if Chapter 24x wasn't played (the opening checks).",
}
HARD = 'On the Hard modes (no prologue) joins at the start of Chapter 1.'


def signed(v):
    return v - 256 if v > 127 else v


def main():
    b = D.db()
    ptrs = set(b.ptrs)
    persons = {p['pid']: (p, o) for p, (_, o) in zip(D.persons(), D.table('Person', PERSON, 'Job'))}
    job_rows = D.table('Job', JOB, 'Item')
    jobs = D.jobs()
    at = {o: i for i, o in job_rows}

    def raw(o, n):
        return b.d[0x20 + o:0x20 + o + n]

    def job_ptr(o, k):
        return jobs[at[b.u32(o + k)]]['jid'] if (o + k) in ptrs and b.u32(o + k) in at else None

    by_jid = {j['jid']: (j, o) for j, (_, o) in zip(jobs, job_rows)}
    cid = {j['jid']: f'j{j["index"]}' for j in jobs}

    def job(jid):
        j, o = by_jid[jid]
        r = raw(o, JOB)
        return {
            'name': NAMES.get(jid) or j['name'], 'bases': {**dict(zip(STATS, map(signed, r[8:16]))), 'mov': r[0x29]},
            'growths': dict(zip(STATS, map(signed, r[0x10:0x18]))), 'caps': dict(zip(STATS, r[0x20:0x28])),
            'wexp': list(r[0x2c:0x32]), 'promoted': bool(r[0x39] & 0x08), 'to': job_ptr(o, 0x40), 'from': job_ptr(o, 0x3c),
        }

    J = {jid: job(jid) for jid in by_jid}
    # A class's promotions: the one it names (+0x40), then any class naming it as where it comes from (+0x3c: the Falcoknight, by the
    # Elysian Whip).
    promotions = {jid: ([v['to']] if v['to'] else []) for jid, v in J.items()}
    for jid, v in J.items():
        if v['from'] and jid not in promotions[v['from']]:
            promotions[v['from']].append(jid)
    set_of = {}
    for name, members in SETS.items():
        for m in members:
            set_of.setdefault('JID_' + m, name)

    units, used = [], set()
    for pid, j in joins().items():
        p, o = persons[pid]
        r = raw(o, PERSON)
        rec = j['unit']
        jid = rec['job']['jid']
        cls = J[jid]
        personal = dict(zip(STATS, map(signed, r[0x0c:0x14])))
        bases = {s: cls['bases'][s] + personal[s] for s in STATS}
        bases['mov'] = cls['bases']['mov']
        # A weapon's rank: the person's experience (+0x1c, sword to staff) plus the class's (+0x2c), where the class can use it.
        ranks = {}
        for k, w in enumerate(WEAPONS):
            if cls['wexp'][k]:
                ranks[w] = D.rank_of(r[0x1c + k] + cls['wexp'][k])
        notes = [x for x in (NOTES.get(p['name']), HARD if j.get('hard') else None) if x]
        join = {'how': j['how']}
        if j['with']:
            join['with'] = j['with']
        if notes:
            join['note'] = ' '.join(notes)
        unit = {
            'id': f'fe11-{p["name"].lower().replace(" ", "-")}', 'name': p['name'], 'classId': cid[jid], 'level': rec['level'],
            'joinChapter': j['chapter'], 'join': join, 'bases': bases, 'growths': dict(zip(STATS, map(signed, r[0x14:0x1c]))),
            'ranks': ranks,
        }
        group = set_of.get(jid)
        if group:
            unit['reclass'] = [cid['JID_' + m] for m in SETS[group]]
        units.append(unit)
        used.add(jid)
        for m in SETS.get(group, []):
            used.add('JID_' + m)
    todo = list(used)
    while todo:
        for c in promotions[todo.pop()]:
            if c not in used:
                used.add(c)
                todo.append(c)
    classes = {}
    for jid in sorted(used, key=lambda x: by_jid[x][0]['index']):
        v = J[jid]
        c = {'id': cid[jid], 'name': v['name'], 'bases': v['bases'], 'caps': v['caps'], 'growths': v['growths'], 'promoted': v['promoted']}
        if promotions[jid]:
            c['promotesTo'] = cid[promotions[jid][0]]
            c['promotions'] = [cid[x] for x in promotions[jid]]
        classes[cid[jid]] = c
    chapters = [{'id': chapter_id(k), 'label': chapter_label(k)} for k in story()]

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    lines = [
        "// Generated by scripts/build-fe11-units.py from the user's own Shadow Dragon dump. Don't edit by hand.",
        "import type { GbaChapter, GbaClass, GbaUnit } from '../../gba/types'",
        '',
        f'export const FE11_CHAPTERS: GbaChapter[] = {js(chapters)}',
        '',
        'export const FE11_UNITS: GbaUnit[] = [',
        *[f'  {js(u)},' for u in units],
        ']',
        '',
        'export const FE11_CLASSES: Record<string, GbaClass> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in classes.items()],
        '}',
        '',
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(units)} units, {len(classes)} classes -> {OUT}')


if __name__ == '__main__':
    main()
