"""
Who joins New Mystery of the Emblem's army, where and how (data-raw/fe12/README.md).

The user's cartridge image has the chapters' scripts (script/*.cmb) zeroed out: every byte of all 119 is 0, and the DSi digest table
on the cartridge (+0x5340800, an HMAC per 1 KB sector) shows those sectors weren't zero when it was made (20,611 sectors of the image
were blanked: the scripts, the small faces sf/, the sound, some battle animations). So the joins come from what is intact:

- The placements (dispos/, 88-byte records; scripts/fe12_data.py `dispos`): a person placed on your side (+8 army 0) with the flag
  0x80 is created there if they aren't in the army yet (overlay 00 0x2205b5c: without 0x80, or with 0x02 / 0x04 / 0x08 / 0x200,
  a record only places a unit that already exists). The group names say when: 'mikata' (the deployment, at the start), 'op' (the
  opening), 'ed' (the ending), 'mNN' (placed during the chapter by its script). The prologue's B groups (bmap204 / 206 / 207:
  mikataB, firstB, m01B...) are the chapter's other version, picked by the first answer at the end of the chapter before.
- The chapters' text (m/NNN): MSnnn_TKn are the talks, MSnnn_VILn the villages; each message names the faces it shows
  ('\\x06\\x08MATIS|'). A talk with a person placed on the foe's side recruits them; a village whose message shows a person placed on
  your side during the chapter recruits them (Marth visits: the other face).
- When an 'mNN' group is placed (the start, a turn, the end) the scripts decided; that, the chapter conditions and the gaiden chapters'
  requirements are Serenes Forest's (GROUP_HOW, NOTES), checked against the text where it shows them.

Units who join in the prologue and leave at its end (they aren't in Chapter 1's deployment, and Prologue VIII's ending has their
goodbyes, MS208_ED3_*) come back where they're next placed with 0x80.
"""
import re
from collections import OrderedDict

