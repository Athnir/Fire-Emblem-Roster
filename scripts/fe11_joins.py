"""
Who joins Shadow Dragon's army, where and how, from the chapters' placements (dispos/) and scripts (script/; scripts/fe11_cmb.py), as
data-raw/fe11/README.md describes:

- A chapter's opening (MapBegin, then Opening) places the units joining at its start: a group of your side's named people whose record
  has flag 0x01 (scene actors have 0x80 alone; 0x40 marks one who only visits, Nyna). 'mikata' is only the deployment slots; Chapter
  1's 'mikata1'-'mikata3' are the army on the Hard modes, which have no prologue.
- A talk handler (trigger 0x08, two people) that hands a unit to your army (UnitTransfar) recruits it; both of a unit's talks count.
- A village (a terrain script's tile of kind 8) that places a group of your side recruits it (only Marth visits villages: Serenes
  Forest).
- The Ending places units joining after the chapter (Cain and Jagen after Prologue II), or hands one over (Horace, Etzel, Ymir). A unit
  the same scene takes off again doesn't join (Elice in Prologue I's ending).

`play()` (the Armory's, copied) runs a scene's placements and moves straight through.
"""
import os
import struct
from collections import OrderedDict

import fe11_data as D
from fe11_cmb import Script
from fe13_bin import Bin

ROM = D.ROM
PROLOGUE = ['bmap201', 'bmap202', 'bmap203', 'bmap204']
GAIDEN = {'bmap101': '6x', 'bmap102': '12x', 'bmap103': '17x', 'bmap104': '20x', 'bmap105': '24x'}
AFTER = {6: 'bmap101', 12: 'bmap102', 17: 'bmap103', 20: 'bmap104', 24: 'bmap105'}
TALK, VILLAGE = 0x08, 8
JOINS, VISITOR = 0x01, 0x40


def story():
    keys = list(PROLOGUE)
    for n in range(1, 25):
        keys.append(f'bmap{n:03d}')
        if n in AFTER:
            keys.append(AFTER[n])
    return keys + ['bmap025']


def chapter_id(key):
    if key in PROLOGUE:
        return f'fe11-p{PROLOGUE.index(key) + 1}'
    if key in GAIDEN:
        return f'fe11-{GAIDEN[key]}'
    if key == 'bmap025':
        return 'fe11-final'
    return f'fe11-{int(key[4:])}'


def chapter_label(key):
    if key in PROLOGUE:
        return f'Prologue {["I", "II", "III", "IV"][PROLOGUE.index(key)]}'
    if key in GAIDEN:
        return f'Ch. {GAIDEN[key]}'
    if key == 'bmap025':
        return 'Endgame'
    return f'Ch. {int(key[4:])}'


def dispos(key):
    """{group: [unit]} from a placement file; 80-byte records (+0 person, +2 class, +6 x, y, +8 team, +9 level, +0x24 flags)."""
    b = Bin(open(os.path.join(ROM, 'dispos', key), 'rb').read())
    P, J = D.persons(), D.jobs()
    out, o = OrderedDict(), 0
    while True:
        n, rec, cnt = struct.unpack_from('<3I', b.d, 0x20 + o)
        if not n and not rec:
            return out
        units = []
        for k in range(cnt):
            r = b.d[0x20 + rec + k * 80:0x20 + rec + k * 80 + 80]
            p, j = struct.unpack_from('<HH', r, 0)
            at = (r[6], r[7]) if r[6] or r[7] else (r[4], r[5])
            units.append({'person': P[p], 'job': J[j], 'at': at, 'team': r[8], 'level': r[9],
                          'flags': struct.unpack_from('<H', r, 0x24)[0]})
        out[b.cstr(0x20 + n)] = units
        o += 12


def script(key):
    path = os.path.join(ROM, 'script', key + '.cmb')
    return Script(path) if os.path.exists(path) else None


def trigger(s, h):
    return struct.unpack_from('<I', s.d, s.offs[h['index']] + 0xc)[0] & 0xFFFF


def named(s, name):
    return next((h for h in s.handlers() if h['name'] == name), None)


