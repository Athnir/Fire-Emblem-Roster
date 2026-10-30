"""
Who joins your army in Thracia 776, and where: the chapters' event scripts played with fe5_events (the Armory's runner, copied).
Formats are in data-raw/fe5/README.md.
"""
import fe5_events as fe
import fe5_rom as r
from fe5_names import character_names, generic_names

LEIF = 0x01
# Chapter index -> heading, in the chapter records' order (the end scripts skip a gaiden chapter or take 16B and 17B).
HEADINGS = ['Ch.1', 'Ch.2', 'Ch.2x', 'Ch.3', 'Ch.4', 'Ch.4x', 'Ch.5', 'Ch.6', 'Ch.7', 'Ch.8', 'Ch.8x', 'Ch.9', 'Ch.10', 'Ch.11',
            'Ch.11x', 'Ch.12', 'Ch.12x', 'Ch.13', 'Ch.14', 'Ch.14x', 'Ch.15', 'Ch.16A', 'Ch.17A', 'Ch.16B', 'Ch.17B', 'Ch.18', 'Ch.19',
            'Ch.20', 'Ch.21', 'Ch.21x', 'Ch.22', 'Ch.23', 'Ch.24', 'Ch.24x', 'Final']


def chapter_id(n):
    return 'fe5-' + HEADINGS[n].replace('Ch.', '').lower()


def is_generic(c):
    return character_names().get(c) in generic_names()


def on_turn_one(e):
    """A turn event that runs as your first phase starts: turn 1, your phase (or any), nothing else asked but clear flags."""
    turn = [a[1] for c, a in e['conds'] if c == 0x06 and a[0] == fe.TURN]
    phase = [a[1] for c, a in e['conds'] if c == 0x06 and a[0] == fe.PHASE]
    others = [c for c, a in e['conds'] if not (c == 0x06 and a[0] in (fe.TURN, fe.PHASE)) and c != 0x0E]
    return turn == [1] and phase in ([], [0]) and not others


def prep_groups(ev):
    out, a = [], ev['prep_groups']
    while a and r.u16(a):
        out.append(r.u24(a) + 2)
        a += 3
    return out


def joins():
    """{character id: (chapter index, how, [talk partner ids], turn, level)} for the first chapter each character is yours in.

    - 'start': yours when the chapter starts: placed on your side by the preparations groups, the opening or a turn-1 event.
    - 'event': brought in on your side (or made yours) by a later event; `turn` when a turn event does it.
    - 'talk': a talk event that makes them yours; the partners are who can talk to them.
    - 'end': made yours by the ending scene: they're yours from the next chapter."""
    found = {}

    levels = {}

    def add(c, n, how, with_=(), turn=None):
        if c and not is_generic(c) and c in character_names():
            entry = found.setdefault(c, [n, how, [], turn, levels.get(c)])
            if entry[0] == n and entry[1] == how == 'talk':
                entry[2] += [w for w in with_ if w not in entry[2]]

    for n in range(len(HEADINGS)):
        levels.clear()  # a unit's level where it joins (Shiva is level 3 in Chapter 2x and 4 when he joins in 7)
        ev = r.chapter_events(n)
        defs = {k: fe.definitions(v) for k, v in ev.items() if k not in ('ending', 'prep_groups')}
        run = fe.Run(fe.World(turn=0))
        for g in prep_groups(ev):
            run.load(g)
        for e in defs['opening']:
            run.run(e['ptr'])
        run.world.turn = 1
        run.mem[fe.TURN] = 1
        start_flags = set()
        for e in defs['turn']:
            if on_turn_one(e):
                if e['flag']:
                    run.world.flags.add(e['flag'])
                    start_flags.add(e['flag'])
                run.run(e['ptr'])
        for u in run.units:
            levels.setdefault(u['char'], u['level'])
        for u in run.units:
            if u['side'] == fe.PLAYER:
                add(u['char'], n, 'start')
        present = list(run.units)
        for kind in ('turn', 'after_action', 'before_action', 'talk', 'location'):
            for e in defs[kind]:
                if kind == 'turn' and on_turn_one(e):
                    continue
                pair = next((a for c, a in e['conds'] if c in (0x00, 0x01)), None)
                turn = next((a[1] for c, a in e['conds'] if c == 0x06 and a[0] == fe.TURN), None)
                world = fe.World(turn=turn or 1, active=pair[0] if pair else LEIF, held=set(character_names()))
                er = fe.Run(world, units=present, mem={fe.TARGET: pair[1]} if pair else {}).run(e['ptr'])
                for u in er.units:
                    levels.setdefault(u['char'], u['level'])
                for c in er.recruits:
                    if pair and c == pair[1]:
                        add(c, n, 'talk', [pair[0]])
                    else:
                        add(c, n, 'event', turn=turn if kind == 'turn' else None)
                for u in er.units:
                    if u['side'] == fe.PLAYER and all(p['char'] != u['char'] for p in present):
                        add(u['char'], n, 'event', turn=turn if kind == 'turn' else None)
                for _, grp in er.loads:
                    for g in grp:
                        levels.setdefault(g['char'], g['level'])
                        if all(p['char'] != g['char'] for p in present):
                            present.append(dict(g))
        end = fe.Run(fe.World(active=LEIF, held=set(character_names())), units=present).run(ev['ending'])
        for c in end.recruits:
            add(c, n, 'end')
    return {c: tuple(v) for c, v in found.items()}


if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    names = character_names()
    for c, (n, how, with_, turn, level) in sorted(joins().items(), key=lambda x: (x[1][0], x[0])):
        print(c, names.get(c), HEADINGS[n], how, [names.get(w) for w in with_], turn or '', 'Lv', level)
