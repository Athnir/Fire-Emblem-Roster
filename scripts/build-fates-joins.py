"""
Write src/data/__tests__/fatesGameJoins.ts: what Fates' own files say about when and how each first-generation unit joins, for the
tests to hold the hand-entered data in src/data/characters.ts, classes.ts and childLeveling.ts to. See data-raw/fates/README.md.

- Join stats: each unit's person record in GameData.bin, and the route versions in Person/A_HANDOVER.bin (Birthright),
  B_HANDOVER.bin (Conquest) and C_HANDOVER.bin (Revelation) for the units who join that route at another level.
- The story level per chapter (each chapter record's +0x12), and the story level past which a late recruit levels up (person +0x2d).
- The chapters with no My Castle visit after them, from the route scripts (Conquest's and Revelation's are in the route DLC).
- Each base class's promotions.

Reads the romfs the Fire Emblem Armory extracted from the user's cartridge (../Fates Armory/data-raw/fates/romfs; FATES_ROMFS
overrides it). Never commits anything from it but these derived numbers. Run:
    python scripts/build-fates-joins.py
"""
import glob
import os
import re
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fates_text  # noqa: E402
from fates_lz import decompress  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ROMFS = os.environ.get('FATES_ROMFS', os.path.join(ROOT, '..', 'Fates Armory', 'data-raw', 'fates', 'romfs'))
OUT = os.path.join(ROOT, 'src', 'data', '__tests__', 'fatesGameJoins.ts')
B = 0x20
JOB, PERSON, CHAPTER = 0x80, 0x98, 0x1c  # record sizes, counted from each record's ID pointer
PROMOTED = 3  # class flag bit: SPID_上級職
ROUTES = {'A_HANDOVER': 'Birthright', 'B_HANDOVER': 'Conquest', 'C_HANDOVER': 'Revelation'}


def strings(d):
    def s(ptr):
        o = B + ptr
        if not 0 < ptr < len(d) - B:
            return None
        try:
            return d[o:d.index(b'\0', o)].decode('shift_jis')
        except (ValueError, UnicodeDecodeError):
            return None
    return s