def play(s, groups, handlers):
    """The Armory's: run a scene's placements straight through. Returns [(group, unit, tile)] still standing at the end."""
    placed = []

    def find(ref):
        if not ref:
            return None
        kind, v = ref
        for i in range(len(placed) - 1, -1, -1):
            g, u, at = placed[i]
            if kind == 'pid' and u['person']['pid'] == v or kind == 'pos' and tuple(at) == tuple(v):
                return i
        return None

    for h in handlers:
        if not h:
            continue
        stack, local = [], {}
        for _, op, v in s.disasm(h):
            if op in ('int', 'str'):
                stack.append(v)
            elif op == 'addr':
                stack.append(('addr', v))
            elif op == 'local':
                stack.append(local.get(v))
            elif op == 'assign':
                val = stack.pop() if stack else None
                addr = stack.pop() if stack else None
                if isinstance(addr, tuple) and addr[0] == 'addr':
                    local[addr[1]] = val
            elif op == 'call':
                fn, argc = v
                args = stack[len(stack) - argc:] if argc else []
                del stack[len(stack) - argc:]
                res = None
                if fn.startswith('Dispos') and fn != 'DisposWait' and args and isinstance(args[0], str):
                    for u in groups.get(args[0], []):
                        placed.append((args[0], u, tuple(u['at'])))
                elif fn in ('UnitGetByPID', 'UnitSafetyGetByPID') and args:
                    res = ('pid', args[0])
                elif fn in ('UnitGetByPos', 'UnitSafetyGetByPos') and len(args) == 2:
                    res = ('pos', (args[0], args[1]))
                elif fn == 'UnitGetHero':
                    res = ('pid', 'PID_MARS')
                elif fn in ('UnitMovePos', 'UnitMovePosEx', 'UnitSetPos') and len(args) >= 3:
                    i = find(args[0])
                    if i is not None and isinstance(args[1], int) and isinstance(args[2], int):
                        g, u, _ = placed[i]
                        placed[i] = (g, u, (args[1], args[2]))
                elif fn.startswith('UnitRemove') and fn not in ('UnitRemoveAll', 'UnitRemoveAllwithoutHero') and args:
                    i = find(args[0])
                    if i is not None:
                        placed.pop(i)
                stack.append(res)
            elif op == 'pop':
                if stack:
                    stack.pop()
            elif op in ('jz', 'jnz', 'jcc'):
                if stack:
                    stack.pop()
    return placed


def joining(u):
    """A named person of your side placed to join (not a scene actor, not a visitor)."""
    return u['team'] == 0 and u['person']['named'] and u['flags'] & JOINS and not u['flags'] & VISITOR


def record_of(groups, pid):
    """A person's record in a chapter: the first group that places them."""
    for units in groups.values():
        for u in units:
            if u['person']['pid'] == pid:
                return u
    return None


def joins():
    """{pid: {key, chapter, how, with, unit (their record), hard (Chapter 1's record on the Hard modes)}} in the order they join."""
    out = OrderedDict()
    pname = {p['pid']: p['name'] for p in D.persons()}

    def add(pid, key, how, unit, with_=None):
        if pid in out:
            if with_ and out[pid]['key'] == key and out[pid]['how'] == how:
                for w in with_:
                    if w not in out[pid]['with']:
                        out[pid]['with'].append(w)
            return
        out[pid] = {'key': key, 'chapter': chapter_id(key), 'how': how, 'with': list(with_ or []), 'unit': unit}

    hard = {}
    for key in story():
        groups, s, ter = dispos(key), script(key), script(key + '_ter')
        # The start: MapBegin and the opening, played through; 'mikata' is the deployment slots.
        for g, u, _ in play(s, groups, [named(s, 'MapBegin'), named(s, 'Opening')]):
            if g == 'mikata' and key != PROLOGUE[0] or not joining(u) and u['person']['pid'] != 'PID_MARS':
                continue
            if key == 'bmap001' and g in ('mikata1', 'mikata2', 'mikata3'):
                hard[u['person']['pid']] = u
            add(u['person']['pid'], key, 'start', u)
        # Talks that hand a unit over.
        for h in s.handlers():
            calls = s.calls(h)
            if trigger(s, h) != TALK or not any(fn == 'UnitTransfar' for fn, _ in calls):
                continue
            got = [a[0] for fn, a in calls if fn in ('UnitGetByPID', 'UnitSafetyGetByPID') and a and a[0]]
            a, b = (s.string(v) for v in h['args'][:2])
            pid = next((g for g in got if g in (a, b)), None) or (got[-1] if got else None)
            if not pid:
                continue
            talker = b if pid == a else a
            add(pid, key, 'talk', record_of(groups, pid), [pname.get(talker) or talker])
        # Villages that place a group of your side.
        if ter:
            for h in ter.handlers():
                if len(h['args']) < 3 or h['args'][2] != VILLAGE:
                    continue
                for fn, a in ter.calls(h):
                    if fn.startswith('Dispos') and fn != 'DisposWait' and a and isinstance(a[0], str):
                        for u in groups.get(a[0], []):
                            if joining(u):
                                add(u['person']['pid'], key, 'visit', u, ['Marth'])
        # The ending: units it places to join, or hands over.
        end = named(s, 'Ending')
        if end:
            for g, u, _ in play(s, groups, [end]):
                if joining(u):
                    add(u['person']['pid'], key, 'end', u)
            calls = s.calls(end)
            for i, (fn, a) in enumerate(calls):
                if fn == 'UnitTransfar':
                    got = [x[0] for f, x in calls[:i] if f in ('UnitGetByPID', 'UnitSafetyGetByPID') and x and x[0]]
                    if got:
                        add(got[-1], key, 'end', record_of(groups, got[-1]))
    for pid, j in out.items():
        if pid in hard and j['key'] != 'bmap001':
            j['hard'] = hard[pid]
    return out


if __name__ == '__main__':
    pname = {p['pid']: p['name'] for p in D.persons()}
    for pid, j in joins().items():
        u = j['unit']
        print(f"{pname.get(pid) or pid:10} {chapter_label(j['key']):12} {j['how']:6} {','.join(j['with']):18} "
              f"L{u['level'] if u else '?':>2} {u['job']['jid'][4:] if u else '?':16} {'hard' if j.get('hard') else ''}")
