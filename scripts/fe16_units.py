"""Fire Emblem: Three Houses unit data, read from the user's own dump (the 1.2.0 update applied, DLC data included in it).

Reads the files fe16_extract.py copies out of the NSPs (default: Documents\\FE Games\\Switch dumps\\extracted\\fe16\\romfs; set
FE16_ROMFS to change it) and writes JSON to ./out (or the folder given):

  characters.json   every person with a playable-character slot: bases, growths, caps, crests, ranks, strengths/weaknesses,
                    budding talent, personal abilities, learnsets (abilities, arts, spells), starting items, recruitment, supports
  classes.json      the 100 class records: bases, growth modifiers, boosts, mount bonus, rank bonuses, certification, abilities
  rank_rewards.json what every unit learns at each skill rank (persondata section 12)
  abilities.json    the 255 abilities (fixed_skill.bin section 0) with English names and descriptions
  arts.json         the 80 combat arts (fixed_data.bin section 7)
  spells.json       the 38 spells (fixed_data.bin section 1)
  crests.json       crest names / descriptions and the 22 crest records (fixed_skill.bin section 1)
  supports.json     the 267 support pairs (fixed_persondata.bin section 10), decoded
  recruitment.json  the recruitment records (fixed_lobby_common.bin section 4) and the monastery script's RecruitTalk windows

    python fe16_units.py [out_dir]

Layouts: data-raw/fe16/README.md. scripts/build-fe16-units.py writes the app's data from these. Field names follow the Three Houses Research Team's 010 templates where they are
right; every field used here was checked against known values (see fe16_crosscheck.py).
"""
import json
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fe16_data as D  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')

# Archive file numbers (DATA0 entries; the update's INFO0 names them).
FIXED_DATA, PERSONDATA, CLASSDATA, SKILL, GROWTHDATA, LOBBY_COMMON = 6, 12, 11, 15, 9, 24
MONASTERY_RECRUIT_SCRIPT = 360          # LO08_00.bsi: RecruitTalk events

