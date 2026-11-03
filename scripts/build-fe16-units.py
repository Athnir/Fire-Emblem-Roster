"""Write src/data/fe16/fe16Units.ts: Fire Emblem: Three Houses' units, classes, supports and what they learn, from the user's own
dump (the 1.2.0 update and the DLC, as scripts/fe16_extract.py copies them out; scripts/fe16_units.py reads them). Formats in
data-raw/fe16/README.md.

    python scripts/fe16_extract.py      (once: copies the files out of the NSPs)
    python scripts/build-fe16-units.py
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fe16_units as U  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data', 'fe16', 'fe16Units.ts')

STATS = ['hp', 'str', 'mag', 'dex', 'spd', 'lck', 'def', 'res', 'cha']
STAT_OF = dict(zip(['HP', 'Str', 'Mag', 'Dex', 'Spd', 'Lck', 'Def', 'Res', 'Cha', 'Mov'], STATS + ['mov']))
SKILL_OF = dict(zip(U.SKILLS, ['sword', 'lance', 'axe', 'bow', 'brawl', 'reason', 'faith', 'authority', 'armor', 'riding', 'flying']))

# The classes a unit can be. Every certification exam's class (the Pegasus Knight is 54, the playable one; 23 is the foes'), the
# DLC's four (Abyssian Exam Pass), and the unique classes of the units who have them. The rest are the foes' and the story's.
GENERAL = [c for c in range(0, 40) if c not in (6, 17, 23)] + [54, 84, 85, 86, 87]
# Who alone can be in a unique class. Not yet traced in the program: Fire Emblem Wiki's and Serenes Forest's (unconfirmed).
UNIQUE = {
    6: ['edelgard', 'dimitri', 'claude'],   # Lord
    56: ['edelgard'], 40: ['edelgard'],     # Armored Lord, Emperor
    57: ['dimitri'], 44: ['dimitri'],       # High Lord, Great Lord
    58: ['claude'], 17: ['claude'],         # Wyvern Master, Barbarossa
    42: ['byleth-m', 'byleth-f'],           # Enlightened One
    91: ['jeritza'],                        # Death Knight
    43: None,                               # Dancer: anyone (the White Heron Cup's winner)
}
CLASSES = GENERAL + list(UNIQUE)

HOUSE_ROUTES = {'Black Eagles': ['cf', 'ss'], 'Blue Lions': ['am'], 'Golden Deer': ['vw']}
ALL_ROUTES = ['cf', 'ss', 'am', 'vw']

# Persons 0-34 and the DLC's (1040-1043, 1045, 1046) are the playable characters; Jeralt, Rhea and Sothis have records but aren't.
NOT_PLAYABLE = {35, 36, 37, 1044}
DLC = {1040, 1041, 1042, 1043, 1045, 1046}
NO_RECRUIT = {2, 3, 4, 5, 12}   # the house leaders, Hubert and Dedue: no requirement to meet (fixed_lobby_common.bin section 4)

# Routes each unit can be yours on, where it isn't simply "every route" (a student, recruited or in their own house). Joins the
# files don't spell out (the scripted ones) are Serenes Forest's, kept as notes marked unconfirmed until traced.
ROUTES = {
    2: ['cf', 'ss'], 5: ['cf', 'ss'],                     # Edelgard, Hubert (Silver Snow: until the end of Part I)
    3: ['am'], 12: ['am'], 4: ['vw'],                     # Dimitri, Dedue, Claude
    26: ['ss', 'am', 'vw'],                               # Seteth
    30: ['am'],                                           # Gilbert
    32: ['ss', 'am', 'vw'], 34: ['ss', 'am', 'vw'],       # Catherine, Cyril (monastery script: not on the Black Eagles' path before 12)
}
AUTO = {
    26: 'Joins on his own in Chapter 12 (Serenes Forest; not traced).',
    27: 'Joins on her own in Chapter 7 (Serenes Forest; not traced).',
    30: 'Joins on his own on turn 3 of Chapter 13, Azure Moon only (Serenes Forest; the files place him as your unit by script in '
        'scenario 13).',
}
NOTES = {
    15: 'Joins a female Byleth with no requirements (the recruitment record\'s flag).',
    24: 'On the Black Eagles\' path, only from Chapter 12 on Silver Snow (the monastery script).',
    32: 'On the Black Eagles\' path, only from Chapter 12 on Silver Snow, where she joins on her own (Serenes Forest; not traced).',
    33: 'On the Black Eagles\' path she joins on her own in Chapter 12 on Silver Snow (Serenes Forest; not traced).',
    34: 'On the Black Eagles\' path, only from Chapter 12 on Silver Snow, where he joins on his own (Serenes Forest; not traced).',
    1040: 'Cindered Shadows (DLC). In the main story, once Cindered Shadows is cleared (the paralogue A Cursed Relic places him '
          'as your unit or a green one): the conditions aren\'t traced.',
    1041: 'Cindered Shadows (DLC). In the main story, once Cindered Shadows is cleared (the paralogue Black Market Scheme): '
          'the conditions aren\'t traced.',
    1042: 'Cindered Shadows (DLC). In the main story, once Cindered Shadows is cleared (the paralogue A Cursed Relic): the '
          'conditions aren\'t traced.',
    1043: 'Cindered Shadows (DLC). In the main story, once Cindered Shadows is cleared (the paralogue Black Market Scheme): '
          'the conditions aren\'t traced.',
    1045: 'Expansion Pass (DLC). The paralogues The Secret Merchant and the next place him as your unit; the conditions aren\'t '
          'traced.',
    1046: 'Expansion Pass (DLC). Joins after the paralogue The Secret Merchant, which places her as your unit; the conditions '
          'aren\'t traced.',
}
# When units leave and come back (spoilers: blank under the spoiler block). Serenes Forest's, not traced.
AWAY = {
    2: ['Silver Snow: leaves at the end of Part I, in Chapter 11 (Serenes Forest; not traced).'],
    5: ['Silver Snow: leaves at the end of Part I, in Chapter 11 (Serenes Forest; not traced).'],
    27: ['Crimson Flower: leaves in Chapter 11 (Serenes Forest; not traced).'],
    14: ['Recruited from another house, he leaves when Part II begins unless Edelgard or Dimitri leads; defeating him in '
         'Chapter 15 recruits him again (Serenes Forest; not traced).'],
    19: ['Recruited from another house, he leaves when Part II begins unless Edelgard or Claude leads; defeating him in '
         'Chapter 16 recruits him again (Serenes Forest; not traced).'],
    22: ['Crimson Flower: if she wasn\'t recruited, defeating her in Chapter 14 recruits her (Serenes Forest; not traced).'],
}


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def unit_id(c):
    if c['person'] in (0, 1):
        return 'fe16-byleth-' + c['gender'].lower()
    return 'fe16-' + slug(c['name'])


def stats(d, keys=STATS, extra=()):
    return {STAT_OF[k]: v for k, v in d.items() if STAT_OF.get(k) in list(keys) + list(extra)}


def ranks_of(d):
    return {SKILL_OF[k]: v for k, v in d.items() if v}


def when_text(talks):
    """The monastery script's window for a recruitment talk, in plain words."""
    if not talks:
        return None
    t = talks[0]['when']
    if t.startswith('any chapter'):
        return None
    t = t.replace('route is Black Eagles / Silver Snow', "on the Black Eagles' path").replace('route is Blue Lions / Azure Moon', 'Azure Moon')
    t = t.replace('route is Golden Deer / Verdant Wind', 'Verdant Wind').replace('chapter >= ', 'from Chapter ').replace(' and ', ', ')
    return t.strip('()').replace('(', '').replace(')', '')


