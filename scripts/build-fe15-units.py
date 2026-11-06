"""
Build src/data/fe15/fe15Units.ts from the user's own Shadows of Valentia dump (data-raw/fe15/romfs, from scripts/fe15_extract.py; see
data-raw/fe15/README.md): both armies, who joins where and how (the event sheets, scripts/fe15_joins.py), their bases, growths and
maximums, the class tree, and the supports (who, what each rank gives, the points each needs
and the act it opens in).

Run: python scripts/build-fe15-units.py
"""
import json
import os

import fates_text
from fates_lz import decompress
from fe13_bin import Bin
import fe15_bin as FB
import fe15_joins as J
from class_weapons import fe15_class_weapons
from fe15_recruitment import RECRUITMENT

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ROMFS = os.path.join(ROOT, 'data-raw', 'fe15', 'romfs')
OUT = os.path.join(ROOT, 'src', 'data', 'fe15', 'fe15Units.ts')
STATS = ['hp', 'str', 'skl', 'spd', 'lck', 'def', 'res']  # Atk in the GBA screens' Str place
PERSON, JOB = 168, 160
ARMIES = {'BID_アルム軍': 'alm', 'BID_セリカ軍': 'celica'}
# The level a class must reach to change into the next (Serenes Forest's class-change page; not found in the class data). Villagers
# change at 3; Mage (F) into Priestess at 14.
CHANGE_LEVEL = {
    'Villager': 3, 'Mercenary': 7, 'Myrmidon': 10, 'Dread Fighter': 10, 'Soldier': 7, 'Knight': 10, 'Archer': 7, 'Sniper': 10,
    'Cavalier': 7, 'Paladin': 10, 'Mage': 12, 'Pegasus Knight': 12, 'Cleric': 12, 'Fighter': 1, 'Priestess': 1,
}
MAGE_F = 14
# Job.bin's 魔法成長 (+23): which of a person's two spell lists a class uses (0x1a9d0c): 1 the black magic one (Person.bin's 習得魔法系),
# 2 the white magic one (習得神聖系); 0 none.
SPELL_LISTS = {1: ('習得魔法系', 'Black magic'), 2: ('習得神聖系', 'White magic')}
# The Dread Fighter's change back to a Villager (Job.bin's CC_魔戦士男, Lv 10): the way a Mercenary or Myrmidon reaches a Mage.
DREAD_FIGHTER, VILLAGER_M = 'JID_魔戦士男', 'JID_村人男'
# A spell's skills (Item.bin's スキル1-4) that set its range from Atk, as their names say ('Magic Range', '1/2 Magic Range').
ATK_RANGE = {'SID_魔力射程': 'Atk', 'SID_半魔力射程': 'Atk/2', 'SID_四半魔力射程': 'Atk/4'}
# Nosferatu's two hidden skills (no English text; not traced in the program): Serenes Forest's words for what they do.
HIDDEN = {'SID_神殺し_非表示': 'it can defeat a god (神殺し, "god-slayer")', 'SID_眼光封じ': "Duma's Oculus doesn't stop it (眼光封じ)"}


def load(path):
    return Bin(decompress(open(os.path.join(ROMFS, path), 'rb').read()))


def signed(b):
    return b - 256 if b > 127 else b


def say(texts, label):
    return next((t[label] for t in texts if label in t), None)


