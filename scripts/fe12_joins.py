"""
Who joins New Mystery of the Emblem's army, where and how (data-raw/fe12/README.md), read from the placements, the chapters' scripts
(script/*.cmb, `scripts/fe12_cmb.py`) and their text:

- The placements (dispos/, 88-byte records; scripts/fe12_data.py `dispos`): a person placed on your side (+8 army 0) with the flag
  0x80 is created there if they aren't in the army yet (overlay 00 0x2205b5c: without 0x80, or with 0x02 / 0x04 / 0x08 / 0x200,
  a record only places a unit that already exists). The prologue's B groups (bmap204 / 206 / 207: mikataB, firstB, m01B...) are the
  chapter's other version (its own script, bmap204B.cmb...), picked by the first answer at the end of the chapter before.
- When a group is placed is the handler of the chapter's scripts that places it (`group_when`): the map's begin or its opening (the
  start), a turn handler (that turn), its Ending (after the battle), a village of its terrain script (a visit). A group no handler
  places is never placed (Prologue III's Norne).
- The chapters' text (m/NNN): MSnnn_TKn are the talks, MSnnn_VILn the villages; each message names the faces it shows
  ('\x06\x08MATIS|'). A talk with a person placed on the foe's side recruits them (the talkers: the other faces).
- The gaiden chapters' requirements are read from the scripts (`gaiden`): each FlagSet of the chapter's gf_<n>ｘ分岐 flag at the end
  of the chapter before, under the checks just before it.

Units who join in the prologue and leave at its end (they aren't in Chapter 1's deployment, and Prologue VIII's ending has their
goodbyes, MS208_ED3_*) come back where they're next placed with 0x80. (An earlier dump of the cartridge had the scripts zeroed; the
timings and requirements were Serenes Forest's then, and every timing matched.)
"""
import os
import re
import struct
from collections import OrderedDict

import fe12_data as D
from fe12_cmb import Script

# (dispos file, chapter id suffix, label) in story order; gaiden chapters after the chapter that opens them.
STORY = [
    ('bmap201', 'p1', 'Prologue I'), ('bmap202', 'p2', 'Prologue II'), ('bmap203', 'p3', 'Prologue III'),
    ('bmap204', 'p4', 'Prologue IV'), ('bmap205', 'p5', 'Prologue V'), ('bmap206', 'p6', 'Prologue VI'),
    ('bmap207', 'p7', 'Prologue VII'), ('bmap208', 'p8', 'Prologue VIII'),
    ('bmap001', '1', 'Ch. 1'), ('bmap002', '2', 'Ch. 2'), ('bmap003', '3', 'Ch. 3'), ('bmap103', '3x', 'Ch. 3x'),
    ('bmap004', '4', 'Ch. 4'), ('bmap005', '5', 'Ch. 5'), ('bmap006', '6', 'Ch. 6'), ('bmap106', '6x', 'Ch. 6x'),
    ('bmap007', '7', 'Ch. 7'), ('bmap008', '8', 'Ch. 8'), ('bmap009', '9', 'Ch. 9'), ('bmap010', '10', 'Ch. 10'),
    ('bmap110', '10x', 'Ch. 10x'), ('bmap011', '11', 'Ch. 11'), ('bmap012', '12', 'Ch. 12'), ('bmap013', '13', 'Ch. 13'),
    ('bmap113', '13x', 'Ch. 13x'), ('bmap014', '14', 'Ch. 14'), ('bmap015', '15', 'Ch. 15'), ('bmap016', '16', 'Ch. 16'),
    ('bmap116', '16x', 'Ch. 16x'), ('bmap017', '17', 'Ch. 17'), ('bmap018', '18', 'Ch. 18'), ('bmap019', '19', 'Ch. 19'),
    ('bmap020', '20', 'Ch. 20'), ('bmap120', '20x', 'Ch. 20x'), ('bmap021', '21', 'Ch. 21'), ('bmap022', '22', 'Ch. 22'),
    ('bmap023', '23', 'Ch. 23'), ('bmap024', 'final', 'Endgame'),
]
KEY = {k: i for i, (k, _, _) in enumerate(STORY)}
PLAYABLE = range(0, 77)          # PID_MARS .. PID_ERICE (77 is PID_DUMMY; the rest are foes, generics and the extra chapters' casts)
ARMY_YOURS, ARMY_FOE = 0, 1
CREATE = 0x80
# Faces a message shows that stand for a person under another face name.
FACE_ALIAS = {'Y_MISHEIL': 'PID_MISHEIL', 'Y_MINERBA': 'PID_MINERBA', 'S_RENA': 'PID_RENA', 'S_MARIA': 'PID_MARIA',
              'S_NIENA': 'PID_NIENA', 'S_ERICE': 'PID_ERICE', 'PLAYER': 'PID_PLAYER'}