def build():
    chars = [c for c in U.characters() if c['playable']]
    by_person = {c['person']: c for c in chars}
    classes = {c['id']: c for c in U.classes()}
    names = {c['person']: unit_id(c) for c in chars}
    learn_kind = {}

    units = []
    for c in chars:
        p = c['person']
        uid = unit_id(c)
        rec = c['recruitment']
        house = c['join'].get('house')
        if p in (0, 1):
            how = 'lord'
        elif p in AUTO:
            how = 'auto'
        elif house and p not in NO_RECRUIT:
            how = 'student'
        elif house:
            how = 'house'
        else:
            how = 'recruit'
        recruit = None
        if rec and p not in NO_RECRUIT:
            recruit = {}
            if rec['stat']:
                recruit['stat'] = {'stat': STAT_OF[rec['stat']['stat']], 'value': rec['stat']['value']}
            if rec['skill']:
                recruit['skill'] = {'skill': SKILL_OF[rec['skill']['skill']], 'rank': rec['skill']['rank']}
            if rec['byleth_level'] is not None:
                recruit['bylethLevel'] = rec['byleth_level']
            if rec['auto_with_female_byleth']:
                recruit['femaleByleth'] = True
            w = when_text(c['recruit_talk'])
            if w:
                recruit['window'] = w
        learns = []
        for a in c['abilities']['learned']:
            learns.append({'skill': SKILL_OF[a['skill']], 'rank': a['rank'], 'name': a['name'], 'kind': 'ability'})
        for a in c['arts']:
            learns.append({'skill': SKILL_OF[a['skill']], 'rank': a['rank'], 'name': a['name'], 'kind': 'art'})
        for school, ss in c['spells'].items():
            for s in ss:
                learns.append({'skill': SKILL_OF[school], 'rank': s['rank'], 'name': s['name'], 'kind': 'spell'})
        order = {r: i for i, r in enumerate(U.RANKS)}
        learns.sort(key=lambda x: (list(SKILL_OF.values()).index(x['skill']), order[x['rank']]))
        bud = c['budding_talent']
        personal = [x['name'] for x in (c['abilities']['personal'], c['abilities']['personal_part2']) if x]
        u = {
            'id': uid,
            'name': c['name'],
            'female': c['gender'] == 'F',
            'house': house,
            'allegiance': c['allegiance']['name'],
            'classId': str(c['class']['id']),
            'level': 1,
            'bases': stats(c['bases'], extra=['mov']),
            'growths': stats(c['growths']),
            'caps': stats(c['caps']),
            'crests': [{'name': k['name'], 'minor': k['minor']} for k in c['crests']],
            'ranks': ranks_of(c['skill_ranks']),
            'strengths': [SKILL_OF[k] for k, v in c['proficiency'].items() if v == 'strength'],
            'weaknesses': [SKILL_OF[k] for k, v in c['proficiency'].items() if v == 'weakness'],
            'personal': personal,
            'learns': learns,
            'certified': [str(k['id']) for k in c['certified_classes']],
            'routes': ROUTES.get(p, ALL_ROUTES),
            'join': {'how': how, **({'house': house} if house else {}), **({'note': AUTO[p]} if p in AUTO else {})},
        }
        if bud:
            u['budding'] = {'skill': SKILL_OF[bud['skill']], 'name': bud['unlocks']['name'], 'kind': bud['unlocks']['kind']}
        if recruit is not None:
            u['recruit'] = recruit
        if p in NOTES:
            u['notes'] = [NOTES[p]]
        if p in AWAY:
            u['away'] = AWAY[p]
        if p in DLC:
            u['dlc'] = True
        units.append(u)

    out_classes = {}
    for n in CLASSES:
        c = classes[n]
        cert = c['certification']
        who = UNIQUE.get(n)
        cls = {
            'id': str(n),
            'name': c['name'],
            'tier': c['tier_name'],
            'level': c['level_needed'] or 0,
            'bases': stats(c['bases'], keys=STATS[:-1]),
            'growths': stats(c['growths'], extra=['mov']),
            'boosts': stats(c['boosts'], extra=['mov']),
            'types': c['class_types'],
            'gender': {'M': 'male', 'F': 'female'}.get(cert['gender'], 'any'),
            'mastery': [x['name'] for x in (c['mastery_ability'], c['mastery_art']) if x],
            'abilities': [x['name'] for x in c['class_abilities']],
        }
        if c['name_female']:
            cls['nameFemale'] = c['name_female']
        mount = {STAT_OF[k]: v for k, v in c['mount_bonus'].items() if v}
        if mount:
            cls['mount'] = mount
        if n in GENERAL:
            cls['exam'] = {'seal': cert['item']['name'] if cert['item'] else None, 'ranks': ranks_of(cert['ranks'])}
        if who is not None:
            cls['who'] = ['fe16-' + w for w in who]
        if n == 43:
            cls['unique'] = True
        if n in (84, 85, 86, 87):
            cls['dlc'] = True
        out_classes[str(n)] = cls

    supports = []
    for s in U.supports():
        if not s['talks']:
            continue
        pairs = []
        if s['a'] in (0, 1):
            for g, flag in (('m', 's_male_byleth'), ('f', 's_female_byleth')):
                talks = [t for t in s['talks'] if t != 'S' or s.get(flag)]
                pairs.append(('fe16-byleth-' + g, talks))
        else:
            pairs.append((names.get(s['a']), s['talks']))
        for a, talks in pairs:
            b = names.get(s['b'])
            sup = {'a': a, 'b': b or 'fe16-' + slug(s['b_name']), 'talks': talks}
            if not b:
                sup['npc'] = s['b_name']
            if s['paired_ending']:
                sup['pairedEnding'] = True
            supports.append(sup)

    abilities = {a['name']: a['description'] for a in U.abilities() if a['name']}
    arts = {a['name']: a['description'] for a in U.arts() if a['name']}
    spells = {s['name']: s['description'] for s in U.spells() if s['name']}
    rank_rewards = [{'skill': SKILL_OF[r['skill']], 'rank': r['rank'], 'name': r['name'], 'kind': r['kind']} for r in U.rank_rewards()]
    crests = {c['name']: c['description'] for c in U.crests() if c['name']}
    return units, out_classes, supports, abilities, arts, spells, rank_rewards, crests


