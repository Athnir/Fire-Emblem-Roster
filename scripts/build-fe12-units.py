"""
Build src/data/fe12/fe12Units.ts from the user's own New Mystery of the Emblem cartridge (data-raw/fe12/rom, from
scripts/fe12_extract.py; see data-raw/fe12/README.md): who joins, where and how (scripts/fe12_joins.py), their bases, growths and weapon
ranks, the classes, the avatar's creation (Kris), the supports and the base conversations. English names: scripts/fe12_names.py.

Run: python scripts/build-fe12-units.py
"""
import json
import os
import struct

import fe12_data as D
from fe12_joins import GAIDEN, NOTES, STORY, chapter_id, chapter_label, joins
from fe12_names import english

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'data', 'fe12', 'fe12Units.ts')
STATS = D.STATS
WEAPONS = D.WEAPONS
FEMALE, PROMOTED, NO_PLAYER = 0x01, 0x800, 0x80000000
AVATAR_FLAG = 0x4000
# PCData's answers, in the game's order (the label Mエディット_Q_n_k is answer k-1); English as the Fire Emblem Wiki's Kris page.
QUESTIONS = [
    ('Past', ["Noble's Child", 'Orphan', "Farmer's Child", "Priest's Child", "Merchant's Child"]),
    ('Present', ['Beauty', 'Diversity', 'Strength', 'Kindness', 'Wisdom']),
    ('Future', ['Honorable', 'Recluse', 'Enlightened', 'Humane', 'Wealthy']),
]
# The avatar's face parts (arm9 0x20fd6e0 hair, 0x20fd6b0 eyes, 0x20fd698 outfits: the letters of the files in av/). The creation
# menu offers the first 13 hair styles, 10 eye styles and 10 hair colours (pcmake overlay 19: 0x2230024, 0x222ff74, 0x222ffcc).
HAIR = 'GABCDEFHIJKLMNOPQR'
EYES = 'ABCDEFGHIJK'
OUTFITS = 'ABCDE'
MENU_HAIR, MENU_EYES, MENU_COLOURS, HUE_STEP = 13, 10, 10, 36
# The A base conversations' rewards, Serenes Forest's names: a +2 for one chapter (use 0x17, arm9 0x204a1e8 sets unit +0x8e; the
# stat getters add 2, e.g. 0x204f078).
BONDS = {'IID_STRENGTHBOND': 'Strength Bond', 'IID_POWERBOND': 'Magic Bond', 'IID_TECHBOND': 'Skill Bond', 'IID_QUICKBOND': 'Speed Bond',
         'IID_LUCKBOND': 'Luck Bond', 'IID_DEFENSEBOND': 'Defence Bond', 'IID_MDEFBOND': 'Resistance Bond'}
COLUMNS = ['Pegasus Knight', 'Cavalier', 'Knight', 'Archer', 'Mercenary', 'Myrmidon', 'Fighter', 'Hunter', 'Pirate', 'Dark Mage',
           'Mage', 'Curate / Cleric']


def js(v):
    return json.dumps(v, ensure_ascii=False)


def slug(name):
    return name.lower().replace(' ', '-').replace("'", '')


