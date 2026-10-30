"""
Who joins your army in The Sacred Stones, on each route (Eirika's and Ephraim's), and where: each chapter's event scripts played with
fe8_events (the Armory's runner, copied), in story order, on Normal. Formats are in data-raw/fe8/README.md.
"""
import fe8_events as fe
from gba_rom import rom

r = rom('fe8')
R = r.R

# The story as the Armory's maps generator lists it (the end scripts' "go to chapter" order): everyone plays the Prologue to Chapter 8
# (5x is Ephraim's, between 5 and 6), then Eirika's route or Ephraim's. Entries 61 / 62 are the routes' Chapter 11.
SHARED = [(0, 'Prologue'), (1, 'Ch.1'), (2, 'Ch.2'), (3, 'Ch.3'), (4, 'Ch.4'), (6, 'Ch.5'), (5, 'Ch.5x'), (7, 'Ch.6'), (8, 'Ch.7'),
          (9, 'Ch.8')]
TAIL = ['Ch.9', 'Ch.10', 'Ch.11', 'Ch.12', 'Ch.13', 'Ch.14', 'Ch.15', 'Ch.16', 'Ch.17', 'Ch.18', 'Ch.19', 'Ch.20', 'Final']
ROUTES = {
    'Eirika': list(zip([10, 11, 61, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21], TAIL)),
    'Ephraim': list(zip([23, 24, 62, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34], TAIL)),
}
# The Final Chapter's second part (22 / 35) is one chapter with its first.
SAME = {22: 21, 35: 34}
VILLAGE = 0x10
LAST_PLAYABLE = 0x22  # Tana; 0x23-0x2C are the postgame's (Lyon to Hayden)


def story(route):
    """(entry, chapter id, label, mode) in story order: the shared chapters, then the route's."""
    out = [(e, f'fe8-{label.replace("Ch.", "").lower()}', label, 'Prologue') for e, label in SHARED]
    slug = {'Eirika': 'ei', 'Ephraim': 'ep'}[route]
    out += [(e, f'fe8-{slug}-{label.replace("Ch.", "").lower()}', label, route) for e, label in ROUTES[route]]
    return out


def is_opening(e):
    b = e['b']
    return e['type'] == 2 and b[0] == 1 and b[1] in (0, 1) and (b[2] | b[3] << 8) == 0


def ops(ptr):
    try:
        return fe.script(ptr)
    except (ValueError, IndexError):
        return []


def sides_set(ptr, seen=None):
    """Characters a script, and the scripts it calls (0x0A), make yours (0x34 variant 2), on any branch. 'slot' stands for the
    character a called script takes from a slot (0xFFFD: the shared paid recruit at 0x089EEB00 makes yours whoever the talk put in
    s3)."""
    seen = set() if seen is None else seen
    if ptr in seen:
        return set()
    seen.add(ptr)
    out = set()
    for _, cmd, sub, args in ops(ptr):
        if cmd == 0x34 and sub == 2 and args:
            out.add('slot' if args[0] == 0xFFFD else args[0])
        elif cmd == 0x0A and len(args) >= 3 and r.is_ptr(args[1] | args[2] << 16):
            out |= sides_set(args[1] | args[2] << 16, seen)
    return out


def asks_gold(ptr, seen=None):
    """What a script asks to be paid: the gold check (0x19 variant 8) in it or a script it calls, against s4, which the script set
    (0x05); None when it asks nothing."""
    seen = set() if seen is None else seen
    if ptr in seen:
        return None
    seen.add(ptr)
    slots, asks = {}, False
    for _, cmd, sub, args in ops(ptr):
        if cmd == 0x05 and len(args) >= 3:
            slots[args[0]] = args[1] | args[2] << 16
        elif cmd == 0x19 and sub == 8:
            asks = True
        elif cmd == 0x0A and len(args) >= 3 and r.is_ptr(args[1] | args[2] << 16):
            asks = asks or asks_gold(args[1] | args[2] << 16, seen) is not None
    return slots.get(4, 0) if asks else None