# Placements that create a person for a scene, not a join: Nyna, Elice, Maria and Lena in Ch. 20's ending (its Ending places them, and
# Gharnef takes them; the Endgame's talks recruit them).
SCENE = {('bmap020', 'ed01')}
# Recruited from the foe's side with no talk in the text: Tiki by her talk handler with Marth (bmap014's, type 0x08); Caesar and Radd
# handed over by Ch. 6x's Ending (UnitTransfer).
FOE_HOW = {
    ('bmap014', 'PID_TIKI'): ('talk', ['PID_MARS']),
    ('bmap106', 'PID_SEAZER'): ('end', []),
    ('bmap106', 'PID_RADEI'): ('end', []),
}
# Units who join in the prologue only for one answer to a choice at the end of the chapter before (the B groups are the first answer).
CHOICE_UNITS = {'PID_GOHDON', 'PID_ATHENA', 'PID_OGUMA', 'PID_DOHGA', 'PID_EST', 'PID_KAIN'}
# Where the placements don't hold a recruit: the scripts' conditions (Serenes Forest's where it says so).
NOTES = {
    'PID_GOHDON': 'Joins at the end of Prologue IV if the second answer was picked at the end of Prologue III (Jeorge is the '
                  'opponent); otherwise at the start of Ch. 1, as the Ch. 1 deployment creates him (flag 0x80).',
    'PID_ATHENA': 'Joins at the end of Prologue IV if the first answer was picked at the end of Prologue III (she is the opponent); '
                  'leaves after Prologue VIII (MS208_ED3_3B); otherwise first in Ch. 13x.',
    'PID_OGUMA': 'Joins at the end of Prologue VI if the second answer was picked at the end of Prologue V (he is the opponent); '
                 'leaves after Prologue VIII (MS208_ED3_1_2A); otherwise first at the start of Ch. 4.',
    'PID_DOHGA': 'Joins at the end of Prologue VI if the first answer was picked at the end of Prologue V (he is the opponent); '
                 'otherwise at the start of Ch. 1, as the Ch. 1 deployment creates him (flag 0x80).',
    'PID_EST': 'Joins at the end of Prologue VII if the second answer was picked at the end of Prologue VI (she is the opponent); '
               'leaves after Prologue VIII (MS208_ED3_1A); otherwise first at the start of Ch. 15.',
    'PID_KAIN': 'Joins at the end of Prologue VII if the first answer was picked at the end of Prologue VI (he is the opponent); '
                'otherwise first at the start of Ch. 8.',
    'PID_RICARD': 'Talk with Julian in Ch. 5, or in Ch. 6 if not recruited in Ch. 5 (he comes as a reinforcement there).',
    'PID_JORJUE': 'Only if he wasn\'t killed in Ch. 5, where he fights you: Ch. 8 places him unless the flag his death sets.',
    'PID_ASTRIA': 'Only if he wasn\'t killed in Ch. 7, 8 or 9, where he fights you: Ch. 16 places him unless the flag his death sets.',
    'PID_TIKI': 'Talk with Marth; needs the Starsphere (Serenes Forest).',
    'PID_SEAZER': "Clear Ch. 6x without killing him: its Ending hands him over (the ending has him surrender, MS106_ED1A).",
    'PID_RADEI': "Clear Ch. 6x without killing him: its Ending hands him over (MS106_ED1C has Marth hire him).",
    'PID_KATARINA': 'Talk with Kris three times (MS116_TK1-3).',
    'PID_SIMA': 'Talk with Marth, only while no Gra soldier has been killed (the talk\'s check counts them); killing one later while '
                'she lives turns her and Samson back into foes (Serenes Forest).',
    'PID_SAMSON': 'Talk with Sheema once she has joined.',
    'PID_BIRAKU': 'Comes with the reinforcements of Ch. 19\'s second area, unless he was killed in Ch. 18.',
    'PID_MISHEIL': 'In Ch. 21, Minerva steps onto the village by turn 15 while it\'s unvisited, then a unit visits it; he joins once '
                   'the chapter ends (its Ending places him; MS021_EV2 / MS021_VIL1).',
    'PID_DICE': "Joins at the end of Ch. 10 (its Ending places him), for Ch. 10x.",
    'PID_MARIS': "Joins at the end of Ch. 10 (its Ending places her), for Ch. 10x.",
}
FACE = re.compile(r'[\x06\x07\x0b\x0c]\x08([A-Za-z_0-9]+)\|')


