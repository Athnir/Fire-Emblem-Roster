"""
Radiant Dawn's people, classes, skills, supports and bonds, read from FE10Data.cms's named tables (see
data-raw/fe10/README.md for the layouts). Shared by build-fe10-units.py and the checks.

Unlike Path of Radiance's, most of these records are variable-length: a count in the record says how many skill
(or attribute) pointers follow, so each table is walked record by record.
"""
import struct

from fe10_files import GameData, read_text

STATS = ('hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res')
# The weapon rank string's twelve places, in the game's order ('blow' is a laguz's own strike).
RANK_TYPES = ('sword', 'lance', 'axe', 'bow', 'knife', 'strike', 'fire', 'thunder', 'wind', 'light', 'dark', 'staff')
# PersonData's affinity strings -> the labels of their names in e_common.m ('telius' is Earth).
AFFINITY_LABELS = {'telius': 'MDV_TELI', 'heaven': 'MDV_HV', 'light': 'MDV_LIT', 'dark': 'MDV_D', 'water': 'MDV_WAT',
                   'wind': 'MDV_WD', 'thunder': 'MDV_TH', 'fire': 'MDV_FI'}


def signed(b):
    return b - 256 if b > 127 else b


class Tables:
    """FE10Data.cms's named tables: {name: data offset} (offsets from 0x20, like its pointers)."""

    def __init__(self):
        self.g = GameData()
        self.text = read_text()
        d = self.g.d
        _, size, n_ptrs, n_names = struct.unpack_from('>4I', d, 0)
        self.ptrs = set(struct.unpack_from(f'>{n_ptrs}I', d, 0x20 + size))
        names_at = 0x20 + size + n_ptrs * 4
        strings_at = names_at + n_names * 8
        self.named = {}
        for k in range(n_names):
            off, name = struct.unpack_from('>2I', d, names_at + k * 8)
            self.named[d[strings_at + name:d.index(b'\0', strings_at + name)].decode('shift_jis')] = off

    def u32(self, off):
        return self.g.u32(self.g.B + off)

    def ptr_string(self, off):
        """The string the pointer at data offset `off` points at, or None (only offsets the file relocates hold one)."""
        return self.g.string(self.u32(off)) if off in self.ptrs else None

    def raw(self, off, n):
        return self.g.d[self.g.B + off:self.g.B + off + n]

    def name(self, label):
        return ' '.join(self.text.get(label, '').split()) if label else ''


def people(t):
    """PersonData: a count, then records of a 4-byte head (skill count, 0, level, 1 for women), seven pointers (PID,
    MPID, MNPID, FID, JID, affinity, weapon ranks), the skills, a pointer, four animation pointers (AID_), then 28
    bytes: 0 biorhythm type, 1-2 its amplitude and period (3, 8 for everyone), 3 the laguz gauge it starts with, 4
    leadership stars, 5-8 the laguz gauge's changes (turn, battle, transformed turn, transformed battle; signed), 9-16
    their own bases (HP, Str, Mag, Skl, Spd, Lck, Def, Res; signed, added to the class's), 17-18 Con and Wt (signed,
    added to the class's), 19-26 growth rates. {PID: dict}."""
    o = t.named['PersonData']
    p = o + 4
    out = {}
    for _ in range(t.u32(o)):
        head = t.raw(p, 4)
        pid = t.ptr_string(p + 4)
        skills = [t.ptr_string(p + 32 + 4 * i) for i in range(head[0])]
        q = p + 32 + 4 * head[0] + 20
        r = t.raw(q, 28)
        out[pid] = {
            'pid': pid, 'mpid': t.ptr_string(p + 8), 'name': t.name(t.ptr_string(p + 8)), 'named': bool(t.u32(p + 12)),
            'jid': t.ptr_string(p + 20), 'affinity': t.ptr_string(p + 24), 'ranks': t.ptr_string(p + 28) or '',
            'skills': [s for s in skills if s], 'level': head[2], 'female': bool(head[3]),
            'biorhythm': r[0], 'gauge_start': r[3], 'stars': r[4], 'gauge': [signed(b) for b in r[5:9]],
            'bases': dict(zip(STATS, (signed(b) for b in r[9:17]))),
            'con': signed(r[17]), 'wt': signed(r[18]),
            'growths': dict(zip(STATS, r[19:27])),
        }
        p = q + 28
    assert p == t.named['JobData'], 'PersonData should end where JobData starts'
    return out


