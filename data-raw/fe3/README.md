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

## Weapons each class can use (`scripts/class_weapons.py`)

- No per-class table: every item names its classes. The check ($83:EE68) takes item +12 to a u16 pointer at $88:A4B1, a list of class
  ids ended by FF, against the unit's class; then a weapon level (+2) with bit 7 is locked to the name ids at $88:A48E and skips the
  weapon-level check, and any other needs +2 at or below the unit's weapon level. A class can use a kind when some item of it lists the
  class. Dragonstones are the 7 items at $83:84A6. Indoors ($93:D9BD) Cavaliers, Paladins, Pegasus and Dragon Knights get off as
  Knights (the women, $93:FFE5, as Knight (F)), a Horseman as a Hunter.
- Items from 0x57 on (the non-weapons) compare +2 with the unit's level instead: the promotion items need Lv 10. Xane (name 0x28) can't
  use one ($83:EF9B).

## Not read yet

- Merric's own Bishop class (27), which Serenes Forest gives other gains, isn't the one the promotion table names.

## Portraits (`scripts/snes_portraits.py`)

For the user's own copy of the art only: the PNGs go to `data-raw/fe3/art/` (git-ignored) and are loaded through Bulk Upload.

- **Which face:** byte +7 of the unit record that makes the character join (`fe3_joins.joins`; the game keeps it at `$7F:4417`,
  `$83:AF80`). A name in both books takes Book 1's; Book 2's records for Marth, Caeda, Linde, Merric and Tiki name portraits of
  their own (139, 140, 141, 142, 143), written to `data-raw/fe3/art-book2/`.
- **Table** (`$81:D12B`, `$81:D14D`): the graphics pointer is the 3 bytes at `$88:8EB0` + 3 x id, unpacked by the game's
  decompressor (`$80:8F18`, through `$81:D920`) to 2048 bytes; the palette is 16 BGR555 colours at `$D7:E800` + 32 x id.
- **Layout:** the 64 4bpp tiles go to VRAM as a block 16 tiles wide; the 48x64 face is its columns 0-5 (top half) over columns 6-11
  (bottom half); columns 12-15 are the mouth and eye frames. Checked pixel for pixel against Mesen in Ch.1's opening talk (Marth on
  the left is drawn flipped; the file keeps the stored way round).
- **Backdrop:** these portraits never use colour 0: the backdrop is painted in (colour 14, the talk window's blue, in most), so it
  would stay opaque. The script clears it where it touches the edge, so the portraits sit in the app like the other games';
  `--fe3-keep-box` keeps it as the game shows it.
- **Run:** `python scripts/snes_portraits.py fe3` (add `--sheet` for a labelled contact sheet, `data-raw/fe3/portraits-sheet.png`).
