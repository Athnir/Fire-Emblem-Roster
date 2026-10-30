"""
Build src/data/fe10/fe10Units.ts from the user's own Radiant Dawn files (see data-raw/fe10/README.md): the playable
units, when they join and which chapters they're in your army for, their classes and promotions, skills, supports and
bonds.

Run: python scripts/build-fe10-units.py   (FE10_FILES overrides where the extracted disc is)
"""
import json
import os
import re
import struct

from fe10_cmb import Script, calls, scripts
from fe10_files import FE10
from fe10_units import (AFFINITY_LABELS, RANK_TYPES, STATS, Tables, bonds, classes, items, people, skills, support_param,
                        supports)

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'data', 'fe10', 'fe10Units.ts')

# Who is playable: everyone in the support table, the Black Knight (Part 1) and Lehran (Part 4's last map).
EXTRA_UNITS = ('PID_DARKKNIGHT_0', 'PID_ERLAN')
# Your army is team 5 while a chapter is set up; 0 is your side on the map. The other teams hold the armies that
# aren't being played (8, 9 and 10) or units away from every army (7). Teams 1 to 4 are the map's other sides.
ARMY = (0, 5)
MAP_SIDES = (1, 2, 3, 4)
# Handlers that set a chapter up before the battle.
OPENINGS = ('Opening', 'RestoreSally', 'FinalDisposition')
# The startup script's helpers that move units between teams (handler numbers).
ALL_TO, TEAM_CHECK, UNIT_CHECK, TEAM_PID = 382, 383, 384, 385

# Joins the scripts make on a condition: what isn't traced is said under `unconfirmed`, not as fact.
NOTES = {
    'PID_FRIEDA': 'Joins if she survived {c0107}.',
    'PID_SOANEVALCKE': 'Found by moving Micaiah, Lethe or Mordecai onto a tile partway through the chapter.',
    'PID_VOLKE': 'Joins if paid 3,000 gold (Serenes Forest: by Bastian or Elincia).',
    'PID_PELLEAS': 'Second playthrough on, if he was spared in {c0314} (Serenes Forest).',
    'PID_ERLAN': 'Second playthrough on (Serenes Forest: once Ike\'s memory scene was seen in {c0407b}).',
    'PID_NASIR': 'Joins if he survived {c0407c}.',
    'PID_GORT': 'Joins if he survived {c0407c}.',
    'PID_JANAFF': 'Ulki joins with him. Otherwise both join at the start of the next chapter (Serenes Forest).',
    'PID_VULCI': 'Janaff joins with him. Otherwise both join at the start of the next chapter (Serenes Forest).',
}
UNCONFIRMED = {
    'PID_SOTHE': 'Serenes Forest has him from turn 2: on turn 2 he only passes through a scene and leaves; turn 3 places him.',
}
# Story promotions (classes with SID_EVENT_CC can't use a Seal or Crown): the chapter whose script changes the class
# (UnitClassChange on the unit, in the chapter's closing or opening scenes).
EVENT_PROMOTIONS = {
    'PID_MICAIAH': [('0111', 'end'), ('0407a', 'start')],
    'PID_SOTHE': [('0401', 'start')],
    'PID_IKE': [('0401', 'start')],
}


class Reloc:
    """A pointer-relocated placement file (dispos_*.bin): data at 0x20, then pointer offsets and table names."""

    def __init__(self, d):
        _, size, n_ptrs, n_names = struct.unpack_from('>4I', d, 0)
        names_at = 0x20 + size + n_ptrs * 4
        strings_at = names_at + n_names * 8
        self.data = d[0x20:0x20 + size]
        self.ptrs = set(struct.unpack_from(f'>{n_ptrs}I', d, 0x20 + size))
        self.tables = sorted((struct.unpack_from('>I', d, names_at + k * 8)[0],
                              self._c(d, strings_at + struct.unpack_from('>I', d, names_at + k * 8 + 4)[0]))
                             for k in range(n_names))

    @staticmethod
    def _c(d, o):
        return d[o:d.index(b'\0', o)].decode('shift_jis')

    def string(self, o):
        return self._c(self.data, struct.unpack_from('>I', self.data, o)[0]) if o in self.ptrs else None