TURNS, VILLAGE = (0x03, 0x17), 9


def script(key):
    p = os.path.join(D.ROM, 'script', key + '.cmb')
    return Script(p) if os.path.exists(p) else None


def trigger(s, h):
    return struct.unpack_from('<I', s.d, s.offs[h['index']] + 0xc)[0] & 0xFFFF


def group_when(key):
    """{group: (how, turn)}: the handler of the chapter's scripts that places each group (a Dispos call): the map's begin or opening, or
    its first turn's player phase ('start'), a later turn's handler ('event', the turn), its Ending ('end'), a village of its terrain
    script ('visit'). A prologue chapter with a second version adds that version's scripts (bmap204B...)."""
    out = {}
    for k in (key, key + 'B'):
        for s, ter in ((script(k), False), (script(k + '_ter'), True)):
            for h in s.handlers() if s else []:
                if ter:
                    if len(h['args']) < 3 or h['args'][2] != VILLAGE:
                        continue
                    w = ('visit', None)
                elif h['name'] in ('MapBegin', 'Opening'):
                    w = ('start', None)
                elif h['name'] == 'Ending':
                    w = ('end', None)
                elif trigger(s, h) in TURNS and h['args'][0]:
                    first, _, phase = h['args'][:3]
                    w = ('start', None) if first == 1 and phase == 0 else ('event', first)
                else:
                    continue
                for fn, a in s.calls(h):
                    if fn.startswith('Dispos') and fn != 'DisposWait' and a and isinstance(a[0], str):
                        out.setdefault(a[0], w)
    return out


# GetNormalizeTurn (arm9 0x2028510): a turn limit times 100, 120, 140, 160 or 180% (Normal, Hard, Maniac, Lunatic, Reverse Lunatic).
NORMALIZE = (('Hard', 120), ('Maniac', 140), ('Lunatic', 160), ('Reverse Lunatic', 180))
ZENKAKU = str.maketrans('0123456789', '０１２３４５６７８９')
GAIDEN_FLAG = 'gf_{}ｘ分岐'   # gf_<n>ｘ分岐
SHIELD = '封印の盾完成'   # 封印の盾完成


def _name(pid):
    from fe12_names import english
    p = next(p for p in D.persons() if p['pid'] == pid)
    if pid == 'PID_PLAYER':
        return english(D.say('MPID_PLAYER_DEFAULT'))
    return english(D.say('MPID_' + p['fid'][4:]) or D.say('MPID_' + p['pid'][4:]))


