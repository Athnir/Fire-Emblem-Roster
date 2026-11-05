"""
Path of Radiance's and Radiant Dawn's biorhythm, read from the user's own files (the readers in fe9_units.py and
fe10_units.py) and checked against each game's program (sys/main.dol, read with gc_dol.py). The two games work
differently; nothing here is shared between them but the five states' names and the float rounding.

Both games compute the curve in single-precision floats; value_* below round the same way (f32), so a state on the
edge of a threshold comes out as the game has it.

Path of Radiance (FE9, NA GFEE01)
---------------------------------
PersonData (FE8Data.bin, 84-byte records) +0x32 (u16) is the person's biorhythm phase and +0x35 (u8) its period.
The loader (0x8001ac18) copies them to the person's in-memory record (+0x58, +0x55): a period of 0 becomes 30
(0x8001b00c; every one of the 340 records has 30), and a phase of 0 becomes a random number from 0 to 365 (0x8001aff0,
the RNG 0x8000cee4(366)). The loader runs once when the game boots (0x80005c8c, after main() seeds the RNG from the
time base), and nothing saves the phase (the unit save loader 0x8003c830 restores the person only by index), so those
units get a new random phase each time the game is switched on. Only 12 of the 51 playable records have a phase of
their own (Ike, Boyd, Greil, Titania, Oscar, Shinon, Gatrie, Soren, Mia, Mist, Rolf; Zawana's too).

The value (0x80037904 -> 0x801660c4, the sine 0x80238638):
    x = 7 * chapter + 236161 + battles // 10 - phase                      (0x801660a8 gives 7 * chapter + 236161)
    value = sin(2 * pi * x / period)
`chapter` is the byte at 0x80330718: the chapter's file number (Scripts/Cnn.cmb: 1 the Prologue ... 31 the Endgame),
the same for every unit, deployed or not. `battles` is the unit's battle count (unit +0x228, u16): the battle set-up
(0x801a5268) adds 1 to both units. So a unit moves 7 points along a 30-point wave each chapter and 1 more for every
10 battles; the map's turn number is never read (0x801660a8 is handed the map's state and ignores it).
States (0x80165e90): the value is compared with -0.8, -0.4, 0.4 and 0.8 (floats at 0x8036a8c8..d4); the number of
those it is at or below picks a row of the 5x5 byte table at 0x80277888. Rows 0-4 are what Serenes Forest calls Best,
Good, Normal, Bad and Worst (the game's text has no names for them). Each row is five signed bytes: Str/Mag (added by
0x80039408 and 0x8003afa0), Def/Res (0x8003aa40, 0x8003a778), Hit, Avoid, Crit (the battle calculation 0x801a8f80:
Hit 0x801a9254, Avoid 0x801a9288, Crit 0x801a92ec). Only Hit and Avoid are ever non-zero: +5 for rows 0-1, -5 for 3-4.
Tempest (SID_TEMPER, skill 0x12) doubles all five, then Serenity (SID_CALM, 0x13) halves them toward zero, both
checked on the unit's own skills (0x80165fbc, 0x8016600c). Boyd and Makalov start with Tempest, Rhys and Devdan with
Serenity.
The status screen (0x8007ead8) draws the curve from x - 20 to x + 20 with the unit's current point marked; the map's
unit window (0x80083f08) shows a mark when the value is >= 0.8 or <= -0.8.

Radiant Dawn (FE10, NA RFEE01)
------------------------------
PersonData's 28 trailing bytes (fe10_units.people): byte 0 is the biorhythm type (0-9; 0xFF on generic units), byte 1
a phase code, byte 2 the step per phase. The loader (0x80109df8) keeps them at person +0xe4, +0xe5, +0xe3. When a unit
is first placed (0x8011d580, from the placement routines 0x8010c200/0x8010c408/0x8010c8ec, which skip a PID already on
the roster) it gets
    type  = byte 0, or a random 0-7 if negative (0x8011d69c: generic units never get 8 or 9)
    step  = byte 2, or trunc(random 0-99 / 6) if negative
    phase = the phase code's value (0x801075a4): 0 -> 25, 1 -> 12.5, 2 -> 37.5, 3 -> 0, 4 -> 62.5, 5 -> 87.5, 6 -> 75,
            anything else a random 0-99; +50 if the type's A*B is negative; brought to 100 or under; kept as a whole number
    t     = 0
All 73 playable units have phase code 3 (phase 0) and step 8.
The value (0x801070a4, the sine 0x80295940):
    value = A * B * sin(2 * pi * (F * t + phase) / 100) + C
with the type's row of BioData (FE10Data.cms: ten rows of four floats A, B, F, C). The end-of-phase routine (0x80042d38,
run just before the phase passes to the next army, 0x800614a8) adds the step to t for every unit of the army whose
phase is ending. So with step 8, t = 8 * (n - 1) during the n-th phase of the unit's army since it was placed, and t
carries over from chapter to chapter (it's saved with the unit, 0x80121700/0x80121a28). Sampled once a turn every type
repeats every 25 turns (F * 8 * 25 is a multiple of 100).
States and effects: BioParam (FE10Data.cms: five rows of a float threshold and five bytes). Best if value >= 0.8, Good
if >= 0.4, Normal if > -0.4, Bad if > -0.8, Worst otherwise (0x801076d0, 0x80107864). The effect routine (0x80107864)
fills seven bytes: 0 Str/Mag (0x80124cf0, 0x80124ff4) and 1 Def/Res (0x801261e4, 0x801264e8), always 0 (BioParam has
no column for them), then BioParam's five: Hit (the battle calculation 0x8002f220, at 0x8002f6b8), Avoid (0x8002f734),
Crit (0x8002f7b4; 0 in every row), skill activation (every skill-rate routine: 0x80027d9c Astra/Aether/Adept,
0x80028a68 Pavise/Colossus/Luna/Lethality/..., 0x8002742c and 0x8002b2ac Vantage, 0x8002d8d8, 0x801209d0/0x80120ac0/
0x80120bb0), and the buried-treasure chance (0x801278f8: Skl, +60 with SID_THUNT, + this, held to 0-100; startup.cmb's
GetRndTreasure reads it as UnitGet(unit, 12)). Tempest (SID_TEMPEST) doubles all seven and Serenity (SID_SERENITY)
halves them toward zero (0x80107980, 0x80107a04), but in the NA game no unit or class has either and their scrolls are
named "dummy".
What changes t: Matrona (0x801c9a40) and the herons' galdr Bliss (0x800489b4) set it to the type's first peak,
trunc((25 - phase) / F); Sorrow (0x80048c70) to its first trough, trunc((-25 - phase) / F) (0x801072e4, 0x80107444;
Bliss and Sorrow need SID_GALLDRER and Lv 15, 0x80120cac/0x80120d2c). The status screen (0x801c5874) draws t - 120 to
t + 120 (15 turns each way at step 8).

Run: python scripts/tellius_biorhythm.py   prints each playable unit's biorhythm and one cycle per type.
"""
import math
import os
import struct

