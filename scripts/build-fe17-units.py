"""Write src/data/fe17/fe17Units.ts: Fire Emblem Engage's units, classes, emblems, supports and stat boosters, from the user's own
dump (the 2.0.0 update, the Expansion Pass's content in it), as scripts/fe17_extract.py copies it out and scripts/fe17_units.py
reads it. Formats and the mechanics traced in the program: data-raw/fe17/README.md.

    python scripts/fe17_extract.py      (once: copies the files out of the NSPs)
    python scripts/build-fe17-units.py
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fe17_units as U  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data', 'fe17', 'fe17Units.ts')

STAT = {'HP': 'hp', 'Str': 'str', 'Mag': 'mag', 'Dex': 'dex', 'Spd': 'spd', 'Def': 'def', 'Res': 'res', 'Lck': 'lck', 'Bld': 'bld',
        'Mov': 'mov'}
SEAL = {'Master Seal': 'master', 'Second Seal': 'second'}
# The bond ring sets by the game's own short title for each (ring.xml's RNID_<series>_...), named as this app names the games and
# in the order they came out, as the home screen lists them; the Expansion Pass's three from Heroes last.
RING_SERIES = [
    ('紋章', 'Mystery of the Emblem'),        # 紋章の謎 (Kris, Katarina and Legion are New Mystery's)
    ('聖戦', 'Genealogy of the Holy War'),    # 聖戦の系譜
    ('トラキア', 'Thracia 776'),
    ('封印', 'The Binding Blade'),            # 封印の剣
    ('烈火', 'The Blazing Blade'),            # 烈火の剣
    ('聖魔', 'The Sacred Stones'),            # 聖魔の光石
    ('蒼炎', 'Path of Radiance'),             # 蒼炎の軌跡
    ('暁', 'Radiant Dawn'),                   # 暁の女神
    ('覚醒', 'Awakening'),
    ('IF', 'Fates'),
    ('外伝', 'Shadows of Valentia'),          # Gaiden's remake, as the rings' own help says
    ('風花', 'Three Houses'),                 # 風花雪月
    ('DLC1コモン', 'Heroes'),                 # the Expansion Pass's Alfonse, Sharena and Anna
]


def stats(d, keep=STAT):
    return {STAT[k]: v for k, v in (d or {}).items() if k in keep}


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower().replace('é', 'e').replace('è', 'e')).strip('-')


def round_grow(x):
    """UnitUtil.GetRoundGrow (0x1c759d0): max((x + 50) / 100, 0), the division truncating."""
    return max(int((x + 50) / 100), 0)


def chapter_order(chapters):
    """The story as the spoiler block walks it: the Prologue and the chapters in order, each paralogue after the chapter that opens
    it; the Divine Paralogues and Fell Xenologue (the Expansion Pass's, from the Somniel) after Chapter 6, which opens them."""
    main = [c for c in chapters if c.startswith('CID_M')]
    side = {}
    for cid, c in chapters.items():
        if cid.startswith('CID_S') and c['opens_after']:
            side.setdefault('CID_' + c['opens_after'], []).append(cid)
    dlc = [c for c in chapters if c.startswith('CID_G')] + [c for c in chapters if c.startswith('CID_E')]
    out = []
    for cid in main:
        out.append(cid)
        out += side.get(cid, [])
        if cid == 'CID_M006':
            out += dlc
    return out


def chapter_label(c):
    prefix = c['prefix']
    return f"{prefix}: {c['name']}" if prefix in ('Paralogue', 'Divine Paralogue') else prefix


def build():
    d = U.build(None)
    job_id = {c['jid']: slug(c['name']) for c in d['classes']}
    # Classes sharing an English name (the three Fell Childs...) get the person's name too.
    seen = {}
    for c in d['classes']:
        seen.setdefault(slug(c['name']), []).append(c['jid'])
    for name, jids in seen.items():
        if len(jids) > 1:
            for i, jid in enumerate(jids):
                job_id[jid] = f'{name}-{i + 1}'
    pid_id = {u['pid']: 'fe17-' + slug(u['name']) for u in d['units']}
    names = {u['pid']: u['name'] for u in d['units']}

    classes = {}
    for c in d['classes']:
        cls = {
            'id': job_id[c['jid']],
            'jid': c['jid'],
            'name': c['name'],
            'help': c['help'],
            'tier': c['tier'],
            'maxLevel': c['max_level'],
            'internalLevel': c['internal_level'],
            'moveType': c['move_type'],
            'style': c['battle_style'],
            'bases': stats(c['bases']),
            'caps': stats(c['caps']),
            'growths': stats(c['growth_modifiers']),
            'weapons': [{'weapon': w['weapon'], 'use': w['use'], 'rank': w['max_rank'], **({'plus': True} if w['plus_with_innate'] else {})}
                        for w in c['weapons']],
            'needs': {'all': c['proficiency_needed']['all_of'], 'choose': c['proficiency_needed']['choose'],
                      'from': c['proficiency_needed']['from']},
            'skills': [s['name'] for s in c['skills'] if s.get('name')],
            'promotesTo': [job_id[p['jid']] for p in c['promotes_to'] if p['jid'] in job_id],
            'promotesFrom': [job_id[p['jid']] for p in c['promotes_from'] if p['jid'] in job_id],
        }
        if c['learned_skill'] and c['learned_skill'].get('name'):
            cls['learns'] = {'skill': c['learned_skill']['name'], 'level': 25 if c['max_level'] > 39 else 5}
        if c['female_only']:
            cls['femaleOnly'] = True
        if c['unique_to']:
            cls['uniqueTo'] = [pid_id[p] for p in c['unique_to'] if p in pid_id]
        if c['expansion_pass']:
            cls['expansionPass'] = True
        if c['class_change_items']:
            cls['items'] = [i['name'] for i in c['class_change_items']]
        classes[cls['id']] = cls

    order = chapter_order(d['chapters'])
    chapters = [{'id': cid, 'label': chapter_label(d['chapters'][cid])} for cid in order]
    place = {cid: i for i, cid in enumerate(order)}
    # Each emblem's ring from the first chapter that gives it (fe17_units.build_emblem_joins: every site; the earliest counts).
    emblem_join = {gid: min(sites, key=lambda s: place[s['cid']])['cid'] for gid, sites in d['emblem_joins'].items()}
    # The Somniel first follows the first chapter flagged Hub; the Expansion Pass's rings from Heroes come there
    # (HubSequence.ContentsEvent -> ContentsRewardSequence.RewordAll, data-raw/fe17/README.md 2.12).
    first_hub = next(cid for cid in order if d['chapters'][cid]['hub'])

    units = []
    for u in d['units']:
        cls = next(c for c in d['classes'] if c['jid'] == u['class']['jid'])
        total = u['auto_level_total']
        grow = u['growths']
        # The unit's own stats, kept apart from the class's bases (Unit.m_BaseCapability): the person's offset plus the averaged
        # growths over the levels the game auto-levels them by (CalculateAutoGrowCapability 0x1a0e0a0), Mov 0 to 2.
        own = {}
        for k, key in STAT.items():
            off = u['stat_offsets'].get(k, 0)
            v = off + (round_grow(grow[k] * (total - 1)) if k in grow else 0)
            own[key] = max(0, min(2, v)) if key == 'mov' else max(-120, min(120, v))
        unit = {
            'id': pid_id[u['pid']],
            'name': u['name'],
            'female': u['gender'] == 'female',
            'classId': job_id[u['class']['jid']],
            'level': u['level'],
            'internalLevel': u['internal_level'],
            'own': own,
            'joinStats': stats(u['join_stats']),
            'growths': stats(u['growths']),
            'capMods': stats(u['cap_modifiers']),
            'innate': u['proficiencies']['innate'],
            'proficiencies': u['proficiencies']['at_join'],
            'personal': [s['name'] for s in u['personal_skills'] if s.get('name')],
            'sp': u['starting_sp'],
            'supportType': u['support_category']['name'],
            'joinChapter': u['join']['cid'],
            'join': {'how': u['join']['how'], 'note': u['join']['note']},
        }
        if u['expansion_pass']:
            unit['expansionPass'] = True
        dp = u['death_protection']
        if dp:
            # Unit.IsExistDie (0x1a22540): until then they can't be lost (UnitUtil.GetDieType gives Exist, not Die).
            where = d['chapters'].get(dp['until_cid'] or '', {}).get('prefix', '')
            unit['protected'] = 'always' if dp['timing'] == 'Eternal' else f"until {where} {'begins' if dp['timing'] == 'Begin' else 'ends'}"
        
        units.append(unit)

    emblems = []
    for e in d['emblems']:
        if not e.get('levels'):
            continue
        levels = []
        for lv in e['levels']:
            levels.append({
                'level': lv['bond_level'],
                'inherit': [{'name': s['name'], 'sp': s['sp']} for s in lv['inheritable_new'] if s.get('name')],
                'sync': [s['name'] for s in lv['sync_skills'] if s.get('name')],
                'engage': [s['name'] for s in lv['engage_skills'] if s.get('name')],
                'stats': stats(lv['sync_stat_bonus']),
                'proficiency': lv['proficiency_granted'],
                **({'weapons': lv['engage_weapons_new']} if lv.get('engage_weapons_new') else {}),
            })
        emblems.append({
            'id': 'fe17-' + slug(e['name']),
            'name': e['name'],
            'joinChapter': emblem_join[e['gid']],
            **({'ring': e['ring_name']} if e['ring_name'] else {}),
            **({'expansionPass': True} if e['expansion_pass'] else {}),
            **({'engageAttack': e['engage_attack']['name']} if (e['engage_attack'] or {}).get('name') else {}),
            'bondCap': e['bond_level_cap'],
            'levels': levels,
        })

    supports = []
    for p in d['supports']['pairs']:
        if p['a'] in pid_id and p['b'] in pid_id:
            supports.append({'a': pid_id[p['a']], 'b': pid_id[p['b']], 'top': p['max_rank']})

    skills = {}
    for sid, s in d['skills'].items():
        if s.get('name') and s.get('help') and not s.get('hidden'):
            skills.setdefault(s['name'], s['help'])
    boosters = [{'name': b['name'], 'raises': stats(b['raises'])} for b in d['stat_boosters']]

    rings = list(d['bond_rings']['rings'].values())
    assert {r['series'] for r in rings} == {s for s, _ in RING_SERIES}, {r['series'] for r in rings}
    bond_rings = []
    for series, game in RING_SERIES:
        members = [r for r in rings if r['series'] == series]
        first = members[0]
        bond_rings.append({
            'game': game,
            **({'emblem': first['emblem'], 'world': first['world']} if first['emblem'] else {}),
            'joinChapter': emblem_join[first['gid']] if first['gid'] else first_hub,
            **({'expansionPass': True} if series.startswith('DLC') else {}),
            'rings': [{
                'name': r['name'],
                'ranks': [{'rank': rank, 'stats': stats(v['stat_bonus']),
                           **({'skills': [s['name'] for s in v['skills'] if s.get('name')]} if v['skills'] else {})}
                          for rank, v in r['ranks'].items()],
            } for r in members],
        })
    return units, classes, emblems, supports, skills, boosters, chapters, names, bond_rings


def ts(v):
    return json.dumps(v, ensure_ascii=False, indent=2)


def main():
    units, classes, emblems, supports, skills, boosters, chapters, _, bond_rings = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    body = f'''// Generated by scripts/build-fe17-units.py from the user's own Engage dump (2.0.0, the Expansion Pass included). Don't edit by hand.
import type {{ Fe17BondRingSet, Fe17Booster, Fe17Chapter, Fe17Class, Fe17Emblem, Fe17Support, Fe17Unit }} from '../../engage/types'

/** The story as the spoiler block walks it: the chapters, each paralogue after the chapter that opens it, the Expansion Pass's after
 * Chapter 6. */
export const FE17_CHAPTERS: Fe17Chapter[] = {ts(chapters)}

export const FE17_UNITS: Fe17Unit[] = {ts(units)}

export const FE17_CLASSES: Record<string, Fe17Class> = {ts(classes)}

export const FE17_EMBLEMS: Fe17Emblem[] = {ts(emblems)}

/** The bond rings, a set for each game (ring.xml), in the order the games came out. */
export const FE17_BOND_RINGS: Fe17BondRingSet[] = {ts(bond_rings)}

export const FE17_SUPPORTS: Fe17Support[] = {ts(supports)}

/** Every skill a unit can show, by name, with the game's help text. */
export const FE17_SKILLS: Record<string, string> = {ts(skills)}

export const FE17_BOOSTERS: Fe17Booster[] = {ts(boosters)}
'''
    open(OUT, 'w', encoding='utf-8', newline='\n').write(body)
    print(f'{len(units)} units, {len(classes)} classes, {len(emblems)} emblems, {sum(len(s["rings"]) for s in bond_rings)} bond rings, '
          f'{len(supports)} supports, {len(skills)} skills, {len(chapters)} chapters -> {os.path.relpath(OUT)}')


if __name__ == '__main__':
    main()
