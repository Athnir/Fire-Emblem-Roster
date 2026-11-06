"""
English names for New Mystery of the Emblem's people and classes. The game is Japanese only, so:

- A name Shadow Dragon (FE11) also has is its official English one: FE11's Japanese text (the Japanese cartridge, YFEJ, read-only)
  and its English text (the North American cartridge, YFEE, scripts/fe11_extract.py's CART) are matched by label (MPID_ / MJID_),
  and FE12's Japanese string is looked up in FE11's Japanese.
- A name new in FE12 is Serenes Forest's (its FE12 section, the community translation's names), kept in NEW below so the generator
  runs without the web.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fe11_extract import CART as FE11_US  # noqa: E402
from fe13_bin import Bin  # noqa: E402
from nds_rom import Nds, decompress  # noqa: E402

FE11_JP = os.path.join(os.path.expanduser('~'), 'Documents', 'GC Games', 'New folder',
                       '2541 - Fire Emblem - Shin Ankokuryuu to Hikari no Ken (Japan).nds')
# FE12's Japanese -> English, for names Shadow Dragon doesn't have (Serenes Forest, light-and-shadow/characters/recruitment).
NEW = {
    'クリス': 'Kris',           # the avatar's default name (MPID_PLAYER_DEFAULT)
    'ルーク': 'Luke', 'ロディ': 'Rody', 'セシル': 'Cecil', 'ライアン': 'Ryan', 'カタリナ': 'Katarina',
    'マリーシア': 'Malliesia', 'ウォレン': 'Warren', 'ユミナ': 'Yumina', 'ユベロ': 'Yubello', 'シリウス': 'Sirius',
    'サムトー': 'Samto', 'フィーナ': 'Feena', 'エルレーン': 'Ellerean', 'ダイス': 'Dice', 'マリス': 'Maris',
    'ロベルト': 'Robert', 'ベルフ': 'Belf', 'ライデン': 'Leiden', 'シーマ': 'Sheema', 'フロスト': 'Frost',
    # Classes FE11 doesn't have (Serenes Forest's FE12 class names).
    '踊り子': 'Dancer', '蛮族': 'Barbarian', '皇帝': 'Emperor', '氷竜': 'Ice Dragon', '飛竜': 'Wyvern', '暗黒竜': 'Shadow Dragon',
}
# FE11's English text spells these with glyphs it can't show (as scripts/build-fe11-units.py).
FIX = {'⊂⊃⊆⊇⊥£♪': 'Swordmaster'}

_jp2en = None


def _labels(rom, prefix):
    out = {}
    for p in rom.files:
        if p.startswith(prefix):
            t = Bin(decompress(rom.read(p)))
            for o, n in t.labels:
                out.setdefault(n, t.cstr(0x20 + o))
    return out


def jp2en():
    global _jp2en
    if _jp2en is None:
        jp = _labels(Nds(FE11_JP), 'm/')
        en = _labels(Nds(FE11_US), 'm/en_')
        _jp2en = {}
        for label, s in jp.items():
            if (label.startswith('MPID_') or label.startswith('MJID_')) and label in en:
                _jp2en.setdefault(s, FIX.get(en[label], en[label]))
    return _jp2en


def english(jp):
    """FE12's Japanese name -> English (FE11's official name, else Serenes Forest's)."""
    if jp in NEW:
        return NEW[jp]
    m = jp2en()
    if jp in m:
        return m[jp]
    raise KeyError(f'no English name for {jp}')