STATES = ('Best', 'Good', 'Normal', 'Bad', 'Worst')


def f32(x):
    """x rounded to a single-precision float, as the GameCube/Wii's single-precision instructions leave it."""
    return struct.unpack('>f', struct.pack('>f', x))[0]


TWO_PI = f32(2 * math.pi)  # both programs' constant (0x40c90fdb)


# ---------------------------------------------------------------------------------------------------------------
# Path of Radiance
# ---------------------------------------------------------------------------------------------------------------

FE9_DEFAULT_PERIOD = 30     # a period byte of 0 (0x8001b00c)
FE9_RANDOM_PHASES = 366     # a phase of 0 becomes random 0..365 at boot (0x8001aff0)
FE9_TIME_BASE = 236161      # 0x801660a8: 7 * chapter + 236161
FE9_STEPS_PER_CHAPTER = 7
FE9_BATTLES_PER_STEP = 10
FE9_THRESHOLDS = tuple(f32(x) for x in (-0.8, -0.4, 0.4, 0.8))  # 0x8036a8c8..0x8036a8d4
FE9_EFFECT_FIELDS = ('str_mag', 'def_res', 'hit', 'avoid', 'crit')
# The rows of 0x80277888, by state (index 0 = Best ... 4 = Worst).
FE9_EFFECTS = ((0, 0, 5, 5, 0), (0, 0, 5, 5, 0), (0, 0, 0, 0, 0), (0, 0, -5, -5, 0), (0, 0, -5, -5, 0))
FE9_TEMPEST, FE9_SERENITY = 'SID_TEMPER', 'SID_CALM'


