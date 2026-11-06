"""
Read the unit data of Fire Emblem Gaiden (FE2, Famicom, 1992) from the user's own ROM (with its English fan translation patched in) and
print it as JSON. See data-raw/fe2/README.md for the formats; scripts/fe2_rom.py reads the cartridge and its text.

    python scripts/fe2_units.py [path to the .nes] [-o out.json]

Addresses are bank:$addr (MMC4: bank n at $8000-$BFFF, bank 15 fixed at $C000-$FFFF). The tables:
- characters 8:$90E2, 12 bytes each by character - 1 (copied into the army by 8:$A6C0): character, class, level, max HP, EXP, Str,
  Skl, Spd, Lck, Def, the spells known (a bit per spell of the class's list), the item.
- growths 9:$8DE9 (u16 pointers by character - 1): 6 bytes Str, Skl, Spd, Lck, Def, HP, in percent (the level-up, 9:$8858).
- Res 15:$EE00 by character - 1: a character's own, fixed (the map unit's +12, 6:$8C3A); a Dread Fighter adds 15 (15:$EDF3).
- names 15:$DEA9 (u16 pointers by character - 1; the foes' 15:$DFBA); portraits 9:$BDBF by character (9:$AE13).
- classes: bases 15:$ED04 (u16 pointers by class - 1, classes 1-23) -> 7 bytes Str, Skl, Spd, Lck, Def, HP, EXP; Mov 15:$EDD3 and the
  foes' Res 15:$EDEA by class - 1; names 15:$DB73 (your units') and 15:$DC2E (foes'), u16 pointers by class - 1.
- class changes at a Mila statue (8:$A804): from 15:$E3A7, to $E3B5, level $E3C2; a Villager's random class $E3CF (5).
- weapons (15:$F460): item bounds 15:$F50C, class lists 15:$F512 (u16 pointers, lists ended by $EF); a personal item's 15:$D9F4 byte
  has bit 7 and the character in its low bits (for a spell it's the HP the spell costs).
- spells: the learning table 15:$E299 (11 bytes: character, then five (level, spell)); the class's eight spells 15:$E199 (8 bytes per
  class: Priestess, Mage (men), Mage (women), Saint, Cleric, Sage).
- town scenes (bank 13): scripts $B61B (u16 pointers), triggers $B4FA (u16 pointers by town - 1: 3-byte entries, $FF, actor + 1, script
  for a talk, else x, y, script); people 10:$8C6B; the towns' flags (three bytes each, 15:$FACC) changed by the flag events 10:$8000
  (7 bytes: town - 1, three AND masks, three OR masks); the triggers' first state 15:$FB8F; the flag event when an army enters a town
  15:$FB62; flag events when a character dies 15:$F18D; guests on a battle map 15:$F16B / $F178.
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fe2_rom import FIXED, Rom, decode_dialogue  # noqa: E402

CHARACTERS = 34
CLASSES = 23            # with bases (15:$ED04); 24 is a name only (Celica's once promoted)

# --- the addresses ---
CHAR_RECORDS = (8, 0x90E2)
GROWTHS = (9, 0x8DE9)
GROWTH_ORDER = ['str', 'skl', 'spd', 'lck', 'def', 'hp']   # 9:$8840 (X = 0..5)
CHAR_RES = 0xEE00
CHAR_NAMES, FOE_NAMES = 0xDEA9, 0xDFBA
CLASS_NAMES, CLASS_FOE_NAMES = 0xDB73, 0xDC2E
CLASS_BASES = 0xED04
CLASS_BASE_ORDER = ['str', 'skl', 'spd', 'lck', 'def', 'hp', 'exp']
CLASS_MOV, CLASS_FOE_RES = 0xEDD3, 0xEDEA
DREAD_FIGHTER, DREAD_RES = 10, 0xEDF3
CLASS_STRENGTH, LEVEL_FACTOR = (9, 0x8F21), (9, 0x8EF9)
CHANGE_FROM, CHANGE_TO, CHANGE_LEVEL, VILLAGER_TO = 0xE3A7, 0xE3B5, 0xE3C2, 0xE3CF
VILLAGER, FIGHTER, PRIESTESS, HERO, ROYAL = 14, 21, 11, 23, 24
ITEM_NAMES, ITEM_MIGHT, ITEM_COST = 0xDCAD, 0xD9B9, 0xD9F4
WEAPON_BOUNDS, WEAPON_LISTS = 0xF50C, 0xF512
SPELL_LEARN, SPELL_LISTS = 0xE299, 0xE199
SPELL_LIST_CLASSES = [PRIESTESS, 15, 16, 17, 18, 19]       # 1:$AE38: Priestess -> list 0, class c (15-19) -> list c - 14
PORTRAITS = (9, 0xBDBF)
SCRIPTS, TRIGGERS, WARPS = 0xB61B, 0xB4FA, 0xBEF0        # bank 13
NODE_TOWN = 0xB98C                                        # bank 13: world-map node 49 + i -> town (13:$853B)
PLACE_NAMES = 0xB821                                      # bank 11: u16 pointers by world-map node - 1 (11:$96AD)
TOWN_PEOPLE = 0x8C6B                                      # bank 10
FLAG_EVENTS = 0x8000                                      # bank 10 (15:$FACC)
TRIGGER_INIT, ARMY_ENTRY_EVENTS = 0xFB8F, 0xFB62
DEATH_EVENTS, GUEST_BATTLES, GUEST_LISTS = 0xF18D, 0xF16B, 0xF178
CAP, HP_CAP, MAX_LEVEL = 40, 52, 20                       # 9:$88CD-$88D9, 9:$885F

# Script commands (13:$949B: the high nibble; the low nibble is a count): the bytes each takes after it.
SCRIPT_ARGS = {0x3: 1, 0x5: 1, 0x7: 1, 0xA: 1, 0xC: 2}
SCRIPT_OPS = {0: 'wait', 1: 'face', 2: 'move', 3: 'text', 4: 'special', 5: 'music', 6: 'op6', 7: 'join', 8: 'place', 9: 'battle',
              0xA: 'flags', 0xB: 'opB', 0xC: 'walk', 0xD: 'move', 0xE: 'next chapter', 0xF: 'end scene'}
# 13:$95FA: the special events a script can call (op 4, its low nibble).
SPECIALS = {2: 'Celica promotes (13:$97D8)', 9: 'Alm promotes (13:$96B4)'}

# Who joins where, and in which army and chapter. The ROM gives the town, the talk and its conditions (read and checked below); which
# army visits a town and in which chapter is the story's, as Serenes Forest's recruitment page has it (the ROM settles it only where
# noted: Jesse and Zeke by the army entering, 15:$FB2F; Nomah by the chapter-change script that opens his talk).
# character -> (army, chapter, town)
JOIN_TOWNS = {
    5: ('alm', 1, 1), 6: ('alm', 1, 1), 7: ('alm', 1, 1), 8: ('alm', 1, 1), 9: ('alm', 1, 2), 11: ('alm', 1, 3), 12: ('alm', 1, 3),
    20: ('alm', 1, 33), 14: ('alm', 1, 32),
    15: ('celica', 2, 5), 16: ('celica', 2, 5), 13: ('celica', 2, 5), 27: ('celica', 2, 6), 17: ('celica', 2, 7),
    21: ('celica', 2, 7), 18: ('celica', 2, 7),
    28: ('alm', 3, 16), 19: ('alm', 3, 17), 29: ('alm', 3, 19),
    32: ('celica', 3, 9), 31: ('celica', 3, 9), 22: ('celica', 3, 10), 23: ('celica', 3, 12), 26: ('celica', 3, 13),
    25: ('celica', 3, 13), 33: ('celica', 3, 13),
    30: ('alm', 4, 23), 34: ('alm', 4, 21), 3: ('alm', 4, 30),
    4: ('celica', 4, 34),
}
# Rooms the world map doesn't lead to directly, and the place each is in (their scenes say so: Clive and Forsyth's room of the
# Liberation Army's HQ; Silque's "taken by a group of bandits" in the Thieves' Shrine; Nomah's "I followed you to the temple, and fell
# down here").
ROOM_NODES = {3: 51, 32: 80, 34: 63}
# The fuller names the translation's dialogue gives some characters (the menus have room for four or five tiles): character -> (name,
# the scene texts it's in). Checked against the text below.
DIALOGUE_NAMES = {2: ('Celica', [32, 33]), 4: ('Norma', [89]), 9: ('Claire', [12]), 10: ('Cleve', [12]), 18: ('Balbo', [26, 27]),
                  34: ('Zeke', [87])}
# The names the app shows: Shadows of Valentia's official English (checked against src/data/fe15/fe15Units.ts by the builder). The
# translation's menus fit four or five letters ("Pala", "Bird"), so its own names are kept beside them (`translationName`), as the
# patched game shows them. Places keep the translation's names: they're what the game shows when looking for a unit.
SOV_NAMES = {1: 'Alm', 2: 'Celica', 3: 'Mycen', 4: 'Nomah', 5: 'Lukas', 6: 'Kliff', 7: 'Tobin', 8: 'Gray', 9: 'Clair', 10: 'Clive',
             12: 'Forsyth', 13: 'Mae', 14: 'Silque', 15: 'Genny', 16: 'Boey', 17: 'Kamui', 18: 'Valbar', 19: 'Mathilda', 20: 'Python',
             21: 'Leon', 22: 'Atlas', 23: 'Jesse', 25: 'Sonya', 26: 'Deen', 27: 'Saber', 28: 'Luthier', 29: 'Delthea', 30: 'Tatiana',
             31: 'Catria', 32: 'Palla', 33: 'Est', 34: 'Zeke'}
# What opens and closes each talk, as read below (checked: the build stops if the ROM says otherwise). `opens`: the flag events that
# open the talk (None: open from the start); `gone`: who dying (a foe: $80 + its number) closes the talk or takes the person away; `alt`:
# the flag events that bring the person in (the town's second list of people).
JOIN_RULES = {
    5: {'opens': [19]}, 6: {'opens': [1]}, 7: {'opens': [1]}, 8: {'opens': [1]}, 9: {}, 11: {'alt': [89], 'gone': [12]},
    12: {'alt': [89], 'gone': [12]}, 20: {'opens': [24], 'alt': [90], 'gone': [12]}, 14: {}, 15: {'opens': [20]},
    16: {'opens': [20]}, 13: {'opens': [20]}, 27: {}, 17: {'gone': [0x11]}, 21: {'gone': [0x15]}, 18: {'gone': [0x12]}, 28: {},
    19: {'gone': [0x13]}, 29: {'gone': [0x91]}, 32: {'opens': [37], 'gone': [0x20]}, 31: {'opens': [37], 'gone': [0x1F]}, 22: {},
    23: {'opens': [27]}, 26: {'gone': [0x88]}, 25: {'gone': [0x9D]}, 33: {}, 30: {'gone': [0x8B]},
    34: {'opens': [66], 'gone': [0x39, 0x8B]}, 3: {}, 4: {'opens': [63]},
}
# The joins in words: {place} is the patch's name of the town (spaces put back), {cN} character N's name as the units have it.
_GUEST = ('Talk to {him} at the {place}. {He} fights on your side in a battle before it (a guest); if {he} dies there, {his} talk is '
          'gone (flag event {e}).')
JOIN_NOTES = {
    5: 'Talk to him at {place} after the opening scene and after talking to {c3} there (each talk opens the next: flag events 17, 18, '
       '19).',
    6: 'Talk to him at {place} once {c5} has joined (his talk opens the three: flag event 1).',
    7: 'Talk to him at {place} once {c5} has joined (his talk opens the three: flag event 1).',
    8: 'Talk to him at {place} once {c5} has joined (his talk opens the three: flag event 1).',
    9: 'Talk to her at {place} (the Southern Fortress).',
    11: "Talk to him at the {place}. He and {c12} are there once {c9} has joined (her talk sets the room's people: flag event 89). His "
        "talk adds a copy of his record kept for it (11), which is character 10's. If {c12} has joined and died by then, the room's "
        'people are gone (flag event 59).',
    12: 'Talk to him at the {place}, where he is once {c9} has joined (flag event 89).',
    20: "Talk to him at the {place} once {c10} has joined ({c10}'s talk opens his: flag event 24); he is there once {c9} has joined "
        '(flag event 90). If {c12} has joined and died by then, he is gone (flag event 60).',
    14: 'Talk to her at the {place}.',
    15: 'Talk to her at the {place}, after the scene on arriving (it opens the three talks: flag event 20).',
    16: 'Talk to him at the {place}, after the scene on arriving (it opens the three talks: flag event 20).',
    13: 'Talk to her at the {place}, after the scene on arriving (it opens the three talks: flag event 20).',
    27: 'Talk to him at {place} (Novis in Shadows of Valentia).',
    17: _GUEST.format(him='him', He='He', he='he', his='his', e=13, place='{place}'),
    21: _GUEST.format(him='him', He='He', he='he', his='his', e=14, place='{place}'),
    18: _GUEST.format(him='him', He='He', he='he', his='his', e=15, place='{place}'),
    28: 'Talk to him at the {place} (the Forest Village).',
    19: _GUEST.format(him='her', He='She', he='she', his='her', e=33, place='{place}').replace('at the {place}', 'at {place}'),
    29: "Talk to her at the {place}. She fights against you there under Tatara's spell (a foe, 8:$9606); if she is killed, her talk is "
        'gone (flag event 34).',
    32: 'Talk to her at {place} once the foe the translation calls Gaha (a Thief, 8:$951E) is beaten (flag event 37). She fights on '
        'your side in that battle (a guest); if she dies there, her talk is gone (flag event 38).',
    31: 'Talk to her at {place} once the foe the translation calls Gaha (a Thief, 8:$951E) is beaten (flag event 37). She fights on '
        'your side in that battle (a guest); if she dies there, her talk is gone (flag event 39).',
    22: 'Talk to him at the {place} (the Mountain Village).',
    23: "Talk to him at the {place} (the Desert Fortress). Only {c2}'s army finds him: hers arriving opens his talk (flag event 27), "
        "{c1}'s closes it (flag event 42).",
    26: 'Talk to him at {place}. Only one of {c26} and {c25} joins (either talk closes both: flag events 51, 52), and {c26} is not '
        'there if he was killed as a foe (8:$9557; flag event 28).',
    25: 'Talk to her at {place}. Only one of {c26} and {c25} joins (either talk closes both: flag events 51, 52), and {c25} is not '
        'there if she was killed as a foe (8:$9567; flag event 29).',
    33: 'Talk to her at {place}.',
    30: "Talk to her at {place} (Nuibaba's mansion). She is gone if {c34} was killed as a foe (8:$9634; flag event 31).",
    34: "Talk to him at the {place}. Only {c1}'s army finds him: its arriving opens his talk (flag event 66); he is gone if he was "
        'killed as a foe (8:$9634; flag event 68).',
    3: 'Talk to him at {place}: the scene where he tells {c1} who his father is.',
    4: 'Talk to him below the {place}, where he fell: his talk opens in the scene that starts Chapter 4 (flag event 63).',
}


def readable(place):
    """The patch's place names have no spaces ("LiberationHQ"): put them back for notes."""
    return re.sub(r'(?<=[a-z.])(?=[A-Z])', ' ', place)


