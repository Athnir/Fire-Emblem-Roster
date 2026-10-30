# Genealogy of the Holy War (FE4): the unit data's formats

Read from the user's clean Japanese ROM, `Fire Emblem - Seisen no Keifu (J).smc` (CRC32 DC0D8CF9; `FE4_ROM` overrides the
path). English names come from the Lil' Nordion patch's tables, applied in memory (`scripts/fe4_names.py`, `FE4_PATCH`).
Nothing from either is committed; `scripts/build-fe4-units.py` writes `src/data/fe4/fe4Units.ts`. The fuller ROM notes are in
`Documents\FE Games\notes\FE4 Genealogy - notes.md`, and the Armory's `data-raw/fe4/README.md` covers maps, events and battle.

`$XX:YYYY` is file offset `(XX & 0x3F) * 0x10000 + YYYY`; data is little-endian.

## Characters: `0x38000 + 0x2DF5`

A u16 (count x 2), then u16 offsets from there to each record, id 1 upward. Kind (first byte) 0 is a named character (38
bytes), 1 a child whose stats come from their parents (12 bytes), 2 a named foe, 3 a generic foe.

Kind 0: +1 HP (the unit's own, not added to the class's), +2-8 Str, Mag, Skl, Spd, Def, Res, Lck (added to the class's bases;
Luck has none), +9 class, +0x0A level, +0x0B leadership stars, +0x0C gold / 1000, +0x0D id, +0x0F name index (u16), +0x11 the
second generation's slot, +0x13 1 for women, +0x14-0x1B growth rates (HP, Str, Mag, Skl, Spd, Def, Res, Lck), +0x1C-0x1E
skills (bits), +0x1F-0x22 holy blood, +0x23-0x25 item instances.

- Skill bits, matched against Serenes Forest's lists: byte 0: 0x01 Wrath, 0x02 Pursuit, 0x04 Adept, 0x10 Charm, 0x40 Nihil,
  0x80 Miracle; byte 1: 0x01 Critical, 0x02 Vantage, 0x04 Accost, 0x08 Astra, 0x10 Luna, 0x20 Sol; byte 2: 0x02 Paragon,
  0x10 Bargain. Unmatched: byte 0 0x08 and 0x20 (Deirdre and Julia have 0x20), byte 2 0x04 (Quan, Ethlyn, Finn).
- Holy blood: 13 two-bit fields (1 minor, 2 major), in the bonus table's order: Baldr, Naga, Dáinn, Njörun, Od, Ullr, Neir,
  Fjalar, Thrud, Forseti, Bragi, Hezul, Loptous.
- Kind 1: +1 class, +2 level, +5 name index, +7 slot, +9-0x0A item instances. A kind 0 second-generation record with the same
  slot is that child's substitute. Which mother each pair of slots belongs to is Serenes Forest's (not found in the ROM yet).
- Finn's second-generation record is empty (level 0): he carries on from the first generation.

## Classes: `0x38FCD`, 72 records of 31 bytes

+0-6 generic units' growths, +7-0x10 weapon ranks (0 A, 1 B, 2 C, 3 none), +0x11 Mov, +0x12 movement type, +0x13 flier,
+0x14-0x15 class skills (bits, not matched yet), +0x18-0x1E bases (HP, Str, Mag, Skl, Spd, Def, Res). A class's bases sit in
the record before its own (slot i - 1); the first five knights share theirs.

## Promotions: `0x3833C`

One byte per character id (from 1): the class they promote to, 255 none. Each character has their own (Dalvin's and
Scáthach's Sword Fighter becomes a Forester, Larcei's a Swordmaster); Oifey's names his own class.

## Joins (`scripts/build-fe4-units.py`, with the Armory's `fe4_events.py` and `fe4_cpu.py`)

A unit's first chapter is where a scene puts them on the map (event command 0x49) or moves them to army 0 (0x53): in the
opening (the start), a talk trigger's scene (a talk; 0xFFFF as the speaker is anyone), or a turn block's (that turn, or under a
flag: the trigger that sets it, a castle seized (0x02), entered (0x07) or an area reached (0x0B)). Arden, whom nothing brings in,
starts in the home castle. Matches Serenes Forest's recruitment page, except a few turns (under those units' `unconfirmed`).
Notes where the trigger isn't one the reader names (the arena, Beowolf's fee) are Serenes'.

## Children (`src/genealogy/logic.ts`)

A child record's +0x0B is 1 when the child takes after the father, 0 the mother (daughters; Leif and Febail swap, Altena and
Patty too). The rest follows Serenes Forest's inheritance and calculations pages, not yet traced in the code: growths are the
main parent's own + half the other's own (rounded down) + the child's holy blood bonus; bases from the parents' stats at the end
of the first generation (the app uses their Unit Planner plans), with Luck's random 1-99 taken as 50; holy blood: the main
parent's major stays major, the other's becomes minor, minor from both becomes major, Loptous isn't passed on. Serenes' worked
example (Seliph) comes out the same (tested).

## Holy blood: `0x389E3`, 13 records of 16 bytes

+0 weapon type, +1 holy weapon item id, +2-9 growth bonuses (HP, Str, Mag, Skl, Spd, Def, Res, Lck), doubled for major blood.

## Level-ups and caps (`$84:A464` onward, `$84:AD00` onward)

Each stat's growth is the unit's own rate (+0x14 onward) plus its holy blood bonus. What's stored is held at 80 for HP, 15 for
Str to Res (the amount above the class's base) and 30 for Luck: so a stat's cap is the class's base + 15, as Serenes' per-class
caps show (Lord Knight Str 25 = 10 + 15). Promotion changes the class's bases and keeps what's stored.

## Unconfirmed

- The children's bases, growths and holy blood: Serenes Forest's formulas, not yet found in the code.
- Which mother each child belongs to, from Serenes.
- Promotion keeping the level, and the level cap of 30 (Serenes).
- Which father each mother can have: the app offers every first-generation man but Sigurd and Quan.
