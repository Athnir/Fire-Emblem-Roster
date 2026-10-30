# The Sacred Stones (FE8): the unit data's formats

Read from the user's own cartridge image, `Fire Emblem - The Sacred Stones (U).gba` (CRC32 A47246AE; `FE8_ROM` overrides the path).
The game is in English, so every name is its own text. Nothing from it is committed; `scripts/build-fe8-units.py` writes
`src/data/fe8/fe8Units.ts`. The fuller ROM notes are in the Armory's `data-raw/fe8/README.md`; `gba_rom.py` and `fe8_events.py` are
its readers, copied (`fe8_events.py` changed in one place: a group load passes on its variant and whether it's on the chapter's map).

## Two routes

Everyone plays the Prologue to Chapter 8 (5x is Ephraim's, between 5 and 6), then Eirika's route or Ephraim's (entries 10-22 and
61, 23-35 and 62). A unit who joins before the split is listed once; one who joins on both routes is listed once per route under one
id (the same character, so a plan carries over). The postgame's ten units (Caellach to Lyon) are a chapter of their own.

## Characters and classes

The Blazing Blade's layouts (`data-raw/fe7/README.md`): characters at `0x803D30`, classes at `0x807110`.

- **Promotions:** the table at `0x95DFA4` (read at 0x080CC7D0), two class ids per class: the one or two classes it promotes to.
  A class's own +5 isn't used (a Manakete's points at a Wyvern Rider). Promoting (0x0802BC20) adds the new class's +0x22-0x27 (HP,
  Str, Skl, Spd, Def, Res), each held at its caps; Con and Mov are the class's plus the character's. Matches every row of Serenes
  Forest's promotion gains but its trainees' "(2)" classes, which the table doesn't offer.
- **Trainees** (Ross, Amelia, Ewan): their first classes have ability 0x80000 and promote, into one of two classes, on reaching Lv
  10 (Serenes Forest; not traced in the code).
- **Levels** (0x08017C18): a group record with the auto-level bit, for a unit of yours, calls 0x08018160: the unit is set to the
  character's own level (+0x0B) and levels up for real (random, by growths) once for each level the record is above it. So Cormag's
  Lv 1 record gives Lv 9, and Duessel (Eirika's route), Knoll (Eirika's), Innes and Saleh (Ephraim's) join with 1-2 random level-ups,
  shown as the average. Serenes Forest gives one row per character, without them.

## Supports

The Blazing Blade's: 7 partners, 7 starting points, 7 per-turn gains, the count (24 bytes). Points grow when the two are side by side
or one carries the other (0x08028490); unlike The Blazing Blade's, the gain routine (0x08028290) checks no story, so supports grow
from the Prologue. C, B and A at over 80, 160 and 240 points (0x0802823C).

## Joins (`scripts/fe8_joins.py`)

Each route's chapters played in order, on Normal, as in The Blazing Blade's finder, with FE8's own engine:

- **Scenes:** a group load's variant 1 (0x2C; the handler at 0x0800FB84 gives it the loader's leave-out mode 2) is the cutscenes'.
  Its units don't join (Ewan in Eirika's Chapter 11, Cormag in Ephraim's 10, Myrrh on the ship in Ephraim's 11: the Fire Emblem Wiki
  and Serenes Forest list none of them there). A variant-0 load does, before the preparations screen or after it (Natasha, Gerik,
  Myrrh in Chapter 16). Unconfirmed: nothing in the loader marks a scene's unit, so the variant is the sign, read from which loads the
  joins line up with. A unit's level and class come from a variant-0 record where there is one (Joshua's scene record is Lv 1).
- **The preparations screen** (0x3E) takes your units off the map and deploys your army on the deploy group's tiles; its characters
  after the lord's are placeholders and place no one new.
- **A variant-0 load on a cutscene's map** in a chapter's ending makes the unit yours (Knoll, at the end of Ephraim's Chapter 14);
  an opening's flashbacks don't count (the Prologue's Ephraim, a Soldier).
- **A talk that sets a side on a called script** counts: the shared paid recruit (0x089EEB00) checks your gold (0x19 variant 8)
  against what the talk put in s4 and makes yours the character in s3 (Rennac with the lord: 9,980 gold).
- **Two ways in one chapter** (a talk, or the end scene if they're alive): the talk is listed, with the other in the note.

## Not read yet

- When the postgame's units are added (the game's code): taken from Serenes Forest's recruitment page.
- Hard mode's and Easy mode's changes; the promotion item level (taken as Serenes Forest's: from Lv 10).
