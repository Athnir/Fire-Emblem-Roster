"""
Build src/data/fe7/fe7Units.ts from the user's own Blazing Blade ROM (see data-raw/fe7/README.md): the playable units of each of its
three stories, when and how they join, their classes and promotions, supports and affinities.

Run: python scripts/build-fe7-units.py   (FE7_ROM overrides where the ROM is)
"""
import json
import os

import fe7_events as fe
from fe7_joins import SAME, STORIES, joins, placements, story
from gba_rom import rom

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'data', 'fe7', 'fe7Units.ts')
r = rom('fe7')
R = r.R
WEAPONS = ('sword', 'lance', 'axe', 'bow', 'staff', 'anima', 'light', 'dark')
# Weapon experience for each rank (the Armory's data-raw/fe7/README.md).
RANKS = [(251, 'S'), (181, 'A'), (121, 'B'), (71, 'C'), (31, 'D'), (1, 'E')]
# Affinity ids 1-7, by the support screen's order (the Armory's build-gba-supports.py).
AFFINITIES = {1: 'Fire', 2: 'Thunder', 3: 'Wind', 4: 'Ice', 5: 'Dark', 6: 'Light', 7: 'Anima'}
# Support levels from points (0x08026690): over 80 = C, over 160 = B, over 240 = A; five levels at most per unit (0x0802696C).
SUPPORT_LEVELS = [81, 161, 241]
PROMOTED = 0x100  # class abilities (+0x28): a promoted class; its +5 points back at the class it promotes from
STORY_IDS = {'Lyn': 'lyn', 'Eliwood': 'eliwood', 'Hector': 'hector'}
STORY_LABELS = {'Lyn': "Lyn's story", 'Eliwood': "Eliwood's story", 'Hector': "Hector's story"}
# What the scripts leave to a check routine or the player, in Serenes Forest's words (its recruitment page).
NOTES = {
    ('Lyn', 13): 'If no one visits, he joins on his own at the start of turn 3 (Serenes Forest).',
    ('Lyn', 35): 'If no one visits, he joins on his own at the start of turn 3 (Serenes Forest).',
    ('Lyn', 8): 'He also joins at the end of the chapter if he survives (Serenes Forest).',
    ('Lyn', 17): 'She also joins at the end of the chapter (Serenes Forest).',
    ('Lyn', 19): 'He joins with Serra, or at the end of the chapter (Serenes Forest).',
    27: 'If no one visits and her village survives, she joins with Erk in the next chapter (Serenes Forest).',
    51: 'If you played the side quest before, he must have survived it (Serenes Forest).',
    31: 'She asks for 20,000 gold (Serenes Forest).',
    7: 'He or Harken appears on turn 10, not both: Karel if you defeat two or more of the promoted foes (against Jerme) or open four '
       'or more doors (against Kenneth); Harken otherwise (Serenes Forest).',
    56: 'He or Karel appears on turn 10, not both: Harken if you defeat fewer than two of the promoted foes (against Jerme) or open '
        'fewer than four doors (against Kenneth) (Serenes Forest).',
    33: 'Only if she survived the earlier chapter she fought in; she appears once you cross into the north-west (Serenes Forest).',
    38: "He can't be deployed in the next chapter and its side quest (Serenes Forest).",
    55: 'Bartre must be deployed, as a Warrior of Lv 5 or more; she appears above the arena. Talk to her with Bartre; both must '
        'survive a round of combat (Serenes Forest).',
    18: 'Visit the ruins in the north-west within 11 turns (Serenes Forest).',
}
VERSIONS = {31: 'Lloyd', 32: 'Linus', 35: 'Kenneth', 36: 'Jerme'}


def record(c):
    return r.character_record(c)


def personal(c):
    """+0x0C-0x13 their own bases added to the class's (HP, Str, Skl, Spd, Def, Res, Lck, Con), +0x14-0x1B weapon experience,
    +0x1C-0x22 growths (HP, Str, Skl, Spd, Def, Res, Lck), +9 affinity, +0x2C the support data."""
    e = record(c)
    b = dict(zip(('hp', 'str', 'skl', 'spd', 'def', 'res', 'lck', 'con'), (r.s8(e + 0x0C + i) for i in range(8))))
    g = dict(zip(('hp', 'str', 'skl', 'spd', 'def', 'res', 'lck'), R[e + 0x1C:e + 0x23]))
    return {'bases': b, 'growths': g, 'ranks': list(R[e + 0x14:e + 0x1C]), 'affinity': R[e + 9], 'supports': r.u32(e + 0x2C)}