class Run(fe.Run):
    """The Armory's runner, except for two things:
      - your army's deploy group only places units already yours (after the lord's, its characters are placeholders for the tiles);
      - a group load's variant 1 (0x2C; the handler at 0x0800FB84 runs it with the loader's leave-out mode 2) is the cutscenes':
        Ewan in Eirika's Chapter 11, Cormag in Ephraim's 10, Myrrh on the ship in Ephraim's 11, none of whom joins there (Serenes
        Forest; the Fire Emblem Wiki's chapter pages). Its units are marked `scene` and don't join; a unit for yours by variant 0
        does, before the preparations screen or after it (Natasha, Gerik, Myrrh in Chapter 16). Unconfirmed: nothing in the
        loader marks a unit as a scene's, so the variant is the sign, read from which loads the joins line up with.
    `plain`: who a variant-0 load has placed as yours."""

    def __init__(self, world, units=None, chapter=None, mine=()):
        super().__init__(world, units, chapter)
        self.mine = set(mine)
        self.plain = set()
        self.seen = {}  # the records of units made off the chapter's map
        # Each character's record: a variant-0 load's over a scene's (Joshua: Lv 1 in Chapter 5's opening scene, Lv 5 as he's
        # placed).
        self.records, self.firm = {}, set()

    def note(self, ptr, variant):
        for g in fe.unit_group(ptr):
            if g['char'] not in self.firm:
                self.records[g['char']] = g
                if variant != 1:
                    self.firm.add(g['char'])

    def load(self, ptr, army=False, keep_dead=False, variant=0, here=True):
        if not r.is_ptr(ptr):
            return
        if not army:
            self.note(ptr, variant)
        if not here:
            # A load on a cutscene's map (0x25): no one stands on the chapter's, but the unit is made all the same (the units
            # aren't kept per map). Counted only in a chapter's ending (Knoll, at the end of Ephraim's Chapter 14): an opening's
            # flashbacks load a variant-0 Ephraim as a Soldier in the Prologue, and he doesn't join there.
            if variant != 1:
                self.plain |= {g['char'] for g in fe.unit_group(ptr) if g['side'] == 'player' and g['char'] not in self.world.dead}
                for g in fe.unit_group(ptr):
                    self.seen.setdefault(g['char'], g)
            return
        if not army:
            before = {id(u) for u in self.units}
            super().load(ptr, army, keep_dead)
            players = {g['char'] for g in fe.unit_group(ptr) if g['side'] == 'player'}
            for u in self.units:
                if u['char'] in players:
                    if variant == 1 and id(u) not in before:
                        u['scene'] = True
                    elif variant != 1:
                        u.pop('scene', None)
            if variant != 1:
                self.plain |= players
            return
        mine = self.mine | {u['char'] for u in self.units if u['side'] == 'player' and not u.get('scene')}
        group = [u for u in fe.unit_group(ptr) if u['char'] in mine and u['char'] not in self.world.dead]
        self.loads.append((ptr, group, army))
        for u in group:
            self.place(u, ptr, army)


