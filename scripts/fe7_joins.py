"""
Who joins your army in The Blazing Blade, in each of its three stories (Lyn's, Eliwood's and Hector's), and where: each chapter's event
scripts played with fe7_events (the Armory's runner, copied), in story order, on Normal. Formats are in data-raw/fe7/README.md.
"""
import re

import fe7_events as fe
from gba_rom import rom

r = rom('fe7')
R = r.R

LYN = list(range(0, 12))
ELIWOOD = [12, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 26, 27, 28, 29, 30, 31, 32, 34, 35, 36, 37, 38, 39, 40, 42, 43, 44, 46, 47]
HECTOR = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, 43, 44,
          45, 46, 47]
STORIES = {'Lyn': LYN, 'Eliwood': ELIWOOD, 'Hector': HECTOR}
# Two versions of one chapter (against Lloyd or Linus, Kenneth or Jerme) and the Final Chapter's two parts: one chapter here.
SAME = {32: 31, 36: 35, 47: 46}
# A turn event's condition (+0xC): 1 Eliwood Normal, 2 Hector Normal, 3 Eliwood Hard, 4 Hector Hard, 5 Hard.
TURN_CONDITION = {1: ('Eliwood', False), 2: ('Hector', False), 3: ('Eliwood', True), 4: ('Hector', True), 5: (None, True)}
VILLAGE = 0x0E


def heading(entry, mode):
    """'Ch. 11: Taking Leave' -> 'Ch.11'; the heading in the story's own numbering (Hector's runs one or two ahead)."""
    text = r.text(r.u16(r.chapter(entry) + (0x72 if mode == 'Hector' else 0x70)))
    m = re.match(r'(Ch\. ([0-9]+x*)( pt 2)?|Prologue|Final Chapter): ', text)
    if m.group(2):
        # The game's own "Ch. 19x pt 2" is called 19xx by Serenes Forest and the wikis.
        return 'Ch.' + m.group(2) + ('x' if m.group(3) else '')
    return 'Final' if m.group(1) == 'Final Chapter' else m.group(1)


def story(mode):
    """(entry, chapter id, label) in story order, one per chapter (the two versions of a chapter as one)."""
    out = []
    slug = {'Lyn': 'lyn', 'Eliwood': 'e', 'Hector': 'h'}[mode]
    for entry in STORIES[mode]:
        if entry in SAME:
            continue
        label = heading(entry, mode)
        out.append((entry, f'fe7-{slug}-{label.replace("Ch.", "").lower()}', label))
    return out


def u32_at(b, i):
    return b[i] | b[i + 1] << 8 | b[i + 2] << 16 | b[i + 3] << 24


def turn_allowed(e, mode):
    """A turn event's condition, on Normal."""
    c = u32_at(e['b'], 4) if len(e['b']) >= 8 else 0
    if c in TURN_CONDITION:
        m, hard = TURN_CONDITION[c]
        return not hard and m in (None, mode)
    return True


def talk_allowed(e, mode):
    """A talk's condition (+0xC): 0 always, 1 Eliwood's story, 2 Hector's, 3 once a flag is set (taken as set)."""
    if e['type'] != 3:
        return True
    c = e['b'][4]
    return c in (0, 3) or (c == 1 and mode == 'Eliwood') or (c == 2 and mode == 'Hector')


def is_opening(e):
    return e['type'] == 2 and e['b'][0] == 1 and e['b'][2] == 0


REMOVE_CHAR = (0x6B, 0x6D, 0x6F)   # take a character's unit off the map (it doesn't join)
GO_TO_CHAPTER = 0x81
SET_FLAG = 0x76
CHANGE_SIDE = 0x65
# Script commands that load a group, and which of their arguments are groups.
LOADS = {0x32: [0], 0x33: [0], 0x34: [1], 0x37: [1], 0x35: [0, 1, 2, 3], 0x38: [0, 1, 2, 3], 0x36: [0]}


def ops(ptr):
    try:
        return fe.script(ptr)
    except AssertionError:
        return []


def removed_by(ptr):
    """Characters a script takes off the map by name: a cutscene's visitors, who don't join (Matthew and Serra in Eliwood's
    Chapter 12). Units the clearing routines take off stay in your army (Athos in the Final Chapter)."""
    return {args[0] & 0xFF for _, op, _, args in ops(ptr) if op in REMOVE_CHAR}