def groups():
    """Every placement group on the disc (zmap/*/dispos_{c,n,h}.bin): {group: [(PID, side)]}. A group named without a
    suffix in the scripts gets the difficulty's (`_n`, `_h`) or the shared `_c` one; both are kept under the bare name
    too. Units are 104 bytes: +4 PID, +17 side (0 yours)."""
    out = {}
    for folder in os.listdir(os.path.join(FE10, 'zmap')):
        for diff in 'cnh':
            path = os.path.join(FE10, 'zmap', folder, f'dispos_{diff}.bin')
            if not os.path.exists(path):
                continue
            r = Reloc(open(path, 'rb').read())
            for o, group in r.tables:
                units = [(r.string(o + 4 + 104 * k + 4), r.data[o + 4 + 104 * k + 17]) for k in range(r.data[o])]
                out.setdefault(group, []).extend(units)
                bare = re.sub(r'_[cnh]$', '', group)
                if bare != group:
                    out.setdefault(bare, []).extend(units)
    return out


def team_moves(startup):
    """The startup script's TEAM_ functions as moves: {name: [(PID or None, from team or None, to team)]}. PID None
    moves a whole team; `from` None moves the unit wherever it is."""
    out = {}
    hs = startup.handlers()
    for h in hs:
        if not h['name'].startswith('TEAM_'):
            continue
        moves, pids, ints, source = [], [], [], None
        for _, op, a in startup.disasm(h):
            if op == 'str':
                pids.append(a)
            elif op == 'int':
                ints.append(a)
            elif op == 'call' and a == 'ForceGetFirst/1':
                source = ints[-1]
            elif op == 'callh':
                if a == ALL_TO:
                    moves.append((None, ints[-2], ints[-1]))
                elif a == TEAM_PID:
                    moves.append((pids.pop(), None, ints[-1]))
                elif a == TEAM_CHECK:  # each unit of team `source` that's on the list goes to the team
                    moves += [(p, source, ints[-1]) for p in pids]
                    pids = []
                elif a == UNIT_CHECK:  # each listed unit in team `from` goes to team `to`
                    moves += [(p, ints[-2], ints[-1]) for p in pids]
                    pids = []
                ints = []
        out[h['name']] = moves
    return out


def chapter_code(script_name):
    return script_name[1:-4]


def chapter_label(text, code):
    """'0305' -> 'Part 3 Ch.4'; '0407b' -> 'Part 4 Endgame (2)'."""
    roman = {'I': 1, 'II': 2, 'III': 3, 'IV': 4}[text[f'MCT{code}_0_2']]
    return f"Part {roman} {text[f'MCT{code}_3']}"


def chapter_id(text, code):
    """'0305' -> 'fe10-3-4', the same ids as the Armory's maps (Part 1 Ch.6, two maps, is 'fe10-1-6-1')."""
    label = text[f'MCT{code}_3'].replace('Ch.', '')
    cid = 'fe10-' + re.sub(r'[^a-z0-9]+', '-', f'{int(code[:2])}-{label}'.lower()).strip('-')
    return cid + '-1' if code == '0107' else cid


