"""Copy the unit data of the user's own Fire Emblem: Three Houses out of the NSP packages, without other tools.

Adapted from the Armory's scripts/fe16_extract.py (same formats; see its data-raw/fe16/README.md). Reads the base game, the 1.2.0
update (a BKTR patch RomFS laid over the base's: switch_nsp.py) and the six DLC packages straight from the NSPs (keys from ~/.switch,
never printed), and writes only the small files the readers need:

  <OUT>/romfs/<n>.bin     archive file n as the game reads it (the update's copy where it has one), decompressed
  <OUT>/romfs/index.json  every DATA0 entry: size, stored size, compressed, and the update's path for the files it replaces
  <OUT>/romfs/info1.json  the files the update adds (INFO1), in order
  <OUT>/romfs/main.bin    the update's program (main NSO) as it sits in memory, relocated to 0
  <OUT>/dlc/<n>.bin       DLC archive file n (files up to 256 KB: data, text, scripts, unit tables), owners.json who holds each

    python fe16_extract.py [out_dir]
"""
import json
import os
import struct
import sys
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from switch_nsp import Nsp, nso_image  # noqa: E402

NSP_DIR = os.path.join(os.path.expanduser('~'), 'Documents', 'FE Games', 'Switch dumps', 'NSP')
BASE = 'Fire Emblem_ Three Houses [010055D009F78000][v0][BASE].nsp'
UPDATE = 'Fire Emblem_ Three Houses 1.2.0 [010055D009F78800][v327680][UPD].nsp'
OUT = os.path.join(os.path.expanduser('~'), 'Documents', 'FE Games', 'Switch dumps', 'extracted', 'fe16')
WANTED = range(0, 407)   # 0-82 data tables and text, 83-364 unit tables and scripts, 365-406 map grids
DLC_LIMIT = 0x40000


def koei_unzip(data):
    """Koei's chunked zlib: u32 chunk size, u32 chunk count, u32 total, u32 stored size per chunk, then from the next 0x80 boundary
    each chunk as u32 length + zlib stream (or stored as it is when its stored size is its plain length), each on a 0x80 boundary."""
    chunk, count, total = struct.unpack_from('<3I', data, 0)
    sizes = struct.unpack_from(f'<{count}I', data, 12)
    p = (12 + 4 * count + 0x7F) & ~0x7F
    out = bytearray()
    for s in sizes:
        plain = min(chunk, total - len(out))
        if s == plain:
            out += data[p:p + s]
        else:
            n = struct.unpack_from('<I', data, p)[0]
            out += zlib.decompress(data[p + 4:p + 4 + n])
        p = (p + s + 0x7F) & ~0x7F
    assert len(out) == total, (len(out), total)
    return bytes(out)