def fe9_dol_path():
    from fe9_files import FE9
    return os.path.join(FE9, '..', 'sys', 'main.dol')


def fe9_person_biorhythm(t):
    """Every PersonData record's biorhythm: {PID: {'phase': n, or None when the game rolls it (0..365) at boot,
    'period': n}}. `t` is fe9_units.Tables()."""
    o = t.named['PersonData']
    out = {}
    for k in range(t.u32(o)):
        p = o + 4 + k * 84
        r = t.raw(p, 84)
        phase = struct.unpack_from('>H', r, 0x32)[0]
        out[t.ptr_string(p)] = {'phase': phase or None, 'period': r[0x35] or FE9_DEFAULT_PERIOD}
    return out


def fe9_biorhythm_types(t):
    """Path of Radiance has no numbered types: each person carries a phase and a period. The distinct curves:
    {(phase or None, period): [PIDs]}."""
    out = {}
    for pid, b in fe9_person_biorhythm(t).items():
        out.setdefault((b['phase'], b['period']), []).append(pid)
    return out


def fe9_unit_biorhythm(t, pids):
    """{PID: {'phase', 'period'}} for the PIDs given (the playable ones build-fe9-units.py writes)."""
    every = fe9_person_biorhythm(t)
    return {pid: every[pid] for pid in pids}


