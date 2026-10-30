"""
Who joins your army in The Binding Blade, and where: each chapter's event scripts played with fe6_events (the Armory's runner,
copied), in story order. Formats are in data-raw/fe6/README.md.
"""
import fe6_events as fe
import fe6_rom as rom
from fe6_names import character_names

# (chapter entry, chapter id, label) in story order; A and B are the two routes. The gaiden (x) chapters follow their chapter.
STORY = [
    (1, 'fe6-1', 'Ch.1'), (2, 'fe6-2', 'Ch.2'), (3, 'fe6-3', 'Ch.3'), (4, 'fe6-4', 'Ch.4'), (5, 'fe6-5', 'Ch.5'),
    (6, 'fe6-6', 'Ch.6'), (7, 'fe6-7', 'Ch.7'), (8, 'fe6-8', 'Ch.8'), (32, 'fe6-8x', 'Ch.8x'), (9, 'fe6-9', 'Ch.9'),
    (10, 'fe6-10a', 'Ch.10A'), (11, 'fe6-11a', 'Ch.11A'), (26, 'fe6-10b', 'Ch.10B'), (27, 'fe6-11b', 'Ch.11B'),
    (12, 'fe6-12', 'Ch.12'), (33, 'fe6-12x', 'Ch.12x'), (13, 'fe6-13', 'Ch.13'), (14, 'fe6-14', 'Ch.14'), (34, 'fe6-14x', 'Ch.14x'),
    (15, 'fe6-15', 'Ch.15'), (16, 'fe6-16', 'Ch.16'), (35, 'fe6-16x', 'Ch.16x'), (17, 'fe6-17a', 'Ch.17A'), (18, 'fe6-18a', 'Ch.18A'),
    (19, 'fe6-19a', 'Ch.19A'), (20, 'fe6-20a', 'Ch.20A'), (36, 'fe6-20ax', 'Ch.20Ax'), (28, 'fe6-17b', 'Ch.17B'),
    (29, 'fe6-18b', 'Ch.18B'), (30, 'fe6-19b', 'Ch.19B'), (31, 'fe6-20b', 'Ch.20B'), (37, 'fe6-20bx', 'Ch.20Bx'),
    (21, 'fe6-21', 'Ch.21'), (38, 'fe6-21x', 'Ch.21x'), (22, 'fe6-22', 'Ch.22'), (23, 'fe6-23', 'Ch.23'), (24, 'fe6-24', 'Ch.24'),
    (25, 'fe6-final', 'Final'),
]


def is_opening(e):
    """A turn event that runs as your first phase starts (turn 1, your phase; the Hard-only kind left out)."""
    return e['type'] == 2 and e['b'][0] == 1 and e['b'][2] == 0