def gaiden():
    """{'3x': requirement...}: what opens each gaiden chapter, read from the end of the chapter before (each FlagSet of its gaiden flag,
    gf_<n>ｘ分岐, under the checks just before it): cleared by a turn (GetTurn() <= GetNormalizeTurn(n), the limit scaled by the mode),
    no foe escaped (IsEnemyEscape), someone in your army (ForceUnitCheckPID), so many of a list, Kris promoted at a level, so many of the
    chapter's foes left (GetCountSamePID). Prologue VIII's ChapterNext sets 3x's flag too, and Ch. 20 goes on only once the Binding
    Shield is completed (its ChapterNext checks 封印の盾完成 first, else BadEnd)."""
    out = {}
    for before, n in (('bmap003', 3), ('bmap006', 6), ('bmap010', 10), ('bmap013', 13), ('bmap016', 16), ('bmap020', 20)):
        s = script(before)
        ops = s.disasm(next(h for h in s.handlers() if h['name'] == 'Ending'))
        flag = GAIDEN_FLAG.format(str(n).translate(ZENKAKU))
        counted = {ops[k][2]: ops[k + 1][2] for k in range(len(ops) - 2)
                   if ops[k][1] == 'addr' and ops[k + 1][1] == 'str' and ops[k + 2][1] == 'call' and ops[k + 2][2][0] == 'GetCountSamePID'}
        ways, start = [], 0
        for k, (_, op, v) in enumerate(ops):
            if not (op == 'call' and v[0] == 'FlagSet' and ops[k - 1][2] == flag):
                continue
            seg, start = ops[start:k], k + 1
            calls = [x[2][0] for x in seg if x[1] == 'call']
            pids = list(dict.fromkeys(x[2] for x in seg if x[1] == 'str' and x[2].startswith('PID_')))
            last_int = next((x[2] for x in reversed(seg) if x[1] == 'int'), None)
            if 'GetNormalizeTurn' in calls:
                i = next(i for i, x in enumerate(seg) if x[1] == 'call' and x[2][0] == 'GetNormalizeTurn')
                t = seg[i - 1][2]
                ways.insert(0, f"Ch. {n} is cleared by turn {t} (" + ', '.join(f'{t * pct // 100} on {mode}' for mode, pct in NORMALIZE)
                            + ')')
            elif 'IsEnemyEscape' in calls:
                ways.append('no foe has escaped the map')
            elif 'UnitIsHighJob' in calls:
                ways.append(f'{_name("PID_PLAYER")} is promoted and Lv {last_int} or over')
            elif 'ForceUnitCheckPID' in calls and len(pids) == 1:
                ways.append(f'{_name(pids[0])} is in your army')
            elif 'ForceUnitCheckPID' in calls:
                names = [_name(p) for p in pids]
                ways.append(f"{last_int} or more of {', '.join(names[:-1])} and {names[-1]} are in your army")
            elif any(x[1] == 'local' and x[2] in counted for x in seg):
                pid = counted[next(x[2] for x in seg if x[1] == 'local' and x[2] in counted)]
                count = sum(1 for us in D.dispos(before).values() for u in us if D.persons()[u['person']]['pid'] == pid)
                ways.append(f'{last_int} or more of the {count} enemy Clerics are still on the map')
            else:
                raise AssertionError((before, seg[-10:]))
        text = ways[0] + (', or ' + ', or '.join(ways[1:]) + ' when it ends' if len(ways) > 1 else '')
        if n == 3:
            s8 = script('bmap208')
            ops8 = s8.disasm(next(h for h in s8.handlers() if h['name'] == 'ChapterNext'))
            k = next(k for k, (_, op, v) in enumerate(ops8) if op == 'str' and v == flag)
            assert ops8[k - 2][1] == 'op32', ops8[k - 4:k]
            text += f'; or no more than {ops8[k - 3][2]} of your units fell in the prologue'
        if n == 20:
            s20 = script('bmap020')
            nxt = [v for _, op, v in s20.disasm(next(h for h in s20.handlers() if h['name'] == 'ChapterNext')) if op == 'str']
            assert nxt[0] == SHIELD, nxt
            text += '; and only once the Binding Shield is completed in Ch. 20 (without it the game ends there)'
        out[f'{n}x'] = text[0].upper() + text[1:] + '.'
    return out


GAIDEN = gaiden()


def chapter_id(key):
    return 'fe12-' + STORY[KEY[key]][1]


def chapter_label(key):
    return STORY[KEY[key]][2]


_faces = None


def faces_to_pids():
    """{face name (as the text writes it): PID} from the people's FIDs."""
    global _faces
    if _faces is None:
        _faces = {}
        for p in D.persons():
            if p['fid'] and p['pid'] and p['index'] in PLAYABLE:
                _faces.setdefault(p['fid'][4:], p['pid'])
        _faces.update(FACE_ALIAS)
    return _faces


def scenes(key):
    """[(label, kind 'TK' / 'VIL', group number, {PIDs shown})] from a chapter's text."""
    num = key[4:]
    f2p = faces_to_pids()
    try:
        t = D.text_of(num)
    except FileNotFoundError:
        return []
    out = []
    for label, s in t.items():
        m = re.match(r'MS\d+_(TK|VIL)(\d+)', label)
        if m:
            out.append((label, m.group(1), int(m.group(2)), {f2p[f] for f in FACE.findall(s) if f in f2p}))
    return out