class FE2:
    def __init__(self, rom):
        self.r = rom

    # --- names ---
    def menu_name(self, ch):
        return self.r.string_at(FIXED, CHAR_NAMES, ch - 1).strip()

    def foe_name(self, foe):
        p = self.r.u16(FIXED, FOE_NAMES + 2 * ((foe & 0x7F) - 1))
        return self.r.string(FIXED, p).strip() if 0xC000 <= p < 0xFF00 else None

    def class_name(self, k, foe=False):
        p = self.r.u16(FIXED, (CLASS_FOE_NAMES if foe else CLASS_NAMES) + 2 * (k - 1))
        return self.r.string(FIXED, p).strip() if 0xD000 <= p < 0xE000 else None

    def item_name(self, i, full=False):
        """The item's name as the menus show it; `full` the whole string where the patch's pointer starts a letter in (the menus show
        "and" for the Hand Lance and "ibro" for Libro: the strings before them end a byte earlier than the pointers)."""
        p = self.r.u16(FIXED, ITEM_NAMES + 2 * i)
        if full and self.r.u8(FIXED, p - 1) != 0xEF and 0x45 <= self.r.u8(FIXED, p - 1) <= 0x83:
            p -= 1
        return self.r.string(FIXED, p, icons=True).strip()

    # --- characters ---
    def record(self, ch):
        bank, base = CHAR_RECORDS
        return self.r.read(bank, base + 12 * (ch - 1), 12)

    def growths(self, ch):
        bank, table = GROWTHS
        g = self.r.read(bank, self.r.u16(bank, table + 2 * (ch - 1)), 6)
        return dict(zip(GROWTH_ORDER, g))

    def res(self, ch):
        return self.r.u8(FIXED, CHAR_RES + ch - 1)

    def portrait(self, ch):
        bank, table = PORTRAITS
        return self.r.u8(bank, table + ch)

    # --- classes ---
    def class_bases(self, k):
        p = self.r.u16(FIXED, CLASS_BASES + 2 * (k - 1))
        return dict(zip(CLASS_BASE_ORDER, self.r.read(FIXED, p, 7)))

    def class_mov(self, k):
        return self.r.u8(FIXED, CLASS_MOV + k - 1)

    def class_foe_res(self, k):
        return self.r.u8(FIXED, CLASS_FOE_RES + k - 1)

    def dread_res(self):
        return self.r.u8(FIXED, DREAD_RES)

    def class_strength(self, k):
        bank, table = CLASS_STRENGTH
        return self.r.u8(bank, table + k - 1)

    def level_factors(self):
        bank, table = LEVEL_FACTOR
        return list(self.r.read(bank, table, 20))

    def class_changes(self):
        """[(from, to, level)] (8:$A810), then a Villager's five (8:$A835: Lv 3, a random one of them, 8:$A83D)."""
        out, i = [], 0
        while (k := self.r.u8(FIXED, CHANGE_FROM + i)) < 0x80:
            out.append((k, self.r.u8(FIXED, CHANGE_TO + i), self.r.u8(FIXED, CHANGE_LEVEL + i)))
            i += 1
        return out, list(self.r.read(FIXED, VILLAGER_TO, 5))

    def weapon_lists(self):
        """Item ranges and the classes that use them (15:$F4AD): items below $F50C[0] anyone; [k-1, k) the list $F512[k-1]."""
        bounds = list(self.r.read(FIXED, WEAPON_BOUNDS, 6))
        lists = []
        for k in range(5):
            p, cls = self.r.u16(FIXED, WEAPON_LISTS + 2 * k), []
            while (c := self.r.u8(FIXED, p)) != 0xEF:
                cls.append(c)
                p += 1
            lists.append((bounds[k], bounds[k + 1] - 1, cls))
        return bounds, lists

    # --- spells ---
    def spell_list(self, k):
        """A casting class's eight spells (items), in the order of the record's spell bits; None for the others."""
        if k not in SPELL_LIST_CLASSES:
            return None
        return list(self.r.read(FIXED, SPELL_LISTS + 8 * SPELL_LIST_CLASSES.index(k), 8))

    def spell_learning(self):
        """character -> [(level, spell item)] (1:$AE18: learned at the level-up that brings the character's count to the level - 1)."""
        out, p = {}, SPELL_LEARN
        while (ch := self.r.u8(FIXED, p)) < 0x80:
            rec = self.r.read(FIXED, p + 1, 10)
            out[ch] = [(rec[2 * k], rec[2 * k + 1]) for k in range(5) if rec[2 * k]]
            p += 11
        return out

    # --- towns ---
    def place(self, node):
        return self.r.string(11, self.r.u16(11, PLACE_NAMES + 2 * (node - 1)))

    def node_town(self, node):
        return self.r.u8(13, NODE_TOWN + node - 49)

    def scripts(self):
        first = self.r.u16(13, SCRIPTS)
        return [self.parse_script(self.r.u16(13, SCRIPTS + 2 * i)) for i in range((first - SCRIPTS) // 2)]

    def parse_script(self, p):
        """A scene script (13:$99A1): blocks of [actor] commands... $00, until $EF. Returns [(actor, [(op, low nibble, args)])]."""
        out = []
        while (actor := self.r.u8(13, p)) != 0xEF:
            p += 1
            cmds = []
            while (c := self.r.u8(13, p)) != 0x00:
                p += 1
                op, n = c >> 4, c & 15
                k = SCRIPT_ARGS.get(op, 1 if op in (6, 0xB) and n else 0)
                cmds.append((op, n, list(self.r.read(13, p, k))))
                p += k
            p += 1
            out.append((actor, cmds))
        return out

    def triggers(self, town):
        p = self.r.u16(13, TRIGGERS + 2 * (town - 1))
        return [tuple(self.r.read(13, p + 3 * k, 3)) for k in range(8)]

    def people(self, town, alternate=False):
        """10:$8B8A: actor 1.. of the town's list (the second list once the town's first flag byte has bit 7); $FE skips a slot."""
        p = self.r.u16(10, TOWN_PEOPLE + 4 * (town - 1) + (2 if alternate else 0))
        out, x = {}, 1
        while x < 8 and (b := self.r.u8(10, p)) != 0xEF:
            if b == 0xFE:
                p += 1
            else:
                out[x] = tuple(self.r.read(10, p, 9))
                p += 9
            x += 1
        return out

    def flag_events(self):
        first = self.r.u16(10, FLAG_EVENTS)
        out = {}
        for i in range((first - FLAG_EVENTS) // 2):
            rec = self.r.read(10, self.r.u16(10, FLAG_EVENTS + 2 * i), 7)
            out[i + 1] = {'town': rec[0] + 1, 'and': list(rec[1:4]), 'or': list(rec[4:7])}
        return out

    def trigger_init(self):
        out, p = {}, TRIGGER_INIT
        while (t := self.r.u8(FIXED, p)) != 0xFF:
            out[t + 1] = self.r.u8(FIXED, p + 1)
            p += 2
        return out

    def army_entry_events(self):
        """15:$FB2F: town -> (flag event when Alm's army enters, when Celica's does)."""
        out, p = {}, ARMY_ENTRY_EVENTS
        while (t := self.r.u8(FIXED, p)) != 0xFF:
            out[t] = (self.r.u8(FIXED, p + 1), self.r.u8(FIXED, p + 2))
            p += 3
        return out

    def death_events(self):
        """9:$8BDE: [(character that dies, kind, value)]: kind 1 a flag event (9:$8C51)."""
        out, p = [], DEATH_EVENTS
        while (c := self.r.u8(FIXED, p)) != 0xFF:
            out.append((c, self.r.u8(FIXED, p + 1), self.r.u8(FIXED, p + 2)))
            p += 3
        return out

    def guests(self):
        """6:$8B48: a battle's guests (fighting on your side; +19 = $84: no EXP, 9:$885B): [characters]."""
        out = {}
        for b in range(13):
            k = self.r.u8(FIXED, GUEST_BATTLES + b)
            if k:
                p, lst = self.r.u16(FIXED, GUEST_LISTS + 2 * (k - 1)), []
                while (c := self.r.u8(FIXED, p)) != 0xFF:
                    lst.append(c)
                    p += 2
                out[b] = lst
        return out

    def warps(self):
        return {n: tuple(self.r.read(13, self.r.u16(13, WARPS + 2 * (n - 1)), 3)) for n in range(1, 5)}


def script_text(script):
    """A scene script in words: [(actor, ['text 7', 'join 5', ...])]."""
    out = []
    for actor, cmds in script:
        words = []
        for op, n, args in cmds:
            name = SPECIALS.get(n, f'special {n}') if op == 4 else SCRIPT_OPS[op]
            words.append(' '.join([name] + [str(a) for a in args]) + (f' x{n}' if n and op not in (4, 6, 0xB) else ''))
        out.append((actor, words))
    return out


# --- the level-up --------------------------------------------------------------------------------------------------------------------

def growth_chance(g):
    """9:$889B: a roll of (random byte x 99) / 256 + 1 (1-99; 15:$C068), and the stat grows when it is below the growth: so a growth G
    is ceil(256 (G - 1) / 99) / 256 (50 -> 49.6%, 10 -> 9.4%, 1 -> never)."""
    if g <= 1:
        return 0.0
    return min(256, -(-256 * (g - 1) // 99)) / 256


def expected_gains(growths):
    """Each stat's average gain per level, exactly: the six rolls of a level-up (HP, Def, Lck, Spd, Skl, Str, 9:$8896) come from six
    calls in a row of 15:$C04E, each adding 55 to the random byte $37, so they are r + 55, r + 110 ... for one r; and a level-up where
    every roll fails adds 1 HP (9:$88E0). Averaged over the 256 r."""
    order = ['hp', 'def', 'lck', 'spd', 'skl', 'str']
    total = dict.fromkeys(order, 0)
    for r in range(256):
        grew = {}
        for k, s in enumerate(order):
            v = ((r + 55 * (k + 1)) & 255) * 99 // 256 + 1
            grew[s] = v < growths[s]
        for s in order:
            total[s] += grew[s]
        if not any(grew.values()):
            total['hp'] += 1
    return {s: total[s] / 256 for s in order}


# --- building it -----------------------------------------------------------------------------------------------------------------

def build(game):
    r = game.r
    scripts = game.scripts()
    events = game.flag_events()
    init = game.trigger_init()
    entry = game.army_entry_events()
    deaths = game.death_events()
    learning = game.spell_learning()
    changes, villager_to = game.class_changes()
    item = lambda i: game.item_name(i, full=True)

    # Towns: a world-map node's place name (11:$96AD) for each town it leads to (13:$853B).
    town_node = {}
    for node in range(49, 82):
        town_node.setdefault(game.node_town(node), node)
    town_node.update(ROOM_NODES)

    def town_name(t):
        return game.place(town_node[t]) if t in town_node else None

    def town_reaches(t, bit):
        """The flag events that open trigger `bit` of town t, and those that close it."""
        opens = [e for e, v in events.items() if v['town'] == t and v['or'][2] & (1 << bit)]
        closes = [e for e, v in events.items() if v['town'] == t and not v['and'][2] & (1 << bit)]
        return opens, closes

    def scripts_calling(e):
        return [i for i, s in enumerate(scripts) if any(op == 0xA and args == [e] for _a, cmds in s for op, _n, args in cmds)]

    def death_of(e):
        return [c for c, kind, v in deaths if kind == 1 and v == e]

    def sources(e):
        return {'scripts': scripts_calling(e), 'deaths': death_of(e), 'armyEntering': [tt for tt, ab in entry.items() if e in ab]}

    joins = {}
    for i, s in enumerate(scripts):
        for _actor, cmds in s:
            for op, _n, args in cmds:
                if op == 7:
                    joins.setdefault(args[0], []).append(i)

    units = []
    for ch, (story, chapter, town) in JOIN_TOWNS.items():
        rec = game.record(ch)
        script_ids = joins[ch]
        found = []
        for bit, (x, y, s) in enumerate(game.triggers(town)):
            if s in script_ids and x >= 0x80:
                opens, closes = town_reaches(town, bit)
                reachable = (init.get(town, 0) >> bit) & 1 or opens
                present = (y - 1) in game.people(town) or (y - 1) in game.people(town, True)
                if reachable and present:
                    found.append((bit, y - 1, s, opens, closes))
        assert len(found) == 1, (ch, found)
        bit, actor, s, opens, closes = found[0]
        # The person: in the town's first list of people, or only its second (brought in by a flag event setting bit 7 of the town's
        # first flag byte); taken away by a flag event setting bit actor - 1 of it (10:$8C16).
        alt_only = actor not in game.people(town)
        alt = [e for e, v in events.items() if v['town'] == town and v['or'][0] & 0x80] if alt_only else []
        hides = [e for e, v in events.items() if v['town'] == town and v['or'][0] & (1 << (actor - 1))]
        # Check what the notes say against the ROM.
        rule = JOIN_RULES[ch]
        opened_by = [e for e in opens if e not in [x for x in closes]]
        assert (rule.get('opens') or []) == opened_by, (ch, opened_by)
        assert bool((init.get(town, 0) >> bit) & 1) == (not rule.get('opens')), ch
        gone = sorted({c for e in set(closes) | set(hides) for c in death_of(e)})
        assert sorted(rule.get('gone', [])) == gone, (ch, gone)
        assert (rule.get('alt') or []) == alt, (ch, alt)
        joins_as = rec[0]            # Clive's join record (11) is character 10's (8:$A6DF copies it whole)
        units.append({'character': joins_as, 'record': ch, 'story': story, 'chapter': chapter, 'town': town, 'trigger': bit,
                      'actor': actor, 'script': s,
                      'opensBy': {e: sources(e) for e in opened_by},
                      'closedBy': {e: sources(e) for e in closes if not set(scripts_calling(e)) & {s}},
                      'takenAwayBy': {e: sources(e) for e in hides if not set(scripts_calling(e)) & {s}},
                      'broughtInBy': {e: sources(e) for e in alt},
                      'initiallyOpen': bool((init.get(town, 0) >> bit) & 1)})
    # The leaders: Alm is the army a new game makes (8:$A6F2 list 0, $90E0: [1]); Celica's army is made as Chapter 2 starts (12:$ABD3).
    units.insert(0, {'character': 1, 'record': 1, 'story': 'alm', 'chapter': 1, 'leader': True})
    units.append({'character': 2, 'record': 2, 'story': 'celica', 'chapter': 2, 'leader': True})

    # The dialogue names, checked against the texts they come from.
    dialogue_names = {}
    for ch, (name, texts) in DIALOGUE_NAMES.items():
        for n in texts:
            assert name in decode_dialogue(r.dialogue(n)[2])[0], (ch, name, n)
        dialogue_names[ch] = name

    names_by_char = {f'c{ch}': SOV_NAMES.get(ch, dialogue_names.get(ch, game.menu_name(ch))) for ch in range(1, CHARACTERS + 1)}
    out_units = []
    for u in units:
        ch, rec = u['character'], game.record(u['record'])
        cls = rec[1]
        g = game.growths(ch)
        res = game.res(ch) + (game.dread_res() if cls == DREAD_FIGHTER else 0)
        known = [game.spell_list(cls)[k] for k in range(8) if rec[10] >> k & 1] if game.spell_list(cls) else []
        menu = game.menu_name(ch)
        unit = {
            'character': ch, 'name': SOV_NAMES[ch], 'translationName': dialogue_names.get(ch, menu), 'menuName': menu,
            'story': u['story'], 'chapter': u['chapter'],
            'class': cls, 'className': game.class_name(cls), 'level': rec[2],
            'bases': {'hp': rec[3], 'str': rec[5], 'skl': rec[6], 'spd': rec[7], 'lck': rec[8], 'def': rec[9], 'res': res,
                      'mov': game.class_mov(cls)},
            'growths': {s: g[s] for s in ['hp', 'str', 'skl', 'spd', 'lck', 'def']},
            'expectedGains': {s: round(100 * v, 2) for s, v in expected_gains(g).items()},
            'item': item(rec[11]) if rec[11] else None,
            'spells': {'known': [item(s) for s in known],
                       'learn': [{'level': lv, 'spell': item(s)} for lv, s in learning.get(ch, [])]},
            'portrait': game.portrait(ch),
        }
        if ch != u['record']:
            unit['joinRecord'] = u['record']
        if u.get('leader'):
            unit['join'] = {'how': 'start', 'note': 'Leads the army from the start.' if ch == 1 else
                            "Leads her army from Chapter 2's start (12:$ABD3 makes it)."}
        else:
            place = town_name(u['town'])
            unit['join'] = {'how': 'talk', 'with': ['Alm' if u['story'] == 'alm' else 'Celica'],
                            'note': JOIN_NOTES[u['record']].format(place=readable(place), **names_by_char),
                            'town': u['town'], 'place': place, 'trigger': u['trigger'], 'actor': u['actor'],
                            'script': u['script'], 'initiallyOpen': u['initiallyOpen'], 'opens': u['opensBy'],
                            'closes': u['closedBy'], 'takenAway': u['takenAwayBy'], 'broughtIn': u['broughtInBy']}
        out_units.append(unit)

    classes = {}
    for k in range(1, CLASSES + 1):
        b = game.class_bases(k)
        c = {'id': k, 'name': game.class_name(k), 'foeName': game.class_name(k, foe=True),
             'bases': {s: b[s] for s in ['hp', 'str', 'skl', 'spd', 'lck', 'def']}, 'exp': b['exp'], 'mov': game.class_mov(k)}
        if k <= 22:
            c['foeRes'] = game.class_foe_res(k)
            c['classStrength'] = game.class_strength(k)
        c['spells'] = [item(s) for s in game.spell_list(k) if s != 0xFF] if game.spell_list(k) else None
        classes[k] = c
    classes[ROYAL] = {'id': ROYAL, 'name': game.class_name(ROYAL), 'note': "Celica once promoted: only a name (13:$A1C2); her class stays 11"}

    bounds, wlists = game.weapon_lists()
    kinds = {0: 'Lance', 1: 'Sword', 2: 'Bow', 3: 'Magic', 4: 'Magic'}
    weapons = {}
    for n, (lo, hi, cls) in enumerate(wlists):
        for k in cls:
            weapons.setdefault(k, [])
            if kinds[n] not in weapons[k]:
                weapons[k].append(kinds[n])
    personal = {}
    for i in range(1, bounds[-1]):
        v = r.u8(FIXED, ITEM_COST + i)
        if v & 0x80 and i < bounds[2]:
            personal[item(i)] = v & 0x7F

    spells = {}   # items 23-47: the spells (15:$F4AD: lists 4 and 5); 15:$D9F4 is the HP each costs
    for i in range(bounds[3], bounds[5]):
        spells[i] = {'name': item(i), 'hpCost': r.u8(FIXED, ITEM_COST + i), 'might': r.u8(FIXED, ITEM_MIGHT + i)}

    chapters_ = [{'story': 'alm', 'number': n} for n in (1, 3, 4)] + [{'story': 'celica', 'number': n} for n in (2, 3, 4)]
    joined = {u['character'] for u in out_units}
    not_joining = {ch: game.menu_name(ch) for ch in range(1, CHARACTERS + 1) if ch not in joined}
    return {
        'source': {'rom': r.header.hex(), 'mapper': r.mapper, 'battery': r.battery},
        'stories': [{'id': 'alm', 'label': "Alm's army"}, {'id': 'celica', 'label': "Celica's army"}],
        'chapters': chapters_,
        'units': out_units,
        'classes': classes,
        'classChanges': [{'from': f, 'to': t, 'level': lv} for f, t, lv in changes],
        'villagerClasses': villager_to,
        'weapons': weapons,
        'weaponBounds': bounds,
        'personalItems': personal,
        'spells': spells,
        'levelFactors': game.level_factors(),
        'notJoining': not_joining,
        'towns': {t: town_name(t) for t in sorted(town_node)},
        'guests': game.guests(),
        'deaths': [{'character': c, 'foe': c >= 0x80, 'name': game.foe_name(c) if c >= 0x80 else (game.menu_name(c) if 1 <= c <= CHARACTERS else None),
                    'kind': kind, 'value': v} for c, kind, v in deaths],
        'warps': game.warps(),
        'joinScripts': {u['script']: script_text(scripts[u['script']]) for u in units if 'script' in u},
        'growthChance': {g: growth_chance(g) for g in range(0, 101, 5)},
        'caps': {'hp': HP_CAP, 'others': CAP, 'maxLevel': MAX_LEVEL},
        'dreadFighterRes': game.dread_res(),
        # 8:$A9DF: becoming a Mage (15) sets the spells to bit 0 (and starts the count again, 8:$AA24); a Priestess (11), Sage (19)
        # or Saint (17) adds bit 7 of the class's list.
        'spellOnChange': {'mage': item(game.spell_list(15)[0]), 'priestess': item(game.spell_list(PRIESTESS)[7]),
                          'sage': item(game.spell_list(19)[7]), 'saint': item(game.spell_list(17)[7])},
        # 8:$A83D: (random byte x 5) / 256 picks the Villager's class.
        'villagerOdds': [sum(1 for b in range(256) if b * 5 // 256 == i) / 256 for i in range(5)],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('rom', nargs='?')
    ap.add_argument('-o', '--out')
    args = ap.parse_args()
    data = build(FE2(Rom(args.rom)))
    text = json.dumps(data, ensure_ascii=False, indent=1)
    if args.out:
        open(args.out, 'w', encoding='utf-8', newline='\n').write(text + '\n')
        print(f"{len(data['units'])} units, {len(data['classes'])} classes -> {args.out}")
    else:
        sys.stdout.reconfigure(encoding='utf-8')
        print(text)


if __name__ == '__main__':
    main()
