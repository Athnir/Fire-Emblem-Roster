"""
Build src/data/fe9/fe9Units.ts from the user's own Path of Radiance files (see data-raw/fe9/README.md):
the playable units and how they join, their classes and promotions, skills and supports.

Run: python scripts/build-fe9-units.py   (FE9_FILES overrides where the extracted disc is)
"""
import json
import os
import struct

from fe9_cmb import Script
from fe9_files import map_files
from fe9_units import AFFINITY_LABELS, RANK_TYPES, STATS, Tables, classes, people, skills, supports

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'data', 'fe9', 'fe9Units.ts')

# The chapter files (Cnn, bmapNN) of the story, in order. 80-82 are the tutorials and 91-96 the trial maps.
STORY = range(1, 32)
# Variants of a person that only stand in for them in a scene or one map (PID_IKE_EV1, PID_BOLE_MAP1).
SCENE_SUFFIXES = ('_EV', '_EV1', '_EV2', '_EV3', '_MAP1', '_MAP9')

# Joins the scripts make on a condition, read from the scripts named here. What isn't traced yet is said
# under `unconfirmed`, not as fact.
CONDITIONS = {
    # C30's RestoreSallyDisposition and Opening1: bmap30_m02_c (Nasir) if G_漆黒の騎士倒した is set, else
    # bmap30_m01_c (Ena). C29's handler 11 sets the flag when the Black Knight falls.
    'PID_NASIR': 'Joins if the Black Knight was defeated in {c29}; otherwise Ena joins instead.',
    'PID_ENA': 'Joins if the Black Knight was not defeated in {c29}; otherwise Nasir joins instead.',
    # C31's turn-3 handlers place bmap31_m_tibarn_c, _m_naesala_c or _m_giffca_c by BMGetValue(0) = 0, 1, 2.
    'PID_TIBARN': 'One of Tibarn, Naesala and Giffca joins; Tibarn when the value the script reads is 0.',
    'PID_NAESALA': 'One of Tibarn, Naesala and Giffca joins; Naesala when the value the script reads is 1.',
    'PID_GIFFCA': 'One of Tibarn, Naesala and Giffca joins; Giffca when the value the script reads is 2.',
}
UNCONFIRMED = {
    'PID_TIBARN': 'What sets the value (BMGetValue(0)) is not traced. Serenes Forest: you choose one of the three.',
    'PID_NAESALA': 'What sets the value (BMGetValue(0)) is not traced. Serenes Forest: you choose one of the three.',
    'PID_GIFFCA': 'What sets the value (BMGetValue(0)) is not traced. Serenes Forest: you choose one of the three.',
    'PID_NASIR': "C30's and C31's Opening0 also set the flag, beside the debug starts' joins (always_dbg_*); taken as the debug path.",
    'PID_ENA': "C30's and C31's Opening0 also set the flag, beside the debug starts' joins (always_dbg_*); taken as the debug path.",
    'PID_KILROY': 'Serenes Forest lists Rhys at 22 HP, 0 Str, 10 Mag, 8 Skl, 5 Spd, 8 Lck, 0 Def, 14 Res; the data gives the numbers here.',
}


class Reloc:
    """A pointer-relocated file inside a .cmp (dispos_*.bin): data at 0x20, then pointer offsets and table names."""

    def __init__(self, d):
        _, size, n_ptrs, n_names = struct.unpack_from('>4I', d, 0)
        ptrs_at = 0x20 + size
        names_at = ptrs_at + n_ptrs * 4
        strings_at = names_at + n_names * 8
        self.data = d[0x20:0x20 + size]
        self.ptrs = set(struct.unpack_from(f'>{n_ptrs}I', d, ptrs_at))
        self.tables = sorted((struct.unpack_from('>I', d, names_at + k * 8)[0],
                              self._c(d, strings_at + struct.unpack_from('>I', d, names_at + k * 8 + 4)[0]))
                             for k in range(n_names))

    @staticmethod
    def _c(d, o):
        return d[o:d.index(b'\0', o)].decode('shift_jis')

    def string(self, o):
        if o not in self.ptrs:
            return None
        return self._c(self.data, struct.unpack_from('>I', self.data, o)[0])


