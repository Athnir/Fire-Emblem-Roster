"""
Who joins your army in Fire Emblem Awakening, and where: each chapter's and paralogue's script (scripts/<key>.cmb) and placements
(data/dispos/<key>.bin), read with the Armory's readers (fe13_events, fe13_data; copied), in story order. Formats are in
data-raw/fe13/README.md.

- The load handler's groups (0x07) are the chapter's start: a unit of team 0 in them is yours from the start.
- A later handler (a turn, reinforcement or area handler) that places a team-0 unit brings it in during the chapter.
- A talk handler (0x12) whose target it hands over (UnitTransferByIndex) recruits it, by its talker.
- The end handler (0x0a) places the units that join after the battle.
A unit a handler takes off again in the same handler (UnitExpulsionByIndex) is a scene's and doesn't join.
"""
import os

import fe13_data as D
import fe13_events as E
from fe13_bin import ROMFS

STORY = ['P002'] + [f'{n:03d}' for n in range(1, 27)]   # P001 (Premonition) is the opening dream: no army
PARALOGUES = [f'X{n:03d}' for n in range(1, 24)]
AVATAR = ('PID_プレイヤー男', 'PID_プレイヤー女', 'PID_プレイヤー')
CHAPTERS = {c['key']: c for c in D.chapters()}


def order():
    """The story's chapters with each paralogue after the chapter whose clearing opens it (ChapterData +20)."""
    out = []
    for key in STORY:
        out.append(key)
        out += [p for p in PARALOGUES if CHAPTERS.get(p, {}).get('after') == key]
    return out


def joins():
    """{PID: [chapter key, how, [talker PIDs], turn]} for the first chapter each character is yours in (the army's own records only:
    data/person/static.bin)."""
    found = {}
    starts = set()   # recruits who start their talk themselves
    main = D.persons('static')

    def add(pid, key, how, with_=(), turn=None):
        if pid in AVATAR or pid not in main:
            return
        if pid not in found:
            found[pid] = [key, how, list(with_), turn]
        elif found[pid][0] == key and found[pid][1] == how == 'talk':
            found[pid][2] += [w for w in with_ if w not in found[pid][2]]

    for key in order():
        path = os.path.join(ROMFS, 'scripts', key + '.cmb')
        if not os.path.exists(path):
            continue
        ch = E.Chapter(path)
        groups = dict(D.dispos(key))

        def placed(hd, turns):
            out = []
            for di in range(3):
                for t in turns:
                    out += [g for g, _ in E.run(ch.s, hd, di, t)]
            return list(dict.fromkeys(out))

        # The start: the load handler's groups, and the opening's (turn 1, your phase: the Prologue places Chrom's party there).
        at_start = []
        for hd in ch.of_kind(E.LOAD):
            at_start += [g for g in placed(hd, [0]) if g not in at_start]
        for hd in ch.of_kind(E.TURN, E.TUTORIAL):
            if hd['args'][:1] == (1,) and (len(hd['args']) < 3 or hd['args'][2] == 0):
                gone = set(E.removed_pids(ch, hd))
                for g in placed(hd, [1]):
                    if g not in at_start:
                        at_start.append(g)
        for group in at_start:
            for u in groups.get(group, []):
                if u['team'] == 0:
                    add(u['pid'], key, 'start')
        # Talks first: a talk that hands its target over recruits it by its talker; one that hands over the talker is the recruit's own
        # (Severa talks to Holland).
        for hd in ch.of_kind(E.TALK):
            talker, target = ch.string(hd['args'][0]), ch.string(hd['args'][1])
            got = E.recruits(ch, hd)
            if target in got:
                add(target, key, 'talk', [talker])
            if talker in got:
                add(talker, key, 'talk', [target])
                starts.add(talker)
        # Villages (the _Terrain script's tiles of kind 8, `ch.ths`): a group a visit places on your side, for the visitors the script
        # names (Laurent's village asks for Chrom or Miriel).
        for hd in ch.ths:
            if hd['k'] != E.TILE or hd['args'][2:3] != (8,):
                continue
            named = [x.strip("'") for _, n, x in hd['ins'] if n == 'str' and x.strip("'").startswith('PID_')]
            visited = list(dict.fromkeys(g for di in range(3) for g, _ in E.run(ch.t, hd, di, 1)))
            for group in visited:
                for u in groups.get(group, []):
                    if u['team'] == 0:
                        add(u['pid'], key, 'visit', list(dict.fromkeys(p for p in named if p != u['pid'])))
            for pid in E.recruits(ch, hd):
                add(pid, key, 'visit', [p for p in named if p != pid])
        # Then the turn, area and condition handlers, and the end of the chapter last.
        late = [hd for hd in ch.hs if hd['k'] in (E.REINFORCE, E.TURN, E.TURN2, E.TUTORIAL, E.AREA, 0)] + list(ch.of_kind(E.END))
        for hd in late:
            k = hd['k']
            ending = k == E.END
            first = hd['args'][0] if k in (E.REINFORCE, E.TURN, E.TURN2, E.TUTORIAL) and hd['args'] else None
            for pid in E.recruits(ch, hd):
                add(pid, key, 'end' if ending else 'event', turn=first if not ending and first and first > 1 else None)
            gone = set(E.removed_pids(ch, hd))
            # A handler on turn -1 runs on a condition (Laurent's group, at the end of his paralogue): played as turn 99.
            turns = [99] if ending or first == -1 else [max(first or 1, 1)]
            for group in placed(hd, turns):
                if group in at_start:
                    continue
                for u in groups.get(group, []):
                    if u['team'] == 0 and u['pid'] not in gone:
                        how = 'end' if ending or first == -1 else 'event'
                        add(u['pid'], key, how, turn=first if how == 'event' and first and first > 1 else None)
    for pid in starts:
        found[pid].append('starts')
    return found


if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    main = D.persons('static')
    for pid, (key, how, with_, turn, *rest) in joins().items():
        nm = D.name_of(main[pid]['name_label']) if pid in main else pid
        print(key, nm, how, [D.name_of(main[w]['name_label']) if w in main else w for w in with_], turn or '', rest)
