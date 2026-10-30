"""
Build src/data/fe13/fe13Units.ts from the user's own Fire Emblem Awakening dump (data-raw/fe13/romfs, from scripts/fe13_extract.py; see
data-raw/fe13/README.md): the army, when and how each joins, their classes and class sets, supports, parents, and the classes' stats,
skills and promotions.

Run: python scripts/build-fe13-units.py
"""
import json
import os

import fe13_data as D
from fe13_bin import Bin, ROMFS
from fates_lz import decompress
from fe13_growth_tables import CLASS_GROWTHS, PERSONAL_GROWTHS
from fe13_joins import AVATAR, CHAPTERS, joins, order

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'data', 'fe13', 'fe13Units.ts')
STATS = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res']
PERSON = 568
AVATARS = {'PID_プレイヤー男': 'Avatar (M)', 'PID_プレイヤー女': 'Avatar (F)'}
# Classes the Avatar can't take (Serenes Forest): the special classes.
AVATAR_EXCLUDED = {'Lord', 'Dancer', 'Villager', 'Manakete', 'Taguel', 'Conqueror', 'Lodestar', 'Dread Fighter', 'Bride'}
MORGAN = {'PID_マーク男': 'Morgan (M)', 'PID_マーク女': 'Morgan (F)'}
# What the scripts leave to the player, in Serenes Forest's words (its recruitment page).
NOTES = {
    'PID_ドニ': 'Joins at the end of the chapter only if he gained a level in it (Serenes Forest).',
    'PID_ギャンレル': 'Talk to him with Chrom three times (Serenes Forest).',
    'PID_ヴァルハルト': 'Only if Chrom fought him in this chapter (Serenes Forest).',
    'PID_エメリナ': 'Only if she survives the chapter (Serenes Forest).',
    'PID_インバース': 'Only if she (the green unit) survives the chapter (Serenes Forest).',
    'PID_バジーリオ': 'After Validar is defeated (Serenes Forest).',
    'PID_フラヴィア': 'After Validar is defeated (Serenes Forest).',
}


def label(key):
    if key == 'P002':
        return 'Prologue'
    if key == '026':
        return 'Endgame'
    if key.startswith('X'):
        return f'Paralogue {int(key[1:])}'
    return f'Ch.{int(key)}'


def s8(v):
    return v - 256 if v > 127 else v


def class_growths(c):
    name = c['name']
    for k, v in CLASS_GROWTHS.items():
        names = [k] if '/' not in k else [k.split('/')[0], k.split(' ')[0] + ' ' + k.split('/')[1]]
        if name in names or (name == 'Taguel' and k == f"Taguel ({'F' if c['female'] else 'M'})"):
            return dict(zip(STATS, v))
    return None


