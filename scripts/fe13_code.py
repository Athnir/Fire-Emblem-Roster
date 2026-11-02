"""Helpers for reading Awakening's program (data-raw/fe13/romfs/code.bin, loaded at 0x100000): find a class's virtual functions
through its RTTI name, follow references, and disassemble ARM code with capstone. Used to check mechanics in the code."""
import os
import re
import struct

import capstone

CODE = open(os.path.join(os.path.dirname(__file__), '..', 'data-raw', 'fe13', 'romfs', 'code.bin'), 'rb').read()
BASE = 0x100000
md = capstone.Cs(capstone.CS_ARCH_ARM, capstone.CS_MODE_ARM)
md.detail = False


def u32(addr):
    return struct.unpack_from('<I', CODE, addr - BASE)[0]


def refs(value):
    """Addresses of 4-byte words equal to value (pointers to it)."""
    pat = struct.pack('<I', value)
    return [m.start() + BASE for m in re.finditer(re.escape(pat), CODE) if m.start() % 4 == 0]


def string_addr(s):
    return [m.start() + BASE for m in re.finditer(re.escape(s.encode('shift_jis') + b'\0'), CODE)]


def vtable(mangled):
    """The vtable(s) of the class whose RTTI name is `mangled` ('N8shopMenu10refineMenu9EditPowerE'): lists of function addresses."""
    out = []
    for name in string_addr(mangled):
        for ti_field in refs(name):
            ti = ti_field - 4  # typeinfo: [vtable for the typeinfo class][name][base...]
            for vt_field in refs(ti):
                fns = []
                a = vt_field + 4
                while True:
                    v = u32(a)
                    if not (BASE <= v < BASE + len(CODE)) or v % 4:
                        break
                    fns.append(v)
                    a += 4
                out.append((vt_field, fns))
    return out


def dis(addr, n=60):
    code = CODE[addr - BASE:addr - BASE + 4 * n]
    return [(i.address, i.mnemonic, i.op_str) for i in md.disasm(code, addr)]


def show(addr, n=60):
    for a, m, o in dis(addr, n):
        extra = ''
        mm = re.search(r'\[pc, #(-?0x[0-9a-f]+|-?\d+)\]', o)
        if mm and m.startswith('ldr'):
            lit = a + 8 + int(mm.group(1), 0)
            extra = f' ; ={u32(lit):#x}'
        print(f'{a:08x}  {m:8} {o}{extra}')


_ALL = None


def all_ins():
    """Every 4-byte word of the program disassembled once (data decodes as junk, which is fine for searching)."""
    global _ALL
    if _ALL is None:
        md.skipdata = True
        _ALL = [(i.address, i.mnemonic, i.op_str) for i in md.disasm(CODE, BASE)]
        md.skipdata = False
    return _ALL


def callers(target):
    t = f'#{target:#x}'
    return [a for a, m, o in all_ins() if m in ('bl', 'blx', 'b') and o == t]


def adr_refs(target):
    """Instructions that form `target` as add/sub rX, pc, #imm."""
    out = []
    for a, m, o in all_ins():
        if m in ('add', 'sub') and ', pc, #' in o and o.count('#') == 1:
            imm = int(o.split('#')[1], 0)
            v = a + 8 + (imm if m == 'add' else -imm)
            if v == target:
                out.append(a)
    return out


def func_start(addr):
    """The nearest `push {..., lr}` at or before addr: where the function holding addr likely begins."""
    a = addr - addr % 4
    while a > BASE:
        for x, m, o in dis(a, 1):
            if m in ('push', 'stmdb') and 'lr' in o:
                return a
        a -= 4
    return None


