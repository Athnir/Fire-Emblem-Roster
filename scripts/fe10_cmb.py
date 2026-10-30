"""
Radiant Dawn's chapter scripts (Scripts/*.cmb): Path of Radiance's format (fe9_cmb.py) with two differences. Op 0x37
calls another handler by its number, which takes one byte, or two when the first has its top bit set (the startup
script's helpers sit past handler 127: 0x81 0x81 is handler 0x181, TeamTransferPID); and op 0x47 stores the value on
top of the stack into the address under it.
"""
import os
import re

import fe9_cmb
from fe10_files import FE10

fe9_cmb.FE9 = FE10


class Script(fe9_cmb.Script):
    def disasm(self, h):
        """[(pc, op, arg)] as fe9_cmb's, with ('callh', handler number) for op 0x37 and ('store', '') for 0x47."""
        d = self.d
        pc = h['code']
        out = []
        furthest = pc
        while pc < h['end']:
            op = d[pc]
            if op == 0x37:
                b = d[pc + 1]
                if b & 0x80:
                    out.append((pc, 'callh', ((b & 0x7F) << 8) | d[pc + 2]))
                    pc += 3
                else:
                    out.append((pc, 'callh', b))
                    pc += 2
                continue
            if op == 0x47:
                out.append((pc, 'store', ''))
                pc += 1
                continue
            name, n = fe9_cmb.OPS.get(op, (f'?{op:02x}', 0))
            raw = d[pc + 1:pc + 1 + n]
            if name == 'str':
                arg = self.string(int.from_bytes(raw, 'big'))
            elif name == 'call':
                arg = f"{self.string(int.from_bytes(raw[:2], 'big'))}/{raw[2]}"
            elif name == 'int':
                arg = int.from_bytes(raw, 'big', signed=True)
            elif name in ('jmp', 'jz', 'jnz', 'orjump', 'andjump'):
                arg = pc + 1 + int.from_bytes(raw, 'big', signed=True)
            else:
                arg = raw.hex()
            out.append((pc, name, arg))
            if name in ('jmp', 'jz', 'jnz', 'orjump', 'andjump'):
                furthest = max(furthest, arg)
            pc += 1 + n
            if name == 'ret' and pc > furthest:
                break
        return out


def scripts():
    """The story's chapter script names, in file order (C0101.cmb ... C0407e.cmb)."""
    return sorted(f for f in os.listdir(os.path.join(FE10, 'Scripts'))
                  if re.fullmatch(r'C0[1-4]\d\d[a-e]?\.cmb', f))


def calls(script, handlers, h, depth=0):
    """A handler's calls with their literal arguments, following calls to other handlers in the same script: [(name,
    [args], handler)]. An argument is a literal, ('unit', PID) from UnitGetByPID, or ('?',)."""
    stack, out, env = [], [], {}

    def pop():
        return stack.pop() if stack else ('?',)
    for _, op, a in script.disasm(h):
        if op in ('str', 'int'):
            stack.append(a)
        elif op == 'load':
            stack.append(('addr', a))
        elif op == 'var':
            stack.append(env.get(a, ('?',)))
        elif op == 'store':
            value, addr = pop(), pop()
            if isinstance(addr, tuple) and addr[0] == 'addr':
                env[addr[1]] = value
        elif op == 'call':
            fn, argc = a.split('/')
            argc = int(argc)
            args = stack[len(stack) - argc:] if argc else []
            del stack[len(stack) - argc:]
            out.append((fn, args, h))
            stack.append(('unit', args[0]) if fn == 'UnitGetByPID' and args else ('?',))
        elif op == 'callh':
            if depth < 6 and a < len(handlers) and a != h['i']:
                out.append(('->', [a], h))
                out += calls(script, handlers, handlers[a], depth + 1)
            del stack[:]
            stack.append(('?',))
        elif op == 'pop':
            pop()
        elif op.startswith('op'):
            pop(), pop()
            stack.append(('?',))
        elif op in ('ref', 'index', 'deref'):
            stack.append(('?',))
    return out
