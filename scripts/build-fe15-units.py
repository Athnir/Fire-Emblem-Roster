"""
Build src/data/fe15/fe15Units.ts from the user's own Shadows of Valentia dump (data-raw/fe15/romfs, from scripts/fe15_extract.py; see
data-raw/fe15/README.md): both armies, their bases, growths and maximums, the class tree, and who supports whom.

Run: python scripts/build-fe15-units.py
"""
import json
import os

import fates_text
from fates_lz import decompress
from fe13_bin import Bin
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


def load(path):
    return Bin(decompress(open(os.path.join(ROMFS, path), 'rb').read()))


def how_of(text):
    t = text.lower()
    if t.startswith('automatically from the start'):
        return 'start'
    if t.startswith('talk'):
        return 'talk'
    if 'end of' in t:
        return 'end'
    return 'event'


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
    chapters = []
    for story in ('alm', 'celica'):
        acts = sorted({act for nm, (act, _) in RECRUITMENT.items() if nm in people and ARMIES.get(pb.str(people[nm] + 24)) == story})
        chapters += [{'id': f'fe15-{story}-{a}', 'label': f'Act {a}', 'story': story} for a in acts]
    for nm, (act, text) in RECRUITMENT.items():
        o = people.get(nm)
        if o is None:
            continue  # DLC (Cipher Legends): not in the user's dump
        story = ARMIES.get(pb.str(o + 24))
        raw = pb.d[0x20 + o:0x20 + o + PERSON]
        cls = pb.str(o + 8)
        used.add(cls)
        mov = job(cls)['raw'][43]
        units.append({
            'id': f'fe15-{nm.lower()}', 'story': story, 'name': nm, 'classId': f'j{jid[cls]}', 'level': raw[29],
            'joinChapter': f'fe15-{story}-{act}',
            'join': {'how': how_of(text), 'note': f'{text} (Serenes Forest).'},
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
        }
    # Supports (Reliance.bin, 支援効果): each character's partners. The 16 bytes of bonuses each partner gives aren't decoded yet.
    rb = load('Data/Reliance.bin.lz')
    rptrs = set(rb.ptrs)
    by_pid = {pb.str(o): nm for nm, o in people.items()}
    supports, seen = [], set()
    for o, n in rb.labels:
        if not n.startswith('SUPID_') or (o + 8) not in rptrs:
            continue
        me = by_pid.get('PID_' + n[6:])
        cnt, p = rb.u32(o + 4), rb.u32(o + 8)
        for k in range(cnt):
            partner = by_pid.get(rb.str(p + 20 * k))
            if me and partner and me in RECRUITMENT and partner in RECRUITMENT:
                key = tuple(sorted((me, partner)))
                if key not in seen:
                    seen.add(key)
                    supports.append({'a': f'fe15-{me.lower()}', 'b': f'fe15-{partner.lower()}'})
    stories = [{'id': 'alm', 'label': "Alm's army"}, {'id': 'celica', 'label': "Celica's army"}]

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    lines = [
        "// Generated by scripts/build-fe15-units.py from the user's own Shadows of Valentia dump. Don't edit by hand.",
        "import type { GbaChapter, GbaClass, GbaStory, GbaUnit } from '../../gba/types'",
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
        '// Who supports whom (each pair once); what each support gives is not decoded yet.',
        f'export const FE15_SUPPORT_PAIRS: {{ a: string; b: string }}[] = {js(supports)}',
        '',
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(units)} units, {len(classes)} classes, {len(supports)} support pairs -> {OUT}')


if __name__ == '__main__':
    main()