def literal_users(lit):
    """Instructions that load the literal pool word at `lit` (ldr rX, [pc, #imm])."""
    out = []
    ins = all_ins()
    k0 = (lit - 4096 - BASE) // 4
    for a, m, o in ins[max(k0, 0):(lit - BASE) // 4]:
        if m.startswith('ldr') and '[pc, #' in o:
            imm = int(o.split('#')[1].rstrip(']'), 0)
            if a + 8 + imm == lit:
                out.append(a)
    return out


def cstr(addr):
    o = addr - BASE
    return CODE[o:CODE.index(b'\0', o)].decode('shift_jis')


SECOND_SEAL_LIST = 0x2cff38
LIST_ADD = 0x2bbde4


def full_class_list():
    """The classes the Second Seal's list (0x2cff38) adds for a unit whose own, parents' or grandparents' set holds the Tactician
    (checked by 0x214098): {'female': [JID...], 'male': [JID...]}, in the order the program adds them. Each is the same few
    instructions: the name's address (`add r0, pc, #n`), its class (0x2de558), then the add step (`mov r1, r0`, `mov r0, r8`, a call to
    0x2bbde4). The Manakete and Taguel, added after a check of the unit's SID_マムクート or SID_ラグズ flag, are left out."""
    out = {'female': [], 'male': []}
    ins = []
    # Word by word: the routine's string pool sits between its two halves, and capstone stops at the first word it can't read.
    for a in range(SECOND_SEAL_LIST, SECOND_SEAL_LIST + 0x800, 4):
        got = dis(a, 1)
        ins.append(got[0] if got else (a, '.word', ''))
    flagged = False
    for k, (a, m, o) in enumerate(ins):
        if m not in ('add', 'sub') or ', pc, #' not in o or o.count('#') != 1:
            continue
        s = cstr(a + 8 + int(o.split('#')[1], 0) * (1 if m == 'add' else -1))
        if s in ('SID_マムクート', 'SID_ラグズ'):
            flagged = True
            continue
        # (A `nop` can sit between the steps.)
        tail = [(x[1], x[2]) for x in ins[k + 1:k + 7] if x[1] != 'nop'][:4]
        if not s.startswith('JID_') or tail != [('bl', '#0x2de558'), ('mov', 'r1, r0'), ('mov', 'r0, r8'), ('bl', f'#{LIST_ADD:#x}')]:
            continue
        if not flagged:
            gender = 'female' if s.endswith('女') else 'male'
            if s not in out[gender]:
                out[gender].append(s)
        flagged = False
    return out


AVATAR_HAIR = 0x2c8128


def avatar_hair_palette():
    """The Avatar's 20 hair colours ('#rrggbb'), as 0x2c8128 builds them: byte by byte, each an immediate moved into a register and
    stored at an offset from the palette's base (r5, or r0 copied from it). Followed until the routine's first return."""
    regs, mem, base = {}, {}, {'r5'}
    a = AVATAR_HAIR
    while a < AVATAR_HAIR + 0x400:
        got = dis(a, 1)
        a += 4
        if not got:
            continue
        _, m, o = got[0]
        if m.startswith('pop') or (m == 'bx' and o == 'lr'):
            break
        ops = [x.strip() for x in o.split(',')]
        if m == 'mov' and ops[1].startswith('#'):
            regs[ops[0]] = int(ops[1][1:], 0)
        elif m == 'mov' and ops[1] in base:
            base.add(ops[0])
        elif m == 'add' and len(ops) == 3 and ops[1] in base and ops[2] == '#0':
            base.add(ops[0])
        elif m == 'strb' and ops[0] in regs:
            mm = re.match(r'\[(r\d+|ip|lr)(?:, #(0x[0-9a-f]+|\d+))?\]', ', '.join(ops[1:]))
            if mm and mm.group(1) in base:
                mem[int(mm.group(2) or '0', 0)] = regs[ops[0]]
    out = []
    for k in range(0, max(mem) + 1, 4):
        out.append('#%02x%02x%02x' % (mem.get(k, 0), mem.get(k + 1, 0), mem.get(k + 2, 0)))
    return out
