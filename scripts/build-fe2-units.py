"""
Build src/data/fe2/fe2Units.ts from the user's own Fire Emblem Gaiden ROM (the Famicom game, with an English fan translation patched in;
see data-raw/fe2/README.md): both armies, who joins where and how, their bases and growths, the classes and the Mila statues' class
changes, the spells each learns, and the special attacks.

Run: python scripts/build-fe2-units.py   (FE2_ROM overrides where the ROM is)
"""
import json
import os
import re

from fe2_rom import Rom
from fe2_units import DREAD_FIGHTER, FE2, FIGHTER, HERO, PRIESTESS, ROYAL, SOV_NAMES, VILLAGER, build, growth_chance

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'data', 'fe2', 'fe2Units.ts')
FE15 = os.path.join(ROOT, 'src', 'data', 'fe15', 'fe15Units.ts')
STATS = ['hp', 'str', 'skl', 'spd', 'lck', 'def', 'res', 'mov']
GROWING = ['hp', 'str', 'skl', 'spd', 'lck', 'def']
CAPS = {'hp': 52, 'str': 40, 'skl': 40, 'spd': 40, 'lck': 40, 'def': 40}     # 9:$88CD-$88D9
CELICA_CLASS = '11c'      # her Priestess, kept apart from the Priestess a Mage (women) becomes, so only she gets the story promotion
MAGIC_CLASSES = {PRIESTESS, 15, 16, 17, 18, 19}
# Shadows of Valentia's official English for each class, as the app shows them (the units' are SOV_NAMES in fe2_units.py); both
# checked against src/data/fe15/fe15Units.ts below. The translation's class names are short and four of them read "Knight".
SOV_CLASSES = {1: 'Cavalier', 2: 'Knight', 3: 'Pegasus Knight', 4: 'Paladin', 5: 'Falcon Knight', 6: 'Soldier', 7: 'Gold Knight',
               8: 'Mercenary', 9: 'Myrmidon', 10: 'Dread Fighter', 11: 'Priestess', 12: 'Archer', 13: 'Sniper', 14: 'Villager',
               15: 'Mage', 16: 'Mage', 17: 'Saint', 18: 'Cleric', 19: 'Sage', 20: 'Bow Knight', 21: 'Fighter', 22: 'Baron', 23: 'Hero',
               24: 'Princess'}

ALM_PROMOTION = ("Alm promotes when Celica's army talks to Hark at the Sage Village (Chapter 4; 13:$96B4): his level becomes 1 and "
                 "his EXP 0, and HP, Str, Skl, Spd, Lck and Def are each lifted to the Hero's bases where lower, or max HP rises by 1 "
                 "if none is (8:$A96F). His class stays Fighter's (a flag, $744A, names him Hero and lets him use bows), so his Mov "
                 "stays 5.")
CELICA_PROMOTION = ("Celica promotes in a scene at Fort Geeth (Chapter 3; walking onto its spot, 13:$97D8): her level becomes 1 and "
                    "nothing else changes. Her class stays the Priestess's (a flag, $744B, gives her the Princess's name, Royal in the "
                    "translation).")
WEAPON_NOTES = {
    6: 'not the Hand Lance or the Galdius (15:$F46F)',
    FIGHTER: "the Falcion and the Royal Sword are his alone (15:$D9F4); bows once he is a Hero (15:$F4FA)",
}
MAGIC_NOTE = "the spells are the unit's own, learned by level"
# The monsters Angel is effective against: its list is classes 3, 5, 11, 17 and 18, the foes' Gargoyle, Dragon Zombie, Zombie, Skeleton
# and Bigl (README: the foe classes share the numbers); the translation's menus cut them short ("Gargoyl", "DZombi").
MONSTERS = {3: 'Gargoyles', 5: 'Dragon Zombies', 11: 'Zombies', 17: 'Skeletons', 18: 'Bigls'}
THUNDER = 24
# What the white magic spells do: the ROM has no help text, so these are Serenes Forest's Gaiden white magic notes (fetched 2026-11-06).
WHITE_MAGIC = {
    'Recover': "Restores an adjacent ally's HP by the caster's Str (Serenes Forest).",
    'Libro': "Restores an ally's HP by the caster's Str, at any range (Serenes Forest).",
    'Drain': "Restores the caster's HP by the damage it does; it can harm Duma once he's at 52 HP or less (Serenes Forest).",
    'Warp': 'Sends an adjacent ally to any space they could stand on (Serenes Forest).',
    'Reserve': "Restores every ally's HP by the caster's Str (Serenes Forest).",
    'Illusion': "Summons allies: Silque's Dread Fighters, Genny's Soldiers, Tatiana's Pegasus Knights (Serenes Forest).",
    'Dear': 'Removes a number of monsters from the map (Serenes Forest).',
}


