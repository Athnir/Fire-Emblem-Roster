"""
Build src/data/fe5/fe5Units.ts from the user's own Thracia 776 ROM (see data-raw/fe5/README.md): the playable units, when and how
they join and leave, their own stats, weapon points and skills, their classes and class changes, supports, the holy scrolls,
rings and skill manuals, and the story's picks of who joins.

Run: python scripts/build-fe5-units.py   (FE5_ROM overrides where the ROM is)
"""
import json
import os

import fe5_rom as r
from fe5_joins import HEADINGS, chapter_id, joins
from fe5_names import character_names, class_names, item_names

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'data', 'fe5', 'fe5Units.ts')
# The order of a character record's bases and growths, and of the scrolls' bonuses and the rings' rows.
GAME_STATS = ('hp', 'str', 'mag', 'skl', 'spd', 'def', 'con', 'lck', 'mov')
# The order a class record keeps its bases in (no Luck).
CLASS_STATS = ('hp', 'str', 'mag', 'skl', 'spd', 'def', 'con', 'mov')
STATS = ('hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'con', 'mov')
WEAPONS = ('sword', 'lance', 'axe', 'bow', 'staff', 'fire', 'thunder', 'wind', 'light', 'dark')
SUPPORTS = 0x8880CD    # 5-byte entries: gets u16, gives u16, bonus u8; ended by a 0 character ($83:E5A5)
SCROLLS = 0x888054     # 10-byte entries: item id, then a signed growth bonus per stat (GAME_STATS order) ($83:DDE0)
SCROLL_COUNT = 12
PROMOTIONS = 0x8882F1  # 3-byte entries: character u16, the class a Master Seal makes them; ended by a 0 character ($83:A9A6)
MOUNTED = 0x888000     # 28 mounted classes, and at DISMOUNTED_OF the class each becomes on foot ($87:9500)
DISMOUNTED_OF = 0x88801C
RING_GROWTHS = 0x888297  # 10-byte rows by (use effect - 2) / 2: growths (GAME_STATS order) / 4 for one level-up roll ($87:BCBF)
RINGS = range(125, 134)
CAP = 20                 # every stat but HP, shown and kept ($83:90BE, $83:DFC4)

# Skill bits (character +0x29-0x2B, class +0x13-0x15), named where the code tests them (data-raw/fe5/README.md). Mount (byte 0,
# 0x20) only marks a class that can dismount; the immortal and uncapturable bits are story protection, in the units' notes.
SKILL_BITS = {
    0: {0x01: 'Dance', 0x02: 'Steal', 0x08: 'Bargain', 0x10: 'Renewal', 0x40: 'Canto'},
    1: {0x01: 'Adept', 0x02: 'Charm', 0x08: 'Miracle', 0x10: 'Vantage', 0x20: 'Accost', 0x40: 'Pavise', 0x80: 'Nihil'},
    2: {0x01: 'Wrath', 0x02: 'Astra', 0x04: 'Luna', 0x08: 'Sol', 0x10: 'Paragon'},
}
# What each skill does, from the routines that test it.
SKILL_TEXT = {
    'Adept': '(Attack speed)% chance of a second hit right away, unless Astra fired. Works with brave weapons ($83:D6FC).',
    'Charm': '+10 hit and avoid to each unit of the same army 1 to 3 tiles away, not to the unit itself ($83:E342).',
    'Miracle': '(Luck x 3)% once a battle: if it comes up, a hit that would kill does no damage ($83:D4C5).',
    'Vantage': 'When attacked, strikes first if it can counter ($83:DC0D).',
    'Accost': 'With more HP and attack speed than the foe, one extra round of combat, once ($83:D66E).',
    'Pavise': '(Level)% chance to cancel a hit, unless the attacker\'s Luna or Sol fired ($83:D8A1).',
    'Nihil': "Cancels the foe's Adept, Charm, Miracle, Vantage, Accost, Pavise, Wrath, Astra, Luna and Sol, weapons' too ($83:D1D0).",
    'Wrath': 'Crit 100 on its counter turn, never on follow-ups ($83:D8C4).',
    'Astra': '(Skill)% chance of five hits in a row, ten with a brave weapon ($83:D6D8).',
    'Luna': "(Skill)% a hit: the foe's defence counts as 0 and the hit lands ($83:D843).",
    'Sol': '(Skill)% a hit: the hit lands and drains HP ($83:D86A).',
    'Paragon': 'Double EXP, up to 100 an action ($83:EFCA).',
    'Steal': 'Takes an item from an adjacent enemy with less Spd, if its weight is under the thief\'s Con ($87:99D8, $87:B517).',
    'Dance': 'Refreshes an adjacent unit so it can act again ($87:93B3).',
    'Bargain': 'Halves shop prices ($85:A1E1).',
    'Renewal': 'Heals 5 to 10% of max HP as each turn starts ($83:8335).',
    'Canto': 'Moves again after acting. Mounted classes have it; on foot it goes ($83:A7BA).',
}
# The skill manuals the chapters hold (items 158-167; using one teaches the skill for good, $87:BDAF). Found by playing every
# chapter's scripts and reading its units and shops; the Ch.6 house's script gives the Paragon Manual behind a branch the runner
# doesn't take ($99:A8A0). The Bargain and Miracle Manuals are in no chapter.
MANUALS = {
    158: ('A house in Ch.6', 'Ch.6'),
    162: ('A chest in Ch.8x', 'Ch.8x'),
    161: ('Carried by Colho in Ch.12', 'Ch.12'),
    159: ('A chest in Ch.12x', 'Ch.12x'),
    166: ('Ilios has it when he joins in 16A', 'Ch.16A'),
    165: ('Carried by Conomor in 16A', 'Ch.16A'),
    167: ('Carried by a Sellsword in 16B', 'Ch.16B'),
    163: ('Carried by Gustav in Ch.18', 'Ch.18'),
}

LEIF, LARA, LINOAN, MAREETA, SARA = 0x01, 0x0C, 0x26, 0x2A, 0x31
# Story class changes (the Master Seal's routine without its level check, $8A:8745 -> $87:C113).
STORY_PROMOTIONS = {
    LEIF: (0x2A, 'At the end of Ch.18, whatever his level ($E7:8AE7). He has no Master Seal entry.'),
    LINOAN: (0x67, 'When she visits the church in Ch.21 ($FD:E78C). She has no Master Seal entry.'),
}
STORY_STEPS = {
    LARA: (0x2D, 'If Lara is the one who recruits Perne in Ch.12x ($FD:9501). A Dancer can still use a Master Seal from Lv 10.'),
}
STORY_SKILLS = {MAREETA: ('Astra', 'Talk to Shannam with Mareeta in Ch.15, both armed ($FD:AD54).')}
# Leadership set by the scripts as a unit joins (it overrides the record; nothing else changes stars).
LEADERSHIP = {
    0x02: 1, 0x05: 1,           # Finn and Eyvel, the Ch.1 opening ($FD:8513, $FD:84FB)
    0x18: 0,                    # Perne, recruited in 12x ($FD:9437)
    0xD4: 0,                    # Ilios, 16A ($FD:B3EB)
    0x27: 0,                    # Misha, 17A ($FD:C41A)
    0xED: 1,                    # Xavier, Ch.18 ($E7:845A)
    0x2E: 1, 0x2D: 1,           # Conomor and Amalda, Ch.19 ($FD:CEA8, $FD:D0EF)
    0x32: 3,                    # Saias: 5 as a guest in Ch.23 ($FD:F9BB), 3 once he stays ($FD:FBA2)
}
LEADERSHIP_NOTES = {
    LEIF: '0 to start (1 during Ch.2x only), 1 from Ch.6, 2 from the end of Ch.9, 1 from the end of Ch.18 ($97:8244, $99:AE9E, '
          '$8C:F5D9, $E7:8AC9).',
    0x32: '5 while he\'s a guest in Ch.23, 3 once he stays.',
}
# Joins the reader gets wrong (it plays one path through each chapter): (chapter, how, with, place, note).
JOIN_FIXES = {
    0x09: ('Ch.2', 'visit', [], 'a house', 'Only before any village is destroyed ($99:8221).'),
    0x0B: ('Ch.2x', 'end', [], None, 'Only if you reach 2x: no village destroyed in Ch.2 ($97:8429).'),
    0x20: ('Ch.2x', 'end', [], None, 'Capture him in 2x and hold him to the end ($97:83DB); 2x needs no village destroyed in Ch.2.'),
    0x28: ('Ch.12x', 'start', [], None, 'Capture him in Ch.12 and hold him to the end: he\'s set aside at once ($99:E2C7) and back at '
                                         'the start of 12x ($FD:9620), so only if you reach 12x (Ch.12 cleared before turn 20).'),
    0x27: ('Ch.17A', 'end', ['Karin'], None, 'Talk to her with Karin, then capture her: she joins at the end of 17A if Karin is alive '
                                             'and not captured and Misha is still held ($FD:C3A4).'),
    0x26: ('Ch.14x', 'start', [], None, 'Or at the start of Ch.15 if 14x is skipped ($FD:AEE4).'),
    SARA: ('Ch.17A', 'visit', [], 'the church', 'On route B, Leif talks to her in 16B instead ($99:EE86).'),
    0x2F: ('Ch.14', 'visit', ['Nanna'], 'a house', 'Only Nanna\'s visit recruits him ($FD:98AA).'),
    0x0A: ('Ch.16B', 'event', [], None, 'When Leif stops on a particular gate tile, she appears beside him and joins ($99:ED8B, '
                                        '$99:EE24).'),
    0x29: ('Ch.16A', 'visit', ['Leif'], 'a house', 'Only if Leif left Ch.15 by the church ($FD:A91F).'),
    0x12: ('Ch.6', 'visit', [], 'a house', 'Only if Murphy escaped in 4x ($99:A773).'),
}
# Conditions the join notes add, from the scripts.
JOIN_NOTES = {
    0x15: 'Only if Jubel was carried to his house in Ch.3 ($8C:E867).',
    0x17: 'Only Safy can talk to him, so you need 2x, and only if he didn\'t die in 2x ($99:BBE5).',
    0x2A: 'Only if she didn\'t die as an enemy in Ch.5 ($99:DC3A).',
    0x24: 'Or capture her and hold her to the end of 12x while Perne is yours ($FD:9700).',
    0xD4: 'Only if Olwen is dead or never joined ($8C:B6C6).',
    0x23: 'Not if he died in Ch.15 or 16B.',
    0xED: 'All eight knights must be turned by their families first; then Leif talks to him, or he walks to Leif ($7E:4976).',
    0x30: 'Only if Nanna is alive ($FD:E840).',
    0x50: 'Not if he was killed or let go in Ch.5 or 6.',
    0x32: 'A guest in Ch.23. He stays only if he lives, all six civilians are safe and Ced isn\'t on the map at the end; he\'s then '
          'back at the start of Ch.24 ($FD:FA4E).',
}
# Story protection: hidden skill bits the scripts set or clear ($83:D4BD immortal; $87:9B10 uncapturable).
NOTES = {
    0x05: 'Can\'t be killed, only captured, until 24x (a hidden skill 24x clears, $97:8C97).',
    0x1D: 'Can\'t be killed or captured before he joins (hidden skills the join clears).',
    0x1E: 'Can\'t be killed or captured before she joins (hidden skills the join clears).',
    0x32: 'Can\'t be killed or captured before he joins (hidden skills the join clears).',
    0x25: 'Can\'t be killed for part of 8x (until turn 15).',
    LARA: 'Becoming a Dancer takes away the Thief\'s skills, her own Steal too; the scene gives Steal back ($83:AC5B, $FD:9507).',
}
# When units leave and come back (set aside, $8C:A464; brought back, $8C:A486). Spoilers: the Roster hides them under the spoiler
# block, once the app has one.
AWAY = {
    0x05: ['Set aside at the end of Ch.3 ($8C:EDD9).', 'Back for Ch.5, where she\'s turned to stone and set aside ($99:A330).',
           'Back in 24x: Leif or Mareeta talks to her once she\'s cured.'],
    0x02: ['Set aside at the end of Ch.3; back on turn 2 of Ch.7 ($99:B25A).'],
    0x0B: ['Set aside at the end of Ch.3; back on turn 2 of Ch.7 ($99:B2B1).'],
    0x03: ['Set aside at the end of Ch.3; back at the end of Ch.7 ($99:BD8F).'],
    0x04: ['Set aside at the end of Ch.3; back at the end of Ch.7 ($99:BDE6).'],
    0x09: ['Set aside at the end of Ch.3; back at the end of Ch.7 ($99:BE3D).'],
    0x08: ['Set aside at the end of Ch.3.', 'Back in Ch.8 as an enemy ($99:C326): he rejoins when Osian or Halvan talks to him, or '
                                            'when he\'s captured ($99:C0FE).'],
    0x06: ['Set aside at the end of Ch.3.', 'Back at the start of 8x if he and Tanya both live and Lemay was captured; if only he '
                                            'lives, at the end of Ch.8; if both live and Lemay wasn\'t captured, he never comes back.'],
    0x25: ['Set aside at the end of Ch.3.', 'Back at the start of 8x if she and Dagdar both live and Lemay was captured; if only she '
                                            'lives, at the end of Ch.8; if both live and Lemay wasn\'t captured, she never comes back.'],
    0x22: ['Leaves at the end of any chapter from 14x on if Linoan isn\'t a living, uncaptured member of the army.'],
}
# The story's picks of who joins (the Roster's buttons): units in another option than the one picked drop out of every tab.
ILIOS, MISHA, SCHROFF, AMALDA, MIRANDA, SHANNAM, CONOMOR, OLWEN, CED, SAIAS = 0xD4, 0x27, 0x29, 0x2D, 0x0A, 0x23, 0x2E, 0x1E, 0x1F, 0x32
CHOICES = [
    {'id': 'fe5-route', 'chapter': 'Ch.15', 'question': 'Where Leif leaves Ch.15 picks the route ($FD:A9BC, $FD:A91F, $FD:A9A1):',
     'options': [('West exit (16A)', [ILIOS, MISHA], 'A'), ('The church (16A, and Schroff joins)', [SCHROFF, AMALDA, ILIOS, MISHA], 'A'),
                 ('East exit (16B)', [MIRANDA, SHANNAM, CONOMOR], 'B')]},
    {'id': 'fe5-olwen-ilios', 'chapter': 'Ch.16A', 'question': 'Ilios joins only if Olwen is dead or never joined:',
     'options': [('Olwen', [OLWEN]), ('Ilios', [ILIOS])]},
    {'id': 'fe5-ced-saias', 'chapter': 'Ch.23', 'question': 'Saias stays after Ch.23 only if Ced isn\'t on the map at its end:',
     'options': [('Ced', [CED]), ('Saias', [SAIAS])]},
]
# Sara joins on either route: in 17A by the church, in 16B when Leif talks to her (the route pick's third option).
ALT_JOINS = {SARA: ('fe5-route', 2, 'Ch.16B', 'talk', ['Leif'], None)}
# Support givers who aren't playable, and when they're on the map.
GIVER_NOTES = {69: 'Ced, as an ally in 4x and Ch.6', 71: 'Reinhardt, as an enemy', 146: 'Reinhardt, as an enemy'}


def signed(b):
    return b - 256 if b > 127 else b


def character(c):
    """48 bytes from id 1 at $86:9A2D: +0-8 their own bases (GAME_STATS; HP is added to the class's when they load, the rest are
    kept apart), +9 movement stars x 5, +0x0A the pursuit critical coefficient, +0x0B-0x13 growth rates (GAME_STATS), +0x14-0x1D
    weapon points (sword ... dark), +0x1E-0x27 weapon EXP rates, +0x28 1 for women, +0x29-0x2B skills (bits), +0x2C class, +0x2D
    leadership stars, +0x2E map sprite, +0x2F portrait."""
    o = r.lo(r.CHARACTERS + 48 * (c - 1))
    b = r.R[o:o + 48]
    return {
        'own': dict(zip(GAME_STATS, (signed(x) for x in b[0:9]))), 'move_stars': b[9] // 5, 'pcc': b[10],
        'growths': dict(zip(GAME_STATS, b[11:20])), 'points': dict(zip(WEAPONS, b[0x14:0x1E])), 'female': bool(b[0x28]),
        'skills': b[0x29:0x2C], 'class': b[0x2C], 'leadership': b[0x2D],
    }


def class_record(c):
    """36 bytes from id 1 at $86:8000: +0-7 bases (CLASS_STATS), +9-0x12 weapon ranks (the class's base points; 0 can't use),
    +0x13-0x15 skills, +0x23 the base class the EXP formula uses."""
    o = r.lo(r.CLASSES + 36 * (c - 1))
    b = r.R[o:o + 36]
    return {'bases': dict(zip(CLASS_STATS, b[0:8])), 'ranks': dict(zip(WEAPONS, b[9:19])), 'skills': b[0x13:0x16]}


def skill_names(bits):
    return [name for i, byte in enumerate(bits) for bit, name in SKILL_BITS[i].items() if byte & bit]


def promotions():
    """{character: class} from the Master Seal's table."""
    out, a = {}, PROMOTIONS
    while r.u16(a):
        out[r.u16(a)] = r.u8(a + 2)
        a += 3
    return out


def mount_pairs():
    mounted = [r.u8(MOUNTED + i) for i in range(28)]
    on_foot = [r.u8(DISMOUNTED_OF + i) for i in range(28)]
    return dict(zip(mounted, on_foot))


def main():
    names, cnames, inames = character_names(), class_names(), item_names()
    chapter_of = {h: chapter_id(i) for i, h in enumerate(HEADINGS)}
    found = {c: v for c, v in joins().items()}
    for c, (heading, how, with_, place, note) in JOIN_FIXES.items():
        level = found.get(c, (None, None, None, None, None))[4]
        found[c] = (HEADINGS.index(heading), how, with_, None, level, place, note)
    joined = {c: v if len(v) == 7 else (*v, None, None) for c, v in found.items()}
    # Misha's level is her placement's in 17A (the reader can't reach the branch behind Karin's talk).
    if joined[MISHA][4] is None:
        joined[MISHA] = (*joined[MISHA][:4], 4, *joined[MISHA][5:])
    order = sorted(joined, key=lambda c: (joined[c][0], c))
    seal = promotions()
    pairs = mount_pairs()
    on_foot_of = {v: k for k, v in pairs.items()}

    used = set()
    units = []
    for c in order:
        n, how, with_, turn, level, place, note = joined[c]
        p = character(c)
        loaded = class_record(p['class'])
        # A unit joining on an indoor map comes in its dismounted class; it's listed in its mounted one, as Serenes Forest does.
        cid = on_foot_of.get(p['class'], p['class'])
        cls = class_record(cid)
        used.add(cid)
        own = {s: p['own'][s] for s in STATS}
        own['hp'] = min(250, loaded['bases']['hp'] + p['own']['hp'])  # HP is kept whole: the class's plus their own ($83:953A)
        cb = {**cls['bases'], 'lck': 0}
        bases = {s: own['hp'] if s == 'hp' else min(CAP, cb[s] + own[s]) for s in STATS}
        join = {'how': how}
        if with_:
            join['with'] = [w if isinstance(w, str) else names[w] for w in with_]
        if turn:
            join['turn'] = turn
        if place:
            join['place'] = place
        notes = [x for x in (note, JOIN_NOTES.get(c)) if x]
        if notes:
            join['note'] = ' '.join(notes)
        unit = {
            'id': f'fe5-{c}', 'name': names[c], 'classId': str(cid), 'level': level or 1, 'joinChapter': chapter_of[HEADINGS[n]],
            'join': join, 'female': p['female'], 'own': own, 'bases': bases, 'growths': {s: p['growths'][s] for s in STATS},
            'weaponPoints': {w: v for w, v in p['points'].items() if v}, 'skills': skill_names(p['skills']),
            'leadership': LEADERSHIP.get(c, p['leadership']), 'moveStars': p['move_stars'], 'pcc': p['pcc'],
        }
        if c in ALT_JOINS:
            choice, option, heading, alt_how, alt_with, alt_place = ALT_JOINS[c]
            unit['altJoin'] = {'choice': choice, 'option': option, 'joinChapter': chapter_of[heading],
                               'join': {'how': alt_how, **({'with': alt_with} if alt_with else {}),
                                        **({'place': alt_place} if alt_place else {})}}
        if c in LEADERSHIP_NOTES:
            unit['leadershipNote'] = LEADERSHIP_NOTES[c]
        if c in STORY_PROMOTIONS:
            to, why = STORY_PROMOTIONS[c]
            unit['promotion'] = {'classId': str(to), 'by': 'story', 'note': why}
            used.add(to)
        elif seal.get(c) and seal[c] != cid:
            unit['promotion'] = {'classId': str(seal[c]), 'by': 'seal'}
            used.add(seal[c])
        if c in STORY_STEPS:
            to, why = STORY_STEPS[c]
            unit['storyStep'] = {'classId': str(to), 'note': why}
            used.add(to)
        if c in STORY_SKILLS:
            skill, why = STORY_SKILLS[c]
            unit['storySkill'] = {'skill': skill, 'note': why}
        if c in NOTES:
            unit['notes'] = [NOTES[c]]
        if c in AWAY:
            unit['away'] = AWAY[c]
        units.append(unit)

    # Every class a unit can be in, and the class each mounted one becomes on foot.
    for k in list(used):
        if k in pairs:
            used.add(pairs[k])
    out_classes = {}
    for k in sorted(used):
        rec = class_record(k)
        entry = {'id': str(k), 'name': cnames[k], 'bases': {**rec['bases'], 'lck': 0},
                 'ranks': {w: v for w, v in rec['ranks'].items() if v}, 'skills': skill_names(rec['skills'])}
        if k in pairs:
            entry['dismounted'] = str(pairs[k])
        out_classes[str(k)] = entry

    ids = {u['id'] for u in units}
    supports, a = [], SUPPORTS
    while r.u16(a):
        gets, gives, bonus = r.u16(a), r.u16(a + 2), r.u8(a + 4)
        if f'fe5-{gets}' in ids:
            entry = {'gets': f'fe5-{gets}', 'gives': f'fe5-{gives}', 'bonus': bonus}
            if f'fe5-{gives}' not in ids:
                entry['giverNote'] = GIVER_NOTES[gives]
            supports.append(entry)
        a += 5

    scrolls = []
    for k in range(SCROLL_COUNT):
        o = r.lo(SCROLLS + 10 * k)
        b = r.R[o:o + 10]
        bonus = dict(zip(GAME_STATS, (signed(x) for x in b[1:10])))
        scrolls.append({'id': str(b[0]), 'name': inames[b[0]], 'growths': {s: bonus[s] for s in STATS}})

    rings = []
    for i in RINGS:
        row = r.lo(RING_GROWTHS + 10 * ((r.item(i)['use_effect'] - 2) // 2))
        gain = {s: r.R[row + j] * 4 // 100 for j, s in enumerate(GAME_STATS) if r.R[row + j]}
        (stat, amount), = gain.items()
        rings.append({'id': str(i), 'name': inames[i], 'stat': stat, 'amount': amount})

    manuals = [{'id': str(i), 'name': inames[i], 'skill': inames[i].replace(' Manual', ''), 'where': where,
                'chapter': chapter_of[heading]} for i, (where, heading) in MANUALS.items()]
    skills = {k: SKILL_TEXT[k] for k in SKILL_TEXT}

    choices = [{'id': ch['id'], 'chapter': chapter_of[ch['chapter']], 'question': ch['question'],
                'options': [{'label': o[0], 'units': [f'fe5-{u}' for u in o[1]], **({'route': o[2]} if len(o) > 2 else {})}
                            for o in ch['options']]} for ch in CHOICES]
    # The chapters of one route only (16A and 17A, or 16B and 17B).
    chapters = [{'id': chapter_id(i), 'label': h, **({'route': h[-1]} if h[-1] in 'AB' else {})} for i, h in enumerate(HEADINGS)]

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    lines = [
        "// Generated by scripts/build-fe5-units.py from the user's own Thracia 776 ROM. Don't edit by hand.",
        "import type { Fe5Chapter, Fe5Choice, Fe5Class, Fe5Manual, Fe5Ring, Fe5Scroll, Fe5Support, Fe5Unit } from '../../thracia/types'",
        '',
        f'export const FE5_CHAPTERS: Fe5Chapter[] = {js(chapters)}',
        '',
        'export const FE5_UNITS: Fe5Unit[] = [',
        *[f'  {js(u)},' for u in units],
        ']',
        '',
        'export const FE5_CLASSES: Record<string, Fe5Class> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in out_classes.items()],
        '}',
        '',
        '// Who gets a bonus to hit, avoid, crit and crit avoid from whom (within 3 tiles), one way per entry.',
        'export const FE5_SUPPORTS: Fe5Support[] = [',
        *[f'  {js(s)},' for s in supports],
        ']',
        '',
        '// The holy scrolls: growth bonuses while carried anywhere in the inventory; several add up.',
        'export const FE5_SCROLLS: Fe5Scroll[] = [',
        *[f'  {js(s)},' for s in scrolls],
        ']',
        '',
        '// The rings: each raises one stat once, by a fixed amount, held at the caps.',
        f'export const FE5_RINGS: Fe5Ring[] = {js(rings)}',
        '',
        '// The skill manuals the chapters hold, one copy each.',
        f'export const FE5_MANUALS: Fe5Manual[] = {js(manuals)}',
        '',
        '// What each skill does, from the routines that test it.',
        f'export const FE5_SKILLS: Record<string, string> = {js(skills)}',
        '',
        "// The story's picks of who joins.",
        f'export const FE5_CHOICES: Fe5Choice[] = {js(choices)}',
        '',
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(units)} units, {len(out_classes)} classes, {len(supports)} supports, {len(scrolls)} scrolls, {len(rings)} rings, '
          f'{len(manuals)} manuals -> {OUT}')


if __name__ == '__main__':
    main()