class Archive:
    """DATA0 (32-byte records: u64 offset, u64 size, u64 stored size, u64 compressed) indexing DATA1, in a RomFS."""

    def __init__(self, rom, files, prefix=''):
        self.rom, self.files = rom, files
        d0 = rom.open(*files[prefix + '/DATA0.bin'])
        self.entries = [struct.unpack_from('<4Q', d0, i * 32) for i in range(len(d0) // 32)]
        self.data1 = files[prefix + '/DATA1.bin'][0]

    def get(self, i):
        off, size, stored, compressed = self.entries[i]
        raw = self.rom.open(self.data1 + off, stored)
        return koei_unzip(raw) if compressed else raw

    def path(self, path):
        return self.rom.open(*self.files[path])


def merged_romfs():
    base = Nsp(os.path.join(NSP_DIR, BASE)).program()
    update = Nsp(os.path.join(NSP_DIR, UPDATE)).program()
    assert base.title_id == update.title_id == 0x010055D009F78000
    base_s = next(s for s in base.sections if s['fs_type'] == 'RomFS')
    upd_s = next(s for s in update.sections if s['fs_type'] == 'RomFS')
    rom = update.romfs_from(upd_s, update.patched_reader(upd_s, base.section_reader(base_s)))
    return update, rom, {p: (o, n) for p, o, n in rom.walk()}


def patch_index(archive, info='patch4'):
    """INFO0 (0x120-byte records: u64 number, size, stored, compressed, then the replacement's path) and INFO1 (0x118: the same
    without the number: files the update adds); INFO2 the two counts."""
    replaced, added = {}, []
    i0 = archive.path(f'/{info}/INFO0.bin')
    for k in range(len(i0) // 0x120):
        number, size, stored, compressed = struct.unpack_from('<4Q', i0, k * 0x120)
        replaced[number] = (i0[k * 0x120 + 0x20:(k + 1) * 0x120].split(b'\0')[0].decode().replace('rom:', ''), size, compressed)
    i1 = archive.path(f'/{info}/INFO1.bin')
    for k in range(len(i1) // 0x118):
        size, stored, compressed = struct.unpack_from('<3Q', i1, k * 0x118)
        added.append((i1[k * 0x118 + 0x18:(k + 1) * 0x118].split(b'\0')[0].decode().replace('rom:', ''), size, compressed))
    counts = struct.unpack('<2Q', archive.path(f'/{info}/INFO2.bin'))
    assert counts == (len(replaced), len(added)), counts
    return replaced, added


def main(out_root=OUT):
    update, rom, files = merged_romfs()
    archive = Archive(rom, files)
    replaced, added = patch_index(archive)
    out = os.path.join(out_root, 'romfs')
    os.makedirs(out, exist_ok=True)
    index = []
    for n, (off, size, stored, compressed) in enumerate(archive.entries):
        e = {'n': n, 'size': size, 'stored': stored, 'compressed': bool(compressed)}
        if n in replaced:
            e['update'] = replaced[n][0]
            e['size'] = replaced[n][1]
        index.append(e)
    json.dump(index, open(os.path.join(out, 'index.json'), 'w'), indent=0)
    for n in WANTED:
        if n in replaced:
            path, size, compressed = replaced[n]
            data = archive.path(path)
            data = koei_unzip(data) if compressed else data
            assert len(data) == size, (n, len(data), size)
        else:
            data = archive.get(n)
        open(os.path.join(out, f'{n}.bin'), 'wb').write(data)
    json.dump([{'path': p, 'size': s, 'compressed': bool(c)} for p, s, c in added], open(os.path.join(out, 'info1.json'), 'w'),
              indent=1)
    exefs = update.pfs0(next(s for s in update.sections if s['fs_type'] == 'PFS0'))
    image, _ = nso_image(exefs.open('main'))
    open(os.path.join(out, 'main.bin'), 'wb').write(image)
    print(f'romfs: {len(archive.entries)} archive entries, {len(WANTED)} written ({sum(n in replaced for n in WANTED)} from the '
          f'update; it replaces {len(replaced)} and adds {len(added)}), main.bin {len(image):#x} bytes')

    dlc_out = os.path.join(out_root, 'dlc')
    os.makedirs(dlc_out, exist_ok=True)
    owner = {}
    for name in sorted(os.listdir(NSP_DIR)):
        if not (name.startswith('Fire Emblem_ Three Houses') and '[DLC]' in name):
            continue
        nca = next(c for _, c in Nsp(os.path.join(NSP_DIR, name)).ncas() if c.content_type == 'PublicData')
        s = next(x for x in nca.sections if x['fs_type'] == 'RomFS')
        r = nca.romfs(s)
        tree = {p: (o, n) for p, o, n in r.walk()}
        dlc = Archive(r, tree)
        kept = 0
        for n, (_off, size, _stored, _c) in enumerate(dlc.entries):
            if not size:
                continue
            assert n not in owner, f'DLC file {n} in {owner[n]} and {name}'
            owner[n] = name
            if size <= DLC_LIMIT:
                open(os.path.join(dlc_out, f'{n}.bin'), 'wb').write(dlc.get(n))
                kept += 1
        print(f'{name}: {len(dlc.entries)} entries, {kept} files kept; RomFS files: {sorted(tree)}')
    json.dump({n: owner[n].split('[')[1].rstrip(']') for n in sorted(owner)}, open(os.path.join(dlc_out, 'owners.json'), 'w'),
              indent=0)


if __name__ == '__main__':
    main(*sys.argv[1:])