def placements(ptr, c):
    """Every record of character c in the groups a script can load, on any branch."""
    out = []
    for _, op, _, args in ops(ptr):
        for k in LOADS.get(op, []):
            if k < len(args) and r.is_ptr(args[k]):
                out += [g for g in fe.unit_group(args[k]) if g['char'] == c]
    return out


class Run(fe.Run):
    """The Armory's runner, except for two loads that only place units already yours:
      - your army's group (0x36-0x38, and a chapter's deploy tiles): its characters are placeholders for the tiles (Chapter 18's
        lists Canas, Chapter 24's Geitz and Heath);
      - 0x33, a cutscene's load of your living units (0x0800D098): it skips a character whose unit (0x08017D34) is dead. A character
        not yet yours has no unit; the lookup returns 0 and the check reads address 0x0C, outside the ROM. Taken as skipped, which is
        how the story plays (Dragon's Gate's opening lists Canas, who joins only in Chapter 16x; unconfirmed)."""

    def __init__(self, world, units=None, mine=()):
        super().__init__(world, units)
        self.mine = set(mine)

    def load(self, ptr, army=False, living=False):
        if not (army or living) or not r.is_ptr(ptr):
            return super().load(ptr, army, living)
        mine = self.mine | {u['char'] for u in self.units if u['side'] == 'player'}
        group = [u for u in fe.unit_group(ptr) if u['char'] in mine and u['char'] not in self.world.dead]
        self.loads.append((ptr, group, army))
        for u in group:
            same = next((x for x in self.units if x['char'] == u['char']), None)
            if same:
                same.update({'tile': u['end'], 'start': u['start'], 'side': u['side'], 'group': ptr, 'army': army})
            else:
                self.units.append({**u, 'tile': u['end'], 'group': ptr, 'army': army})