def main():
    d = decompress(open(os.path.join(ROMFS, 'GameData.bin.lz'), 'rb').read())
    u16 = lambda o: struct.unpack_from('<H', d, o)[0]  # noqa: E731
    u32 = lambda o: struct.unpack_from('<I', d, o)[0]  # noqa: E731
    stats = lambda buf, o: list(struct.unpack_from('<8b', buf, o))  # noqa: E731
    s = strings(d)

    text = {}
    for path in glob.glob(os.path.join(ROMFS, 'm', '@E', '*.bin.lz')):
        text.update(fates_text.read(path))

    def table(prefix, size):
        first = next(o for o in range(B, len(d) - 4, 4) if (s(u32(o)) or '').startswith(prefix))
        out = []
        o = first
        while (s(u32(o)) or '').startswith(prefix):
            out.append(o)
            o += size
        return out

    jobs = {u16(o + 0x10): o for o in table('JID_', JOB)}  # +0x10: the class number

    def job_name(n):
        return text[s(u32(jobs[n] + 8))]  # +8: the class's name label (MJID_)

    def promoted(n):
        return int.from_bytes(d[jobs[n] - 8:jobs[n]], 'little') >> PROMOTED & 1

    def join(buf, o):
        # +0x24 the class they join in, +0x2a their level, +0x30 their own (personal) stats; the class's bases (+0x14) are added.
        cls = struct.unpack_from('<H', buf, o + 0x24)[0]
        bases = [a + b for a, b in zip(stats(buf, o + 0x30), stats(d, jobs[cls] + 0x14))]
        return {'level': buf[o + 0x2a], 'joinClass': job_name(cls), 'bases': bases}

    # First-generation units: a reclass slot (+0x74) and no fixed parent (+0x22), as in build-fates-class-sets.py.
    units, by_pid = {}, {}
    for o in table('PID_', PERSON):
        if not u16(o + 0x74) or u16(o + 0x22):
            continue
        name = text.get(s(u32(o + 0x0c)) or '')
        if not name or name in units:
            continue
        units[name] = dict(join(d, o), routes={})
        if d[o + 0x2d]:
            units[name]['scalesFrom'] = d[o + 0x2d]  # +0x2d: past this story level, each one adds a level (0x3d396c)
        by_pid[s(u32(o))[4:]] = name

    for file, route in ROUTES.items():
        x = decompress(open(os.path.join(ROMFS, 'Person', file + '.bin.lz'), 'rb').read())
        xs = strings(x)
        for o in range(0, len(x) - PERSON, 4):
            pid = xs(struct.unpack_from('<I', x, o)[0]) or ''
            m = re.fullmatch(r'PID_[ABC]_(.+)', pid)
            if m and m.group(1) in by_pid:
                units[by_pid[m.group(1)]]['routes'][route] = join(x, o)

    # The story level: when a chapter is played, the game raises it to the chapter record's +0x12 (0x1b72f0). The prologue is
    # chapter 0 and the endgame chapter 28 on every route; the three routes share chapters 0-5 and agree from 6 on.
    chapters = {s(u32(o)): d[o + 0x12] for o in table('CID_', CHAPTER)}
    story = [chapters[f'CID_A{n:03}'] for n in range(29)]
    for route in 'BC':
        for n in range(6, 29):
            assert chapters[f'CID_{route}{n:03}'] == story[n], (route, n)

    # Chapters the game goes on from without a My Castle visit: their script calls ev::ChapterSetSkipChapterSaveCastle. Birthright's
    # scripts are in the cartridge's Scripts, Conquest's and Revelation's in the route DLC.
    no_castle = {route: [] for route in ROUTES.values()}
    letters = {'A': 'Birthright', 'B': 'Conquest', 'C': 'Revelation'}
    scripts = glob.glob(os.path.join(ROMFS, 'Scripts', '?', '*.cmb'))
    scripts += glob.glob(os.path.join(ROMFS, 'dlc', '*', 'local', 'Scripts', '?', '*.cmb'))
    for path in scripts:
        m = re.fullmatch(r'([ABC])(\d{3})\.cmb', os.path.basename(path))
        if m and b'ev::ChapterSetSkipChapterSaveCastle' in open(path, 'rb').read():
            skipped = no_castle[letters[m.group(1)]]
            if int(m.group(2)) not in skipped:
                skipped.append(int(m.group(2)))

    promotions = {}
    for n, o in sorted(jobs.items()):
        promos = [u16(o + 0x5c), u16(o + 0x5e)]  # +0x5c: the two promotions
        name = text.get(s(u32(o + 8)) or '')
        if name and not promoted(n) and any(promos) and name not in promotions:
            promotions[name] = [job_name(p) for p in promos if p]

    quote = lambda t: "'" + t.replace("'", "\\'") + "'"  # noqa: E731
    fmt = lambda j: f"{{ level: {j['level']}, joinClass: {quote(j['joinClass'])}, bases: [{', '.join(map(str, j['bases']))}] }}"  # noqa: E731
    lines = [
        '// Generated by scripts/build-fates-joins.py from GameData.bin and Person/*_HANDOVER.bin (data-raw/fates/README.md).',
        '// Do not edit by hand.',
        '',
        'export interface GameJoin {',
        '  level: number',
        '  joinClass: string',
        '  /** HP, Str, Mag, Skl, Spd, Lck, Def, Res: their own stats plus the class\'s bases. */',
        '  bases: number[]',
        '}',
        '',
        '/** How each first-generation unit joins: their person record, the route versions that replace it, and for the late',
        ' * recruits the story level past which each further one adds a level. */',
        'export const FATES_GAME_JOINS: Record<string, GameJoin & { scalesFrom?: number; routes: Record<string, GameJoin> }> = {',
    ]
    for name, u in sorted(units.items()):
        lines.append(f"  {quote(name)}: {{")
        lines.append(f"    level: {u['level']}, joinClass: {quote(u['joinClass'])}, bases: [{', '.join(map(str, u['bases']))}],")
        if 'scalesFrom' in u:
            lines.append(f"    scalesFrom: {u['scalesFrom']},")
        lines.append('    routes: {' + ''.join(f"\n      {route}: {fmt(j)}," for route, j in u['routes'].items()) + ('\n    },' if u['routes'] else '},'))
        lines.append('  },')
    lines += [
        '}',
        '',
        '/** The story level once each chapter (0, the prologue, to 28, the endgame) has been played. */',
        f"export const FATES_GAME_STORY_LEVELS: number[] = [{', '.join(map(str, story))}]",
        '',
        '/** The chapters each route goes on from without a My Castle visit, so nobody can be recruited before the next one. */',
        'export const FATES_GAME_NO_CASTLE_AFTER: Record<string, number[]> = {',
        *[f"  {route}: [{', '.join(map(str, sorted(chs)))}]," for route, chs in no_castle.items()],
        '}',
        '',
        '/** Each base class\'s promotions (the male class names). */',
        'export const FATES_GAME_PROMOTIONS: Record<string, string[]> = {',
    ]
    lines += [f"  {quote(name)}: [{', '.join(map(quote, p))}]," for name, p in promotions.items()]
    lines.append('}')
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')
    routed = sum(len(u['routes']) for u in units.values())
    print(f'{len(units)} units ({routed} route versions), {len(story)} chapters, {len(promotions)} classes -> {os.path.relpath(OUT, ROOT)}')


if __name__ == '__main__':
    main()