def spells_of(units, unit_person, class_name, children):
    """Each unit's spell lists, for the Spells tab: the lists the classes they can reach use (Job.bin 魔法成長), each entry a spell,
    its rank (0 the first class's, 1 the promoted one's) and level (Person.bin's 習得魔法 records); and every spell's numbers and help
    text (Item.bin). A unit reaches a class through the class tree, and a male one through a Dread Fighter's change back to Villager."""
    texts = [fates_text.read(os.path.join(ROMFS, 'm', '@NOA_EN', f + '.bin.lz')) for f in ('Item', 'Name', 'Job', 'Skill')]
    people = {r['_off']: r for r in FB.table('Data/Person.bin.lz', '個人').rows}
    people_by_pid = {r['個人']: r for r in people.values()}
    lists = FB.table('Data/Person.bin.lz', '習得魔法').by_id
    jobs = FB.table('Data/Job.bin.lz', '兵種').by_id
    items = FB.table('Data/Item.bin.lz', 'アイテム').by_id

    def spell_name(iid):
        r = items[iid]
        name = say(texts, r['名前'])
        if r['召喚']:
            # Each Invoke summons its own class (Item.bin's 召喚, a person): named by it, as the game names all three alike.
            name += f" ({class_name(people_by_pid[r['召喚']]['兵種'])}s)"
        return name

    book, used = {}, {}
    for u in units:
        person = people[unit_person[u['id']]]
        start = person['兵種']
        # The classes they can reach, and whether only through the Dread Fighter's change back to Villager.
        seen, todo = {start: False}, [start]
        while todo:
            c = todo.pop()
            nexts = [(n, seen[c]) for n in children.get(c, [])]
            if c == DREAD_FIGHTER:
                nexts.append((VILLAGER_M, True))
            for n, loop in nexts:
                if n not in seen:
                    seen[n] = loop
                    todo.append(n)
        out = []
        for kind, (field, label) in SPELL_LISTS.items():
            magic = [c for c in seen if jobs[c]['魔法成長'] == kind]
            if not magic or not person[field]:
                continue
            ranks = [sorted({class_name(c) for c in magic if jobs[c]['ランク'] == r}) for r in (0, 1)]
            entries = []
            rec = lists[person[field]]
            for k, suffix in enumerate(['', '#2', '#3', '#4', '#5', '#6']):
                iid = rec[f'魔法{k + 1}']
                if iid:
                    name = spell_name(iid)
                    used[name] = iid
                    entries.append({'spell': name, 'rank': rec['ランク' + suffix], 'level': rec['LV' + suffix]})
            via = all(seen[c] for c in magic)
            out.append({'kind': label, 'classes': [' or '.join(r) for r in ranks],
                        **({'via': 'a Dread Fighter changing back to Villager (Lv 10), then to Mage (Villager Lv 3)'} if via else {}),
                        'entries': entries})
        if out:
            book[u['id']] = out

    stats = {}
    for name, iid in sorted(used.items()):
        r = items[iid]
        sk = [r[f'スキル{k}'] for k in range(1, 5) if r[f'スキル{k}']]
        lo, hi = r['内射程'], r['外射程']
        atk = next((ATK_RANGE[x] for x in sk if x in ATK_RANGE), None)
        rng = f'{lo}-{atk}' if hi == 255 and atk else '' if hi == 0 else str(lo) if lo == hi else f'{lo}-{hi}'
        # 効果: 1 an attack, 2 heals an ally, 3 heals allies around; the rest move, bind or summon.
        attack, heals = r['効果'] == 1, r['効果'] in (2, 3)
        hidden = [HIDDEN[x] for x in sk if x in HIDDEN]
        stats[name] = {
            'kind': 'Black magic' if r['種類'] == 5 else 'White magic',
            **({'mt': r['威力']} if attack or heals else {}), **({'heals': True} if heals else {}),
            'hit': r['命中'], **({'crit': r['必殺']} if attack else {}), 'range': rng, 'hp': r['消費HP'],
            'text': ' '.join((say(texts, r['ヘルプ']) or '').split()),
            **({'notes': [f"Hidden skills: {'; '.join(hidden)} (Serenes Forest)."]} if hidden else {}),
        }
    return book, stats