def joins(mode, skip=()):
    """{character id: [story index, how, [talk partner or visitor ids], turn, level, class]} for the first chapter each character is
    yours in, for one story (`skip`: gaiden entries left out). 'start': yours when the chapter starts (its opening, or the army it
    deploys); 'event': a later event brings them in on your side; 'talk': a talk makes them yours; 'visit': a village does; 'end':
    the chapter's ending does (its end scene, or an event that goes to the next chapter)."""
    names = r.character_names()
    chapters = story(mode)
    found = {}
    # Units a script placed as yours and then took off the map by name: they stay in your army, off the map, until an army
    # group places them (Serra and Matthew, placed with Hector in Eliwood's Chapter 12, are deployed from Chapter 13).
    benched = set()
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

    def world(**kw):
        return fe.World(mode=mode, away=set(names) - set(found), **kw)

    for i, (entry, _, _) in enumerate(chapters):
        if entry in skip:
            continue
        scripts = []
        for version in [entry] + [k for k, v in SAME.items() if v == entry]:
            ev = fe.events_of(version)
            prep = R[r.chapter(version) + 0xD]
            turns = fe.event_list(ev['turn'])
            talks = [e for e in fe.event_list(ev['talk']) if talk_allowed(e, mode) and e['type'] in (3, 4)]
            # The chapter's start (0x0801537C): the opening scene; with preparations, everyone not yours is cleared and the enemies
            # and your army's group for the story are loaded; then each turn-1 event on your phase (the opening again, in a chapter
            # without preparations, plays once).
            run = Run(world(), mine=set(found) | benched)
            run.run(ev['opening'])
            opened = [ev['opening']]
            if prep:
                army = ev['army'][fe.group_slot(mode, False)]
                run.units = [u for u in run.units if u['side'] == 'player' and not u['army']]
                run.load(ev['enemies'][fe.group_slot(mode, False)])
                run.load(army, army=True)
            for e in turns:
                if is_opening(e) and turn_allowed(e, mode) and r.is_ptr(e['ptr']) and e['ptr'] != ev['opening']:
                    run.run(e['ptr'])
                    opened.append(e['ptr'])
            seen = {}
            for _, grp, _ in run.loads:
                for g in grp:
                    seen.setdefault(g['char'], g)
            gone = set().union(*(removed_by(p) for p in opened))
            starting = [u['char'] for u in run.units if u['side'] == 'player']
            starting += [g['char'] for _, grp, _ in run.loads for g in grp if g['side'] == 'player' and g['char'] in run.removed
                         and g['char'] not in gone]
            for c in dict.fromkeys(starting):
                add(seen.get(c, c), i, 'start', seen=seen)

            # Flags a talk sets (Farina's payment): an event set off by one counts as that talk's recruit.
            flag_talk = {}
            for e in talks:
                for _, op, w, _ in ops(e['ptr']) if r.is_ptr(e['ptr']) else []:
                    if op == SET_FLAG:
                        flag_talk.setdefault(w >> 16, (e['b'][0], e['b'][1]))
            lists = [('turn', e) for e in turns if not is_opening(e) and turn_allowed(e, mode)]
            lists += [('talk', e) for e in talks]
            lists += [('location', e) for e in fe.event_list(ev['location']) if e['type'] in range(5, 11) and e['b'][2] == VILLAGE]
            lists += [('misc', e) for e in fe.event_list(ev['misc'])]
            for kind, e in lists:
                if not r.is_ptr(e['ptr']) or not ops(e['ptr']):
                    continue  # not a script (a location can hold data)
                scripts.append(e['ptr'])
                pair = (e['b'][0], e['b'][1]) if kind == 'talk' else None
                flag = e['b'][0] | e['b'][1] << 8
                if e['type'] == 1 and flag in flag_talk:
                    pair = flag_talk[flag]
                # A village that recruits only for certain visitors: try everyone who has joined.
                visitors = [pair[0]] if pair else [None] + (list(found) if kind == 'location' else [])
                er = None
                for v in visitors:
                    tried = Run(world(active=v, turn=e['b'][0] if e['type'] == 2 else 1),
                                   units=[dict(u) for u in run.units], mine=set(found) | benched).run(e['ptr'])
                    joined_here = list(tried.recruits) + [g['char'] for _, grp, _ in tried.loads for g in grp if g['side'] == 'player'
                                                          and g['char'] not in found]
                    if kind != 'location':
                        er = tried
                        break
                    if joined_here and v is not None:
                        visited_by.setdefault(tuple(joined_here), []).append(v)
                    er = er or (tried if joined_here else None)
                if er is None:
                    continue
                for _, grp, _ in er.loads:
                    for g in grp:
                        seen.setdefault(g['char'], g)
                ending = any(op == GO_TO_CHAPTER for _, op, _, _ in ops(e['ptr']))
                how = 'end' if ending else 'event'
                turn = e['b'][0] if e['type'] == 2 and not ending else None
                gone = removed_by(e['ptr'])
                for c in er.recruits:
                    if pair and c in pair:
                        add(c, i, 'talk', [p for p in pair if p != c], seen=seen)
                    else:
                        add(c, i, how, turn=turn, seen=seen)
                # A recruit only on a branch the plain run doesn't take (a payment, a duel): the script still has the change of side
                # (0x65, side 0); the talker is the one in this chapter's talks with that character. In an ending (Jaffar, at Chapter
                # 26's), that talk is what the ending checks for.
                for _, op, _, args in ops(e['ptr']):
                    c = args[0] & 0xFF if op == CHANGE_SIDE and args[1] == 0 else None
                    if c is None or c in er.recruits:
                        continue
                    partners = [p for p in pair if p != c] if pair and c in pair else [t['b'][0] for t in talks if t['b'][1] == c]
                    if partners:
                        add(c, i, 'end' if ending else 'talk', partners, seen=seen)
                for _, grp, _ in er.loads:
                    for g in grp:
                        if g['side'] == 'player' and g['char'] not in gone:
                            add(g, i, how, turn=turn)
                        elif g['side'] == 'player':
                            benched.add(g['char'])
            end = Run(world(enemies_left=False), units=[dict(u) for u in run.units], mine=set(found) | benched).run(ev['end'])
            scripts += opened + [ev['end']]
            for _, grp, _ in end.loads:
                for g in grp:
                    seen.setdefault(g['char'], g)
                    if g['side'] == 'player':
                        add(g, i, 'end')
            for c in end.recruits:
                add(c, i, 'end', seen=seen)
        # Levels for anyone who joined here without a placement the runs kept (Harken and Vaida arrive on a branch): the groups
        # the chapter's scripts can load.
        for c, v in found.items():
            if v[0] == i and v[4] is None:
                g = next((g for p in scripts for g in placements(p, c)), None)
                if g:
                    v[4], v[5] = g['level'], g['class']
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
    for mode in STORIES:
        chapters = story(mode)
        print('==', mode, [c[2] for c in chapters])
        for c, (i, how, with_, turn, level, cls) in sorted(joins(mode).items(), key=lambda x: (x[1][0], x[0])):
            print(' ', c, names.get(c), chapters[i][2], how, [names.get(w) for w in with_], turn or '', 'Lv', level, cn.get(cls))