def placed(n):
    """Every unit in chapter file n's placement groups, any difficulty: [(group, PID, JID, level, side)]."""
    out = []
    for name, raw in map_files(f'bmap{n:02d}', 'dispos').items():
        if not name.startswith('dispos'):
            continue
        r = Reloc(raw)
        for o, group in r.tables:
            p = o + 4
            for _ in range(r.data[o]):
                b = r.data[p:p + 108]
                out.append((group, r.string(p), r.string(p + 4), b[96], b[97]))
                p += 108
    return out


def calls(script, h):
    """A handler's calls with their literal arguments: [(name, [args])]."""
    stack, out = [], []
    for _, op, a in script.disasm(h):
        if op in ('str', 'int'):
            stack.append(a)
        elif op == 'call':
            fn, argc = a.split('/')
            argc = int(argc)
            args = stack[len(stack) - argc:] if argc else []
            del stack[len(stack) - argc:]
            out.append((fn, args))
    return out


def chapter_label(text, n):
    """9 -> 'Ch.8', 29 -> 'Ch.27-2', 31 -> 'Endgame' (the chapter title before its colon)."""
    return text[f'MCT{n:02d}'].split(':')[0]


def chapter_id(text, n):
    """9 -> 'fe9-8', the same ids as the Armory's maps."""
    return 'fe9-' + chapter_label(text, n).lower().replace('ch.', '').replace(' ', '')


# Calls that set a placement group down on the map.
PLACING = ('InstantDisposFirst', 'InstantDispos', 'InstantDisposContinue', 'Dispos', 'DisposContinue', 'DisposAsynchronous',
           'SallyAddByGroup')


def always_groups():
    """zmap/always/dispos.cmp: the groups `Join` adds to your army ({group: [PID]}), outside any map."""
    r = Reloc(map_files('always', 'dispos')['dispos_c.bin'])
    out = {}
    for o, group in r.tables:
        p = o + 4
        for _ in range(r.data[o]):
            out.setdefault(group, []).append(r.string(p))
            p += 108
    return out


def joins(t, persons):
    """{PID: (chapter file, how, partners, turn)}: the first chapter each person joins your army. `how` is 'start'
    (at the start of the chapter), 'base' (an Info conversation at the base before it), 'talk' (a talk hands them over:
    partners are who can talk to them) or 'event' (during the chapter; `turn` when a turn event sets them down).

    What joins someone, from the scripts:
    - `Join(group)` adds a group from zmap/always (Sothe, Calill, Largo at the base; Lethe, Mordecai, Tormod and Muarim
      at a chapter's start). Groups named `always_dbg_*` are the debug starts' and are skipped.
    - `UnitTransferToForceByPID(pid, 0)`.
    - A side-0 unit in a group the script sets down that isn't a deployment template: not `mikata`/`mik...` and not an
      `event` cutscene group (Ranulf's bmap24_m01_c, Bastian and Lucia's bmap25_m01_c on turn 2).
    - `InstantDisposFirst` on a `mikata` group: the first chapters set down their new units this way.
    The other `mikata` groups are deployment templates that can list units before they join (Ranulf in Ch.21's), so
    they count only for a unit nothing else joins (Geoffrey).
    """
    always = always_groups()
    found, fallback = {}, {}

    def add(pid, n, how, with_=(), turn=None):
        if pid in persons and not pid.endswith(SCENE_SUFFIXES) and pid not in found:
            found[pid] = (n, how, list(with_), turn)

    for n in STORY:
        units = {}
        for group, pid, _, _, side in placed(n):
            units.setdefault(group, []).append((pid, side))
        script = Script(f'C{n:02d}.cmb')
        handlers = script.handlers()
        # Talks (kind 8) name both speakers; a talk recruits whoever a handover in it, or in the function it calls, moves.
        talkers = {}
        for h in handlers:
            if h['kind'] == 8 and len(h['args']) >= 2:
                a, b = (script.string(x) for x in h['args'][:2])
                talkers.setdefault(b, []).append(a)
                talkers.setdefault(a, []).append(b)
        for h in handlers:
            opening = h['name'].startswith(('Opening', 'FinalDisposition', 'RestoreSally'))
            for fn, a in calls(script, h):
                if fn == 'Join' and a and a[0] in always and 'dbg' not in a[0]:
                    for pid in always[a[0]]:
                        add(pid, n, 'base' if h['kind'] == 14 else 'start')
                elif fn == 'UnitTransferToForceByPID' and len(a) == 2 and a[1] == 0:
                    with_ = [p for p in talkers.get(a[0], []) if p != a[0]]
                    if h['kind'] == 8 or (h['kind'] == 256 and with_):
                        add(a[0], n, 'talk', with_)
                    else:
                        add(a[0], n, 'start' if opening else 'event')
                elif fn in PLACING:
                    for group in a:
                        if not isinstance(group, str) or group not in units:
                            continue
                        base = group.split(f'bmap{n:02d}_', 1)[-1]
                        if 'event' in base:
                            continue
                        template = base.startswith('mik')
                        for pid, side in units[group]:
                            if side != 0:
                                continue
                            if not template:
                                turn = h['args'][0] if h['kind'] == 3 and h['args'] else None
                                add(pid, n, 'start' if opening or turn is None else 'event', turn=turn)
                            elif fn == 'InstantDisposFirst':
                                add(pid, n, 'start')
                            else:
                                fallback.setdefault(pid, n)
    for pid, n in fallback.items():
        add(pid, n, 'start')
    return found