def ts(v):
    return json.dumps(v, ensure_ascii=False, indent=2)


def main():
    units, classes, supports, abilities, arts, spells, rank_rewards, crests = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    body = f'''// Generated by scripts/build-fe16-units.py from the user's own Three Houses dump (1.2.0 and the DLC). Don't edit by hand.
import type {{ Fe16Class, Fe16Learn, Fe16Support, Fe16Unit }} from '../../houses/types'

export const FE16_UNITS: Fe16Unit[] = {ts(units)}

export const FE16_CLASSES: Record<string, Fe16Class> = {ts(classes)}

export const FE16_SUPPORTS: Fe16Support[] = {ts(supports)}

/** What every unit learns at each skill rank (fixed_persondata.bin section 12). */
export const FE16_RANK_REWARDS: Fe16Learn[] = {ts(rank_rewards)}

/** Every ability, combat art, spell and crest, by name, with the game's help text. */
export const FE16_ABILITIES: Record<string, string> = {ts(abilities)}
export const FE16_ARTS: Record<string, string> = {ts(arts)}
export const FE16_SPELLS: Record<string, string> = {ts(spells)}
export const FE16_CRESTS: Record<string, string> = {ts(crests)}
'''
    open(OUT, 'w', encoding='utf-8', newline='\n').write(body)
    print(f'{len(units)} units, {len(classes)} classes, {len(supports)} supports, {len(abilities)} abilities, {len(arts)} arts, '
          f'{len(spells)} spells -> {os.path.relpath(OUT)}')


if __name__ == '__main__':
    main()