def walk(t, persons, playable):
    """Read every chapter's script in story order: who first joins where and how, and who is in your army (and can be
    deployed) for each chapter.

    First joins, the first rule that finds a unit winning:
    - `JoinRank(group, 5)` / `Join(group, 5)`: at the base (an Info conversation, handler kind 14) or the chapter's start.
    - A talk (handler kind 8, or a function such a talk calls) moving them to your side: `UnitTransferToForceByPID(pid, 0)`
      or `UnitTransferToForce(UnitGetByPID(pid), 0)`.
    - Any other move to your side (`UnitTransferToForce`, a TEAM_ function or `TeamTransferPID` to team 5) during or after
      the chapter: during it, an event; after it, the start of the next chapter.
    - A group of yours placed on a turn (handler kind 3): an event on that turn.
    - The first deployment template (a `mikata` group) listing them: the start of that chapter.

    Who's in your army: the teams are followed through the chapters. Each chapter's opening runs its TEAM_..._OP
    functions and `TeamTransferPID`, `UnitCheckTransferPID`, `JoinRank` and `Join` calls; then the units in team 5 and
    whoever joins during the chapter are in your army for it, less those the chapter keeps off the field
    (`UnitNeverSallyByPID`); then its TEAM_..._ED functions run. A move out of a map side (teams 1-4) is taken from
    wherever the unit is: those are units fighting beside you before they join. A whole-army move outside the TEAM_
    functions only stages a cutscene and is skipped."""
    text = t.text
    all_groups = groups()
    startup = Script('startup.cmb')
    teams_fn = team_moves(startup)
    codes = [chapter_code(s) for s in scripts()]

    first = {}  # PID -> (code, how, with, turn, note)
    switches = {}  # PID -> [(code, [who can talk])]
    team = {}  # PID -> team
    army = {}  # code -> [PID]
    held_back = {}  # code -> [PID] (in your army, but the chapter keeps them off the field)

    def join(pid, code, how):
        if pid in playable and pid not in first:
            first[pid] = (code, how, [], None, None)

    def move(pid, frm, to):
        if pid is None:
            for p, tm in list(team.items()):
                if tm == frm:
                    team[p] = to
        elif frm is None or frm in MAP_SIDES or team.get(pid) == frm or (frm in ARMY and team.get(pid) in ARMY):
            if pid in playable:
                team[pid] = to

    for script_name, code in zip(scripts(), codes):
        sc = Script(script_name)
        hs = sc.handlers()
        # Handlers the game starts (openings, base talks, turns, talks, the chapter's end...), each read with the
        # functions it calls (kind 0 without a name, or 256 and up: those take arguments).
        roots = [h for h in hs if h['name'].startswith(OPENINGS) or 0 < h['kind'] < 256]
        cands = {}  # PID -> {how: {'with', 'turns', 'notes'}}
        during, after, before, never = [], [], [], set()

        def candidate(pid, how, with_=(), turn=None, note=None):
            if pid in playable:
                entry = cands.setdefault(pid, {}).setdefault(how, {'with': set(), 'turns': set(), 'notes': set()})
                entry['with'] |= set(with_)
                if turn:
                    entry['turns'].add(turn)
                if note:
                    entry['notes'].add(note)

        for h in roots:
            opening = h['name'].startswith(OPENINGS)
            ending = h['kind'] == 1  # the chapter's end (it runs the TEAM_..._ED functions)
            base = h['kind'] == 14
            # A talk names both speakers (kind 8: two PID string offsets first).
            pair = [sc.string(x) for x in h['args'][:2]] if h['kind'] == 8 and len(h['args']) >= 2 else []
            # A turn event guarded by Normal() runs on Easy only (Normal() is true on Easy), or with `not`, on the others.
            dis = sc.disasm(h)
            easy = None
            if h['kind'] == 3 and len(dis) > 1 and dis[0][1:] == ('call', 'Normal/0'):
                easy = dis[1][1] != 'op29'
            when = before if opening or base else after if ending else during
            for fn, a, _ in calls(sc, hs, h):
                if fn.startswith('TEAM_'):
                    (after if '_ED' in fn else before).append(('team', fn))
                elif fn in ('JoinRank', 'Join') and len(a) == 2 and a[1] == 5 and isinstance(a[0], str):
                    for pid, _side in all_groups.get(a[0], []):
                        candidate(pid, 'next' if ending else 'base' if base else 'start' if opening else 'event')
                        when.append(('move', pid, None, 5))
                elif fn == 'TeamTransferPID' and len(a) == 2 and (opening or ending):
                    when.append(('move', a[0], None, a[1]))
                    if a[1] == 5 and opening:
                        candidate(a[0], 'start')
                elif fn == 'UnitCheckTransferPID' and opening and len(a) == 3:
                    before.append(('move', a[0], a[1], a[2]))
                elif fn in ('UnitTransferToForceByPID', 'UnitTransferToForce') and len(a) == 2 and a[1] == 0:
                    pid = a[0][1] if isinstance(a[0], tuple) and a[0][0] == 'unit' else a[0]
                    if not isinstance(pid, str):
                        continue
                    if ending:
                        candidate(pid, 'next')
                        after.append(('move', pid, None, 5))
                        continue
                    if pid in pair:
                        candidate(pid, 'talk', [persons[p]['name'] for p in pair if p != pid and p in persons])
                    elif pair:
                        candidate(pid, 'event', note=f"Joins when {' and '.join(persons[p]['name'] for p in pair)} talk.")
                    else:
                        candidate(pid, 'event')
                    during.append(('move', pid, None, 5))
                elif fn == 'UnitNeverSallyByPID' and a and isinstance(a[0], str):
                    never.add(a[0])
                elif fn == 'SallyAddByGroupRank' and a and isinstance(a[0], str):
                    for pid, side in all_groups.get(a[0], []):
                        if side == 0:
                            candidate(pid, 'start')
                            before.append(('move', pid, None, 5))
                elif fn.startswith(('Dispos', 'InstantDispos')) and a and isinstance(a[0], str) and (h['kind'] == 3 or opening):
                    if re.search(r'_(op|ed|ev)\d*_|mikata|emap|child', a[0] + '_'):
                        continue  # cutscenes, deployment templates and units carried by another
                    for pid, side in all_groups.get(a[0], []):
                        if side != 0:
                            continue
                        if opening:
                            candidate(pid, 'start')
                            before.append(('move', pid, None, 5))
                        else:
                            which = 'easy' if easy else 'other' if easy is False else 'all'
                            candidate(pid, 'event', turn=(which, h['args'][0] if h['args'] else None))
                            during.append(('move', pid, None, 5))

        # The chapter's joins: an opening beats a base conversation, a talk and an event (Volug's base talk only joins
        # him early). A join after the chapter is the start of the next one.
        for pid, c in cands.items():
            if pid in first:
                # Someone who has joined before and is talked back to your side (Jill and Zihark, fighting for Daein in
                # Part 3).
                if 'talk' in c:
                    switches.setdefault(pid, []).append((code, sorted(c['talk']['with'])))
                continue
            how = next(k for k in ('start', 'base', 'talk', 'event', 'next') if k in c)
            e = c[how]
            if how == 'next':
                if code != codes[-1]:
                    first[pid] = (codes[codes.index(code) + 1], 'start', [], None, None)
                continue
            turns = dict(e['turns'])
            turn = turns.get('all') or turns.get('other')
            notes = sorted(e['notes'])
            if turns.get('easy') and turns['easy'] != turn:
                notes.append(f"On Easy, turn {turns['easy']}.")
            first[pid] = (code, how, sorted(e['with']), turn, ' '.join(notes) or None)

        def run(steps):
            for step in steps:
                if step[0] == 'team':
                    for pid, frm, to in teams_fn.get(step[1], []):
                        move(pid, frm, to)
                else:
                    move(*step[1:])

        # Deployment templates, for units nothing else has joined yet (Part 1's first chapters).
        for group, units in all_groups.items():
            if re.fullmatch(rf'bmap{code}_(a_|b_)?mikata2?', group):
                for pid, side in units:
                    if side == 0 and pid in playable and pid not in first:
                        join(pid, code, 'start')
                        before.append(('move', pid, None, 5))
        # A move to your army after the chapter is a join at the start of the next one.
        for step in after:
            for pid, frm, to in teams_fn.get(step[1], []):
                if pid and to in ARMY and pid in playable and pid not in first and code != codes[-1]:
                    nxt = codes[codes.index(code) + 1]
                    first[pid] = (nxt, 'start', [], None, None)

        run(before)
        run(during)
        army[code] = sorted(p for p, tm in team.items() if tm in ARMY and p not in never)
        held_back[code] = sorted(p for p, tm in team.items() if tm in ARMY and p in never)
        run(after)
    return codes, first, army, held_back, switches


