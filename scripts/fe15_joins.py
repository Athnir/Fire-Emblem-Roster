"""
Who joins Shadows of Valentia's armies, where, in which act and how, from the game's event sheets (Data/Event/<location>.bin) and map
scripts (Scripts/*.cmb):

- An event sheet is sections (MOD_/DAT_ labels: 共通 shared, 1章-5章 an act's, イベント) of 44-byte rows: [sequence (where one starts),
  command, condition 1, comparison (1 ==, 2 !=, 4 >=), condition 2, arguments 1-6]. A unit joins by the command 仲間入り (argument 1 and
  arguments 4-5: the people). The sequences named アドベンチャーをスキップ (skipping the adventure parts) repeat the joins; they're left out.
- How a join is reached: a sequence is entered by サブルーチン呼び出し / ジャンプ / はい選択 / いいえ選択 / イベントジャンプ (argument 1),
  or by talking to a portrait a spot adds (立ち絵追加: argument 1 the sequence, argument 4 the person). Following a join back: a portrait of
  the person on the way makes it a talk; a sequence named エンディング (an act's ending) an ending; otherwise a scene on arrival.
- The act: an act section on the way (N章), a chapter condition (*章 == or >= N), or the act the game's own variable names carry
  (G_<location><N>_...); the earliest found. With none on the way, the act the location's variables carry.
- The army: the location's route (Chapter.bin: 1 Alm's, 2 Celica's); a join reached only under *ルート セリカ is Celica's.
- Conrad joins in a map script: Dolth Keep's ending handler calls ev::JoinUnit('PID_コンラート').
"""
import glob
import os
import re
import struct
from collections import Counter, defaultdict

import fates_text
from fates_cmb import Script
from fates_lz import decompress
from fe13_bin import Bin

ROMFS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data-raw', 'fe15', 'romfs')
EVENTS = os.path.join(ROMFS, 'Data', 'Event')
COLS = 11
ENTER = {'サブルーチン呼び出し', 'ジャンプ', 'はい選択', 'いいえ選択', 'イベントジャンプ'}
SKIP = 'アドベンチャーをスキップ'


def sheet(path):
    """[(section, sequence, row)] of an event sheet."""
    b = Bin(decompress(open(path, 'rb').read()))
    ptrs = set(b.ptrs)
    labels = sorted(b.labels)
    ends = sorted(o for o, n in labels if n.startswith('MOD_') or n == 'SHEET_LIST')
    rows = []
    for start, name in labels:
        if not name.startswith('DAT_'):
            continue
        end = min([e for e in ends if e > start] or [len(b.d) - 0x20])
        seq = None
        for o in range(start, end - COLS * 4 + 1, COLS * 4):
            f = [b.str(o + 4 * k) if (o + 4 * k) in ptrs else b.u32(o + 4 * k) for k in range(COLS)]
            if isinstance(f[0], str):
                seq = f[0]
            rows.append((name[4:], seq, f))
    return rows


def _acts(f, place):
    """The acts a row's conditions name: a chapter condition, or a variable named for an act (G_<place><N>_)."""
    out = []
    if f[2] == '*章' and f[3] in (1, 4) and isinstance(f[4], str) and f[4].isdigit():
        out.append(int(f[4]))
    for x in f[2:]:
        if isinstance(x, str):
            m = re.match(r'G_(.+?)(\d)_', x)
            if m:
                out.append(int(m.group(2)))
    return out