def klass(k):
    """+0x0B-0x12 bases (HP, Str, Skl, Spd, Def, Res, Con, Mov), +0x13-0x19 caps (HP, Str, Skl, Spd, Def, Res, Con), +5 the class it
    promotes to (on a promoted class: the one it promotes from), +0x22-0x27 what promoting into it adds (HP, Str, Skl, Spd, Def, Res:
    0x08029818 adds them to the unit, each held at this class's caps), +0x28 abilities."""
    e = r.cfg['classes'] + 84 * k
    bases = dict(zip(('hp', 'str', 'skl', 'spd', 'def', 'res', 'con', 'mov'), R[e + 0x0B:e + 0x13]))
    caps = dict(zip(('hp', 'str', 'skl', 'spd', 'def', 'res', 'con'), R[e + 0x13:e + 0x1A]))
    gains = dict(zip(('hp', 'str', 'skl', 'spd', 'def', 'res'), R[e + 0x22:e + 0x28]))
    promoted = bool(r.u32(e + 0x28) & PROMOTED)
    # Only into a promoted class: Merlinus's two Transporter classes (the tent and the wagon) point at each other.
    target = R[e + 5]
    promotes = target if not promoted and target and r.u32(r.cfg['classes'] + 84 * target + 0x28) & PROMOTED else 0
    return {'bases': bases, 'caps': caps, 'gains': gains, 'promotes': promotes, 'promoted': promoted}


def rank(points):
    return next((letter for limit, letter in RANKS if points >= limit), None)


def versions_with(entry, c):
    """Of a chapter's two versions, the ones whose scripts or groups place character c."""
    out = []
    for v in [entry] + [k for k, x in SAME.items() if x == entry]:
        ev = fe.events_of(v)
        ptrs = [ev['opening'], ev['end']] + [e['ptr'] for k in ('turn', 'talk', 'misc') for e in fe.event_list(ev[k]) if r.is_ptr(e['ptr'])]
        groups = [p for p in ev['enemies'] if r.is_ptr(p)]
        if any(placements(p, c) for p in ptrs) or any(g['char'] == c for p in groups for g in fe.unit_group(p)):
            out.append(v)
    return out


