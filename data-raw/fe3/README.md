# Mystery of the Emblem (FE3): the unit data's formats

Read from the user's own cartridge image, `Fire Emblem - Monshou no Nazo (J) (V1.1).smc` (CRC32 A427B7E6; `FE3_ROM` overrides the
path), with English names from the translation patch (`FE3_patches_v1.2.zip`, `FE3_PATCHES`) applied in memory only. Nothing from either
is committed; `scripts/build-fe3-units.py` writes `src/data/fe3/fe3Units.ts`. LoROM: `$BB:AAAA` is file offset
`(BB & 0x7F) * 0x8000 + (AAAA & 0x7FFF)`. The map, item and event formats are in the Armory's `data-raw/fe3/README.md`; `fe3_rom.py`,
`fe3_names.py` and `fe3_events.py` are its readers, copied. The tables below were found here, reading the code with
`scripts/fe4_asm.py` (pointed at FE3's mapping).

## Two books

Book 1 is chapters 1-20 and Book 2 21-44 (the Final Chapter's first map is 41, its second 42-44); each book is its own army, and a
character in both is listed once per book with that book's own record.

## Characters and classes (`$83:DD6E`, as a unit is made)

- **Characters:** 17 bytes per character id at `$88:9201`: +0 Str, +1 Skl, +2 Spd, +4 Def, +5 Res, added to the class's; +3 Luck, +6
  HP, +7 weapon level, the character's own (0xFF: the class's); +8 1 for a woman; +9-+16 growths: Str, Skl, Spd, Lck, Def, Res, HP,
  weapon level (Res is 3 % for everyone). A record with no growths is a stand-in (a generic foe, a scene's figure) and never joins.
- **Classes:** 9 bytes per class id at `$88:906C`: Str, Skl, Spd, Mov, Def, Res, the EXP it's worth, weapon level, HP.
- **Caps** (the level-up code, `$83:BAF5` on): every stat 20, HP 52 (`CMP #$15`, `CMP #$35`). The growth roll adds a bonus for the
  orbs and the Starsphere a unit holds (`$83:BD75`); not part of a unit's own data.
- **Promotion** (`$83:FD2B`): the pairs [from class][to class] at `$83:FDE0` (Cavalier > Paladin, Armor Knight > General, Pegasus Knight
  > Dragon Knight, Mage > Bishop, Mage (F) and Cleric > Bishop (F), Archer > Sniper, Hunter > Horseman, Mercenary > Hero). The old
  class's Str, Skl, Spd, Mov, Def and Res come off (`$93:D9FF`) and the new class's go on (`$93:D951`); HP and the weapon level are
  lifted to the new class's bases where lower (`$83:FD76`); the level goes back to 1. Serenes Forest's promotion gains match.
- **On foot:** a mounted class's units get off indoors. A unit record placed in a castle has the dismounted class (Knight 5 or 6)
  with the class it rides as at +6 (for a Manakete, +6 is its dragon); such a joiner is shown mounted, as Serenes Forest does (Midia,
  and Est in Book 2).

## Supports

`$88:CD31`: [giver name id][receiver name id][bonus], ended by FF (the Armory's notes): with the giver within 3 steps, the receiver gets
the bonus to hit, avoid, crit and crit avoid. No support points.

## Joins (`scripts/fe3_joins.py`)

Each book's chapters played in order: every turn event (turn 0 and turn 1's on your phase are the chapter's start), talk, house,
village, seize tile, area and character event, with the army as it stands at each event (Minerva's talk asks for Maria, Est's village
for Minerva).

- A unit counts as yours when a script loads it on your side (LOAD side 0) and it's still on the map when the script ends (a cutscene
  takes its figures off again), or a talk swaps a foe for a record of yours (SWAP). Characters are told apart by name id, since one
  can have several records.
- Marth isn't loaded by any script: the game places him in each book's first chapter; his record there is used.
- A talk recruit joins with the HP its enemy unit had (`$87:87A9` copies the old unit's current HP, `$7F:4403`). Only Navarre's two
  records differ: 19 HP as a foe, a max of 20 as yours; Serenes Forest gives 19.
- Where a talk is started by the recruit (Catria and Palla talk to Marth), that's said.
- What's left to the player (Arran or Samson, Book 2's Tiki and Sheena) is in Serenes Forest's words and says so.

## Not read yet

- The promotion items' level (taken as Serenes Forest's: from Lv 10); Merric's own Bishop class (27), which Serenes Forest gives other
  gains, isn't the one the promotion table names.
