"""
Who joins your army in Mystery of the Emblem, book by book, and where: each chapter's event scripts played with fe3_events (the Armory's
runner, copied), in chapter order. Formats are in data-raw/fe3/README.md.

Book 1 is chapters 1-20 and Book 2 is 21-44 (its Endgame's parts are 41-44); each book is its own army.
"""
import fe3_events as fe
import fe3_rom as r

BOOKS = {1: range(1, 21), 2: range(21, 45)}
VISIT_KINDS = {0: 'house', 3: 'village'}
SEIZE = 4


def name_of_char():
    """character id -> name id, from every unit list (a character's records all show one name)."""
    out = {}
    for m in range(64):
        for table in (r.EVENT_UNITS, r.START_UNITS):
            try:
                for u in r.unit_list(table, m):
                    out.setdefault(u['char'], u['name'])
            except (IndexError, KeyError):
                pass
    return out


CHARACTERS = 0x889201  # 17 bytes per character id (data-raw/fe3/README.md)


def stand_in(char):
    """A record with no growths at all (Luck, HP and weapon level 0xFF: the class's) is a stand-in: a generic foe, or a scene's figure
    ("Bandit" as a General in Book 2's first chapter). No one with one joins."""
    o = r.lo(CHARACTERS + 17 * char)
    return not any(r.R[o + 9:o + 17])


LORD = 0  # Marth's name id: the game places him in each book's first chapter itself; no script loads him


def joins(book):
    """{name id: [chapter, how, [partner name ids], turn, level, class, record, starts]} for the first chapter each character is yours
    in (by name: a character can have several records). 'start': yours as the chapter starts (Marth; the turn-0 and opening scripts'
    units); 'event': a later turn, area or character event's; 'talk': a talk swaps them for a record of yours; 'visit': a house or
    village does; 'end': the seize tile's script does. A unit a script loads and takes off again before it ends (a cutscene's) doesn't
    join. `starts`: the recruit starts the talk (Catria and Palla talk to Marth)."""
    found = {}
    talks = r.talks()
    tiles = r.tile_records(r.TILE_EVENTS)

    def add(u, n, how, with_=(), turn=None, starts=False):
        k = u['name']
        if stand_in(u['char']):
            return
        if k not in found:
            found[k] = [n, how, list(with_), turn, u['level'], u['class'], u, starts]
        elif found[k][0] == n and found[k][1] == how == 'talk':
            found[k][2] += [w for w in with_ if w not in found[k][2]]

    def kept(run):
        """Units a script made yours that are still on the map when it ends, and its recruits."""
        on = {id(u) for u in run.units}
        return [u for u in run.loads if id(u) in on and u['side'] == fe.PLAYER] + run.recruits

    first = min(BOOKS[book])
    lord = next(u for u in r.unit_list(r.EVENT_UNITS, r.chapter_map(first)) if u['name'] == LORD)
    add(lord, first, 'start')
    for n in BOOKS[book]:
        m = r.chapter_map(n)
        # Who's in your army as each event runs (Minerva's talk asks for Maria, Est's village for Minerva).
        world = lambda **kw: fe.World(army={f[6]['char'] for f in found.values()}, **kw)  # noqa: E731
        units = []
        for e in sorted(r.turn_events(m), key=lambda e: (e['turn'], e['phase'])):
            opening = e['turn'] == 0 or (e['turn'] == 1 and e['phase'] == 0)
            run = fe.Run(m, world(turn=max(1, e['turn']), phase=e['phase']), units=[dict(u) for u in units])
            run.run(e['ptr'])
            if opening:
                units = run.units
            for u in kept(run):
                add(u, n, 'start' if opening else 'event', turn=None if opening else e['turn'])
        for t in talks:
            if t['map'] != m:
                continue
            run = fe.Run(m, world(), units=[dict(u) for u in units]).run(t['ptr'])
            for u in run.recruits:
                if u['name'] == t['talker']:
                    add(u, n, 'talk', [t['target']], starts=True)
                else:
                    add(u, n, 'talk', [t['talker']])
        for t in tiles:
            if t['map'] != m or t['kind'] not in (*VISIT_KINDS, SEIZE):
                continue
            run = fe.Run(m, world(), units=[dict(u) for u in units]).run(r.tile_script(t['id']))
            for u in kept(run):
                add(u, n, 'end' if t['kind'] == SEIZE else 'visit')
        for e in r.area_events(m) + r.char_events(m):
            run = fe.Run(m, world(), units=[dict(u) for u in units]).run(e['ptr'])
            for u in kept(run):
                add(u, n, 'event')
    return found


if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    import fe3_names as fn
    names, classes = fn.character_names(), fn.class_names()
    for book in BOOKS:
        print('== Book', book)
        for k, (n, how, with_, turn, level, cls, u, starts) in sorted(joins(book).items(), key=lambda x: (x[1][0], x[0])):
            print(' ', u['char'], names.get(k), 'Ch', n, how, [names.get(w) for w in with_], turn or '', 'Lv', level, classes.get(cls),
                  'starts' if starts else '')