def main():
    names, cnames = r.character_names(), r.class_names()
    used = set()
    units, chapters = [], []
    for mode in STORIES:
        sid = STORY_IDS[mode]
        chs = story(mode)
        chapters += [{'id': cid, 'label': label, 'story': sid} for _, cid, label in chs]
        found = joins(mode)
        # A side quest you can skip: where its joiners come in instead.
        skipped = {}
        for i, (entry, _, label) in enumerate(chs):
            if label.endswith('x') and any(v[0] == i for v in found.values()):
                alt = joins(mode, skip={entry})
                for c, v in found.items():
                    if v[0] == i and c in alt and alt[c][0] != i:
                        skipped[c] = (label, alt[c])
        for c, (i, how, with_, turn, level, cls) in sorted(found.items(), key=lambda x: (x[1][0], x[0])):
            p = personal(c)
            k = cls
            kd = klass(k)
            used.add(k)
            if kd['promotes']:
                used.add(kd['promotes'])
            if how == 'visit' and len(with_) > 1 and all(w in with_ for w, v in found.items() if v[0] < i):
                with_ = []  # anyone can visit
            bases = {s: kd['bases'][s] + p['bases'][s] for s in ('hp', 'str', 'skl', 'spd', 'def', 'res', 'con')}
            bases['lck'] = p['bases']['lck']
            bases['mov'] = kd['bases']['mov']
            notes = []
            entry = chs[i][0]
            if any(SAME.get(k) == entry for k in VERSIONS):
                vs = versions_with(entry, c)
                if len(vs) == 1:
                    notes.append(f'Only in the version against {VERSIONS[vs[0]]}.')
            if c in skipped:
                label, alt = skipped[c]
                notes.append(f'Skipping {label}: joins {"at the start of " if alt[1] == "start" else "in "}{chs[alt[0]][2]} instead.')
            note = NOTES.get((mode, c)) or (NOTES.get(c) if mode != 'Lyn' else None)
            if note:
                notes.append(note)
            units.append({
                'id': f'fe7-lyn-{c}' if mode == 'Lyn' else f'fe7-{c}', 'story': sid, 'name': names[c], 'classId': str(k),
                'level': level, 'joinChapter': chs[i][1],
                'join': {'how': how, **({'with': [names[w] for w in with_]} if with_ else {}), **({'turn': turn} if turn else {}),
                         **({'note': ' '.join(notes)} if notes else {})},
                'affinity': AFFINITIES.get(p['affinity'], ''),
                'bases': bases, 'growths': p['growths'],
                'ranks': {w: rank(v) for w, v in zip(WEAPONS, p['ranks']) if rank(v)},
            })

    out_classes = {}
    for k in sorted(used):
        kd = klass(k)
        out_classes[str(k)] = {'id': str(k), 'name': cnames.get(k, f'Class {k}'), 'bases': {**kd['bases'], 'lck': 0},
                               'caps': {**kd['caps'], 'lck': 30}, **({'promotesTo': str(kd['promotes'])} if kd['promotes'] else {}),
                               **({'gains': kd['gains']} if kd['promoted'] else {})}

    # Supports: Eliwood's and Hector's stories only (the support code skips Lyn's, 0x080266E4). The character's support data
    # (24 bytes): 7 partner ids, 7 starting points, 7 points gained per turn, then the partner count.
    ids = {int(u['id'][4:]) for u in units if u['story'] != 'lyn'}
    supports, seen = [], set()
    for c in sorted(ids):
        ptr = personal(c)['supports']
        if not ptr:
            continue
        o = r.off(ptr)
        for j in range(R[o + 21]):
            partner, start, gain = R[o + j], R[o + 7 + j], R[o + 14 + j]
            key = tuple(sorted((c, partner)))
            if partner in ids and key not in seen:
                seen.add(key)
                supports.append({'a': f'fe7-{c}', 'b': f'fe7-{partner}', 'start': start, 'perTurn': gain})

    affinities = []
    o = r.cfg['affinities']
    while R[o]:
        b = R[o:o + 8]
        affinities.append({'name': AFFINITIES[b[0]], 'atk': b[1], 'def': b[2], 'hit': b[3], 'avoid': b[4], 'crit': b[5], 'dodge': b[6]})
        o += 8

    stories = [{'id': STORY_IDS[m], 'label': STORY_LABELS[m], **({'noSupports': True} if m == 'Lyn' else {})} for m in STORIES]

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    lines = [
        "// Generated by scripts/build-fe7-units.py from the user's own Blazing Blade ROM. Don't edit by hand.",
        "import type { GbaAffinity, GbaChapter, GbaClass, GbaStory, GbaSupport, GbaUnit } from '../../gba/types'",
        '',
        "// Lyn's story is its own army; Eliwood's and Hector's share their units (one id each, so a plan carries over).",
        f'export const FE7_STORIES: GbaStory[] = {js(stories)}',
        '',
        f'export const FE7_CHAPTERS: GbaChapter[] = {js(chapters)}',
        '',
        'export const FE7_UNITS: GbaUnit[] = [',
        *[f'  {js(u)},' for u in units],
        ']',
        '',
        'export const FE7_CLASSES: Record<string, GbaClass> = {',
        *[f'  {js(k)}: {js(v)},' for k, v in out_classes.items()],
        '}',
        '',
        '// Each pair once: its starting points and the points it gains each turn the two spend side by side.',
        'export const FE7_SUPPORTS: GbaSupport[] = [',
        *[f'  {js(s)},' for s in supports],
        ']',
        '',
        f'export const FE7_SUPPORT_LEVELS = {js(SUPPORT_LEVELS)}',
        '',
        '// What each affinity adds per support level (Atk, Def, Hit, Avoid, Crit, Dodge), before the halving.',
        f'export const FE7_AFFINITIES: GbaAffinity[] = {js(affinities)}',
        '',
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(units)} units, {len(out_classes)} classes, {len(supports)} supports -> {OUT}')


if __name__ == '__main__':
    main()