def variant(group):
    """'B' for the prologue's other version of a chapter (mikataB, m01B...), else ''."""
    return 'B' if group.endswith('B') and len(group) > 1 and group[-2].isdigit() or group in ('mikataB', 'firstB') else ''


def joins():
    """{pid: {key, chapter, how, with (PIDs), turn, unit (the placement record), group, variant, returns, alt}} in join order.

    `returns`: for a unit who joins in the prologue and isn't in Ch. 1's deployment (so leaves after Prologue VIII), the placement
    that brings them back. `alt`: for a unit the prologue's choices bring in early (CHOICE_UNITS), the placement that brings them in
    when the other answer was picked."""
    P = D.persons()
    pid = {p['index']: p['pid'] for p in P}
    out = OrderedDict()
    later = OrderedDict()   # pid -> [creation placements after their first join]
    for key, _, _ in STORY:
        groups = D.dispos(key)
        when = group_when(key)
        tk = {}
        for label, kind, n, who in scenes(key):
            tk.setdefault((kind, n), set()).update(who)
        # Your side first (a talker can join earlier in the same chapter: Julian before Matthis, Catria before Warren).
        for gname, units in groups.items():
            for u in units:
                if u['person'] not in PLAYABLE or u['army'] != ARMY_YOURS or not u['flags'] & CREATE or (key, gname) in SCENE:
                    continue
                p = pid[u['person']]
                how, turn, with_ = 'start', None, []
                if not gname.startswith('mikata'):
                    if gname not in when:
                        continue   # no handler places it (Prologue III's Norne)
                    how, turn = when[gname]
                    # A village's recruit: its message shows Marth (the face), as the visitor.
                    if how == 'visit' and any(kind == 'VIL' and p in who for (kind, n), who in tk.items()):
                        with_ = ['PID_MARS']
                ev = {'key': key, 'chapter': chapter_id(key), 'how': how, 'turn': turn, 'with': with_, 'unit': u, 'group': gname,
                      'variant': variant(gname)}
                if p not in out:
                    out[p] = dict(ev, returns=[], alt=None)
                elif out[p]['key'] != key:
                    later.setdefault(p, []).append(ev)
        # Then the foe's side, repeated until nothing changes (Vyland, then Sedgar through him, then Wolf through Sedgar).
        changed = True
        while changed:
            changed = False
            for gname, units in groups.items():
                for u in units:
                    if u['person'] not in PLAYABLE or u['army'] != ARMY_FOE or pid[u['person']] in out:
                        continue
                    p = pid[u['person']]
                    talkers = set()
                    for (kind, n), who in tk.items():
                        if kind == 'TK' and p in who:
                            talkers |= who - {p}
                    talkers = sorted(t for t in talkers if t in out)
                    how = ('talk', talkers) if talkers else FOE_HOW.get((key, p))
                    if how:
                        out[p] = {'key': key, 'chapter': chapter_id(key), 'how': how[0], 'turn': None, 'with': list(how[1]),
                                  'unit': u, 'group': gname, 'variant': '', 'returns': [], 'alt': None}
                        changed = True
    prologue = {k for k, c, _ in STORY if c.startswith('p')}
    ch1 = {pid[u['person']] for u in D.dispos('bmap001').get('mikata', [])}
    for p, j in out.items():
        after = [e for e in later.get(p, []) if e['key'] not in prologue]
        if p in CHOICE_UNITS:
            j['alt'] = after[0] if after else None
            if j['alt'] and j['alt']['key'] == 'bmap001':
                continue
        if j['key'] in prologue and p not in ch1 and after:
            j['returns'] = [after[0]]
    return out


if __name__ == '__main__':
    P = {p['pid']: p for p in D.persons()}
    for p, j in joins().items():
        u = j['unit']
        print(f"{p[4:]:10} {chapter_label(j['key']):14} {j['how']:6} {j['turn'] or '':2} {','.join(w[4:] for w in j['with']):18} "
              f"L{u['level']:>2} {D.jobs()[u['job']]['jid'][4:]:16} {j['group']:8} {j['variant']} "
              f"{'back: ' + chapter_label(j['returns'][0]['key']) if j['returns'] else ''} "
              f"{'else: ' + chapter_label(j['alt']['key']) + ' ' + j['alt']['how'] if j['alt'] else ''}")