def fe9_point(phase, chapter, battles=0, period=FE9_DEFAULT_PERIOD):
    """Where the unit is on its wave: 0..period-1 (Serenes Forest's 'internal' point is this + 1)."""
    return (FE9_TIME_BASE + FE9_STEPS_PER_CHAPTER * chapter + battles // FE9_BATTLES_PER_STEP - phase) % period


def fe9_state_of(value):
    """The state index (0 Best ... 4 Worst) for a value, as 0x80165e90 counts the thresholds it's at or below."""
    v = f32(value)
    return sum(1 for th in FE9_THRESHOLDS if v <= th)


def fe9_value(phase, chapter, battles=0, period=FE9_DEFAULT_PERIOD):
    """(value, state name) as the game works it out (0x801660c4), with its float rounding. `chapter` is the chapter's
    file number (Cnn: 1 the Prologue ... 31 the Endgame), `battles` the unit's battle count."""
    return _fe9_value_x(FE9_TIME_BASE + FE9_STEPS_PER_CHAPTER * chapter + battles // FE9_BATTLES_PER_STEP - phase, period)


def _fe9_value_x(x, period):
    arg = f32(f32(TWO_PI * f32(x)) / f32(period))
    v = f32(math.sin(arg))
    return v, STATES[fe9_state_of(v)]


def fe9_value_at_point(point, period=FE9_DEFAULT_PERIOD):
    """(value, state) at a point of the wave (0..period-1), worked out at the size of number the game uses there (the
    rounding moves the value by a few thousandths at most, never across a threshold: see the checks in main())."""
    return _fe9_value_x(FE9_TIME_BASE + (point - FE9_TIME_BASE) % period, period)


def fe9_effects(state, tempest=False, serenity=False):
    """{field: bonus} for a state (name or index), with Tempest and Serenity as 0x80165e90 applies them."""
    i = STATES.index(state) if isinstance(state, str) else state
    vals = list(FE9_EFFECTS[i])
    if tempest:
        vals = [v * 2 for v in vals]
    if serenity:
        vals = [int(v / 2) for v in vals]  # toward zero
    return dict(zip(FE9_EFFECT_FIELDS, vals))


def fe9_cycle(phase, period=FE9_DEFAULT_PERIOD, chapter=1):
    """One full wave from `chapter` (0 battles), a step at a time: [(step, point, value, state)]. A step is a tenth of
    the battles; a chapter is 7 steps."""
    out = []
    for step in range(period):
        v, s = fe9_value(phase, chapter, step * FE9_BATTLES_PER_STEP, period)
        out.append((step, fe9_point(phase, chapter, step * FE9_BATTLES_PER_STEP, period), v, s))
    return out


def fe9_check_program(path=None):
    """Read the constants above from main.dol and say which differ ([] when all match)."""
    import gc_dol
    d = gc_dol.Dol(path or fe9_dol_path())
    f = lambda a: struct.unpack('>f', struct.pack('>I', d.u32(a)))[0]
    bad = []
    if tuple(f(0x8036a8c8 + 4 * i) for i in range(4)) != FE9_THRESHOLDS:
        bad.append('thresholds')
    if f(0x8036a8d8) != TWO_PI:
        bad.append('2 pi')
    o = d.off(0x80277888)
    if tuple(tuple(struct.unpack('5b', d.d[o + 5 * i:o + 5 * i + 5])) for i in range(5)) != FE9_EFFECTS:
        bad.append('effects')
    # 0x801660a8: lbz chapter; mulli 7; addis 4; addi -0x657f
    if (d.u32(0x801660b4) & 0xffff, d.u32(0x801660b8) & 0xffff, d.u32(0x801660bc) & 0xffff) != (7, 4, 0x10000 - 0x657f):
        bad.append('time base')
    if d.u32(0x8001aff0) & 0xffff != FE9_RANDOM_PHASES or d.u32(0x8001b010) & 0xffff != FE9_DEFAULT_PERIOD:
        bad.append('loader defaults')
    return bad


# ---------------------------------------------------------------------------------------------------------------
# Radiant Dawn
# ---------------------------------------------------------------------------------------------------------------

FE10_PHASE_CODES = {0: 25.0, 1: 12.5, 2: 37.5, 3: 0.0, 4: 62.5, 5: 87.5, 6: 75.0}  # 0x801075a4 (table 0x803856e0)
FE10_EFFECT_FIELDS = ('str_mag', 'def_res', 'hit', 'avoid', 'crit', 'skill', 'treasure')
FE10_TEMPEST, FE10_SERENITY = 'SID_TEMPEST', 'SID_SERENITY'


def fe10_dol_path():
    from fe10_files import FE10
    return os.path.join(FE10, '..', 'sys', 'main.dol')


def fe10_biorhythm_types(t):
    """BioData: ten rows of four floats. [{'type', 'a', 'b', 'f', 'c'}]: value = a * b * sin(2 pi (f t + phase) / 100)
    + c. `t` is fe10_units.Tables()."""
    o = t.named['BioData']
    n = 10
    rows = struct.unpack('>%df' % (4 * n), t.raw(o, 16 * n))
    return [{'type': i, 'a': rows[4 * i], 'b': rows[4 * i + 1], 'f': rows[4 * i + 2], 'c': rows[4 * i + 3]}
            for i in range(n)]


def fe10_states(t):
    """BioParam: five 12-byte rows, Best to Worst: a float threshold, then five signed bytes (Hit, Avoid, Crit, skill
    activation, buried-treasure chance) and padding. [{'state', 'threshold', field: bonus...}], Str/Mag and Def/Res 0."""
    o = t.named['BioParam']
    out = []
    for i, name in enumerate(STATES):
        r = t.raw(o + 12 * i, 12)
        vals = (0, 0) + struct.unpack('5b', r[4:9])
        out.append({'state': name, 'threshold': struct.unpack('>f', r[:4])[0], **dict(zip(FE10_EFFECT_FIELDS, vals))})
    return out


def fe10_phase(code, a=1.0, b=1.0):
    """The phase a phase code gives when the unit is placed (0x801075a4); None for a random one (0-99)."""
    if code not in FE10_PHASE_CODES:
        return None
    p = FE10_PHASE_CODES[code]
    if f32(a * b) < 0:
        p += 50.0
    while p > 100.0:
        p -= 100.0
    return int(p) & 0xFF


def fe10_unit_biorhythm(t, pids):
    """{PID: {'type', 'phase_code', 'phase', 'step'}} for the PIDs given (the playable ones build-fe10-units.py
    writes). A type, phase or step of None is rolled when the unit is placed."""
    types = fe10_biorhythm_types(t)
    o = t.named['PersonData']
    p = o + 4
    raw = {}
    for _ in range(t.u32(o)):
        head = t.raw(p, 4)
        pid = t.ptr_string(p + 4)
        q = p + 32 + 4 * head[0] + 20
        raw[pid] = t.raw(q, 3)
        p = q + 28
    out = {}
    for pid in pids:
        ty, code, step = raw[pid]
        ty = ty if ty < 128 else None
        code = code if code < 128 else code - 256
        row = types[ty] if ty is not None else {'a': 1.0, 'b': 1.0}
        out[pid] = {'type': ty, 'phase_code': code, 'phase': fe10_phase(code, row['a'], row['b']),
                    'step': step if step < 128 else None}
    return out


def fe10_state_of(value, states=None):
    """The state name for a value (0x801076d0): Best >= 0.8, Good >= 0.4, Normal > -0.4, Bad > -0.8, else Worst."""
    th = [f32(s['threshold']) for s in states] if states else [f32(0.8), f32(0.4), 0.0, f32(-0.4), f32(-0.8)]
    v = f32(value)
    if v >= th[0]:
        return 'Best'
    if v >= th[1]:
        return 'Good'
    if v > th[3]:
        return 'Normal'
    if v > th[4]:
        return 'Bad'
    return 'Worst'


def fe10_value(row, t, phase=0, states=None):
    """(value, state) for a BioData row at time t (the unit's counter), with the game's float rounding (0x801071c4)."""
    x = f32(f32(TWO_PI * f32(t)) / f32(100.0))
    ph = f32(f32(TWO_PI * f32(phase & 0xFF)) / f32(100.0))
    arg = f32(f32(row['f']) * x + ph)
    s = f32(math.sin(arg))
    v = f32(f32(f32(row['a']) * f32(row['b'])) * s + f32(row['c']))
    return v, fe10_state_of(v, states)


def fe10_turn_value(row, turn, phase=0, step=8, states=None):
    """(value, state) on the unit's `turn`-th phase since it was placed (1 = its first): t = step * (turn - 1)."""
    return fe10_value(row, step * (turn - 1), phase, states)


def fe10_peak_time(row, phase=0):
    """What Matrona and Bliss set t to (0x801072e4): the first peak, trunc((25 - phase) / f) (100 asin(1) / 2 pi = 25)."""
    return _fe10_extreme(row, phase, 1.0)


def fe10_trough_time(row, phase=0):
    """What Sorrow sets t to (0x80107444): the first trough, trunc((-25 - phase) / f)."""
    return _fe10_extreme(row, phase, -1.0)


def _fe10_extreme(row, phase, sign):
    ab = f32(row['a'] * row['b'])
    target = 0.0 if ab == 0 else (sign if ab > 0 else -sign)
    if target == 0.0 or row['f'] == 0:
        return phase & 0xFF
    ph = f32(f32(TWO_PI * f32(phase & 0xFF)) / 100.0)
    q = f32(f32(f32(math.asin(target)) - ph) / f32(row['f']))
    t = int(f32(f32(100.0 * q) / TWO_PI))  # fctiwz
    return ((t + 0x8000) & 0xFFFF) - 0x8000  # kept as 16 bits, read back signed


def fe10_effects(state, states, tempest=False, serenity=False):
    """{field: bonus} for a state, with Tempest and Serenity as 0x80107864 applies them (no NA unit has either)."""
    row = next(s for s in states if s['state'] == state)
    vals = [row[f] for f in FE10_EFFECT_FIELDS]
    if tempest:
        vals = [v * 2 for v in vals]
    if serenity:
        vals = [int(v / 2) for v in vals]
    return dict(zip(FE10_EFFECT_FIELDS, vals))


def fe10_cycle(row, phase=0, step=8, turns=25, states=None):
    """[(turn, t, value, state)] for turns 1..turns (25 is one full repeat for every type at step 8)."""
    return [(n, step * (n - 1)) + fe10_turn_value(row, n, phase, step, states) for n in range(1, turns + 1)]


def fe10_check_program(path=None):
    """Read the program's constants and say which differ from the ones above ([] when all match)."""
    import gc_dol
    d = gc_dol.Dol(path or fe10_dol_path())
    f = lambda a: struct.unpack('>f', struct.pack('>I', d.u32(a)))[0]
    bad = []
    if f(0x804cdbc8) != TWO_PI or f(0x804cdbcc) != 100.0:
        bad.append('2 pi / 100')
    # 0x801075a4's jump table: each case loads one float from r2 (lfs f1, d(r2)).
    r2 = d.sda()['r2']
    cases = [d.u32(0x803856e0 + 4 * i) for i in range(7)]
    codes = {i: f((r2 + struct.unpack('>h', struct.pack('>H', d.u32(c) & 0xffff))[0]) & 0xffffffff)
             for i, c in enumerate(cases)}
    if codes != FE10_PHASE_CODES:
        bad.append('phase codes %r' % codes)
    if (d.cstr(d.u32(0x804ca6cc)), d.cstr(d.u32(0x804ca6d0))) != (FE10_TEMPEST, FE10_SERENITY):
        bad.append('Tempest/Serenity')
    return bad


# ---------------------------------------------------------------------------------------------------------------

def _playable(game):
    """The PIDs the generator wrote to src/data/<game>/<game>Units.ts (read only, for the printout)."""
    import re
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
    src = open(os.path.join(root, 'src', 'data', game, game + 'Units.ts'), encoding='utf-8').read()
    return re.findall(r'"id": "(PID_[A-Z0-9_]+)"', src)


def main():
    import fe9_units
    import fe10_units
    print('Path of Radiance: program constants', fe9_check_program() or 'match')
    t9 = fe9_units.Tables()
    names9 = {pid: p['name'] for pid, p in fe9_units.people(t9).items()}
    for pid, b in fe9_unit_biorhythm(t9, _playable('fe9')).items():
        print(f'  {pid:18} {names9[pid]:10} phase {b["phase"] if b["phase"] is not None else "random"} period {b["period"]}')
    print('  point: value state')
    for point in range(FE9_DEFAULT_PERIOD):
        v, s = fe9_value_at_point(point)
        print(f'  {point + 1:2}: {v:+.4f} {s}')

    print('Radiant Dawn: program constants', fe10_check_program() or 'match')
    t10 = fe10_units.Tables()
    types = fe10_biorhythm_types(t10)
    states = fe10_states(t10)
    names10 = {pid: p['name'] for pid, p in fe10_units.people(t10).items()}
    for pid, b in fe10_unit_biorhythm(t10, _playable('fe10')).items():
        print(f'  {pid:18} {names10[pid]:12} type {b["type"]} phase {b["phase"]} step {b["step"]}')
    for row in types:
        cyc = fe10_cycle(row, states=states)
        print(f'  type {row["type"]} (a {row["a"]}, b {row["b"]}, f {row["f"]}, c {row["c"]}):',
              ' '.join(s[:2] for _, _, _, s in cyc))


if __name__ == '__main__':
    main()
