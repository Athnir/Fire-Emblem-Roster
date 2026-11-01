"""
Build src/data/fe13/fe13Units.ts from the user's own Fire Emblem Awakening dump (data-raw/fe13/romfs, from scripts/fe13_extract.py; see
data-raw/fe13/README.md): the army, when and how each joins, their classes and class sets, supports, parents, the DLC episodes' recruits
(scripts/fe13_dlc.py), and the classes' stats, skills and promotions.

Run: python scripts/build-fe13-units.py
"""
import json
import os

import fe13_data as D
from fe13_bin import Bin, ROMFS
from fates_lz import decompress
import fe13_dlc as X
import fe13_growths as G
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
# The DLC: when an episode opens, and the Path of a Grandmaster episodes' conditions (Serenes Forest's recruitment page).
DLC_OPENS = 'DLC episodes open after Chapter 4 (Serenes Forest).'
DLC_NOTES = {
    'E018': 'Only if Algol is defeated within 10 turns (Serenes Forest).',
    'E017': 'Only if all five NPC Annas survive (Serenes Forest).',
    'E016': 'Only if all 7 Revenants (starting and reinforcements) are defeated (Serenes Forest).',
    'E019': 'Only if all five enemy waves on the normal route are defeated (Serenes Forest).',
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


def read_assets():
    """GameData's PersonalityData, 56 bytes each: +0 the name label, +8 the asset's bases, +16 its growths, +24 its modifiers, then the
    flaw's at +32, +40 and +48 (8 signed bytes each, HP to Res; HP's modifier is always 0). The first record (無し) changes nothing; the
    rest follow the stats' order, HP to Res."""
    b = D.gamedata()
    stats = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res']

    def row(o):
        return dict(zip(stats, [x - 256 if x > 127 else x for x in b.d[0x20 + o:0x20 + o + 8]]))

    out = []
    for stat, r in zip(stats, D.table('PersonalityData', 56)[1:]):
        out.append({
            'stat': stat,
            'asset': {'bases': row(r + 8), 'growths': row(r + 16), 'modifiers': row(r + 24)},
            'flaw': {'bases': row(r + 32), 'growths': row(r + 40), 'modifiers': row(r + 48)},
        })
    return out


def main():
    b = Bin(decompress(open(os.path.join(ROMFS, 'data', 'person', 'static.bin.lz'), 'rb').read()))
    ptrs = set(b.ptrs)
    rec = {name: o for o, name in b.labels}
    jobs = D.classes()
    # The DLC's classes and skills are named in its own text (Dread Fighter, Bride, Aggressor...).
    dlc_text = X.global_text()
    gd = D.gamedata()
    job_recs = D.table('JobData', 128)
    jid_index = {c['jid']: i for i, c in enumerate(jobs)}
    skill_recs = [gd.at['RemovableSkillData'] + 28 * k for k in range(gd.u32(gd.at['RemovableSkillDataNum']))]
    skills = [D.name_of(gd.str(r + 8)) or dlc_text.get(gd.str(r + 8)) for r in skill_recs]
    skill_by_id = {gd.str(r): name for r, name in zip(skill_recs, skills)}
    for i, c in enumerate(jobs):
        if not c['name']:
            c['name'] = dlc_text.get(gd.str(job_recs[i] + 16))
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
            'growths': dict(zip(STATS, G.person_growths(raw, o))),
            'modifiers': dict(zip(STATS[1:], [s8(x) for x in raw[53:60]])),
            'classSets': sets,
            **({'parent': b.str(o + 132)} if (o + 132) in ptrs else {}),
            'supports': supports,
        })
    # The DLC: the unit each episode gives, made from a template person (the Avatar's twin, or Marth's) with its own asset and flaw.
    assets = read_assets()
    dlc_chapters = []
    for r in X.recruits():
        cls = jid_index[r['jid']]
        used.add(cls)
        c = jobs[cls]
        t = rec[r['template']]
        traw = b.d[0x20 + t:0x20 + t + PERSON]
        tg = G.person_growths(traw, t)
        a, f = assets[r['asset'] - 1]['asset'], assets[r['flaw'] - 1]['flaw']
        bases = dict(zip(STATS, r['stats']))
        cbase = c['raw'][24:32]
        sets = {}
        for g in ('male', 'female'):
            # Their own class and every regular class of their gender, as the Avatar (Serenes Forest's class sets).
            own = [cls] if r['female'] == (g == 'female') else []
            sets[g] = [f'c{i}' for i in dict.fromkeys(own + avatar_classes(g == 'female'))]
            used.update(int(x[1:]) for x in sets[g])
        chapter = f'fe13-{r["episode"].lower()}'
        dlc_chapters.append({'id': chapter, 'label': f'DLC: {r["title"]}'})
        notes = [x for x in (DLC_NOTES.get(r['episode']), DLC_OPENS) if x]
        units.append({
            'id': 'fe13-' + ''.join(ch if ch.isalnum() else '-' for ch in r['name'].lower()).strip('-').replace('--', '-'),
            'pid': None, 'name': r['name'], 'female': r['female'], 'classId': f'c{cls}', 'level': r['level'], 'joinChapter': chapter,
            'join': {'how': 'end', 'note': ' '.join(notes)},
            'bases': {**bases, 'mov': c['mov']}, 'personal': {s: bases[s] - cbase[i] for i, s in enumerate(STATS)},
            'growths': {s: tg[i] + a['growths'][s] + f['growths'][s] for i, s in enumerate(STATS)},
            'modifiers': {s: s8(traw[52 + i]) + a['modifiers'][s] + f['modifiers'][s] for i, s in enumerate(STATS) if s != 'hp'},
            'classSets': sets, 'supports': [], 'skills': [skill_by_id[k] for k in r['skills'] if skill_by_id.get(k)],
        })
    pid_to_id = {u['pid']: u['id'] for u in units if u['pid']}
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
        g = dict(zip(STATS, G.class_growths(raw, i)))
        classes[f'c{i}'] = {
            'id': f'c{i}', 'name': c['name'], 'female': c['female'], 'promoted': promoted,
            'bases': {**dict(zip(STATS, raw[24:32])), 'mov': c['mov']}, 'caps': dict(zip(STATS, raw[48:56])),
            'growths': g, 'skills': learn, 'promotesTo': [f'c{j}' for j in promotions(i)],
            # A special class (neither promoted nor promoting: Villager, Dancer, Taguel, Manakete, Conqueror and the DLC's Lodestar,
            # Dread Fighter, Bride) goes to Lv 30 (Serenes Forest's class sets).
            **({'maxLevel': 30} if not promoted and not promotions(i) else {}),
        }

    chapters = [{'id': f'fe13-{k.lower()}', 'label': label(k)} for k in keys] + dlc_chapters

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    lines = [
        "// Generated by scripts/build-fe13-units.py from the user's own Fire Emblem Awakening dump. Don't edit by hand.",
        "import type { Fe13Asset, Fe13Chapter, Fe13Class, Fe13Unit } from '../../awakening/types'",
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
        "// The Avatar's asset and flaw (GameData's PersonalityData): what each changes in the bases, growths and modifiers.",
        'export const FE13_ASSETS: Fe13Asset[] = [',
        *[f'  {js(a)},' for a in assets],
        ']',
        '',
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(units)} units, {len(classes)} classes -> {OUT}')


if __name__ == '__main__':
    main()