def joins():
    """{character id: (story index, how, [talk partner ids], turn, level, class)} for the first chapter each character is yours in.
    'start': your army at the chapter's start (the opening's units on your side, or the army group when no script places it);
    'event': a later event brings them in on your side; 'talk': a talk makes them yours; 'end': the ending scene does."""
    names = character_names()
    found = {}
    visited_by = {}

    def add(u_or_c, i, how, with_=(), turn=None, seen=None):
        c = u_or_c['char'] if isinstance(u_or_c, dict) else u_or_c
        if c not in names:
            return
        u = u_or_c if isinstance(u_or_c, dict) else (seen or {}).get(c)
        if c not in found:
            found[c] = [i, how, list(with_), turn, u['level'] if u else None, u['class'] if u else None]
        elif found[c][0] == i and found[c][1] == how == 'talk':
            found[c][2] += [w for w in with_ if w not in found[c][2]]

    for i, (entry, _, _) in enumerate(STORY):
        ev = fe.events_of(entry)
        turns = fe.event_list(ev['turn'])
        run = fe.Run(fe.World())
        for u in fe.unit_group(ev['enemies']):
            run.units.append({**u, 'tile': u['end'], 'group': 'start'})
        for e in turns:
            if is_opening(e):
                run.run(e['ptr'])
        if not any(u['side'] == 'player' for u in run.units):
            for u in fe.unit_group(ev['army']):
                run.units.append({**u, 'tile': u['end'], 'group': 'army'})
        seen = {u['char']: u for u in run.units}
        for u in run.units:
            if u['side'] == 'player':
                add(u, i, 'start')
        lists = [('turn', e) for e in turns if not is_opening(e)]
        lists += [('talk', e) for e in fe.event_list(ev['talk'])]
        lists += [('location', e) for e in fe.event_list(ev['location'])]
        lists += [('misc', e) for e in fe.event_list(ev['misc'])]
        for kind, e in lists:
            pair = None
            if kind == 'talk' and e['type'] == 4:
                pair = (e['b'][0], e['b'][1])
            elif kind == 'talk' and e['type'] == 13:
                c = fe.check(rom.u32(e['at'] + 8))
                if c[0] == 'talk':
                    pair = (c[1], c[2])
            if not 0x08000000 <= e['ptr'] < 0x08800000:
                continue  # not a script (a location event can hold an item or a door instead)
            # A village that recruits only for certain visitors (Karel, for Fir or Bartre): try everyone who has joined.
            visitors = [pair[0]] if pair else [1] + ([c for c in found] if kind == 'location' else [])
            er = None
            for v in visitors:
                try:
                    tried = fe.Run(fe.World(active=v), units=[dict(u) for u in run.units]).run(e['ptr'])
                except AssertionError:
                    break  # not a script (some event kinds point at data)
                joined_here = list(tried.recruits) + [g['char'] for _, _, grp in tried.loads for g in grp if g['side'] == 'player']
                if kind != 'location':
                    er = tried
                    break
                if joined_here:
                    visited_by.setdefault(tuple(joined_here), []).append(v)
                    er = er or tried
            if er is None and kind == 'location' and visitors:
                try:
                    er = fe.Run(fe.World(active=1), units=[dict(u) for u in run.units]).run(e['ptr'])
                except AssertionError:
                    er = None
            if er is None:
                continue
            for _, _, grp in er.loads:
                for g in grp:
                    seen.setdefault(g['char'], g)
            turn = e['b'][0] if kind == 'turn' else None
            for c in er.recruits:
                if pair and c in pair:
                    add(c, i, 'talk', [p for p in pair if p != c], seen=seen)
                else:
                    add(c, i, 'event', turn=turn, seen=seen)
            # A recruit only on a branch the plain run doesn't take (paying gold, a second talk): the script still has the
            # change of side (event command 0x2B, the character, side 0).
            if pair and pair[1] not in er.recruits and any(op == 0x2B and args == [pair[1], 0] for _, op, args in fe.script(e['ptr'])):
                add(pair[1], i, 'talk', [pair[0]], seen=seen)
            for _, _, grp in er.loads:
                for g in grp:
                    if g['side'] == 'player':
                        add(g, i, 'event', turn=turn)
        end = fe.Run(fe.World(), units=[dict(u) for u in run.units]).run(ev['end'])
        for _, _, grp in end.loads:
            for g in grp:
                seen.setdefault(g['char'], g)
                if g['side'] == 'player':
                    add(g, i, 'end')
        for c in end.recruits:
            add(c, i, 'end', seen=seen)
    # Levels for anyone a script brought in without a placement the runs kept (Dayan): the first group that places them.
    for c, v in found.items():
        if v[4] is None:
            for entry, _, _ in STORY:
                ev = fe.events_of(entry)
                for e in fe.event_list(ev['turn']) + fe.event_list(ev['talk']):
                    if not 0x08000000 <= e['ptr'] < 0x08800000:
                        continue
                    try:
                        er = fe.Run(fe.World()).run(e['ptr'])
                    except AssertionError:
                        continue
                    for _, _, grp in er.loads:
                        for g in grp:
                            if g['char'] == c and v[4] is None:
                                v[4], v[5] = g['level'], g['class']
    for recruits, who in visited_by.items():
        for c in recruits:
            if c in found and found[c][1] == 'event':
                found[c][2] = sorted(set(who))
                found[c][1] = 'visit'
    return {c: tuple(v) for c, v in found.items()}


if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    names = character_names()
    for c, (i, how, with_, turn, level, cls) in sorted(joins().items(), key=lambda x: (x[1][0], x[0])):
        print(c, names.get(c), STORY[i][2], how, [names.get(w) for w in with_], turn or '', 'Lv', level, 'class', cls)
