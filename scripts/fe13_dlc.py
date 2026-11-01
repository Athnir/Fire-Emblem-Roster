"""
Awakening's DLC recruits, from the user's own DLC dump (data-raw/fe13/romfs/dlc, from scripts/fe13_extract.py):

- Each episode's `data/OtherData_DLC.bin` has a table `ユニットデータ` (unit data) of the unit it gives: +0 its key, +4 its name label
  (MID_DLC_名前_...), +8 an id (0x01000000: a woman), +12 its asset and +13 its flaw (PersonalityData indexes: 1 HP to 8 Res), +32 its
  joining talk, +36 the person it's made from (`旧マルス` for Marth, else `プレイヤー援軍`, the Avatar's twin: static.bin), +40 its class
  (JID_ + the label), +44 its level, +46-+53 its stats as it joins (HP to Res), +54 weapon experience, +80 its skills (RSID_ + each
  label). Episodes whose record has no name label (E022-E027: copies of a template) give no one, nor do E004 and E005 (no record).
- Its growths are the person's it's made from, plus its asset's and flaw's (the level-up's growth, code 0x264858, adds the unit's asset
  and flaw to its person's); its modifiers likewise (the template's are 0).
- English: the episode's own text (`m/E/E000.bin`: its name, MCID_E000; the unit's name) and the global archives' (`E0xx_GLB.arc`,
  m/E/E0xxG.bin: the DLC classes' and skills' names, Dread Fighter, Bride, Aggressor...), read from the archives in memory.
"""
import glob
import os
import tempfile

import fates_text
from fates_lz import decompress
from fe13_bin import ROMFS, Bin

DLC = os.path.join(ROMFS, 'dlc')
UNIT = 'ユニットデータ'


def _text_file(data):
    path = os.path.join(tempfile.gettempdir(), 'fe13_dlc_text.bin.lz')
    open(path, 'wb').write(data)
    return fates_text.read(path)


def global_text():
    """Every label the DLC's global archives name in English (the DLC classes and skills)."""
    out = {}
    for arc in sorted(glob.glob(os.path.join(DLC, '*', 'E0*_GLB.arc'))):
        b = Bin(open(arc, 'rb').read())
        for off, name in b.labels:
            if name.startswith('m/E/'):
                size, start = b.u32(off + 8), b.u32(off + 12)
                out.update(_text_file(b.d[0x20 + start:0x20 + start + size]))
    return out


def recruits():
    """The unit each episode gives, in episode order."""
    out = []
    for ep in sorted(glob.glob(os.path.join(DLC, 'E0*'))):
        path = os.path.join(ep, 'data', 'OtherData_DLC.bin.lz')
        if not os.path.exists(path):
            continue
        b = Bin(decompress(open(path, 'rb').read()))
        ptrs = set(b.ptrs)
        recs = [o for o, n in sorted(b.labels) if n != UNIT]
        if not recs or (recs[0] + 4) not in ptrs:
            continue
        o = recs[0]
        raw = b.d[0x20 + o:0x20 + o + 80]
        text = {}
        for f in glob.glob(os.path.join(ep, 'm', 'E', '*.bin.lz')):
            text.update(fates_text.read(f))
        skills, k = [], o + 80
        while k in ptrs and k < o + 120:
            skills.append('RSID_' + b.str(k))
            k += 4
        out.append({
            'episode': os.path.basename(ep), 'title': text.get('MCID_E000'), 'name': text.get(b.str(o + 4)),
            'female': bool(b.u32(o + 8) & 0x01000000), 'asset': raw[12], 'flaw': raw[13], 'template': 'PID_' + b.str(o + 36),
            'jid': 'JID_' + b.str(o + 40), 'level': raw[44], 'stats': list(raw[46:54]), 'skills': skills,
        })
    return out
