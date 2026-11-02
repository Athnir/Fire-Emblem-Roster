"""
Read a GameCube or Wii program (`sys/main.dol` in a Dolphin extraction) to check mechanics in the code: map addresses to the file,
disassemble PowerPC with capstone, and find what references a string or calls a routine. Path of Radiance's and Radiant Dawn's are
used (their paths are in fe9_files.py and fe10_files.py: <files>/../sys/main.dol). Nothing from the program is committed.

    import gc_dol
    d = gc_dol.Dol(path)
    d.show(0x800357e0, 40)          # disassembly, with lis/addi pairs resolved to addresses (and strings)
    d.string_users('SID_HIGHER')    # instructions that build the string's address
    d.callers(0x800357e0)           # bl sites
"""
import re
import struct

_md = None


def _disassembler():
    """capstone, loaded on first use: reading data from the program (the generators) doesn't need it."""
    global _md
    if _md is None:
        import capstone
        _md = capstone.Cs(capstone.CS_ARCH_PPC, capstone.CS_MODE_32 | capstone.CS_MODE_BIG_ENDIAN)
    return _md


class Dol:
    def __init__(self, path):
        self.d = open(path, 'rb').read()
        offs = struct.unpack_from('>18I', self.d, 0)
        addrs = struct.unpack_from('>18I', self.d, 0x48)
        sizes = struct.unpack_from('>18I', self.d, 0x90)
        # (address, file offset, size, is code): 7 text sections, then 11 data sections.
        self.sections = [(a, o, s, i < 7) for i, (o, a, s) in enumerate(zip(offs, addrs, sizes)) if s]
        self.bss = struct.unpack_from('>II', self.d, 0xd8)
        self.entry = struct.unpack_from('>I', self.d, 0xe0)[0]
        self._ins = None

    def off(self, addr):
        for a, o, s, _ in self.sections:
            if a <= addr < a + s:
                return o + addr - a
        return None

    def u32(self, addr):
        return struct.unpack_from('>I', self.d, self.off(addr))[0]

    def u16(self, addr):
        return struct.unpack_from('>H', self.d, self.off(addr))[0]

    def u8(self, addr):
        return self.d[self.off(addr)]

    def cstr(self, addr, enc='shift_jis'):
        o = self.off(addr)
        if o is None:
            return None
        end = self.d.index(b'\0', o)
        try:
            return self.d[o:end].decode(enc)
        except UnicodeDecodeError:
            return None

    def ins(self):
        """Every code word, disassembled one at a time (data in a text section doesn't stop the rest): [(addr, mnemonic, ops)]."""
        if self._ins is None:
            out = []
            for a, o, s, code in self.sections:
                if not code:
                    continue
                for k in range(0, s, 4):
                    got = list(_disassembler().disasm(self.d[o + k:o + k + 4], a + k))
                    out.append((a + k, got[0].mnemonic, got[0].op_str) if got else (a + k, '.word', '0x%08x' % struct.unpack_from('>I', self.d, o + k)[0]))
            self._ins = out
            self._at = {a: i for i, (a, _, _) in enumerate(out)}
        return self._ins

    def at(self, addr):
        self.ins()
        return self._ins[self._at[addr]]

    def sda(self):
        """r2 and r13, the small-data bases the start-up code sets (lis + ori): the compiler reaches globals and strings through them."""
        if getattr(self, '_sda', None) is None:
            regs = {}
            for a, m, o in self.ins()[:8000]:
                ops = [x.strip() for x in o.split(',')]
                if m == 'lis' and ops[0] in ('r2', 'r13'):
                    regs[ops[0]] = (int(ops[1], 0) & 0xffff) << 16
                elif m in ('ori', 'addi') and ops[0] in ('r2', 'r13') and ops[1] == ops[0] and ops[0] in regs:
                    regs[ops[0]] = (regs[ops[0]] | (int(ops[2], 0) & 0xffff)) if m == 'ori' else (regs[ops[0]] + int(ops[2], 0)) & 0xffffffff
                if len(regs) == 2 and all(r & 0xffff for r in regs.values()):
                    break
            self._sda = regs
        return self._sda

    def addresses(self):
        """Every address the code builds or reads: lis + addi/ori/addis, an add to r2 or r13 (the small-data bases), or a load or
        store's offset from a register holding a known address. {address: [instruction addresses]}. Register values are followed
        within a straight run (reset at a branch, the volatile ones at a call); good enough to find who names a string or a global."""
        if getattr(self, '_addr', None) is None:
            base = self.sda()
            val = {}
            out = {}
            no_write = ('stw', 'stb', 'sth', 'stwu', 'stfs', 'stfd', 'stmw', 'cmpwi', 'cmplwi', 'cmpw', 'cmplw', 'mtctr', 'mtlr')
            for a, m, o in self.ins():
                ops = [x.strip() for x in o.split(',')]
                known = {**val, **base}
                if m == 'lis' and len(ops) == 2:
                    val[ops[0]] = (int(ops[1], 0) & 0xffff) << 16
                    continue
                if m in ('addi', 'ori', 'addis') and len(ops) == 3 and ops[1] in known:
                    imm = int(ops[2], 0)
                    if m == 'addi':
                        v = (known[ops[1]] + imm) & 0xffffffff
                    elif m == 'ori':
                        v = known[ops[1]] | (imm & 0xffff)
                    else:
                        v = (known[ops[1]] + (imm << 16)) & 0xffffffff
                    out.setdefault(v, []).append(a)
                    if ops[0] not in base:
                        val[ops[0]] = v
                    continue
                mm = re.match(r'(-?0x[0-9a-f]+|-?\d+)\((r\d+)\)', ops[-1]) if ops else None
                if mm and mm.group(2) in known:
                    out.setdefault((known[mm.group(2)] + int(mm.group(1), 0)) & 0xffffffff, []).append(a)
                if ops and ops[0] in val and m not in no_write:
                    val.pop(ops[0])
                if m == 'bl':
                    for r in ['r0'] + [f'r{i}' for i in range(3, 13)]:
                        val.pop(r, None)
                elif m.startswith('b'):
                    val = {}
            self._addr = out
        return self._addr

    def find_strings(self, s, enc='shift_jis'):
        pat = s.encode(enc) + b'\0'
        out = []
        for a, o, size, _ in self.sections:
            for m in re.finditer(re.escape(pat), self.d[o:o + size]):
                out.append(a + m.start())
        return out

    def string_users(self, s, enc='shift_jis'):
        refs = self.addresses()
        out = []
        for a in self.find_strings(s, enc):
            out += refs.get(a, [])
        return sorted(out)

    def callers(self, target):
        if getattr(self, '_calls', None) is None:
            calls = {}
            for a, m, o in self.ins():
                if m == 'bl' and o.startswith('0x'):
                    calls.setdefault(int(o, 16), []).append(a)
            self._calls = calls
        return self._calls.get(target, [])

    def func_start(self, addr):
        """The routine holding addr: back to its `stwu r1, -n(r1)` (or the word after a blr)."""
        a = addr
        while True:
            _, m, o = self.at(a)
            if m == 'stwu' and o.startswith('r1, -'):
                return a
            prev = self.at(a - 4)
            if prev[1] == 'blr':
                return a
            a -= 4

    def show(self, addr, n=40):
        refs = None
        for k in range(n):
            a, m, o = self.at(addr + 4 * k)
            extra = ''
            if m in ('addi', 'ori') or re.search(r'\(r\d+\)', o):
                refs = refs or {v: srcs for v, srcs in self.addresses().items()}
                for v, srcs in refs.items():
                    if a in srcs:
                        s = self.cstr(v)
                        extra = f' ; ={v:#x}' + (f' "{s}"' if s and 1 < len(s) < 60 and s.isprintable() else '')
                        break
            print(f'{a:08x}  {m:8} {o}{extra}')