def ranks(s):
    """'-CA------' -> {'lance': 'C', 'axe': 'A'}. '*' is a type picked at promotion."""
    return {k: c for k, c in zip(RANK_TYPES, s) if c != '-'}


def visible(sids, sk):
    """Only skills the game names and explains (the rest are flags: SID_HERO, SID_FLY, SID_HIGHER...)."""
    return [s for s in sids if s in sk and sk[s]['help']]


def main():
    t = Tables()
    text = t.text
    persons, jobs, sk = people(t), classes(t), skills(t)
    joined = joins(t, persons)
    order = sorted(joined, key=lambda p: (joined[p][0], persons[p]['name']))
    c29 = chapter_label(text, 29)

    used = set()
    units = []
    for pid in order:
        p = persons[pid]
        n, how, with_, turn = joined[pid]
        c = jobs[p['jid']]
        used.add(p['jid'])
        unit = {
            'id': pid, 'name': p['name'], 'classId': p['jid'], 'level': p['level'],
            'joinChapter': chapter_id(text, n),
            'join': {'how': how, **({'with': sorted({persons[w]['name'] for w in with_ if w in persons})} if with_ else {}),
                     **({'turn': turn} if turn else {})},
            'affinity': text[AFFINITY_LABELS[p['affinity']]],
            'bases': {s: c['bases'][s] + p['bases'][s] for s in STATS},
            'growths': p['growths'],
            'con': c['con'] + p['con'], 'wt': c['wt'] + p['wt'],
            'ranks': ranks(p['ranks']),
            'skills': visible(p['skills'], sk),
        }
        if pid in CONDITIONS:
            unit['join']['note'] = CONDITIONS[pid].format(c29=c29)
        if pid in UNCONFIRMED:
            unit['unconfirmed'] = UNCONFIRMED[pid]
        units.append(unit)

    # The classes your units start in, what those promote or transform into, and the promoted classes a choice
    # at promotion leads to.
    queue = list(used)
    while queue:
        j = queue.pop()
        other = jobs[j]['other']
        if other and other in jobs and other not in used:
            used.add(other)
            queue.append(other)
    out_classes = {}
    for j in sorted(used):
        c = jobs[j]
        promoted = 'SID_HIGHER' in c['skills']
        laguz = 'alize' in c['attributes']
        out_classes[j] = {
            'id': j, 'name': c['name'], 'tier': 'promoted' if promoted else 'base', 'laguz': laguz,
            **({'transformed': 'SID_LYCANTHROPE' in c['skills'] or c['attributes'][1:2] in (['beast'], ['bird'], ['dragon'])} if laguz else {}),
            **({'promotesTo': c['other']} if c['other'] and not promoted and not laguz else {}),
            **({'transformsTo': c['other']} if laguz and c['other'] else {}),
            'bases': c['bases'], 'caps': c['caps'], 'mov': c['mov'], 'con': c['con'], 'wt': c['wt'],
            'capacity': c['capacity'], 'ranks': ranks(c['ranks']), 'skills': visible(c['skills'], sk),
        }

    # Each skill's scroll is the item named like it (SID_AMBUSH -> IID_AMBUSH, "Vantage"); the mastery skills are
    # learned from the Occult scroll (IID_ESOTERIC, first in the skill's list at +0x20). A scroll item the game
    # gives no name (Daunt's, Celerity's, Tempest's...) is taken as never handed out.
    item_names = {}
    o = t.named['ItemData']
    for k in range(t.u32(o)):
        p = o + 4 + k * 96
        item_names[t.ptr_string(p)] = t.name(t.ptr_string(p + 4))

    def scroll_of(sid):
        first = t.u32(t.named[sid] + 0x20)
        if first and t.g.string(t.u32(first)) == 'IID_ESOTERIC':
            return item_names.get('IID_ESOTERIC') or None
        return item_names.get('IID_' + sid[4:]) or None

    # Skills that can be learned or carried (a capacity, or a unit's or class's own).
    out_skills = {}
    learnable = set()
    for s in sk.values():
        if s['help'] and (s['capacity'] or s['flag']):
            learnable.add(s['sid'])
    shown = learnable | {s for u in units for s in u['skills']} | {s for c in out_classes.values() for s in c['skills']}
    for sid in sorted(shown, key=lambda s: sk[s]['index']):
        s = sk[sid]
        o = t.named[sid]
        only = [t.g.string(t.u32(t.u32(o + 0x24) + 4 * i)) for i in range(s['count'])] if t.u32(o + 0x24) else []
        out_skills[sid] = {
            'id': sid, 'name': s['name'], 'description': s['help'], 'capacity': s['capacity'],
            'removable': bool(s['flag']),
            **({'scroll': scroll_of(sid)} if scroll_of(sid) else {}),
            **({'onlyClasses': sorted({x for x in only if x.startswith('JID_')})} if any(x.startswith('JID_') for x in only) else {}),
            **({'onlyUnits': sorted({x for x in only if x.startswith('PID_')})} if any(x.startswith('PID_') for x in only) else {}),
        }

    # Supports: the totals RelianceData stores for C, B and A. Serenes Forest's chapter counts are these less the
    # levels already reached, for every pair (checked in the tests).
    out_supports = []
    seen = set()
    for a, b, (c_, b_, a_) in supports(t):
        if not b or a not in persons or b not in persons:
            continue
        key = tuple(sorted((a, b)))
        if key in seen:
            continue
        seen.add(key)
        out_supports.append({'a': key[0], 'b': key[1], 'points': [c_, b_, a_]})

    chapters = [{'id': chapter_id(text, n), 'label': chapter_label(text, n),
                 'title': ' '.join(text[f'MCT{n:02d}'].split(':', 1)[-1].split())} for n in STORY]

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    lines = [
        '// Generated by scripts/build-fe9-units.py from the user\'s own Path of Radiance files. Don\'t edit by hand.',
        "import type { TelliusChapter, TelliusClass, TelliusSkill, TelliusSupport, TelliusUnit } from '../../tellius/types'",
        '',
        f'export const FE9_CHAPTERS: TelliusChapter[] = {js(chapters)}',
        '',
        'export const FE9_UNITS: TelliusUnit[] = [',
        *[f'  {js(u)},' for u in units],
        ']',
        '',
        'export const FE9_CLASSES: Record<string, TelliusClass> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in out_classes.items()],
        '}',
        '',
        'export const FE9_SKILLS: Record<string, TelliusSkill> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in out_skills.items()],
        '}',
        '',
        'export const FE9_SUPPORTS: TelliusSupport[] = [',
        *[f'  {js(s)},' for s in out_supports],
        ']',
        '',
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(units)} units, {len(out_classes)} classes, {len(out_skills)} skills, {len(out_supports)} supports -> {OUT}')


if __name__ == '__main__':
    main()
