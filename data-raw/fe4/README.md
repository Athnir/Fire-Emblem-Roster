# Genealogy of the Holy War (FE4): the unit data's formats

Read from the user's clean Japanese ROM, `Fire Emblem - Seisen no Keifu (J).smc` (CRC32 DC0D8CF9; `FE4_ROM` overrides the
path). English names come from the Lil' Nordion patch's tables, applied in memory (`scripts/fe4_names.py`, `FE4_PATCH`).
Nothing from either is committed; `scripts/build-fe4-units.py` writes `src/data/fe4/fe4Units.ts`. The fuller ROM notes are in
`Documents\FE Games\notes\FE4 Genealogy - notes.md`, and the Armory's `data-raw/fe4/README.md` covers maps, events and battle.

`$XX:YYYY` is file offset `(XX & 0x3F) * 0x10000 + YYYY`; data is little-endian. The rules below were traced in the game's code
(2026-11-02), and the children's routines were also run on `scripts/fe4_cpu.py` against crafted parents (555 sets: every
mother, father and child), matching the formulas exactly.

## Characters: `0x38000 + 0x2DF5`

A u16 (count x 2), then u16 offsets from there to each record, id 1 upward. Kind (first byte) 0 is a named character (38
bytes), 1 a child whose stats come from their parents (12 bytes), 2 a named foe, 3 a generic foe.

Kind 0: +1 HP (the unit's own, not added to the class's), +2-8 Str, Mag, Skl, Spd, Def, Res, Lck (added to the class's bases;
Luck has none), +9 class, +0x0A level, +0x0B leadership stars, +0x0C gold / 1000, +0x0D id, +0x0F name index (u16), +0x11 the
second generation's slot, +0x12 1 for women ($84:A3E5), +0x13 a child's father id, +0x14-0x1B growth rates (HP, Str, Mag, Skl,
Spd, Def, Res, Lck), +0x1C-0x1E skills (bits), +0x1F-0x22 holy blood, +0x23-0x25 item instances.

- Personal skill bits, each found where the code tests it: byte 0: 0x01 Wrath, 0x02 Pursuit, 0x04 Adept, 0x08 a skill nothing
  uses, 0x10 Charm, 0x40 Nihil, 0x80 Miracle; byte 1: 0x01 Critical, 0x02 Vantage, 0x04 Accost, 0x08 Astra, 0x10 Luna, 0x20 Sol,
  0x40 and 0x80 unused; byte 2: 0x01 Renewal, 0x02 Paragon, 0x08 Recover, 0x10 Bargain, 0x20 Return (the last three only rings
  give). A unit's skills are their own, their class's, and what they hold: rings and staves anywhere, weapons equipped
  ($87:A19D, $87:A2EF, $84:E06C).
- Two bits aren't skills: byte 0's 0x20 (Deirdre, Julia) takes the unit off the map instead of letting them die, but not in the
  Final Chapter ($84:B930); byte 2's 0x04 (Quan, Ethlyn, the first Finn) makes them retreat instead ($84:B927).
- Holy blood: 13 two-bit fields (1 minor, 2 major), in the bonus table's order: Baldr, Naga, Dáinn, Njörun, Od, Ullr, Neir,
  Fjalar, Thrud, Forseti, Bragi, Hezul, Loptous.
- Kind 1: +1 class, +2 level, +3 id (u16), +5 name index, +7 slot, +8 1 for a daughter, +9-0x0A item instances, +0x0B 1 when the
  father is the parent for holy blood and items (0 the mother). A kind 0 second-generation record with the same slot is that
  child's substitute.
- Finn's second-generation record is empty (level 0): he carries on from the first generation.

## Classes: `0x38FC5`, 72 records of 31 bytes (pointer table 0x38F35)

