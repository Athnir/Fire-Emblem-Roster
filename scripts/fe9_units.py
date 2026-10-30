"""
Path of Radiance's people, classes, skills and supports, read from FE8Data.bin's named tables
(see data-raw/fe9/README.md for the layouts). Shared by build-fe9-units.py and the checks.
"""
import struct

from fe9_files import GameData, read_text

STATS = ('hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res')
# The weapon rank string's nine places, in the game's order.
RANK_TYPES = ('sword', 'lance', 'axe', 'bow', 'fire', 'thunder', 'wind', 'staff', 'light')
# PersonData's affinity strings -> the labels of their names in common.m ('telius' is Earth).
AFFINITY_LABELS = {'telius': 'MDV_TELI', 'heaven': 'MDV_HV', 'light': 'MDV_LIT', 'dark': 'MDV_D', 'water': 'MDV_WAT',
                   'wind': 'MDV_WD', 'thunder': 'MDV_TH', 'fire': 'MDV_FI'}


def signed(b):
    return b - 256 if b > 127 else b


class Tables:
    """FE8Data.bin's named tables: {name: data offset} (offsets from 0x20, like its pointers)."""

    def __init__(self):
        self.g = GameData()
        self.text = read_text()
        d = self.g.d
        _, size, n_ptrs, n_names = struct.unpack_from('>4I', d, 0)
        names_at = 0x20 + size + n_ptrs * 4
        strings_at = names_at + n_names * 8
        self.named = {}
        for k in range(n_names):
            off, name = struct.unpack_from('>2I', d, names_at + k * 8)
            self.named[d[strings_at + name:d.index(b'\0', strings_at + name)].decode('shift_jis')] = off

    def u32(self, off):
        return self.g.u32(self.g.B + off)

    def ptr_string(self, off):
        """The string the pointer at data offset `off` points at, or None."""
        v = self.u32(off)
        return self.g.string(v) if v else None

    def raw(self, off, n):
        return self.g.d[self.g.B + off:self.g.B + off + n]

    def name(self, label):
        return ' '.join(self.text.get(label, '').split()) if label else ''


def people(t):
    """PersonData: a count, then 84-byte records. {PID: dict}."""
    o = t.named['PersonData']
    out = {}
    for k in range(t.u32(o)):
        p = o + 4 + k * 84
        r = t.raw(p, 84)
        out[t.ptr_string(p)] = {
            'pid': t.ptr_string(p), 'name': t.name(t.ptr_string(p + 4)), 'jid': t.ptr_string(p + 0x10),
            'affinity': t.ptr_string(p + 0x14), 'ranks': t.ptr_string(p + 0x18) or '',
            'skills': [s for s in (t.ptr_string(p + 0x1C + 4 * i) for i in range(3)) if s],
            'level': r[0x36],
            'con': signed(r[0x37]), 'wt': signed(r[0x38]),
            'bases': dict(zip(STATS, (signed(b) for b in r[0x39:0x41]))),
            'growths': dict(zip(STATS, r[0x41:0x49])),
        }
    return out


def classes(t):
    """JobData: a count, then 100-byte records. {JID: dict}."""
    o = t.named['JobData']
    out = {}
    for k in range(t.u32(o)):
        p = o + 4 + k * 100
        r = t.raw(p, 100)
        out[t.ptr_string(p)] = {
            'jid': t.ptr_string(p), 'name': t.name(t.ptr_string(p + 4)), 'other': t.ptr_string(p + 0xC),
            'ranks': t.ptr_string(p + 0x14) or '',
            'skills': [s for s in (t.ptr_string(p + 0x18 + 4 * i) for i in range(4)) if s],
            'attributes': [s for s in (t.ptr_string(p + 0x2C + 4 * i) for i in range(3)) if s],
            'con': r[0x3C], 'wt': r[0x3D], 'mov': r[0x3E], 'capacity': r[0x40], 'move_type': r[0x42],
            'bases': dict(zip(STATS, r[0x44:0x4C])), 'caps': dict(zip(STATS, r[0x4C:0x54])),
            'growths': dict(zip(STATS, r[0x54:0x5C])),
            'growth_mods': dict(zip(STATS, (signed(b) for b in r[0x5C:0x64]))),
        }
    return out


def skills(t):
    """The SID_ tables (40 bytes each). {SID: dict}."""
    out = {}
    for name, o in t.named.items():
        if not name.startswith('SID_'):
            continue
        r = t.raw(o, 40)
        out[name] = {
            'sid': name, 'label': t.ptr_string(o + 8), 'name': t.name(t.ptr_string(o + 8)),
            'help': t.name(t.ptr_string(o + 0xC)), 'scroll': t.ptr_string(o + 0x14),
            'index': r[0x18], 'icon': r[0x19], 'capacity': r[0x1A], 'flag': r[0x1B], 'count': r[0x1C],
        }
    return out


def supports(t):
    """RelianceData: a count of people, then each one's PID, a partner count and 8-byte entries
    (partner PID, then three bytes C, B, A). [(PID, partner PID, (c, b, a))]."""
    o = t.named['RelianceData']
    p = o + 4
    out = []
    for _ in range(t.u32(o)):
        pid, n = t.ptr_string(p), t.u32(p + 4)
        p += 8
        for _ in range(n):
            partner = t.ptr_string(p)
            out.append((pid, partner, tuple(t.raw(p + 4, 3))))
            p += 8
    return out
