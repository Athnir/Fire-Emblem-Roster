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
# The reclass sets are the class records' +0x34 (1 male A, 2 male B, 3 female; 4-6 their promoted classes; 0 none) and +0x35 (the
# column, the class line the limits count): the preparations' reclass list (overlay 05, 0x2211058) offers every class whose +0x34 is the
# unit's current class's. Of the female promoted set's two column-0 classes, it offers the Dracoknight, or the Falcoknight instead for a
# unit with flag 0x20000000 (tested at 0x203c810), which only promoting with the Elysian Whip sets (the promotion, arm9 0x203d840).
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
            'set': r[0x34], 'column': signed(r[0x35]),
        }

    J = {jid: job(jid) for jid in by_jid}
    # A class's promotions: the one it names (+0x40), then any class naming it as where it comes from (+0x3c: the Falcoknight, by the
    # Elysian Whip).
    promotions = {jid: ([v['to']] if v['to'] else []) for jid, v in J.items()}
    for jid, v in J.items():
        if v['from'] and jid not in promotions[v['from']]:
            promotions[v['from']].append(jid)
    # A unit's set: its starting class's +0x34 and the same set's other tier (+-3), base classes first, each tier by column.
    def set_of(jid):
        code = J[jid]['set']
        if not code:
            return []
        family = {code, code + 3} if code <= 3 else {code - 3, code}
        members = [x for x in J if J[x]['set'] in family]
        return sorted(members, key=lambda x: (J[x]['set'] > 3, J[x]['column'], by_jid[x][0]['index']))

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
        members = set_of(jid)
        if members:
            unit['reclass'] = [cid[m] for m in members]
        units.append(unit)
        used.add(jid)
        used.update(members)
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
        "// The female promoted set's column 0: the reclass list offers the Dracoknight, or the Falcoknight for a unit promoted with the",
        "// Elysian Whip (the only way to become one).",
        f"export const FE11_RECLASS_SWAP: string[] = {js([cid['JID_DRAGONKNIGHT_F'], cid['JID_FALCONKNIGHT_F']])}",
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