def main():
    persons = D.persons()
    jobs = D.jobs()
    items = D.items()
    pid_of = {p['pid']: p for p in persons}
    cid = {j['index']: f'j{j["index"]}' for j in jobs}
    jname = {j['index']: english(j['name']) for j in jobs}

    def pname(p):
        if p['flags'] & AVATAR_FLAG:
            return english(D.say('MPID_PLAYER_DEFAULT'))
        return english(D.say('MPID_' + p['fid'][4:]) or D.say('MPID_' + p['pid'][4:]))

    def unit_id(p, suffix=''):
        return f'fe12-{slug(pname(p))}{suffix}'

    # Classes: bases (with Mov), caps, growths the class adds, promotions, weapons, max level.
    def promotions(j):
        out = [j['to']] if j['to'] is not None else []
        out += [k['index'] for k in jobs if k['from'] == j['index'] and k['index'] not in out]
        return out

    def weapons(j):
        w = [k.capitalize() for k in WEAPONS if j['wexp'][k]]
        if j['kinds'] & 0x40:
            w.append('Dragonstone')
        if j['kinds'] & 0x08:
            w.append('Ballista')
        return w

    def set_of(j):
        """The reclass set: every class with the same +0x34 as the class or its other tier (set code +-3), base tier first,
        each tier by column (the preparations' list, overlay 10 0x223c6a8)."""
        code = j['set']
        if not code:
            return []
        family = {code, code + 3} if code <= 3 else {code - 3, code}
        members = [k for k in jobs if k['set'] in family]
        return sorted(members, key=lambda k: (k['set'] > 3, k['column'], k['index']))

    def ranks(p, j, start_kind=None):
        out = {}
        for w in WEAPONS:
            if j['wexp'][w]:
                exp = j['wexp'][w] + p['wexp'][w]
                if start_kind == w:
                    exp = max(exp, D.rank_thresholds()[3])   # the avatar's starting weapon: rank D (arm9 0x204ce24)
                out[w] = D.rank_of(exp)
        return out

    def bases(p, j):
        b = {s: j['bases'][s] + p['bases'][s] for s in STATS}
        b['mov'] = j['mov']
        return b

    J = joins()
    pc = D.avatar()
    units, used = [], set()
    for pidv, jn in J.items():
        p = pid_of[pidv]
        rec = jn['unit']
        j = jobs[rec['job']]
        join = {'how': jn['how']}
        with_ = [pname(pid_of[w]) for w in jn['with']]
        if with_:
            join['with'] = with_
        if jn['turn']:
            join['turn'] = jn['turn']
        notes = []
        if pidv in NOTES:
            notes.append(NOTES[pidv])
        gaiden = STORY[[k for k, _, _ in STORY].index(jn['key'])][1]
        if gaiden in GAIDEN:
            notes.append(f'Ch. {gaiden} opens if: {GAIDEN[gaiden]}')
        if notes:
            join['note'] = ' '.join(notes)
        if p['flags'] & AVATAR_FLAG:
            # Two units, a man and a woman: the class the creation's list starts on for each (the placement's Cavalier), and the
            # weapon that class's list entry gives.
            for gender, key, suffix, label in (('male', 'male', '-m', ' (M)'), ('female', 'female', '-f', ' (F)')):
                opts = pc[key]
                k = next(i for i, o in enumerate(opts) if jobs[o['job']]['name'] == j['name'])
                o = opts[k]
                cj = jobs[o['job']]
                kind = WEAPONS[items[o['item']]['kind']]
                unit = {'id': unit_id(p, suffix), 'name': pname(p) + label, 'classId': cid[cj['index']], 'level': rec['level'],
                        'joinChapter': jn['chapter'], 'join': dict(join), 'bases': bases(p, cj), 'growths': p['growths'],
                        'ranks': ranks(p, cj, kind)}
                members = [m['index'] for m in set_of(cj)]
                if members:
                    unit['reclass'] = [cid[m] for m in members]
                units.append(unit)
                used.add(cj['index'])
                used.update(members)
                for opt in opts:
                    used.add(opt['job'])
                    used.update(m['index'] for m in set_of(jobs[opt['job']]))
            continue
        unit = {'id': unit_id(p), 'name': pname(p), 'classId': cid[j['index']], 'level': rec['level'], 'joinChapter': jn['chapter'],
                'join': join, 'bases': bases(p, j), 'growths': p['growths'], 'ranks': ranks(p, j)}
        members = [m['index'] for m in set_of(j)]
        if members:
            unit['reclass'] = [cid[m] for m in members]
        units.append(unit)
        used.add(j['index'])
        used.update(members)
        if jn['alt']:
            used.add(jn['alt']['unit']['job'])
    todo = list(used)
    while todo:
        for c in promotions(jobs[todo.pop()]):
            if c not in used:
                used.add(c)
                todo.append(c)
    classes = {}
    for i in sorted(used):
        j = jobs[i]
        c = {'id': cid[i], 'name': jname[i], 'bases': {**j['bases'], 'mov': j['mov']}, 'caps': j['caps'], 'growths': j['growths'],
             'promoted': bool(j['flags'] & PROMOTED), 'weapons': weapons(j)}
        pr = promotions(j)
        if pr:
            c['promotesTo'] = cid[pr[0]]
            c['promotions'] = [cid[x] for x in pr]
        if not j['flags'] & PROMOTED and j['to'] is None:
            c['maxLevel'] = 30      # arm9 0x2049460: a class that can't promote stops at 30
        if not c['weapons']:
            c['weaponsNote'] = "Uses no weapon of its own (Xane's Freelancer takes on an ally's form)."
        classes[cid[i]] = c
    chapters = [{'id': chapter_id(k), 'label': chapter_label(k)} for k, _, _ in STORY]
    by_pid = {}
    ids = {u['id'] for u in units}
    for p in persons:
        if p['pid'] in J:
            by_pid[p['pid']] = [i for i in (unit_id(p), unit_id(p, '-m'), unit_id(p, '-f')) if i in ids]

    # The avatar.
    def opt(o):
        cj = jobs[o['job']]
        it = items[o['item']]
        return {'classId': cid[cj['index']], 'weapon': it['iid'], 'weaponKind': WEAPONS[it['kind']], 'outfit': OUTFITS[o['outfit']],
                'reclass': [cid[m['index']] for m in set_of(cj)]}

    player = pid_of['PID_PLAYER']
    avatar = {
        'units': {'male': unit_id(player, '-m'), 'female': unit_id(player, '-f')},
        'own': {'bases': player['bases'], 'growths': player['growths']},
        'classes': {'male': [opt(o) for o in pc['male']], 'female': [opt(o) for o in pc['female']]},
        'questions': [{'question': q, 'answers': [
            {'label': names[a['answer']], 'jp': D.say(f'Mエディット_Q_{q_i + 1}_{a["answer"] + 1}').strip('【】'),
             'bases': {k: v for k, v in a['bases'].items() if v}, 'growths': {k: v for k, v in a['growths'].items() if v}}
            for a in pc['answers'] if a['question'] == q_i]} for q_i, (q, names) in enumerate(QUESTIONS)],
        'defaults': {'classIndex': 0, 'answers': [4, 3, 1], 'hair': 0, 'hairColor': 0, 'eyes': 0},
        'looks': {
            'hair': list(HAIR), 'menuHair': MENU_HAIR, 'eyes': list(EYES), 'menuEyes': MENU_EYES, 'hairColors': MENU_COLOURS,
            'hueStep': HUE_STEP, 'outfits': list(OUTFITS), 'noColorHair': {'male': HAIR.index('N')},
        },
    }

    # Supports: each unit's five slots (one way: the unit gets the bonus while the partner is within 3 tiles).
    supports = []
    for pidv in J:
        p = pid_of[pidv]
        for s in p['supports']:
            q = persons[s['partner']]
            if q['pid'] not in J:
                continue
            for a in by_pid[pidv]:
                for b in by_pid[q['pid']]:
                    supports.append({'unit': a, 'partner': b, 'start': s['start'],
                                     'levels': [x if x < 99 else None for x in s['levels']]})

    # Base conversations (FE12BaseTalk.bin's support records): who, the level, the points the record names, the item at A.
    def stat_item(iid):
        if not iid:
            return None
        it = next(i for i in items if i['iid'] == iid)
        raw = D.raw(D.db().at['ItemData'] + it['index'] * D.ITEM, D.ITEM)
        bonus = {s: v for s, v in zip(STATS, struct.unpack_from('8b', raw, 0x1c)) if v}
        return {'iid': iid, 'name': BONDS[iid], 'bonus': bonus, 'chapterOnly': it['use'] == 0x17}

    talks = []
    for t in D.base_talks():
        if not t['a'] or t['a'] not in J or t['b'] not in J:
            continue
        level = t['title'].rsplit('_', 1)[-1]
        talks.append({'a': by_pid[t['a']][0] if t['a'] != 'PID_PLAYER' else avatar['units']['male'],
                      'b': by_pid[t['b']][0] if t['b'] != 'PID_PLAYER' else avatar['units']['male'],
                      'withKris': t['b'] == 'PID_PLAYER' or t['a'] == 'PID_PLAYER', 'level': level, 'points': t['points'],
                      'item': stat_item(t['item'])})

    # The prologue's three choices, units joining for each answer, and the main-story join otherwise.
    choices = [
        {'id': 'p4', 'after': chapter_id('bmap203'), 'chapter': chapter_id('bmap204'),
         'question': "End of Prologue III: Jagen asks whether Kris knows how Marth fought the last war.",
         'first': by_pid['PID_ATHENA'], 'second': by_pid['PID_GOHDON']},
        {'id': 'p6', 'after': chapter_id('bmap205'), 'chapter': chapter_id('bmap206'),
         'question': 'End of Prologue V.', 'first': by_pid['PID_DOHGA'], 'second': by_pid['PID_OGUMA']},
        {'id': 'p7', 'after': chapter_id('bmap206'), 'chapter': chapter_id('bmap207'),
         'question': 'End of Prologue VI.', 'first': by_pid['PID_KAIN'], 'second': by_pid['PID_EST']},
    ]
    alt, away = {}, {}
    for pidv, jn in J.items():
        p = pid_of[pidv]
        if jn['alt']:
            a = jn['alt']
            alt[by_pid[pidv][0]] = {'chapter': a['chapter'], 'how': a['how'], 'level': a['unit']['level'],
                                    'classId': cid[a['unit']['job']]}
        if jn['returns']:
            r = jn['returns'][0]
            away[by_pid[pidv][0]] = [f"Leaves after Prologue VIII; back in {chapter_label(r['key'])}"
                                     f"{' (end)' if r['how'] == 'end' else ''}."]
    lim = {m['key']: m['limits'] for m in D.maps()}
    limits = {chapter_id(k): lim[k] for k, _, _ in STORY}
    prep = {m['key']: m['prep'] for m in D.maps()}
    reclass_open = [chapter_id(k) for k, _, _ in STORY if prep.get(k, 0) & 0x08]
    free = {}
    for gender, fem in (('male', 0), ('female', 1)):
        for tier, prom in (('base', 0), ('promoted', PROMOTED)):
            free[f'{gender}-{tier}'] = [cid[k['index']] for k in sorted(jobs, key=lambda k: (k['column'], k['index']))
                                        if k['set'] and (k['flags'] & FEMALE) == fem and (k['flags'] & PROMOTED) == prom]

    lines = [
        "// Generated by scripts/build-fe12-units.py from the user's own New Mystery of the Emblem dump. Don't edit by hand.",
        "import type { GbaChapter, GbaClass, GbaUnit, GbaStats } from '../../gba/types'",
        '',
        '/** The avatar, Kris: a man and a woman, each a unit. The creation picks a class from the gender\'s list, three answers (each',
        ' * adds bases and growths) and the looks (PCData, arm9 0x2028b04 / 0x2028b60). */',
        'export interface Fe12AvatarOption {',
        '  classId: string',
        '  /** The weapon the class starts with; its kind starts at rank D (arm9 0x204ce24). */',
        '  weapon: string',
        '  weaponKind: string',
        "  /** The portrait's outfit (av/<outfit>?C.?B), fixed by the starting class. */",
        '  outfit: string',
        '  reclass: string[]',
        '}',
        'export interface Fe12AvatarAnswer {',
        '  label: string',
        '  jp: string',
        '  bases: GbaStats',
        '  growths: GbaStats',
        '}',
        'export interface Fe12Avatar {',
        '  units: { male: string; female: string }',
        "  /** PID_PLAYER's own bases and growths (the units' are these plus the class's, without the answers). */",
        '  own: { bases: GbaStats; growths: GbaStats }',
        '  classes: { male: Fe12AvatarOption[]; female: Fe12AvatarOption[] }',
        '  questions: { question: string; answers: Fe12AvatarAnswer[] }[]',
        '  /** What a new save starts on before the creation (arm9 0x2028a40): the first class, answers 5, 4 and 2. */',
        '  defaults: { classIndex: number; answers: number[]; hair: number; hairColor: number; eyes: number }',
        '  looks: {',
        '    /** File letters of the hair styles (av/<letter>.MH / .FH) by index; the menu offers the first `menuHair`. */',
        '    hair: string[]',
        '    menuHair: number',
        '    eyes: string[]',
        '    menuEyes: number',
        "    /** Hair colour k turns the hair part's first 32 palette colours' hue by k * hueStep degrees (arm9 0x200d494). */",
        '    hairColors: number',
        '    hueStep: number',
        '    outfits: string[]',
        '    /** The hair index that takes no colour (the bald head). */',
        '    noColorHair: { male: number }',
        '  }',
        '}',
        '/** A support slot: `unit` gets the bonus while `partner` is within 3 tiles (overlay 00 0x21f2e0c). Points start at `start` and',
        ' * rise by 1 a turn while both are on the map, up to the highest level reachable (arm9 0x2050db0); `levels` are the points C, B',
        ' * and A need (null: never). */',
        'export interface Fe12Support {',
        '  unit: string',
        '  partner: string',
        '  start: number',
        '  levels: (number | null)[]',
        '}',
        '/** A base conversation (FE12BaseTalk.bin). `points` is the record\'s +0x39 (what the missing BaseTalk script compares it with',
        ' * is unconfirmed). The A conversation gives a stat-boosting item. */',
        'export interface Fe12BaseTalk {',
        '  a: string',
        '  b: string',
        '  withKris: boolean',
        "  level: 'C' | 'B' | 'A'",
        '  points: number',
        '  /** A Bond: +2 to one stat for the rest of the chapter (`chapterOnly`). */',
        '  item: { iid: string; name: string; bonus: GbaStats; chapterOnly: boolean } | null',
        '}',
        'export interface Fe12Choice {',
        '  id: string',
        '  /** The chapter whose ending asks; the chapter it changes. */',
        '  after: string',
        '  chapter: string',
        '  question: string',
        "  /** Units who join in `chapter` for the first answer (its B version) and for the second. */",
        '  first: string[]',
        '  second: string[]',
        '}',
        '/** Where a unit the prologue\'s choices bring in early joins when the other answer was picked. */',
        'export interface Fe12AltJoin {',
        '  chapter: string',
        "  how: GbaUnit['join']['how']",
        '  level: number',
        '  classId: string',
        '}',
        '',
        f'export const FE12_CHAPTERS: GbaChapter[] = {js(chapters)}',
        '',
        "// The female promoted set's column 0: the reclass list offers the Dracoknight, or the Falcoknight for a unit promoted with the",
        "// Elysian Whip (overlay 10 0x223c740; the promotion sets unit +0x90 0x40000000, arm9 0x2050d7c).",
        f"export const FE12_RECLASS_SWAP: string[] = {js([cid[5], cid[3]])}",
        '',
        "// Once a game has been cleared on Hard or above, reclassing may pick any class with a set of the unit's gender and tier",
        "// (global flag 2, set at arm9 0x205b334; the list, overlay 10 0x223c6f0). Keyed gender-tier.",
        f'export const FE12_RECLASS_FREE: Record<string, string[]> = {js(free)}',
        '',
        '// The battle preparations offer reclassing from these chapters (MapTable +0x18 bit 0x08).',
        f'export const FE12_RECLASS_CHAPTERS: string[] = {js(reclass_open)}',
        '',
        "// How many units of each class line may be in the army (MapTable +0x1c-+0x27; a reclass into a full line is refused,",
        '// overlay 10 0x223cb18). The columns are the classes\' +0x35.',
        f'export const FE12_CLASS_LIMITS: {{ columns: string[]; byChapter: Record<string, number[]> }} = {js({"columns": COLUMNS, "byChapter": limits})}',
        '',
        'export const FE12_UNITS: GbaUnit[] = [',
        *[f'  {js(u)},' for u in units],
        ']',
        '',
        'export const FE12_CLASSES: Record<string, GbaClass> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in classes.items()],
        '}',
        '',
        f'export const FE12_AVATAR: Fe12Avatar = {js(avatar)}',
        '',
        '// Support bonuses by level (none, C, B, A), per partner in reach, adding up: Hit, Avoid, Crit, Crit avoid (overlay 00 0x21f33a4).',
        'export const FE12_SUPPORT_BONUS: { hit: number[]; avoid: number[]; crit: number[]; dodge: number[] } = '
        '{ hit: [0, 5, 10, 10], avoid: [0, 5, 10, 10], crit: [0, 0, 0, 5], dodge: [0, 0, 0, 5] }',
        '',
        'export const FE12_SUPPORTS: Fe12Support[] = [',
        *[f'  {js(s)},' for s in supports],
        ']',
        '',
        'export const FE12_BASE_TALKS: Fe12BaseTalk[] = [',
        *[f'  {js(t)},' for t in talks],
        ']',
        '',
        f'export const FE12_CHOICES: Fe12Choice[] = {js(choices)}',
        '',
        f'export const FE12_ALT_JOINS: Record<string, Fe12AltJoin> = {js(alt)}',
        '',
        '// When units leave the army and come back. Spoilers.',
        f'export const FE12_AWAY: Record<string, string[]> = {js(away)}',
        '',
        "// The gaiden chapters' requirements (Serenes Forest's; the scripts that check them are missing from the dump).",
        f'export const FE12_GAIDEN: Record<string, string> = {js({"fe12-" + k: v for k, v in GAIDEN.items()})}',
        '',
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(units)} units, {len(classes)} classes, {len(supports)} supports, {len(talks)} base talks -> {OUT}')


if __name__ == '__main__':
    main()