+0 the level to promote into the class (20 for every promoted class), +1-7 bases (HP, Str, Mag, Skl, Spd, Def, Res; HP only for
generic units), +8-0x0E generic units' growths, +0x0F-0x18 weapon ranks (sword, lance, axe, bow, staff, fire, thunder, wind,
light, dark: 0 A, 1 B, 2 C, 3 none), +0x19 Mov, +0x1A movement type, +0x1B flier, +0x1C-0x1D class skills, +0x1E unknown.

Class skill bits: +0x1C: 0x01 Canto (every mounted and flying class), 0x02 Pavise (General, Baron, Emperor), 0x04 Wrath (no
class), 0x08 Pursuit (Bow Fighter, Sword Fighter, Swordmaster, Sniper, Forester, Master Knight, Wyvern Lord, Thief Fighter, Dark
Bishop), 0x10 Adept (Ranger, Falcon Knight, Swordmaster, the Mage Fighters, Sage), 0x20 Steal (Thief, Thief Fighter), 0x80 Dance;
+0x1D: 0x08 Charm (Princess, Queen, Emperor), 0x10 Critical (no class). Without Pursuit a unit never attacks twice ($84:E364).

Weapon ranks with holy blood ($84:A095): a class rank only; a minor blood of that weapon type raises it a letter, a major one to
A. A holy weapon (rank 0xFF) needs major blood of the line whose weapon it is ($84:F66E).

## Promotions: `0x3833C`

One byte per character id (from 1): the class they promote to, 255 none. Each character has their own (Dalvin's and
Scáthach's Sword Fighter becomes a Forester, Larcei's a Swordmaster); Oifey's names his own class.

Promotion is a home castle option ($8A:EEB1) once the unit reaches the promoted class's level (+0; $87:A438). It changes only
the class ($84:ABB0): the level and EXP stay, Str to Res (stored above the class's base) rise by the difference in the classes'
bases, HP and Luck don't change, and the weapon ranks and class skills become the new class's.

## Level-ups and caps (`$84:AABA`, `$84:A464`, `$84:ACE7`, `$84:AD00`)

Each stat's growth is the unit's own rate plus their holy blood's (major doubles it), at least 0; nothing from the class. A
growth of 100 or more gives a sure point and the rest is rolled once, so each stat gains 0, 1 or 2; an empty level-up stays
empty. What's stored is held at 80 for HP, 15 for Str to Res (the amount above the class's base) and 30 for Luck; a stat shows
as min(30, the class's base + stored), plus a holy weapon's or a ring's bonus. Lv 30 is the cap ($84:AA44).

## Rings (item ids 0x6A-0x79, 10 bytes)

+5 picks the stat a ring raises ($84:F1E8): 1 Speed, 2 Magic, 3 Power, 4 Shield (Def), 5 Barrier (Res), 6 Leg (Mov +3),
7 Skill; the stat rings add 5 after the caps ($84:9B1D on). +8 and +9 are skill bits ($87:A2EF): Heal Bracelet (Renewal),
Paragon Ring, Thief Bracelet (Steal in battle), Miracle Bracelet, Follow-Up Ring (Pursuit), Recover Ring, Bargain Bracelet,
Knight Ring (Canto), Return Ring. A ring works from anywhere in the inventory; two of the same add nothing more.

## Joins (`scripts/build-fe4-units.py`, with the Armory's `fe4_events.py` and `fe4_cpu.py`)

A unit's first chapter is where a scene puts them on the map (event command 0x49) or moves them to army 0 (0x53): in the
opening (the start), a talk trigger's scene (a talk; 0xFFFF as the speaker is anyone), or a turn block's (that turn, or under a
flag: the trigger that sets it, a castle seized (0x02), entered (0x07) or an area reached (0x0B)). Arden, whom nothing brings in,
starts in the home castle. Notes where the trigger isn't one the reader names (the arena, Beowolf's fee) are Serenes'.

Turn blocks: a chapter's turn count starts at 0 ($80:AF24); a new turn adds one and starts with your phase, phase 0
($81:A911). As a phase begins the game sends the turn and phase to the event table ($81:A9A6), and a block runs when they match
($86:9C1D). So Dew and Edain (turn 2) arrive as your second turn begins, and the five Ch.6 units of turn 3 as your third.