def joins(route):
    """{character id: [story index, how, [talk partner or visitor ids], turn, level, class]} for the first chapter each character is
    yours in, on one route. 'start': yours when the chapter starts; 'event': a later event brings them in on your side; 'talk': a talk
    makes them yours; 'visit': a village does; 'end': the chapter's ending does."""
    names = r.character_names()
    chapters = story(route)
    found = {}
    visited_by = {}

    def add(u_or_c, i, how, with_=(), turn=None, seen=None):
        c = u_or_c['char'] if isinstance(u_or_c, dict) else u_or_c
        if not c or c > LAST_PLAYABLE or c not in names or names[c] == 'Enemy':
            return
        u = u_or_c if isinstance(u_or_c, dict) else (seen or {}).get(c)
        if c not in found:
            found[c] = [i, how, list(with_), turn, u['level'] if u else None, u['class'] if u else None, [], {},
                        bool(u and u.get('autolevel'))]
        elif found[c][0] == i and found[c][1] == how == 'talk':
            found[c][2] += [w for w in with_ if w not in found[c][2]]
        elif found[c][0] == i and how != found[c][1]:
            # Two ways in one chapter (a talk, or the chapter's end if they're still alive): the talk first, the other kept.
            if how == 'talk' and found[c][1] in ('event', 'end'):
                found[c][6].append(found[c][1])
                found[c][1:4] = [how, list(with_), None]
            elif how not in found[c][6]:
                found[c][6].append(how)

    for i, (entry, _, _, mode) in enumerate(chapters):
        for version in [entry] + [k for k, v in SAME.items() if v == entry]:
            def world(**kw):
                return fe.World(mode=mode, away=set(names) - set(found), **kw)

            ev = fe.events_of(version)
            turns = fe.event_list(ev['turn'])
            talks = [e for e in fe.event_list(ev['talk']) if e['type'] in (3, 4)]
            # The chapter's start: the opening scene; where it calls the preparations screen, your army goes to the deploy group's
            # tiles; then every turn-1 event on your phase.
            run = Run(world(), chapter=version, mine=found)
            run.run(ev['opening'])
            starting = []
            if run.prep:
                # The preparations screen (0x3E): your army deploys on its group's tiles, and the opening's units leave the map.
                # Who a variant-0 load placed as yours before it is in your army (Natasha in Chapter 5, Myrrh in 16).
                starting = [c for c in run.plain if c not in run.world.dead]
                run.mine |= set(starting)
                run.units = [u for u in run.units if u['side'] != 'player']
                run.load(ev['army'], army=True)
            for e in turns:
                if is_opening(e) and r.is_ptr(e['ptr']) and e['ptr'] != ev['opening']:
                    run.run(e['ptr'])
            seen, firm = dict(run.records), set(run.firm)

            def merge(other):
                for c, g in other.records.items():
                    if c not in seen or (c in other.firm and c not in firm):
                        seen[c] = g
                        if c in other.firm:
                            firm.add(c)
            starting += [u['char'] for u in run.units if u['side'] == 'player' and not u.get('scene')]

            for c in dict.fromkeys(starting):
                add(seen.get(c, c), i, 'start', seen=seen)

            lists = [('turn', e) for e in turns if not is_opening(e)]
            lists += [('talk', e) for e in talks]
            lists += [('location', e) for e in fe.event_list(ev['location']) if e['type'] in (5, 6) and e['b'][2] == VILLAGE]
            lists += [('misc', e) for e in fe.event_list(ev['misc'])]
            for kind, e in lists:
                if not r.is_ptr(e['ptr']) or not ops(e['ptr']):
                    continue
                pair = (e['b'][0], e['b'][1]) if kind == 'talk' else None
                visitors = [pair[0] or None] if pair else [None] + (list(found) if kind == 'location' else [])
                er = None
                for v in visitors:
                    tried = Run(world(active=v, turn=e['b'][0] if e['type'] == 2 else 1), units=[dict(u) for u in run.units],
                                chapter=version, mine=found).run(e['ptr'])
                    joined_here = list(tried.recruits) + [g['char'] for _, grp, _ in tried.loads for g in grp
                                                          if g['side'] == 'player' and g['char'] not in found]
                    if kind != 'location':
                        er = tried
                        break
                    if joined_here and v is not None:
                        visited_by.setdefault(tuple(joined_here), []).append(v)
                    er = er or (tried if joined_here else None)
                if er is None:
                    continue
                merge(er)
                ending = bool(er.next_chapter)
                how = 'end' if ending else 'event'
                turn = e['b'][0] if e['type'] == 2 and not ending else None
                for c in er.recruits:
                    if pair and c in pair:
                        add(c, i, 'talk', [p for p in pair if p != c and p], seen=seen)
                    else:
                        add(c, i, how, turn=turn, seen=seen)
                # A recruit on a branch the plain run doesn't take: the script still changes the character's side to yours
                # (0x34 variant 2).
                sides = sides_set(e['ptr']) if pair else set()
                if pair and pair[1] not in er.recruits and (pair[1] in sides or 'slot' in sides):
                    add(pair[1], i, 'talk', [pair[0]] if pair[0] else [], seen=seen)
                    cost = asks_gold(e['ptr'])
                    if cost and pair[0] and pair[1] in found:
                        found[pair[1]][7][pair[0]] = cost
                for u in er.units:
                    if u['side'] == 'player' and not u.get('scene') and                             u['char'] not in {x['char'] for x in run.units if x['side'] == 'player'}:
                        add(seen.get(u['char'], u), i, how, turn=turn, seen=seen)
            end = Run(world(enemies_left=False), units=[dict(u) for u in run.units], chapter=version, mine=found).run(ev['end'])
            merge(end)
            for u in end.units:
                if u['side'] == 'player' and not u.get('scene'):
                    add(seen.get(u['char'], u), i, 'end', seen=seen)
            for c in end.recruits:
                add(c, i, 'end', seen=seen)
            for c in end.plain:
                if c in end.seen:
                    add(end.seen[c], i, 'end')
            # A level and class read from a scene's record give way to a placement's (variant 0) from anywhere in the chapter.
            for c, v in found.items():
                if v[0] == i and c in firm:
                    v[4], v[5], v[8] = seen[c]['level'], seen[c]['class'], bool(seen[c].get('autolevel'))
    for recruits, who in visited_by.items():
        for c in recruits:
            if c in found and found[c][1] == 'event':
                found[c][2] = sorted(set(who))
                found[c][1] = 'visit'
    return found


if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    names, cn = r.character_names(), r.class_names()
    for route in ROUTES:
        chapters = story(route)
        print('==', route)
        for c, (i, how, with_, turn, level, cls, other, paid, auto) in sorted(joins(route).items(), key=lambda x: (x[1][0], x[0])):
            print(' ', c, names.get(c), chapters[i][2], how, [names.get(w) for w in with_], turn or '', 'Lv', level, cn.get(cls), other, paid, 'auto' if auto else '')