def spell_range(i, bits):
    """A spell's range from its bits (15:$DAFD): 0x02 next to the caster, 0x04 two tiles away (Thunder three, 6:$A646), 0x20 any."""
    if bits & 0x20:
        return 'any'
    far = 3 if i == THUNDER else 2 if bits & 0x04 else 1
    return '1' if far == 1 else f'1-{far}'


def main():
    data = build(FE2(Rom()))
    by_char = {u['character']: u for u in data['units']}
    unit_id = {ch: f"fe2-{re.sub(r'[^a-z0-9]+', '-', u['name'].lower()).strip('-')}" for ch, u in by_char.items()}
    fe15 = open(FE15, encoding='utf-8').read()
    for name in list(SOV_NAMES.values()) + list(SOV_CLASSES.values()):
        assert f'"name": "{name}"' in fe15, name

    stories = data['stories']
    chapters = [{'id': f"fe2-{c['story']}-{c['number']}", 'label': f"Ch.{c['number']}", 'story': c['story']} for c in data['chapters']]

    units = []
    for u in sorted(data['units'], key=lambda u: (u['story'] != 'alm', u['chapter'], u['join']['how'] != 'start',
                                                   u['join'].get('script', 0))):
        j = u['join']
        join = {'how': j['how'], **({'with': j['with']} if j.get('with') else {}), 'note': j['note']}
        units.append({
            'id': unit_id[u['character']], 'story': u['story'], 'name': u['name'],
            **({'altName': u['translationName']} if u['translationName'] != u['name'] else {}),
            'classId': CELICA_CLASS if u['character'] == 2 else str(u['class']), 'level': u['level'],
            'joinChapter': f"fe2-{u['story']}-{u['chapter']}", 'join': join,
            'bases': {s: u['bases'][s] for s in STATS},
            'growths': {s: u['growths'][s] for s in GROWING},
            'ranks': {},
        })

    # Classes: the game's 1-22, 23 (the Hero bases Alm's promotion uses), 24 (Celica's promoted name) and Celica's own Priestess.
    raw = {int(k): c for k, c in data['classes'].items()}
    changes = {}
    for ch in data['classChanges']:
        changes.setdefault(ch['from'], []).append((ch['to'], ch['level']))
    villager = data['villagerClasses']
    weapons = {int(k): v for k, v in data['weapons'].items()}

    def cls_entry(k, cid=None):
        c = raw[k]
        bases = {s: c['bases'][s] for s in ['hp', 'str', 'skl', 'spd', 'lck', 'def']}
        # Res: a unit's own; the class adds 15 only to a Dread Fighter (6:$8C47). The class's own Res byte (15:$EDEA) is the foes'.
        bases['res'] = data['dreadFighterRes'] if k == DREAD_FIGHTER else 0
        bases['mov'] = c['mov']
        e = {'id': cid or str(k), 'name': SOV_CLASSES[k], 'bases': bases, 'caps': dict(CAPS), 'maxLevel': 20}
        if k == VILLAGER:
            e['promotesTo'] = str(villager[0])
            e['promotions'] = [str(t) for t in villager]
            e['promoteLevel'] = 3
            odds = ', '.join(f"{SOV_CLASSES[t]} {round(data['villagerOdds'][i] * 256)} in 256" for i, t in enumerate(villager))
            e['changeNote'] = (f'at a Mila statue from Lv 3 the goddess picks one of the five at random ({odds}); you can say no and ask '
                               'again, so the plan picks the one wanted (8:$A83D, 8:$A8F2).')
        elif k in changes:
            (to, level), = changes[k]
            e['promotesTo'] = str(to)
            e['promotions'] = [str(to)]
            e['promoteLevel'] = level
        w = list(weapons.get(k, []))
        if k == FIGHTER:
            w = [x for x in w if x != 'Bow']
        e['weapons'] = w
        notes = [WEAPON_NOTES[k]] if k in WEAPON_NOTES else []
        if k in MAGIC_CLASSES:
            notes.append(MAGIC_NOTE)
        if notes:
            e['weaponsNote'] = '; '.join(notes)
        return e

    targets = {t for lst in changes.values() for t, _ in lst} - {VILLAGER}
    classes = {}
    for k in range(1, 23):
        e = cls_entry(k)
        if k in targets:
            e['promoted'] = True
        if k == FIGHTER:
            e.update({'promotesTo': str(HERO), 'promotions': [str(HERO)], 'promoteLevel': 1, 'storyPromotion': ALM_PROMOTION})
        classes[str(k)] = e
    hero = cls_entry(HERO)
    hero['bases']['mov'] = raw[FIGHTER]['mov']   # Alm keeps the Fighter's class number, so the Fighter's Mov (6:$8C2D)
    hero['weapons'] = ['Sword', 'Bow']
    hero['weaponsNote'] = "Alm's alone: the Falcion and the Royal Sword are his (15:$D9F4)"
    hero['promoted'] = True
    classes[str(HERO)] = hero
    celica = cls_entry(PRIESTESS, CELICA_CLASS)
    celica.update({'promotesTo': str(ROYAL), 'promotions': [str(ROYAL)], 'promoteLevel': 1, 'storyPromotion': CELICA_PROMOTION})
    classes[CELICA_CLASS] = celica
    royal = {'id': str(ROYAL), 'name': SOV_CLASSES[ROYAL], 'bases': {s: 0 for s in STATS}, 'caps': dict(CAPS), 'maxLevel': 20,
             'weapons': list(classes[str(PRIESTESS)]['weapons']), 'weaponsNote': MAGIC_NOTE, 'promoted': True, 'keepsStats': True}
    royal['bases']['mov'] = raw[PRIESTESS]['mov']
    classes[str(ROYAL)] = royal

    # Spells: what each knows on joining and learns later. `level` is the game's count: the level they join at counts as 1, and so
    # does becoming a Mage from a Villager (8:$AA24 starts the count again); other class changes carry the count on (1:$AE18).
    # `atLevel`: the level that comes to in the class they join in, for those who join as a caster and get there without changing.
    # A class can reach a casting class through its class changes (a Villager's five, a Dread Fighter's Villager...)?
    reach = {}
    for k in range(1, 23):
        seen, todo = set(), [k]
        while todo:
            c = todo.pop()
            if c not in seen:
                seen.add(c)
                todo += [t for t, _ in changes.get(c, [])] + (list(villager) if c == VILLAGER else [])
        reach[k] = bool(seen & MAGIC_CLASSES)
    spells = {}
    for u in data['units']:
        sp = u['spells']
        # Mycen's entry in the learning table (Aura at 17) can't be reached: a Gold Knight never changes class.
        if not sp['known'] and not sp['learn'] or not reach[u['class']]:
            continue
        caster = u['class'] in MAGIC_CLASSES
        learn = []
        for x in sp['learn']:
            at = u['level'] + x['level'] - 1
            learn.append({'level': x['level'], **({'atLevel': at} if caster and at <= 20 else {}), 'spell': x['spell']})
        spells[unit_id[u['character']]] = {'known': sp['known'], 'learn': learn}
    class_spells = {str(k): c['spells'] for k, c in raw.items() if c.get('spells')}
    class_spells[CELICA_CLASS] = class_spells[str(PRIESTESS)]
    class_spells[str(ROYAL)] = class_spells[str(PRIESTESS)]
    change_spells = {'15': data['spellOnChange']['mage'], '19': data['spellOnChange']['sage'],
                     str(PRIESTESS): data['spellOnChange']['priestess'], '17': data['spellOnChange']['saint']}

    # Every spell a unit can get: its numbers from the item tables, and what it does.
    spell_stats = {}
    for i in data['classSpellItems']:
        sp = data['spells'][i]
        white = i >= 40
        notes = []
        if sp['effective']:
            notes.append('Mt x3 against ' + ', '.join(MONSTERS[c] for c in sp['effective'][:-1]) + f" and {MONSTERS[sp['effective'][-1]]} (9:$82DD).")
        if i == THUNDER:
            notes.append('Reaches three tiles, where the other attack spells reach two (6:$A646).')
        attack = not white or sp['hit']
        spell_stats[sp['name']] = {
            'kind': 'White magic' if white else 'Black magic', **({'mt': sp['might']} if attack else {}), **({'hit': sp['hit']} if sp['hit'] else {}),
            **({'crit': sp['crit']} if attack else {}), 'range': spell_range(i, sp['range']), 'hp': sp['hpCost'],
            **({'text': WHITE_MAGIC[sp['name']]} if sp['name'] in WHITE_MAGIC else {}), **({'notes': notes} if notes else {}),
        }

    expected = {unit_id[u['character']]: u['expectedGains'] for u in data['units']}
    items = {unit_id[u['character']]: u['item'] for u in data['units'] if u['item']}
    menu_names = {unit_id[u['character']]: u['menuName'] for u in data['units']}
    translation_classes = {str(k): raw[k]['name'] for k in sorted(raw)}
    sov_units = {unit_id[ch]: SOV_NAMES[ch] for ch in by_char}
    sov_classes = {str(k): v for k, v in SOV_CLASSES.items()}
    sov_classes[CELICA_CLASS] = SOV_CLASSES[PRIESTESS]
    chance = [round(growth_chance(g), 6) for g in range(101)]
    villager_odds = {str(t): data['villagerOdds'][i] for i, t in enumerate(villager)}
    special = [
        {'units': [unit_id[32], unit_id[31], unit_id[33]],
         'text': 'Triangle attack: when one of the three attacks a foe next to her with the other two on the four tiles around her, her '
                 'strikes do 5 more damage and are criticals (6:$9C20, 9:$830F, 9:$8556).'},
        {'units': [unit_id[1], unit_id[2]],
         'text': f"When {by_char[1]['name']} attacks a foe next to him with {by_char[2]['name']} on one of the four tiles around him, "
                 'his strikes do 5 more damage and are criticals (6:$AAF6, 9:$830F, 9:$8556).'},
    ]
    for attack in special:
        for u in units:
            if u['id'] in attack['units']:
                u.setdefault('traits', []).append(attack['text'])

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    lines = [
        "// Generated by scripts/build-fe2-units.py from the user's own Fire Emblem Gaiden ROM (English fan translation). Don't edit by hand.",
        "import type { GbaChapter, GbaClass, GbaSpellInfo, GbaStats, GbaStory, GbaUnit } from '../../gba/types'",
        '',
        f'export const FE2_STORIES: GbaStory[] = {js(stories)}',
        '',
        f'export const FE2_CHAPTERS: GbaChapter[] = {js(chapters)}',
        '',
        '// Names are Shadows of Valentia\'s official ones; `altName` is the translation\'s (its dialogue\'s where it gives one, else its',
        '// menus\' four or five letters), as the patched game shows it.',
        'export const FE2_UNITS: GbaUnit[] = [',
        *[f'  {js(u)},' for u in units],
        ']',
        '',
        '// The game\'s classes by number; "23" is the Hero Alm becomes (its bases are read for his promotion; he keeps the Fighter\'s',
        '// class number and Mov), "24" the name Celica takes, "11c" her Priestess (the game\'s 11, kept apart so only she promotes).',
        '// Res in bases is what the class adds to your units\' own: 15 for the Dread Fighter, else nothing.',
        'export const FE2_CLASSES: Record<string, GbaClass> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in classes.items()],
        '}',
        '',
        '// The average gain per level (x100) of each stat: the six rolls of a level-up are r, r + 55 ... of one random byte, and a',
        '// level-up where every roll fails adds 1 HP (9:$8858). Doubled with the Angel Ring equipped.',
        'export const FE2_EXPECTED_GROWTHS: Record<string, Partial<GbaStats>> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in expected.items()],
        '}',
        '',
        '// The real chance of a listed growth G (index): ceil(256 (G - 1) / 99) / 256 (9:$889B).',
        f'export const FE2_GROWTH_CHANCE: number[] = {js(chance)}',
        '',
        '// A Villager\'s class change at Lv 3 is a random one of these (8:$A83D), with these chances; you can say no and try again.',
        f'export const FE2_VILLAGER_CLASSES: Record<string, number> = {js(villager_odds)}',
        '',
        '// Spells: known on joining, and learned at the game\'s count of levels (`level`: the joining level counts as 1, and so does',
        '// becoming a Mage from a Villager; other class changes carry it on). `atLevel`: where that falls in the class they join in.',
        'export const FE2_SPELLS: Record<string, { known: string[]; learn: { level: number; atLevel?: number; spell: string }[] }> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in spells.items()],
        '}',
        '',
        '// Each casting class\'s eight spells (a unit learns a spell only while its class has it), and the spell a class change into',
        '// a class gives (a Mage from a Villager knows Fire alone).',
        f'export const FE2_CLASS_SPELLS: Record<string, string[]> = {js(class_spells)}',
        f'export const FE2_CLASS_CHANGE_SPELLS: Record<string, string> = {js(change_spells)}',
        '',
        '// Every spell a unit can get: Mt, Hit, Crit, range and the HP it costs (15:$D9B9, $DA54, $DA84, $DAFD, $D9F4), and what it does.',
        'export const FE2_SPELL_STATS: Record<string, GbaSpellInfo> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in spell_stats.items()],
        '}',
        '',
        f'export const FE2_STARTING_ITEMS: Record<string, string> = {js(items)}',
        '',
        '// The units\' and classes\' names in the translation\'s menus, and Shadows of Valentia\'s official English (the names shown).',
        f'export const FE2_MENU_NAMES: Record<string, string> = {js(menu_names)}',
        f'export const FE2_MENU_CLASS_NAMES: Record<string, string> = {js(translation_classes)}',
        f'export const FE2_SOV_NAMES: Record<string, string> = {js(sov_units)}',
        f'export const FE2_SOV_CLASS_NAMES: Record<string, string> = {js(sov_classes)}',
        '',
        '// The only fixed bonuses between units: two special attacks.',
        f'export const FE2_SPECIAL_ATTACKS: {{ units: string[]; text: string }}[] = {js(special)}',
        '',
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(units)} units, {len(classes)} classes, {len(chapters)} chapters, {len(spells)} with spells -> {OUT}')


if __name__ == '__main__':
    main()