def ranks(s):
    """'S-A---------' -> {'sword': 'S', 'axe': 'A'}. '*' is SS."""
    return {k: ('SS' if c == '*' else c) for k, c in zip(RANK_TYPES, s) if c != '-'}


def main():
    t = Tables()
    text = t.text
    persons, jobs, sk, item_names = people(t), classes(t), skills(t), items(t)
    pairs = supports(t)
    pool = sorted({a for a, _ in pairs})
    playable = set(pool) | set(EXTRA_UNITS)
    codes, first, army, held_back, switches = walk(t, persons, playable)
    missing = playable - set(first)
    assert not missing, f'no join found for {sorted(missing)}'
    labels = {c: chapter_label(text, c) for c in codes}

    def visible(sids):
        """Only skills the game names and explains (the rest are flags: SID_HERO, SID_FLY, SID_HIGHER...)."""
        return [s for s in sids if s in sk and sk[s]['help'] and sk[s]['kind'] != 3]

    order = sorted(first, key=lambda p: (codes.index(first[p][0]), persons[p]['name']))
    used = set()
    units = []
    for pid in order:
        p = persons[pid]
        code, how, with_, turn, note = first[pid]
        c = jobs[p['jid']]
        used.add(p['jid'])
        unit = {
            'id': pid, 'name': p['name'], 'classId': p['jid'], 'level': p['level'],
            'joinChapter': chapter_id(text, code),
            'join': {'how': how, **({'with': with_} if with_ else {}), **({'turn': turn} if turn else {})},
            'affinity': text[AFFINITY_LABELS[p['affinity']]],
            'bases': {s: c['bases'][s] + p['bases'][s] for s in STATS},
            'growths': p['growths'],
            # Wt is the unit's Con plus the class's weight over Con (and a mount's) plus their own.
            'con': c['con'] + p['con'], 'wt': c['con'] + p['con'] + c['wt'] - c['con'] + p['wt'],
            'ranks': ranks(p['ranks']),
            'skills': visible(p['skills']),
            'available': [chapter_id(text, k) for k in codes if pid in army[k]],
            **({'heldBack': [chapter_id(text, k) for k in codes if pid in held_back[k]]}
               if any(pid in held_back[k] for k in codes) else {}),
        }
        if p['stars']:
            unit['leadership'] = p['stars']
        notes = [note] if note else []
        if pid in NOTES:
            notes.append(NOTES[pid].format(**{f'c{k}': labels[k] for k in codes}))
        if notes:
            unit['join']['note'] = ' '.join(notes)
        if pid in switches:
            unit['talkedBack'] = [{'chapter': chapter_id(text, k), 'with': w} for k, w in switches[pid]]
        if pid in EVENT_PROMOTIONS:
            unit['storyPromotions'] = [{'chapter': chapter_id(text, k), 'when': w} for k, w in EVENT_PROMOTIONS[pid]]
        if pid in UNCONFIRMED:
            unit['unconfirmed'] = UNCONFIRMED[pid]
        units.append(unit)

    # The classes your units start in and everything they promote or change into.
    queue = list(used)
    while queue:
        c = jobs[queue.pop()]
        for other in (c['higher'], c['transform']):
            if other and other in jobs and other not in used:
                used.add(other)
                queue.append(other)
    out_classes = {}
    for j in sorted(used):
        c = jobs[j]
        laguz = 'SFXC_ALIZE' in c['attributes']
        tier = 'master' if 'SID_HIGHEST' in c['skills'] else 'promoted' if 'SID_HIGHER' in c['skills'] else 'base'
        # The class's mastery skill, learned with a Satori Sign: a laguz class names it apart from its skills; a beorc
        # class lists it with them (Aether for the Vanguard, Eclipse for the Black Knight), the one skill of 25 capacity or
        # more and no scroll.
        mastery = c['mastery'] or next((x for x in c['skills'] if sk[x]['capacity'] >= 25
                                         and not sk[x]['scroll']), None)
        out_classes[j] = {
            'id': j, 'name': c['name'], 'tier': tier, 'laguz': laguz,
            **({'transformed': 'SID_LYCANTHROPE' in c['skills']} if laguz else {}),
            **({'promotesTo': c['higher']} if c['higher'] else {}),
            **({'transformsTo': c['transform']} if c['transform'] else {}),
            **({'storyPromotion': True} if 'SID_EVENT_CC' in c['skills'] else {}),
            'bases': c['bases'], 'caps': c['caps'], 'mov': c['mov'], 'con': c['con'], 'wt': c['wt'],
            'capacity': c['capacity'], 'ranks': ranks(c['ranks']),
            'skills': [x for x in visible(c['skills']) if x != mastery],
            **({'mastery': mastery} if mastery else {}),
            'attributes': c['attributes'],
            # Laguz level to 40 (Serenes Forest), beorc to 20 in each tier.
            'maxLevel': 40 if laguz else 20,
            **({'gains': c['gains']} if c['lower'] else {}),
        }

    # Skills: those with a scroll the game names (learnable), and every skill a unit or class has.
    def scroll_of(s):
        name = item_names.get(s['scroll'] or '')
        return name if name and name != 'dummy' else None

    def rule_list(entries):
        return [e for _, e in entries if e]

    out_skills = {}
    shown = {s['sid'] for s in sk.values() if scroll_of(s) and s['name'] != 'dummy'}
    shown |= {s for u in units for s in u['skills']} | {s for c in out_classes.values() for s in c['skills']}
    shown |= {c['mastery'] for c in out_classes.values() if c.get('mastery')}
    for sid in sorted(shown, key=lambda s: sk[s]['order']):
        s = sk[sid]
        deny = [e for f, e in s['rules'] if f == 1 and e and e != sid]
        need = [e for f, e in s['rules'] if f == 0 and e]
        allowed = rule_list(s['allowed'])
        out_skills[sid] = {
            'id': sid, 'name': s['name'], 'description': s['help'], 'capacity': s['capacity'],
            'removable': bool(scroll_of(s)),
            **({'scroll': scroll_of(s)} if scroll_of(s) else {}),
            **({'deny': deny} if deny else {}),
            **({'need': need} if need else {}),
            **({'allow': allowed} if allowed else {}),
        }

    # Supports: everyone in the table can support everyone else in it. Each pair has a kind, 0 to 4, that adds to every
    # gain (RelianceParam), and a flag byte (-1 on 302 pairs) whose use isn't known.
    param = support_param(t)
    out_pairs = []
    for (a, b), (flag, kind) in sorted(pairs.items()):
        if a < b and (kind != 2 or flag):
            out_pairs.append({'a': a, 'b': b, 'kind': kind, **({'flag': flag} if flag else {})})
    out_bonds = [{'a': a, 'b': b, 'value': v} for a, b, v in bonds(t) if a in persons and b in persons]

    chapters = [{'id': chapter_id(text, c), 'label': labels[c], 'title': ' '.join(text[f'MCT{c}_2'].split()),
                 'part': labels[c].split(' ', 2)[0] + ' ' + labels[c].split(' ', 2)[1], 'short': labels[c].split(' ', 2)[2]}
                for c in codes]

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    lines = [
        "// Generated by scripts/build-fe10-units.py from the user's own Radiant Dawn files. Don't edit by hand.",
        'import type { TelliusBond, TelliusChapter, TelliusClass, TelliusOpenSupports, TelliusSkill, TelliusUnit } from '
        "'../../tellius/types'",
        '',
        f'export const FE10_CHAPTERS: TelliusChapter[] = {js(chapters)}',
        '',
        'export const FE10_UNITS: TelliusUnit[] = [',
        *[f'  {js(u)},' for u in units],
        ']',
        '',
        'export const FE10_CLASSES: Record<string, TelliusClass> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in out_classes.items()],
        '}',
        '',
        'export const FE10_SKILLS: Record<string, TelliusSkill> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in out_skills.items()],
        '}',
        '',
        '// Everyone in `pool` can support everyone else in it; `pairs` lists the pairs whose kind isn\'t 2 (the usual).',
        'export const FE10_SUPPORTS: TelliusOpenSupports = {',
        f'  pool: {js(pool)},',
        f"  levels: {js(param['levels'])},",
        f"  actions: {js(param['actions'])},",
        f"  kindBonus: {js(param['kinds'])},",
        '  pairs: [',
        *[f'    {js(p)},' for p in out_pairs],
        '  ],',
        '}',
        '',
        'export const FE10_BONDS: TelliusBond[] = [',
        *[f'  {js(b)},' for b in out_bonds],
        ']',
        '',
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(units)} units, {len(out_classes)} classes, {len(out_skills)} skills, {len(out_pairs)} support pairs, '
          f'{len(out_bonds)} bonds -> {OUT}')


if __name__ == '__main__':
    main()