def read_supports(by_pid):
    """Reliance.bin (see data-raw/fe15/README.md): 支援効果 gives each character's partners and what each partner gives them at each
    rank; 支援関係 the points pattern of each pair that has conversations; 支援会話条件 the act each rank opens in."""
    rb = load('Data/Reliance.bin.lz')
    rptrs = set(rb.ptrs)
    d = rb.d[0x20:]
    at = {n: o for o, n in rb.labels}
    # 必要経験値: pattern i's points for C, B and A (pattern 0: no conversations).
    patterns = [list(d[o + 4:o + 7]) for o, n in rb.labels if n.startswith('REXID_')]
    # 支援関係: a row per character, a byte per character in the same order (the lower half holds each pair once).
    rows = [n for o, n in rb.labels if n.startswith('PID_') and at['DAT_支援関係'] <= o < at['MOD_支援会話条件']]
    pattern = {}
    for r, n in enumerate(rows):
        o = [oo for oo, nn in rb.labels if nn == n and at['DAT_支援関係'] <= oo < at['MOD_支援会話条件']][0]
        for c, m in enumerate(rows):
            if d[o + 4 + c]:
                pattern[frozenset((n, m))] = d[o + 4 + c]
    # 支援会話条件: per character, [partner][the act C, B and A open in].
    acts = {}
    for o, n in rb.labels:
        if n.startswith('RCID_'):
            cnt, p = rb.u32(o + 4), rb.u32(o + 8)
            for k in range(cnt):
                e = p + 8 * k
                acts[frozenset(('PID_' + n[5:], rb.str(e)))] = list(d[e + 4:e + 7])
    gets, order = {}, []
    for o, n in rb.labels:
        if not n.startswith('SUPID_') or (o + 8) not in rptrs:
            continue
        me = 'PID_' + n[6:]
        cnt, p = rb.u32(o + 4), rb.u32(o + 8)
        for k in range(cnt):
            e = p + 20 * k
            other = rb.str(e)
            if me in by_pid and other in by_pid:
                raw = [signed(b) for b in d[e + 4:e + 20]]
                gets[(me, other)] = [raw[i:i + 4] for i in range(0, 16, 4)]
                key = frozenset((me, other))
                if key not in order:
                    order.append(key)
    out = []
    none = [[0] * 4 for _ in range(4)]
    for key in order:
        a, b = sorted(key, key=lambda x: list(by_pid).index(x))
        x = {'a': f'fe15-{by_pid[a].lower()}', 'b': f'fe15-{by_pid[b].lower()}', 'aGets': gets.get((a, b), none), 'bGets': gets.get((b, a), none)}
        pat = pattern.get(key)
        if pat:
            x['points'] = patterns[pat]
            # A pair with no conditions entry opens every rank from Act 1.
            x['acts'] = acts.get(key, [1, 1, 1])
        out.append(x)
    return out