def joins():
    """{person key: {'place', 'act', 'how', 'celica' (Celica's army can recruit them too)}} in file order."""
    names = fates_text.read(os.path.join(ROMFS, 'm', '@NOA_EN', 'Name.bin.lz'))
    out = {}
    acts_of = {}

    def add(person, place, act, how, celica):
        e = out.setdefault(person, {'place': names.get('MID_' + place, place), 'key': place, 'act': act, 'how': how, 'celica': celica})
        # Several ways to one join (Zeke's first visit and his talk): a talk wins, the earliest act, Celica's if any.
        if how == 'talk' and e['how'] == 'event':
            e['how'] = 'talk'
        if act is not None and (e['act'] is None or act < e['act']):
            e['act'] = act
        e['celica'] = e['celica'] or celica

    for path in sorted(glob.glob(os.path.join(EVENTS, '*.bin.lz'))):
        place = os.path.basename(path)[:-7]
        if place in ('Sample',) or place.startswith(('テスト', 'ダミー')):
            continue
        rows = sheet(path)
        into = defaultdict(list)
        for sec, seq, f in rows:
            if f[1] in ENTER and isinstance(f[5], str):
                into[f[5]].append((sec, seq, f, None))
            if f[1] == '立ち絵追加' and isinstance(f[5], str):
                into[f[5]].append((sec, seq, f, f[8]))
        # The acts the location's own variables carry: the fallback.
        acts_of[place] = Counter(a for _, _, f in rows for x in f[2:] if isinstance(x, str)
                                 for a in [int(m.group(1)) for m in [re.match(r'G_' + re.escape(place) + r'(\d)_', x)] if m])
        for sec, seq, f in rows:
            if f[1] != '仲間入り' or (seq or '').startswith(SKIP):
                continue
            people = [x for x in (f[5], f[8], f[9]) if isinstance(x, str)]
            acts, talked, ending, routes = [], False, 'エンディング' in seq, set()
            if sec.endswith('章'):
                acts.append(int(sec[:-1]))
            # Back from the join: (sequence, a scene jump crossed on the way). A talk counts only before any jump: it's the talk's own
            # choices and subroutines that lead to the join, not a scene the talk once led into.
            todo, seen = [(seq, False)], {(seq, False)}
            while todo:
                cur, jumped = todo.pop()
                for csec, cseq, cf, person in into.get(cur, []):
                    acts += _acts(cf, place)
                    if csec.endswith('章'):
                        acts.append(int(csec[:-1]))
                    if person in people and not jumped:
                        talked = True
                    if 'エンディング' in (cseq or ''):
                        ending = True
                    if cf[2] == '*ルート':
                        routes.add(cf[4])
                    nxt = (cseq, jumped or cf[1] in ('ジャンプ', 'イベントジャンプ'))
                    if cseq and nxt not in seen:
                        seen.add(nxt)
                        todo.append(nxt)
            own = acts_of[place]
            act = min(acts) if acts else (own.most_common(1)[0][0] if own else None)
            how = 'end' if ending else 'talk' if talked else 'event'
            for p in people:
                add(p, place, act, how, 'セリカ' in routes)
    # Conrad: a map script's ending handler; its act the one the location's event sheets carry.
    for path in sorted(glob.glob(os.path.join(ROMFS, 'Scripts', '*.cmb'))):
        s = Script(path)
        place = os.path.basename(path)[:-4]
        for h in s.handlers():
            dis = s.disasm(h)
            for i, (_, op, arg) in enumerate(dis):
                if op == 'call' and str(arg).startswith('ev::JoinUnit'):
                    pid = next((a.strip("'") for _, o, a in reversed(dis[:i]) if o == 'str'), None)
                    own = sum((c for k, c in acts_of.items() if k.startswith(place)), Counter())
                    if pid:
                        add(pid[4:], place, own.most_common(1)[0][0] if own else None, 'end', False)
    return out


def route(place):
    """The army a location belongs to (Chapter.bin's ルート: 1 Alm's, 2 Celica's)."""
    b = Bin(decompress(open(os.path.join(ROMFS, 'Data', 'Chapter.bin.lz'), 'rb').read()))
    at = {n: o for o, n in b.labels}
    o = at.get('CID_' + place)
    return b.d[0x20 + o + 14] if o is not None else None


if __name__ == '__main__':
    for k, v in joins().items():
        print(k, v, route(v['key']))