Iuchar and Iucharba: Ch.6's two talks with Larcei (or Creidne) set the same event flag (29), so only the first works; they share
second-generation slot 6. The Roster lets the user pick which one joined (`FE4_CHOICES`).

## Children (`$84:81FF`, `$84:8F83`; `src/genealogy/logic.ts`)

When Ch.6 loads the game makes each mother's children from her and her lover:
- Which mother: `$83:8993`, u16 offsets by mother id 0x10-0x18 to [son, daughter] (Deirdre: Seliph alone).
- Growths ($87:A869): the parent of the child's own sex (+8) gives theirs, plus half the other's (rounded down); holy blood is
  added when growths are used.
- Stats ($87:A6E6), from what the parents store (max HP; Str to Res above their class's base, no ring or holy weapon; Luck):
  (2 x same-sex parent's + other's) / 10, rounded down, + (level - 1) x growth / 100 (the 1/256 table at $80:A8A8 comes out the
  same at every child's level); HP adds 15; Luck adds 1 and a random 1 to 10 ($80:A70E). Nothing is capped: the save keeps Str
  to Res in 4 bits ($91:F11F), so a stored 16 or more wraps (mod 16) once saved and loaded, and level-ups never raise a stored
  value already at 15 or more ($84:AD38). The wikis' "mod 15" is this.
- Holy blood ($87:A9FB): the +0x0B parent's level, plus one if the other parent has that blood at all, held at major; so minor
  and major make major. Seliph's is set by $84:835E (major Baldr, minor Naga), with 2 leadership stars; Altena gets 3
  ($84:8387); every other child 0.
- Skills: both parents' bits through the child's mask at `$87:A975` (3 bytes per child id from 0x19): Astra, Luna and Sol pass
  only to Scáthach, Larcei, Patty and Lene; the protection bits never pass.
- Items ($87:AA39): the child's own, then every item the +0x0B parent has (storage included) that the child's class can use;
  rings always; of the holy weapons only Yewfelle, Forseti and the Valkyrie Staff (the rest go back); past seven, to storage.
- Gold: (father's + mother's) / 10 + 2000.
- A mother without a lover, or dead (but Deirdre and Ethlyn), has her substitutes instead ($84:BAA1, $84:BAB3); a dead father
  still counts, with his stats when he died.

## Love (`$83:850F`, `$83:8738`, `$84:C33D`, `$87:AE05`)

Each woman keeps a u16 per man (unit +0x10's block). The start table (x10; 0xFE = 499; 0xFF = never) and the growth per player
phase (signed) are indexed by the women's and men's id lists at `$83:84DB` and `$83:848D`. Every player phase to turn 50, each
pair in army 0 gains its growth wherever they are, and each woman on the map gains 5 for each man next to her. Talks add more
(event command 0x60, $86:9519: woman, man, points). At 500 the pair become lovers on their own unless he has a lover already;
after that she gains no more. Deirdre and Ethlyn start at 499 with Sigurd and Quan, whom no other woman can win; every other
mother can marry each of the other 13 men.

Jealousy is a bug in the +5 ($84:C3C1): scanning the units next to a woman, the game stops tracking whom it's crediting when it
meets another woman, so the next man's 5 goes to that woman. Which one wins follows the units' map slots (the order they were
placed, $84:C6BA), which change on a reload; checked by running the routine on crafted maps.

## Holy blood: `0x389E3`, 13 records of 16 bytes

+0 weapon type, +1 holy weapon item id, +2-9 growth bonuses (HP, Str, Mag, Skl, Spd, Def, Res, Lck), doubled for major blood,
+0x0A-0x0F the holy weapon's stat bonuses.

## Unconfirmed

- When the 4-bit wrap first applies (on the next save and load; whether every chapter start loads from the save isn't traced).
- Whether a dead father's items still pass.
- What class +0x1E means; Steal's exact effect.
