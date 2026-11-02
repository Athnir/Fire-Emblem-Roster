"""
The 65816 disassembler (scripts/fe4_asm.py) pointed at Thracia 776's ROM, which is LoROM: $BB:AAAA is file offset
(BB & 0x7F) * 0x8000 + (AAAA & 0x7FFF). Usage:
    python scripts/fe5_asm.py 85:F0A9 80            # 80 instructions from $85:F0A9
    python scripts/fe5_asm.py 85:F0A9 80 m16 x16    # starting with 16-bit registers; 'stop' ends at the first return
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fe4_asm  # noqa: E402
import fe5_rom  # noqa: E402

fe4_asm.R = fe5_rom.R
fe4_asm.offset = fe5_rom.lo
disasm, show = fe4_asm.disasm, fe4_asm.show

if __name__ == '__main__':
    bank, _, off = sys.argv[1].partition(':')
    show(int(bank, 16) << 16 | int(off, 16), int(sys.argv[2]) if len(sys.argv) > 2 else 40,
         m=('m16' not in sys.argv), x=('x16' not in sys.argv), stop='stop' in sys.argv)