def main():
    names = fates_text.read(os.path.join(ROMFS, 'm', '@NOA_EN', 'Name.bin.lz'))
    jnames = fates_text.read(os.path.join(ROMFS, 'm', '@NOA_EN', 'Job.bin.lz'))
    pb, jb = load('Data/Person.bin.lz'), load('Data/Job.bin.lz')
    pptrs, jptrs = set(pb.ptrs), set(jb.ptrs)
    jobs = [(o, n) for o, n in jb.labels if n.startswith('JID_') and n != 'JID_不明']
    jid = {n: i for i, (o, n) in enumerate(jobs)}
    job_at = {o: n for o, n in jobs}

    def job(n):
        o = dict((nn, oo) for oo, nn in jobs)[n]
        raw = jb.d[0x20 + o:0x20 + o + JOB]
        name = jnames.get(jb.str(o + 4)) or n
        frm = jb.str(o + 88) if (o + 88) in jptrs else None
        return {'raw': raw, 'name': name, 'from': frm, 'female': n.endswith('女')}

    people = {}
    for o, n in pb.labels:
        if n.startswith('PID_') and (o + 4) in pptrs:
            nm = names.get(pb.str(o + 4))
            if nm and nm not in people:
                people[nm] = o
    units, used = [], set()
    # Who joins, in which act, where and how: the event sheets and map scripts (scripts/fe15_joins.py). The conditions a join's variables
    # carry (survived the battle, Sonya or Deen) are given in Serenes Forest's words.
    found = J.joins()
    leaders = {'アルム': 'Joins as the Prologue ends.', 'セリカ': 'Joins as Act 1 ends (its closing event).'}
    entries = []
    for n, (key, j) in enumerate(found.items()):
        nm = names.get('MPID_' + key)
        o = people.get(nm)
        if o is None:
            continue
        story = ARMIES.get(pb.str(o + 24))
        lord = 'Alm' if story == 'alm' else 'Celica'
        act, how = j['act'], j['how']
        if key in leaders:
            # A leader joins in an act's (or the Prologue's) closing event: theirs from the next act's start.
            act, how = (act or 0) + 1, 'start'
            note = leaders[key]
        else:
            if j['key'].endswith('の砦') and how == 'end':
                how, place = 'event', f"When the battle at {j['place']} is won (its map script)."
            else:
                place = f"At {j['place']}."
            note = place
            if j['celica']:
                note += " The village's events also let Celica's army recruit them, from Act 4."
            if nm in RECRUITMENT:
                note += f' Serenes Forest: {RECRUITMENT[nm][1]}.'
        join = {'how': how, **({'with': [lord]} if how == 'talk' else {}), 'note': note}
        entries.append(((0 if story == 'alm' else 1, act, n), nm, o, story, act, join))
    entries.sort(key=lambda e: e[0])
    chapters = []
    for story in ('alm', 'celica'):
        acts = sorted({e[4] for e in entries if e[3] == story})
        chapters += [{'id': f'fe15-{story}-{a}', 'label': f'Act {a}', 'story': story} for a in acts]
    for _, nm, o, story, act, join in entries:
        raw = pb.d[0x20 + o:0x20 + o + PERSON]
        cls = pb.str(o + 8)
        used.add(cls)
        mov = job(cls)['raw'][43]
        units.append({
            'id': f'fe15-{nm.lower()}', 'story': story, 'name': nm, 'classId': f'j{jid[cls]}', 'level': raw[29],
            'joinChapter': f'fe15-{story}-{act}', 'join': join,
            'bases': {**dict(zip(STATS, raw[52:59])), 'mov': mov},
            'growths': dict(zip(STATS, raw[68:75])),
            'caps': dict(zip(STATS, raw[60:67])),
            'ranks': {},
        })
    # The class tree: each class names the one it changes from (+88); its children are what it changes into.
    children = {}
    for o, n in jobs:
        frm = jb.str(o + 88) if (o + 88) in jptrs else None
        if frm and frm != n:
            children.setdefault(frm, []).append(n)
    todo = list(used)
    while todo:
        n = todo.pop()
        for c in children.get(n, []):
            if c not in used:
                used.add(c)
                todo.append(c)
    class_weapons = fe15_class_weapons(app_ids=True, split_magic=True)
    classes = {}
    for n in sorted(used, key=lambda x: jid[x]):
        j = job(n)
        raw = j['raw']
        nexts = children.get(n, [])
        level = CHANGE_LEVEL.get(j['name'])
        if j['name'] == 'Mage' and j['female']:
            level = MAGE_F
        classes[f'j{jid[n]}'] = {
            'id': f'j{jid[n]}', 'name': j['name'], 'bases': {**dict(zip(STATS, raw[36:43])), 'mov': raw[43]}, 'caps': {},
            **({'promotesTo': f'j{jid[nexts[0]]}', 'promotions': [f'j{jid[c]}' for c in nexts]} if nexts else {}),
            **({'promoteLevel': level} if nexts and level else {}),
            # The weapons the class can use: Job.bin's 武器 mask (the equip check, 0x44fe64; scripts/class_weapons.py).
            'weapons': class_weapons[f'j{jid[n]}'],
            **({'weaponsNote': "the spells are the unit's own, learned by level"} if any('Magic' in w for w in class_weapons[f'j{jid[n]}']) else {}),
        }
    supports = read_supports({pb.str(o): nm for nm, o in people.items() if nm in RECRUITMENT})
    unit_person = {f'fe15-{nm.lower()}': o for nm, o in people.items()}
    spell_book, spell_stats = spells_of(units, unit_person, lambda n: job(n)['name'], children)
    stories = [{'id': 'alm', 'label': "Alm's army"}, {'id': 'celica', 'label': "Celica's army"}]

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    lines = [
        "// Generated by scripts/build-fe15-units.py from the user's own Shadows of Valentia dump. Don't edit by hand.",
        "import type { GbaChapter, GbaClass, GbaRankedSupport, GbaSpellInfo, GbaSpellList, GbaStory, GbaUnit } from '../../gba/types'",
        '',
        f'export const FE15_STORIES: GbaStory[] = {js(stories)}',
        '',
        f'export const FE15_CHAPTERS: GbaChapter[] = {js(chapters)}',
        '',
        'export const FE15_UNITS: GbaUnit[] = [',
        *[f'  {js(u)},' for u in units],
        ']',
        '',
        'export const FE15_CLASSES: Record<string, GbaClass> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in classes.items()],
        '}',
        '',
        '// Each pair once: what each gets from the other ([Hit, Crit, Avoid, Crit avoid] with no rank, then at C, B and A), and for a pair',
        '// with conversations the points each rank needs and the act it opens in.',
        'export const FE15_SUPPORTS: GbaRankedSupport[] = [',
        *[f'  {js(x)},' for x in supports],
        ']',
        '',
        "// Each unit's spell lists: the classes that use each (the first's, then the promoted one's), and each spell's rank and level.",
        'export const FE15_SPELL_BOOK: Record<string, GbaSpellList[]> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in spell_book.items()],
        '}',
        '',
        '// Every spell they can get: its numbers and help text (Item.bin).',
        'export const FE15_SPELL_STATS: Record<string, GbaSpellInfo> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in spell_stats.items()],
        '}',
        '',
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(units)} units, {len(classes)} classes, {len(supports)} supports, {len(spell_book)} with spells ({len(spell_stats)} '
          f'spells) -> {OUT}')


if __name__ == '__main__':
    main()