import fe12_data as D

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
# Placements that create a person for a scene, not a join (the text shows them leaving, or Serenes Forest has them join later).
SCENE = {
    ('bmap203', 'm01'),   # Norne on your side in Prologue III: Serenes Forest lists no Norne in the prologue (see NOTES).
    ('bmap020', 'ed01'),  # Nyna, Elice, Maria and Lena in Ch. 20's ending: taken by Gharnef; recruited in the Endgame.
}
# When the scripts place an 'mNN' group (Serenes Forest's recruitment table; the text agrees where noted).
GROUP_HOW = {
    ('bmap204', 'm01'): ('end', None),     # Gordin, after beating Jeorge (MS204_ED1_A shows him)
    ('bmap204', 'm01B'): ('end', None),    # Athena, after beating her (MS204_ED1_B: 'Athena lends you her strength')
    ('bmap205', 'm01'): ('event', 2),      # Merric, turn 2
    ('bmap206', 'm01'): ('start', None),   # Cecil
    ('bmap206', 'm01B'): ('start', None),
    ('bmap206', 'm02'): ('end', None),     # Ogma (MS206_ED1_A: 'call me if you need my strength')
    ('bmap206', 'm02B'): ('end', None),    # Draug (MS206_ED1_B)
    ('bmap207', 'm01'): ('end', None),     # Est
    ('bmap207', 'm01B'): ('end', None),    # Cain
    ('bmap002', 'm01'): ('start', None),   # Catria
    ('bmap002', 'm03'): ('end', None),     # Linde
    ('bmap003', 'm01'): ('start', None),   # Palla (MS003_OP1 shows her)
    ('bmap004', 'm02'): ('end', None),     # Caeda
    ('bmap004', 'm03'): ('start', None),   # Ogma, Yumina, Yubello
    ('bmap006', 'm01'): ('end', None),     # Wendell
    ('bmap006', 'm03'): ('event', 3),      # Frey and Norne, turn 3 (MS006_EV1 shows them)
    ('bmap007', 'm01'): ('start', None),   # Navarre, Feena
    ('bmap008', 'm02'): ('start', None),   # Cain
    ('bmap010', 'm01'): ('start', None),   # Merric
    ('bmap010', 'm02'): ('end', None),     # Dice and Maris (MS010_ED_BS shows them)
    ('bmap012', 'm01'): ('end', None),     # Robert, Belf, Leiden
    ('bmap014', 'm01'): ('start', None),   # Xane
    ('bmap015', 'm01'): ('start', None),   # Est
    ('bmap015', 'm02'): ('start', None),   # Dolph
    ('bmap016', 'm01'): ('start', None),   # Macellan
    ('bmap017', 'm02'): ('end', None),     # Frost
    ('bmap020', 'm01'): ('start', None),   # Midia
    ('bmap021', 'm01'): ('start', None),   # Ymir
    ('bmap021', 'm02'): ('end', None),     # Michalis, after his village (MS021_VIL1); from Ch. 22's preparations
    ('bmap022', 'm01'): ('start', None),   # Nagi
    ('bmap103', 'm01'): ('start', None),   # Wrys
    ('bmap110', 'm01'): ('start', None),   # Horace
    ('bmap113', 'm01'): ('start', None),   # Athena
}
# Recruited from the foe's side with no talk in the text: how (Serenes Forest).
FOE_HOW = {
    ('bmap014', 'PID_TIKI'): ('talk', ['PID_MARS']),
    ('bmap106', 'PID_SEAZER'): ('end', []),
    ('bmap106', 'PID_RADEI'): ('end', []),
}
# Units who join in the prologue only for one answer to a choice at the end of the chapter before (the B groups are the first answer).
CHOICE_UNITS = {'PID_GOHDON', 'PID_ATHENA', 'PID_OGUMA', 'PID_DOHGA', 'PID_EST', 'PID_KAIN'}
# Where the placements don't hold a recruit: the scripts' conditions (Serenes Forest's, unless it says the text).
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
    'PID_JORJUE': 'Only if he survived Ch. 5 (Serenes Forest).',
    'PID_ASTRIA': 'Only if Jeorge survived Ch. 7, 8 and 9 (Serenes Forest).',
    'PID_TIKI': 'Talk with Marth; needs the Starsphere (Serenes Forest).',
    'PID_SEAZER': 'Clear Ch. 6x without killing him (Serenes Forest; the ending has him surrender, MS106_ED1A).',
    'PID_RADEI': 'Clear Ch. 6x without killing him (Serenes Forest; MS106_ED1C has Marth hire him).',
    'PID_KATARINA': 'Talk with Kris three times (MS116_TK1-3).',
    'PID_SIMA': 'Talk with Marth, only if no Gra soldier has been killed; killing one later while she lives turns her and Samson back '
                'into foes (Serenes Forest).',
    'PID_SAMSON': 'Talk with Sheema once she has joined (Serenes Forest).',
    'PID_BIRAKU': 'Comes as a reinforcement in Ch. 19 (Serenes Forest).',
    'PID_MISHEIL': 'In Ch. 21, Minerva waits on the village before the end of turn 15, then Marth visits it; he joins once the '
                   'chapter ends (Serenes Forest; MS021_EV2 / MS021_VIL1).',
    'PID_DICE': 'Joins at the end of Ch. 10 (MS010_ED_BS), for Ch. 10x (Serenes Forest).',
    'PID_MARIS': 'Joins at the end of Ch. 10 (MS010_ED_BS), for Ch. 10x (Serenes Forest).',
    'PID_NORN': 'Unconfirmed: Prologue III also places her on your side (bmap203 m01), and Prologue VIII\'s ending has her go home '
                '("Ryan\'s injury will heal soon", MS208_ED3_4_2), so she seems to stand in for an injured Ryan; the script that '
                'decides it is missing from the dump.',
}
# The gaiden chapters' requirements (Serenes Forest's; the scripts that check them are missing).
GAIDEN = {
    '3x': 'The prologue was cleared with one or fewer of your units defeated (or retreated).',
    '6x': 'Rickard was recruited and is alive.',
    '10x': 'Three or more of the enemy Clerics survived.',
    '13x': "Neither of the enemy Thieves escaped the map.",
    '16x': "Kris is promoted and Lv 5 or over.",
    '20x': 'The Shield of Seals was obtained, and three or more of Roshea, Vyland, Sedgar, Wolf and Midia were recruited and are alive.',
}
FACE = re.compile(r'[\x06\x07\x0b\x0c]\x08([A-Za-z_0-9]+)\|')


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
                if gname.startswith('ed'):
                    how = 'end'
                elif gname.startswith('m') and not gname.startswith('mikata'):
                    if any(kind == 'VIL' and p in who for (kind, n), who in tk.items()):
                        how, with_ = 'visit', ['PID_MARS']
                    elif (key, gname) in GROUP_HOW:
                        how, turn = GROUP_HOW[(key, gname)]
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