def classes(t):
    """JobData: a count, then records of eleven pointers (JID, MJID, its Japanese name, help, the class it promotes from,
    the one it promotes to, the laguz form it changes to, the laguz weapon, AID, starting and top weapon ranks), 12
    bytes (0 Con; 2 the unit's weight over its Con, signed (-3 for herons); 4 the mount's weight (20 a horse, 15 a
    pegasus, 25 a wyvern); 5 skill count; 6 attribute count; 9 Mov; 10 skill capacity), a pointer, the skills, a
    laguz class's mastery skill, the attributes (SFXC_: HUMAN for beorc, ALIZE for laguz, ...), then the caps, bases,
    generic units' growths and promotion gains, 8 bytes each (HP, Str, Mag, Skl, Spd, Lck, Def, Res). {JID: dict}."""
    o = t.named['JobData']
    p = o + 4
    out = {}
    for _ in range(t.u32(o)):
        jid = t.ptr_string(p)
        b = t.raw(p + 44, 12)
        n_skills, n_attrs = b[5], b[6]
        skills = [t.ptr_string(p + 60 + 4 * i) for i in range(n_skills)]
        q = p + 60 + 4 * n_skills
        mastery = t.ptr_string(q)
        attrs = [t.ptr_string(q + 4 + 4 * i) for i in range(n_attrs)]
        q += 4 + 4 * n_attrs
        st = t.raw(q, 32)
        out[jid] = {
            'jid': jid, 'mjid': t.ptr_string(p + 4), 'name': t.name(t.ptr_string(p + 4)),
            'lower': t.ptr_string(p + 16), 'higher': t.ptr_string(p + 20), 'transform': t.ptr_string(p + 24),
            'ranks': t.ptr_string(p + 36) or '', 'max_ranks': t.ptr_string(p + 40) or '',
            'con': b[0], 'wt': b[0] + signed(b[2]) + b[4], 'mov': b[9], 'capacity': b[10],
            'skills': [s for s in skills if s], 'mastery': mastery, 'attributes': [a for a in attrs if a],
            'caps': dict(zip(STATS, st[0:8])), 'bases': dict(zip(STATS, st[8:16])),
            'growths': dict(zip(STATS, st[16:24])), 'gains': dict(zip(STATS, st[24:32])),
        }
        p = q + 32
    assert p == t.named['ItemData'], 'JobData should end where ItemData starts'
    return out


def items(t):
    """ItemData's IIDs and their names (records start with the IID and MIID_ pointers; their length varies, see the
    Armory's reader). {IID: name}."""
    o, end = t.named['ItemData'], t.named['SkillData']
    out = {}
    for q in range(o + 4, end, 4):
        iid = t.ptr_string(q)
        if (iid or '').startswith('IID_') and (t.ptr_string(q + 4) or '').startswith('MIID_'):
            out[iid] = t.name(t.ptr_string(q + 4))
    return out


def skills(t):
    """The SID_ tables (44 bytes each): 0 SID, 4 name, 8 and 12 help, 16 and 20 effects, 24 the scroll (IID), 28 icon,
    29 kind (3: the game's own markers, never shown), 30 capacity, 31 order, 32 and 33 the lengths of two lists, at the
    pointers 36 and 40. Each list entry is 8 bytes: a flag (byte 0) and a pointer to a SID_, PID_, JID_ or SFXC_ string.
    {SID: dict}."""
    out = {}
    for name, o in t.named.items():
        if not name.startswith('SID_'):
            continue
        r = t.raw(o, 44)

        def entries(count, at):
            base = t.u32(o + at)
            return [(t.raw(base + 8 * i, 1)[0], t.ptr_string(base + 8 * i + 4)) for i in range(count)]

        out[name] = {
            'sid': name, 'label': t.ptr_string(o + 4), 'name': t.name(t.ptr_string(o + 4)),
            'help': t.name(t.ptr_string(o + 8)), 'scroll': t.ptr_string(o + 24),
            'icon': r[28], 'kind': r[29], 'capacity': r[30], 'order': r[31],
            'rules': entries(r[32], 36), 'allowed': entries(r[33], 40),
        }
    return out


def supports(t):
    """RelianceData: a count of people, then each one's PID, a partner count and 8-byte entries (partner PID, then a
    signed byte and the pair's kind 0-4). Everyone in it is paired with everyone, themselves included.
    {(PID, partner PID): (flag, kind)}."""
    o = t.named['RelianceData']
    p = o + 4
    out = {}
    for _ in range(t.u32(o)):
        pid, n = t.ptr_string(p), t.u32(p + 4)
        p += 8
        for _ in range(n):
            r = t.raw(p + 4, 2)
            out[(pid, t.ptr_string(p))] = (signed(r[0]), r[1])
            p += 8
    return out


def support_param(t):
    """RelianceParam (16 bytes): the points C, B and A need in total, a fourth total, the points each action gives
    (seven bytes), and how much each of the five kinds of pair adds to every gain (signed)."""
    r = t.raw(t.named['RelianceParam'], 16)
    return {'levels': list(r[0:3]), 'actions': list(r[4:11]), 'kinds': [signed(b) for b in r[11:16]]}


def bonds(t):
    """KiznaData: a count, then 12-byte entries (PID, PID, then a byte 1 and the bond's value). [(PID, PID, value)]."""
    o = t.named['KiznaData']
    out = []
    for k in range(t.u32(o)):
        p = o + 4 + 12 * k
        out.append((t.ptr_string(p), t.ptr_string(p + 4), t.raw(p + 9, 1)[0]))
    return out