STATS = ['HP', 'Str', 'Mag', 'Dex', 'Spd', 'Lck', 'Def', 'Res', 'Mov', 'Cha']
STATS9 = STATS[1:]                       # the person record's 9-byte blocks: Str .. Res, Mov, Cha
CHAR_STAT = ['Str', 'Mag', 'Dex', 'Spd', 'Lck', 'Def', 'Res', 'Mov', 'Cha']      # recruitment stat type (9 = none)
SKILLS = ['Sword', 'Lance', 'Axe', 'Bow', 'Brawl', 'Reason', 'Faith', 'Authority', 'Heavy Armor', 'Riding', 'Flying']
RANKS = ['E', 'E+', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+', 'S', 'S+']
PROFICIENCY = {1: 'weakness', 2: 'neutral', 3: 'strength'}
SUPPORT_LEVELS = ['C', 'C+', 'B', 'B+', 'A', 'A+', 'S']   # 1-7 internally; growthdata section 4 holds their point thresholds
TIERS = {0: 'Starting', 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced', 4: 'Master', 5: 'DLC', 6: 'Unique'}
MONTHS = ['', 'Guardian Moon', 'Pegasus Moon', 'Lone Moon', 'Great Tree Moon', 'Harpstring Moon', 'Garland Moon',
          'Blue Sea Moon', 'Verdant Rain Moon', 'Horsebow Moon', 'Wyvern Moon', 'Red Wolf Moon', 'Ethereal Moon']
CLASS_TYPES = ['Infantry', 'Armored', 'Cavalry', 'Flying', 'Dragon', 'Monster']
NO_CREST = 86

# Text table 1 (English, US) ranges: name at base + id, description 300 further on (classes: 101 on).
T_PERSON, T_CLASS, T_CLASS_DESC, T_WAR_CLERIC = 1157, 3453, 3554, 3553
T_ART, T_ART_DESC = 6014, 6314
T_ABILITY, T_ABILITY_DESC = 7236, 7536
T_SPELL, T_SPELL_DESC = 7836, 8136
T_CREST, T_CREST_DESC = 9590, 9677
T_ALLEGIANCE = 9498


def T(n):
    return D.text(n).replace('\x1bC1', '').replace('\x1bR', '')


def opt(v, none=255):
    return None if v == none else v


def person_label(p):
    """The name a person is shown with (+0x12 names another person record's text; DLC people's own +0x12 is a name record)."""
    r = D.persons()[p]
    return T(T_PERSON + struct.unpack_from('<H', r, 0x12)[0]).strip()


def class_ref(c):
    if c is None or c == 255:
        return None
    return {'id': c, 'name': T(T_CLASS + c)}


def ability_ref(a):
    return None if a == 255 else {'id': a, 'name': T(T_ABILITY + a)}


def art_ref(a):
    return None if a == 255 else {'id': a, 'name': T(T_ART + a)}


def spell_ref(s):
    return None if s == 255 else {'id': s, 'name': T(T_SPELL + s)}


def crest_ref(c):
    if c == NO_CREST:
        return None
    return {'id': c, 'name': T(T_CREST + c) if c < 48 else f'crest {c}', 'minor': 22 <= c < 44}


def rank(r):
    return RANKS[r] if r < len(RANKS) else None


# --- persons (fixed_persondata.bin section 0, 80 bytes) -------------------------------------------------------------------------------

def person(p):
    r = D.persons()[p]
    u8 = lambda o: r[o]  # noqa: E731
    return {
        'person': p,
        'name_text': struct.unpack_from('<H', r, 0x12)[0],
        'voice_id': struct.unpack_from('<H', r, 0x16)[0],
        'asset_id': struct.unpack_from('<H', r, 0x18)[0],
        'class': u8(0x1A), 'age': u8(0x1B), 'birth_month': u8(0x1C), 'birth_day': u8(0x1E),
        'slot': u8(0x20), 'hp_cap': u8(0x22), 'allegiance': u8(0x24), 'gender': u8(0x26), 'body': u8(0x27),
        'battalion': u8(0x28), 'hp_growth': u8(0x29), 'anim_set': u8(0x2A), 'hp': u8(0x2B),
        'crests': [u8(0x2C), u8(0x2D)], 'height': [u8(0x2F), u8(0x30)],
        'bases9': list(r[0x33:0x3C]), 'growths9': list(r[0x3C:0x45]), 'caps9': list(r[0x45:0x4E]),
        'model_scale': [round(x, 3) for x in struct.unpack_from('<4f', r, 0)],
    }


def slot_table(k):
    return D.table(PERSONDATA, k)


def char_ranks(slot):
    """Section 3 (45 x 34): +0/+1 unknown, +2 palette, +3..+7 the classes already certified at join, +8 flags, +9..+19 starting
    ranks, +20..+30 proficiency (3 strength, 2 neutral, 1 weakness), +31..+33 the classes the unit is given later (as a foe or a
    late recruit: unconfirmed)."""
    r = slot_table(3)[slot]
    return {
        'unk0': r[0], 'unk1': r[1], 'palette': r[2],
        'certified': [c for c in r[3:8] if c != 255],
        'flags8': r[8],
        'ranks': {SKILLS[k]: rank(r[9 + k]) for k in range(11)},
        'proficiency': {SKILLS[k]: PROFICIENCY.get(r[20 + k], r[20 + k]) for k in range(11)},
        'later_classes': [c for c in r[31:34] if c != 255],
    }


def char_spells(slot):
    """Section 4 (45 x 20): +0 Faith learn ranks x5, +5 Reason spells x5, +10 Faith spells x5, +15 Reason learn ranks x5."""
    r = slot_table(4)[slot]
    out = {'Reason': [], 'Faith': []}
    for k in range(5):
        if r[5 + k] != 255:
            out['Reason'].append({'rank': rank(r[15 + k]), **spell_ref(r[5 + k])})
        if r[10 + k] != 255:
            out['Faith'].append({'rank': rank(r[k]), **spell_ref(r[10 + k])})
    return out


def char_abilities(slot):
    """Section 5 (45 x 62): +0 skill x20, +20 personal ability before the time skip, +21 after, +22 ability x20, +42 rank x20."""
    r = slot_table(5)[slot]
    learned = []
    for k in range(20):
        if r[22 + k] != 255:
            learned.append({'skill': SKILLS[r[k]] if r[k] < 11 else r[k], 'rank': rank(r[42 + k]), **ability_ref(r[22 + k])})
    return {'personal': ability_ref(r[20]), 'personal_part2': ability_ref(r[21]), 'learned': learned}


def char_arts(slot):
    """Section 7 (45 x 30): +0 art x10, +10 skill x10, +20 rank x10 (art 0 with skill 255 is an empty slot)."""
    r = slot_table(7)[slot]
    return [{'skill': SKILLS[r[10 + k]], 'rank': rank(r[20 + k]), **art_ref(r[k])} for k in range(10) if r[10 + k] != 255]


def starting_items(slot):
    """Section 6 (45 x 14): u16 (255), then six global item numbers (weapon = n - 10; items 1000 on)."""
    r = slot_table(6)[slot]
    return [{'id': i, 'name': D.global_item_name(i)} for i in struct.unpack_from('<6H', r, 2) if i]


def budding_talents():
    """Section 11 (240 x 6, first 24 used): u16 person, u8 param (12; 6 for Byleth: meaning unconfirmed), u8 skill, u8 art,
    u8 ability (255 none)."""
    out = {}
    for r in slot_table(11):
        p, param, skill, art, ab = struct.unpack_from('<HBBBB', r, 0)
        if skill == 255:
            continue
        out[p] = {'skill': SKILLS[skill], 'param': param,
                  'unlocks': {'kind': 'art', **art_ref(art)} if art != 255 else {'kind': 'ability', **ability_ref(ab)}}
    return out


def rank_rewards():
    """Section 12 (12 x 22): row = rank E .. S+, +0..+10 the combat art and +11..+21 the ability every unit learns in that skill."""
    out = []
    for rk, r in enumerate(slot_table(12)):
        for k in range(11):
            if r[k] != 255:
                out.append({'skill': SKILLS[k], 'rank': RANKS[rk], 'kind': 'art', **art_ref(r[k])})
            if r[11 + k] != 255:
                out.append({'skill': SKILLS[k], 'rank': RANKS[rk], 'kind': 'ability', **ability_ref(r[11 + k])})
    return out


# --- supports (persondata section 10, 12 bytes) ---------------------------------------------------------------------------------------

SUPPORT_BITS = [(6, 'C'), (5, 'C+'), (4, 'B'), (3, 'B+'), (2, 'A'), (1, 'A+'), (0, 'S')]


def supports():
    """u16 0, u16 person A, u16 person B, u8 +6 (1 on 13 pairs: the lords with Byleth, Edelgard-Linhardt, Dimitri-Ashe,
    Claude-Hilda, the Ashen Wolves among themselves; meaning unconfirmed), u8 0, u8 +8 (0, 45, 75, 90, 105, 120: unconfirmed),
    u16 +9 flags: bits 0-6 the conversations S, A+, A, B+, B, C+, C; bit 7 / bit 8 (Byleth pairs) S with male / female Byleth (1 on
    every other pair); bit 9 a paired ending; bit 10 the ten pairs with an A+ level and no A+ talk (unconfirmed)."""
    out = []
    for i, r in enumerate(slot_table(10)):
        _, a, b, b6, _b7, b8 = struct.unpack_from('<HHHBBB', r, 0)
        if a == 0xFFFF:
            continue
        v = struct.unpack_from('<H', r, 9)[0]
        talks = [name for bit, name in SUPPORT_BITS if v >> bit & 1]
        byleth = a in (0, 1)
        rec = {
            'index': i, 'a': a, 'b': b, 'a_name': person_label(a), 'b_name': person_label(b),
            'talks': talks,
            'max': ('S' if 'S' in talks else 'A' if (v >> 2 & 1) or (v >> 9 & 1) else 'B' if talks else None),
            'paired_ending': bool(v >> 9 & 1),
            'a_plus_level': bool(v >> 10 & 1),
            'flag6': b6, 'value8': b8, 'raw_flags': v,
        }
        if byleth:
            rec['s_male_byleth'] = bool(v & 1 and v >> 7 & 1)
            rec['s_female_byleth'] = bool(v & 1 and v >> 8 & 1)
        if not talks:
            rec['max'] = None
        out.append(rec)
    return out


# --- recruitment --------------------------------------------------------------------------------------------------------------------

def recruit_records():
    """fixed_lobby_common.bin section 4 (101 x 14): u16 person, u16 a global item (Bullion for most nobles, a stat fruit for
    most commoners, Intermediate Seal for the faculty, Abyssian Exam Pass for the Ashen Wolves: probably what they drop as foes,
    unconfirmed), u16 0xFFFF, u8 class if recruited early, u8 Byleth's level needed (faculty; 255 students), u8
    class if recruited later, u8 stat (Str .. Cha; 9 none), u8 skill (11 none), u8 rank, u8 1 = joins a female Byleth without
    requirements (Sylvain), u8 the stat's value."""
    out = {}
    for r in D.table(LOBBY_COMMON, 4):
        p, flag, ff, c1, lv, c2, st, sk, rk, auto_f, amount = struct.unpack_from('<HHHBBBBBBBB', r, 0)
        if c1 == 0 and c2 == 0 and lv == 255:
            continue
        out[p] = {
            'item': None if flag == 0xFFFF else {'id': flag, 'name': D.global_item_name(flag)}, 'class_early': class_ref(c1), 'class_late': class_ref(c2),
            'byleth_level': opt(lv),
            'stat': None if st >= 9 else {'stat': CHAR_STAT[st], 'value': amount},
            'skill': None if sk >= 11 else {'skill': SKILLS[sk], 'rank': rank(rk)},
            'auto_with_female_byleth': bool(auto_f),
        }
    return out


def recruit_talks():
    """The monastery script (archive 360, LO08_00.bsi): each RecruitTalk event and the chapter / route conditions around it
    (ChapterSelect: negated, chapter, compare 0 <, 1 <=, 2 ==, 3 >=, 4 >; Route: negated, route, 1 is / 0 is not; routes 0 Black
    Eagles then Silver Snow, 1 Blue Lions / Azure Moon, 2 Golden Deer / Verdant Wind, 3 Crimson Flower)."""
    out = {}
    for e in D.parse_events(D.archive_file(MONASTERY_RECRUIT_SCRIPT)):
        for name, args in e['actions']:
            if name == 'RecruitTalk':
                out.setdefault(args[0], []).append({'event': e['num'], 'when': cond_text(e['conditions']),
                                                    'conditions': e['conditions']})
    return out


ROUTES = ['Black Eagles / Silver Snow', 'Blue Lions / Azure Moon', 'Golden Deer / Verdant Wind', 'Crimson Flower']
CMP = ['<', '<=', '==', '>=', '>']


def cond_text(t):
    """A script condition tree as text (ChapterSelect and Route spelt out; anything else by name)."""
    if t[0] in ('and', 'or'):
        parts = [x for x in (cond_text(k) for k in t[1]) if x]
        if not parts:
            return ''
        return parts[0] if len(parts) == 1 else '(' + f' {t[0]} '.join(parts) + ')'
    name, a = t
    if name == 'ChapterSelect':
        return f"{'not ' if a[0] else ''}chapter {CMP[a[2]]} {a[1]}"
    if name == 'Route':
        return f"route {'is' if a[2] else 'is not'} {ROUTES[a[1]]}"
    return f'{name}{a}'


HOUSES = {1: 'Black Eagles', 2: 'Blue Lions', 3: 'Golden Deer', 23: 'Ashen Wolves'}
# Joins the files don't spell out in one place (scripted joins in battle and monastery scripts not traced): Serenes Forest's,
# kept apart as unconfirmed. Where the unit tables place the person as a unit of yours is given for each.
UNCONFIRMED_JOINS = {
    26: 'Serenes: joins automatically in Chapter 12 (not on Crimson Flower); the files place him as your unit in scenario 13 '
        '(Hunting by Daybreak) by script',
    27: 'Serenes: joins automatically in Chapter 7; leaves on Crimson Flower',
    30: 'Serenes: joins automatically on turn 3 of Chapter 13 (Azure Moon); placed as your unit by script in scenario 13',
    1040: 'Cindered Shadows; in the main story after Cindered Shadows is cleared (paralogue A Cursed Relic, scenario 94, places '
          'him as your unit or a green unit): conditions not traced',
    1041: 'as Yuri (paralogue Black Market Scheme, scenario 93)', 1042: 'as Yuri (A Cursed Relic, scenario 94)',
    1043: 'as Yuri (Black Market Scheme, scenario 93)',
    1045: 'DLC (Expansion Pass): conditions not traced; scenario 97 (The Secret Merchant) and 98 place him as your unit',
    1046: 'DLC: joins after The Secret Merchant (scenario 97, which places her as your unit): conditions not traced',
}


def join_info(p, x, rec, talk):
    out = {'house': HOUSES.get(x['allegiance']) if 2 <= p <= 25 or p >= 1040 and x['allegiance'] == 23 else None}
    if p in (0, 1):
        out['how'] = 'the protagonist'
    elif 2 <= p <= 25:
        out['how'] = 'in your class from Chapter 1 when Byleth teaches their house (all but the house leaders can be '                     'recruited by the others)' if rec else 'only with their own house'
    if rec:
        out['recruit'] = {k: rec[k] for k in ('stat', 'skill', 'byleth_level', 'auto_with_female_byleth')}
    if talk:
        out['recruit_talk_when'] = [t['when'] or 'any chapter (the code applies the requirement)' for t in talk]
    if p in UNCONFIRMED_JOINS:
        out['unconfirmed'] = UNCONFIRMED_JOINS[p]
    return out


# --- characters ---------------------------------------------------------------------------------------------------------------------

NOT_PLAYABLE = {35, 36, 37, 1044}     # Jeralt, Rhea, Sothis (data slots; NPC or guest), Aelfric (Cindered Shadows NPC)


def characters():
    talents = budding_talents()
    recs = recruit_records()
    talks = recruit_talks()
    sup = supports()
    out = []
    for p, r in enumerate(D.persons()):
        if r[0x20] == 255 or r[0x20] >= len(slot_table(3)):
            if p != 37:
                continue
        x = person(p)
        slot = x['slot'] if x['slot'] != 255 else p          # Sothis's slot byte is 255; her rows are 37
        cr = char_ranks(slot)
        c = {
            'person': p, 'slot': slot, 'name': person_label(p),
            'playable': p not in NOT_PLAYABLE,
            'gender': 'F' if x['gender'] else 'M',
            'allegiance': {'id': x['allegiance'], 'name': T(T_ALLEGIANCE + x['allegiance'])},
            'age': x['age'],
            'birthday': None if x['birth_day'] == 99 else {'month': x['birth_month'], 'moon': MONTHS[x['birth_month']],
                                                            'day': x['birth_day']},
            'height_cm': x['height'],
            'class': class_ref(x['class']),
            'level': 1,
            'bases': {'HP': x['hp'], **dict(zip(STATS9, x['bases9']))},
            'growths': {'HP': x['hp_growth'], **{k: v for k, v in zip(STATS9, x['growths9']) if k != 'Mov'}},
            'caps': {'HP': x['hp_cap'], **{k: v for k, v in zip(STATS9, x['caps9']) if k != 'Mov'}},
            'crests': [crest_ref(k) for k in x['crests'] if k != NO_CREST],
            'skill_ranks': cr['ranks'],
            'proficiency': cr['proficiency'],
            'budding_talent': talents.get(p),
            'certified_classes': [class_ref(k) for k in cr['certified']],
            'later_classes': [class_ref(k) for k in cr['later_classes']],
            'abilities': char_abilities(slot),
            'arts': char_arts(slot),
            'spells': char_spells(slot),
            'starting_items': starting_items(slot),
            'recruitment': recs.get(p),
            'recruit_talk': talks.get(p),
            'join': join_info(p, x, recs.get(p), talks.get(p)),
            'supports': [{'partner': s['b'] if s['a'] == p else s['a'],
                          'partner_name': s['b_name'] if s['a'] == p else s['a_name'],
                          **{k: s[k] for k in ('talks', 'max', 'paired_ending', 'a_plus_level', 's_male_byleth',
                                               's_female_byleth') if k in s}}
                         for s in sup if p in (s['a'], s['b']) or (p == 1 and s['a'] == 0)],
            'raw': {'section3_bytes0_2': [cr['unk0'], cr['unk1'], cr['palette']], 'section3_flags8': cr['flags8'],
                    'battalion': x['battalion'], 'body': x['body'], 'anim_set': x['anim_set'], 'voice_id': x['voice_id'],
                    'asset_id': x['asset_id'], 'name_text': x['name_text']},
        }
        out.append(c)
    return out


# --- classes (fixed_classdata.bin) --------------------------------------------------------------------------------------------------

def sb(r, o, n):
    return list(struct.unpack_from(f'<{n}b', r, o))


def classes():
    """Section 0 (100 x 118), section 1 certification (100 x 15), section 2 the level each tier needs (7 x 1), section 3 mastery
    and class abilities (100 x 5). Offsets: +8/+10 male/female model, +16 HP boost, +19 foes' HP growth, +20 the growth
    modifiers HP .. Res, Mov, Cha (signed), +30 the foes' growths Str .. Cha, +39 the stat boosts Str .. Cha (signed), +48 the
    mount's bonus (signed, lost when dismounted), +57 skill EXP bonus x11, +69 tier, +74 class EXP to master (unconfirmed), +75
    base HP, +77 movement type, +78 its dismounted type, +79 weapon type, +80 second weapon type (unconfirmed), +81 class
    types (infantry .. monster bits), +82 flags (1 mounted, 8 uses magic: from the template), +83/+84 class spells, +85 base Str ..
    Res, +98 five abilities x4 (the foes' by difficulty: template)."""
    recs = D.table(CLASSDATA, 0)
    cert = D.table(CLASSDATA, 1)
    tier_level = [x[0] for x in D.table(CLASSDATA, 2)]
    abil = D.table(CLASSDATA, 3)
    out = []
    for c, r in enumerate(recs):
        name = T(T_CLASS + c)
        g = cert[c]
        a = abil[c]
        tier = r[69]
        boosts = sb(r, 39, 9)
        out.append({
            'id': c, 'name': name, 'name_female': T(T_WAR_CLERIC) if c == 85 else None,
            'description': T(T_CLASS_DESC + c),
            'tier': tier, 'tier_name': TIERS.get(tier, tier),
            'level_needed': tier_level[tier] if tier < len(tier_level) else None,
            'bases': {'HP': r[75], **dict(zip(['Str', 'Mag', 'Dex', 'Spd', 'Lck', 'Def', 'Res'], r[85:92]))},
            'growths': dict(zip(['HP', 'Str', 'Mag', 'Dex', 'Spd', 'Lck', 'Def', 'Res', 'Mov', 'Cha'], sb(r, 20, 10))),
            'enemy_growths': {'HP': r[19], **dict(zip(STATS9, sb(r, 30, 9)))},
            'boosts': {'HP': struct.unpack_from('<b', r, 16)[0], **dict(zip(STATS9, boosts))},
            'mount_bonus': dict(zip(STATS9, sb(r, 48, 9))),
            'skill_bonus': dict(zip(SKILLS, r[57:68])),
            'move_type': r[77], 'dismount_move_type': r[78], 'weapon_type': r[79], 'weapon_type2': r[80],
            'class_types': [CLASS_TYPES[k] for k in range(6) if r[81] >> k & 1],
            'flags': r[82],
            'class_spells': [spell_ref(s) for s in r[83:85] if s not in (38, 255)],
            'mastery_exp': r[74],
            'certification': {
                # +0: the pass rate lost per rank short (0x634024: 40, 32 for the two-skill advanced and DLC classes, 20 Master).
                'cost': g[0], 'item': None if g[1] == 255 else {'id': 1000 + g[1], 'name': D.global_item_name(1000 + g[1])},
                'exam': g[2], 'gender': {0: 'M', 1: 'F', 2: 'any'}.get(g[3], g[3]),
                'ranks': {SKILLS[k]: rank(g[4 + k]) for k in range(11) if g[4 + k]},
            },
            'mastery_ability': ability_ref(a[0]), 'mastery_art': art_ref(a[1]),
            'class_abilities': [ability_ref(k) for k in a[2:5] if k != 255],
            'enemy_abilities': [[ability_ref(k) for k in r[98 + 5 * j:103 + 5 * j] if k != 255] for j in range(4)],
            'models': [struct.unpack_from('<H', r, 8)[0], struct.unpack_from('<H', r, 10)[0]],
            'raw': r.hex(),
        })
    return out


# --- abilities, arts, spells, crests -----------------------------------------------------------------------------------------------

def abilities():
    """fixed_skill.bin section 0 (255 x 15): +0..+2 property values, +3 upgrade group, +4 menu order, +5/+6 conditions, +7, +8
    icon, +9 flags (0x10 learnable from an adjutant, 0x20 removed when it is a class ability: template), +10..+12 properties,
    +13/+14 modifiers."""
    out = []
    for a, r in enumerate(D.table(SKILL, 0)):
        out.append({'id': a, 'name': T(T_ABILITY + a), 'description': T(T_ABILITY_DESC + a),
                    'values': list(struct.unpack_from('<3b', r, 0)), 'upgrade_group': r[3], 'order': r[4],
                    'conditions': [r[5], r[6]], 'icon': r[8], 'flags': r[9], 'properties': list(r[10:13]),
                    'modifiers': list(struct.unpack_from('<2b', r, 13)), 'raw': r.hex()})
    return out


def arts():
    """fixed_data.bin section 7 (80 x 18): u16 +0 the weapon it needs (relic arts; 0xFFFF none), +2 Avo, +3 Mt, +4 Crit, +5 Hit,
    +6 Avo again, +7 special effect, +8 the class it needs (255 none), +10 durability cost, +11 max range, +12 min range, +13
    weapon bits (1 sword, 2 lance, 4 axe, 8 bow, 16 gauntlets, 63 any), +14 (8 on bow arts: unconfirmed), +15 effective against
    (bits), +16 flags (1 magic, 8 no counter, 16 learned by all, 64 targets self, 128 targets an ally). The template's layout is
    one byte short of this (checked against Serenes' Mt, Hit, Crit, range and cost for every art)."""
    out = []
    for a, r in enumerate(D.table(FIXED_DATA, 7)):
        weapon = struct.unpack_from('<H', r, 0)[0]
        avo, mt, crit, hit, avo2 = struct.unpack_from('<bbbbb', r, 2)
        out.append({'id': a, 'name': T(T_ART + a), 'description': T(T_ART_DESC + a),
                    'weapon_needed': None if weapon == 0xFFFF else {'id': weapon, 'name': D.weapon_label(weapon)},
                    'mt': mt, 'hit': hit, 'avo': avo, 'crit': crit, 'cost': r[10], 'range': [r[12], r[11]],
                    'class_needed': class_ref(r[8]), 'effect': r[7], 'weapons': [SKILLS[k] for k in range(5) if r[13] >> k & 1],
                    'effective': [CLASS_TYPES[k] for k in range(6) if r[15] >> k & 1], 'flags': r[16], 'byte14': r[14],
                    'raw': r.hex()})
    return out


SPELL_KINDS = {5: 'Black magic', 6: 'White magic', 7: 'Dark magic'}
# +4, what a spell does: 0 an attack, 1 heals an ally, 2 heals allies around, 5 hits around the target (Meteor), 6 drains (Nosferatu),
# 7 Torch, 8 Restore, 9 Ward, 10 Silence, 11 Rescue, 12 Warp, 13 the whole map (Quake).
SPELL_HEALS = (1, 2)


def spells():
    """fixed_data.bin section 1 (38 x 24), the weapons' layout: +4 what it does (SPELL_KINDS' note), +5 its kind (5 black magic, 6
    white, 7 dark: the names the abilities use, 'Black Magic Uses x2'), +7 max range, +10 min range (a max of 100 or more is worked out
    from Mag, as the help text says; Quake's 130 the whole map), +11 uses, +12 the status it inflicts (0x60 none), +14 effective
    against, +16 Mt (what a healing spell heals), +17 Hit, +18 Crit, +19 Wt, +22 flags (the weapons': 0x10 no follow-up, 0x04 leaves
    1 HP, 0x08 not fliers)."""
    out = []
    for s, r in enumerate(D.table(FIXED_DATA, 1)):
        out.append({'id': s, 'name': T(T_SPELL + s), 'description': T(T_SPELL_DESC + s), 'school': 'Faith' if s >= 24 else 'Reason',
                    'kind': SPELL_KINDS[r[5]], 'does': r[4], 'heals': r[4] in SPELL_HEALS,
                    'mt': r[16], 'hit': r[17], 'crit': r[18], 'wt': r[19], 'range': [r[10], r[7]], 'uses': r[11],
                    'effective': [CLASS_TYPES[k] for k in range(6) if r[14] >> k & 1], 'flags': r[22], 'raw': r.hex()})
    return out


# --- tea parties, gifts and lost items -----------------------------------------------------------------------------------------------

LOBBY_COMMON, PRESENTDATA, MATERIALDATA = 24, 28, 31
T_KEY_ITEM = 10142                    # a gift's or lost item's name; its description 255 on (text 10397 + n)
T_MATERIAL = 5056                     # a material's name: tea leaves are materials 192-212
T_TOPIC, T_PERSONAL_TOPIC = 14781, 14881
T_REACTION = 14931                    # Nod, Laugh, Commend, Disagree, Admonish, Sigh, Chat, Sip tea, Blush, Praise
TEA_FINAL_BLOCK = 45                  # scrdata table 0: a person's k-th final line is block 45 + k, the row block * 100 + slot


def key_item(n):
    """A gift's or lost item's name and description, spaces made plain (one name has a no-break space)."""
    return {'name': ' '.join(T(T_KEY_ITEM + n).split()), 'description': ' '.join(T(T_KEY_ITEM + 255 + n).split())}


def key_items():
    """fixed_presentdata.bin section 0 (245 x 12), by key item: u16 its price, u16, u8 +4 its rank (0-4), +5 a quest's item, +6 a
    flower, +7 everyone likes it (the Owl Feather), +8 a lost item. The gift checks (0x4088b0 liked, 0x4089f0 disliked) read +6
    and +7; the lost item one (0x3dd6c0) +8."""
    out = []
    for n, r in enumerate(D.records(D.sections(D.archive_file(PRESENTDATA))[0])):
        out.append({'id': n, **key_item(n), 'price': struct.unpack_from('<H', r, 0)[0], 'rank': r[4], 'quest': bool(r[5]),
                    'flower': bool(r[6]), 'liked_by_all': bool(r[7]), 'lost_item': bool(r[8])})
    return out


def gift_prefs(slot):
    """fixed_presentdata.bin section 1 (45 x 17), by character slot: +0 the flower they like (255 none), +1..+3 their lost items,
    +4..+6 the gifts they dislike, +7..+11 the gifts they like, +12..+16 the quest items they take. Giving an item (0x209a30): a lost
    item draws their 'mine' line or 'not mine'; a liked gift, the Owl Feather or their flower the liked line (0x4088b0), a disliked
    one the disliked line (0x4089f0), anything else the plain one."""
    r = D.records(D.sections(D.archive_file(PRESENTDATA))[1])[slot]
    pick = lambda a, b: [key_item(n)['name'] for n in r[a:b] if n != 255]  # noqa: E731
    return {'flower': None if r[0] == 255 else key_item(r[0])['name'], 'lost_items': [key_item(n) for n in r[1:4] if n != 255],
            'dislikes': pick(4, 7), 'likes': pick(7, 12), 'quest_items': pick(12, 17)}


def favorite_teas():
    """fixed_lobby_common.bin section 10 (101 x 10): u16 person, four bytes not traced, then +6..+9 the teas they like best (materials
    192-212, 255 none): the tea party's 'my favorite' greeting."""
    out = {}
    for r in D.records(D.sections(D.archive_file(LOBBY_COMMON))[10]):
        p = struct.unpack_from('<H', r, 0)[0]
        out[p] = [T(T_MATERIAL + m) for m in r[6:10] if m != 255]
    return out


def tea_topics(slot, section=13):
    """fixed_lobby_common.bin section 13 (150 x 43): a row per topic (0-99 the general ones, text 14781 + row; 100-149 the personal
    ones, text 14881 + row - 100, one person's each), a byte per character (slot - 2: no Byleth) set where they like it. The tea
    party (0x238650, through 0x406af0 and 0x406a50) counts a liked topic and plays the 'lively' reaction; any other gets 'not very
    interested'. Section 12, the same layout, only starts a 90-frame expression (0x238814, 0x4069e0): not counted."""
    rows = D.records(D.sections(D.archive_file(LOBBY_COMMON))[section])
    out = []
    for k, r in enumerate(rows):
        if 0 <= slot - 2 < len(r) and r[slot - 2] == 1:
            out.append({'name': T(T_TOPIC + k if k < 100 else T_PERSONAL_TOPIC + k - 100), 'personal': k >= 100})
    return out


def tea_final_lines(person, slot):
    """fixed_lobby_common.bin section 11 (392 x 14): u16 person, u8 the set (Constance's second, 1, is her other self's), u8 a code,
    then a byte per reaction (text 14931 on) set where it's right (0x4066d0 looks a line's reaction up by person and code). A person's
    k-th record of a set is their k-th final line, scrdata table 0 block 45 + k: checked against the tea party guides' lines and
    answers for Edelgard, Dimitri and Seteth (27 of 27). The DLC characters' lines (persons 1040 on) are the update's
    scrdataDLC.bin, its table 0 in blocks of 10 (row block * 10 + person - 1040), a set's line in column 2 x set."""
    reactions = [T(T_REACTION + k) for k in range(10)]
    dlc = person >= 1040
    lines = D.script_lines(0, dlc=dlc)
    out = []
    count = {}
    for r in D.records(D.sections(D.archive_file(LOBBY_COMMON))[11]):
        if struct.unpack_from('<H', r, 0)[0] != person:
            continue
        k = count[r[2]] = count.get(r[2], -1) + 1
        row = (TEA_FINAL_BLOCK + k) * 10 + person - 1040 if dlc else (TEA_FINAL_BLOCK + k) * 100 + slot
        text = lines[row][2 * r[2]]
        assert text, (person, k)
        out.append({'text': ' '.join(text.split()), 'set': r[2], 'code': r[3], 'right': [reactions[j] for j in range(10) if r[4 + j]]})
    return out


def crests():
    """Names: text 9590 + id (0-21 major, 22-43 minor, 44 Agarthan, 45 Forge, 46/47 Mystery); 86 no crest. fixed_skill.bin
    section 1 (22 x 12) per crest: u32 effect name offset, u8 effect, u8 trigger bits, u8 rate as major, u8 as minor, u8 as an
    item crest, u16, u8 (template)."""
    table = D.table(SKILL, 1)
    out = []
    for c in range(48):
        rec = {'id': c, 'name': T(T_CREST + c), 'description': T(T_CREST_DESC + c), 'minor': 22 <= c < 44}
        base = c - 22 if 22 <= c < 44 else c
        if base < len(table):
            r = table[base]
            rec.update({'effect': r[4], 'trigger': r[5], 'rate_major': r[6], 'rate_minor': r[7], 'rate_item': r[8]})
        out.append(rec)
    return out


def main(out_dir=OUT):
    os.makedirs(out_dir, exist_ok=True)
    data = {
        'characters': characters(), 'classes': classes(), 'rank_rewards': rank_rewards(), 'abilities': abilities(),
        'arts': arts(), 'spells': spells(), 'crests': crests(), 'supports': supports(),
        'recruitment': {'records': {str(k): v for k, v in recruit_records().items()},
                        'recruit_talk': {str(k): v for k, v in recruit_talks().items()}},
    }
    for k, v in data.items():
        with open(os.path.join(out_dir, f'{k}.json'), 'w', encoding='utf-8') as f:
            json.dump(v, f, ensure_ascii=False, indent=1)
    ch = data['characters']
    print(f"{len(ch)} characters ({sum(c['playable'] for c in ch)} playable), {len(data['classes'])} classes, "
          f"{len(data['abilities'])} abilities, {len(data['arts'])} arts, {len(data['spells'])} spells, "
          f"{len(data['supports'])} support pairs -> {out_dir}")


if __name__ == '__main__':
    main(*sys.argv[1:])