def main():
    b = Bin(decompress(open(os.path.join(ROMFS, 'data', 'person', 'static.bin.lz'), 'rb').read()))
    ptrs = set(b.ptrs)
    rec = {name: o for o, name in b.labels}
    jobs = D.classes()
    gd = D.gamedata()
    job_recs = D.table('JobData', 128)
    jid_index = {c['jid']: i for i, c in enumerate(jobs)}
    skills = [D.name_of(gd.str(gd.at['RemovableSkillData'] + 28 * k + 8)) for k in range(gd.u32(gd.at['RemovableSkillDataNum']))]
    found = joins()

    def avatar_classes(female):
        # The base classes a playable unit can be (one some person's set names), of the gender, but the special ones.
        named = {b.str(o + k) for o, _ in b.labels for k in (108, 112, 116, 120, 124, 128) if (o + k) in ptrs}
        return [i for i, c in enumerate(jobs) if c['jid'] in named and c['female'] == female and not c['promoted']
                and c['name'] not in AVATAR_EXCLUDED]

    def name_of(pid):
        return AVATARS.get(pid) or MORGAN.get(pid) or D.name_of(b.str(rec[pid] + 20))

    def uid(pid):
        n = name_of(pid)
        return 'fe13-' + ''.join(ch if ch.isalnum() else '-' for ch in n.lower().replace("'", '').replace('’', '')).strip('-').replace('--', '-')

    # The army: the two Avatars (the Prologue's start), then everyone the scripts bring in.
    entries = [(pid, ['P002', 'start', [], None]) for pid in AVATARS] + list(found.items())
    used, units = set(), []
    keys = order()
    for pid, (key, how, with_, turn, *rest) in sorted(entries, key=lambda e: keys.index(e[1][0])):
        o = rec[pid]
        raw = b.d[0x20 + o:0x20 + o + PERSON]
        female = bool(b.u32(o) & 1)
        cls = jid_index[b.str(o + 16)]
        used.add(cls)
        c = jobs[cls]
        cbase = c['raw'][24:32]
        personal = [s8(x) for x in raw[28:36]]
        bases = {s: cbase[i] + personal[i] for i, s in enumerate(STATS)}
        bases['mov'] = c['mov']
        sets = {}
        for g, offs in (('male', (108, 112, 116)), ('female', (120, 124, 128))):
            sets[g] = [f'c{jid_index[b.str(o + k)]}' for k in offs if (o + k) in ptrs and b.str(o + k) in jid_index]
            if pid in AVATARS:
                # The Avatar's record names only the Tactician: a Second Seal opens every base class of their gender but the special
                # ones (Serenes Forest).
                sets[g] = [f'c{i}' for i in avatar_classes(g == 'female')]
            used.update(int(x[1:]) for x in sets[g])
        supports = []
        k = 136
        while (o + k) in ptrs and k < 544:
            partner = b.str(o + k)
            lv = list(raw[k + 4:k + 8])
            if partner in rec:
                supports.append({'partner': partner, 'levels': [x if x != 99 else None for x in lv]})
            k += 8
        name = name_of(pid)
        growth_name = 'Avatar' if pid in AVATARS else 'Morgan' if pid in MORGAN else name
        notes = []
        if rest and 'starts' in rest:
            notes.append(f'{name} starts the talk.')
        if pid in NOTES:
            notes.append(NOTES[pid])
        ch = CHAPTERS.get(key, {})
        if ch.get('parent') and key.startswith('X'):
            parent = 'the Avatar' if ch['parent'].startswith('プレイヤー') else D.name_of('MPID_' + ch['parent'])
            notes.append(f'The paralogue opens once {parent} is married (the chapter data).')
        units.append({
            'id': uid(pid), 'pid': pid, 'name': name, 'female': female, 'classId': f'c{cls}', 'level': raw[69],
            'joinChapter': f'fe13-{key.lower()}',
            'join': {'how': how, **({'with': [name_of(w) if w in rec else 'Avatar' for w in dict.fromkeys(with_)]} if with_ else {}),
                     **({'turn': turn} if turn else {}), **({'note': ' '.join(notes)} if notes else {})},
            'bases': bases, 'personal': dict(zip(STATS, personal)),
            'growths': dict(zip(STATS, PERSONAL_GROWTHS[growth_name])),
            'modifiers': dict(zip(STATS[1:], [s8(x) for x in raw[53:60]])),
            'classSets': sets,
            **({'parent': b.str(o + 132)} if (o + 132) in ptrs else {}),
            'supports': supports,
        })
    pid_to_id = {u['pid']: u['id'] for u in units}
    for u in units:
        if 'parent' in u:
            u['parent'] = pid_to_id.get(u['parent'], 'fe13-avatar-' + ('f' if u['parent'].endswith('女') else 'm'))
        u['supports'] = [{'partner': pid_to_id[s['partner']], 'levels': s['levels']} for s in u['supports'] if s['partner'] in pid_to_id]
        del u['pid']

    # Classes: everyone's, their class sets', and what they promote to (+92, +96: pointers to the promoted classes' records).
    def promotions(i):
        out = []
        for k in (92, 96):
            r = job_recs[i]
            if (r + k) in set(gd.ptrs):
                p = gd.u32(r + k)
                out += [j for j, rr in enumerate(job_recs) if rr == p]
        return out
    todo = list(used)
    while todo:
        i = todo.pop()
        for j in promotions(i):
            if j not in used:
                used.add(j)
                todo.append(j)
    classes = {}
    for i in sorted(used):
        c = jobs[i]
        raw = c['raw']
        promoted = bool(raw[0] & 8)
        levels = (5, 15) if promoted else (1, 10)
        learn = [{'skill': skills[raw[64 + 2 * n]], 'level': levels[n]} for n in range(2) if raw[64 + 2 * n]]
        g = class_growths(c)
        classes[f'c{i}'] = {
            'id': f'c{i}', 'name': c['name'], 'female': c['female'], 'promoted': promoted,
            'bases': {**dict(zip(STATS, raw[24:32])), 'mov': c['mov']}, 'caps': dict(zip(STATS, raw[48:56])),
            **({'growths': g} if g else {}), 'skills': learn, 'promotesTo': [f'c{j}' for j in promotions(i)],
        }

    chapters = [{'id': f'fe13-{k.lower()}', 'label': label(k)} for k in keys]

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    lines = [
        "// Generated by scripts/build-fe13-units.py from the user's own Fire Emblem Awakening dump. Don't edit by hand.",
        "import type { Fe13Chapter, Fe13Class, Fe13Unit } from '../../awakening/types'",
        '',
        f'export const FE13_CHAPTERS: Fe13Chapter[] = {js(chapters)}',
        '',
        'export const FE13_UNITS: Fe13Unit[] = [',
        *[f'  {js(u)},' for u in units],
        ']',
        '',
        'export const FE13_CLASSES: Record<string, Fe13Class> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in classes.items()],
        '}',
        '',
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(units)} units, {len(classes)} classes -> {OUT}')


if __name__ == '__main__':
    main()
