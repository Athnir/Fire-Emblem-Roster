# Fire Emblem: Shadow Dragon (FE11): the unit data's formats

Read from the user's own cartridge image, `Fire Emblem - Shadow Dragon.nds` in `Documents\FE Games` (North American, YFEE).
`scripts/fe11_extract.py` copies `data/`, `dispos/`, `map/`, `script/`, `m/` (the English text) and `cpu/`, decompressed, plus the ARM9
program and its overlays, into `data-raw/fe11/rom/` (git-ignored, never committed). The readers (`nds_rom.py`, `fe11_extract.py`,
`fe11_data.py`, `fe11_cmb.py`) are the Armory's, copied; its `data-raw/fe11/README.md` has the containers, the script bytecode and the
maps. `scripts/build-fe11-units.py` writes `src/data/fe11/fe11Units.ts`.

## People: `data/database` Person, 80 bytes

+0 PID, +4 face (none for a generic), +8 a generic's army name, +0x0c-+0x13 their own bases (HP, Str, Mag, Skl, Spd, Lck, Def, Res;
signed, added to the class's), +0x14-+0x1b growths (signed: Lena's HP is -5), +0x1c-+0x21 weapon experience (sword, lance, axe, bow,
tome, staff), +0x24 flags (0x01 a woman). Their level and class are the record that places them in a chapter. Every unit's bases, growths
and weapon ranks match Serenes Forest's tables.

## Classes: Job, 92 bytes

+8-+0xf bases (signed), +0x10-+0x17 growths added to the person's (signed), +0x20-+0x27 caps, +0x29 Mov, +0x2c-+0x31 weapon experience
(added to the person's for the rank, where the class can use the weapon: Marth's 30 + the Lord's 1 = D), +0x38 a woman's class, +0x39
0x08 promoted, +0x3c the class it promotes from and +0x40 the one it promotes to (pointers to Job records: a Pegasus Knight to a
Dracoknight, and a Falcoknight names the Pegasus Knight as where it comes from), +0x34 the reclass set and tier (1 male A, 2 male B,
3 female, 4-6 their promoted classes, 0 none: the Lord, Thief, Ballistician, Freelancer, Manaketes, a man's Pegasus Knight, a woman's
Cavalier), +0x35 its column (signed: the class line, 0 Pegasus Knight / Dracoknight / Falcoknight to 11 Curate / Cleric / Bishop; -1
none). A growth below 0 counts as 0 (Serenes Forest's full growths, all 500 unit-and-class rows checked in the test).

## Joins (`scripts/fe11_joins.py`)

Each chapter's placements (`dispos/`, 80-byte records: +0 person, +2 class, +8 team, +9 level, +0x24 flags) and scripts:

- The opening (MapBegin, then Opening, played through) places the units joining at the start: your side's named people with flag 0x01
  (0x80 alone is a scene actor, 0x40 one who only visits: Nyna). The group 'mikata' is only the deployment slots.
- A talk handler (trigger 0x08) that hands a unit over (UnitTransfar) recruits it; every such talk counts (Wendell: Marth or Merric).
- A village (a `_ter` script's tile of kind 8) placing a group of your side. Only Marth visits villages (Serenes Forest).
- The Ending places units joining after the chapter (Cain and Jagen after Prologue II) or hands one over (Horace, Etzel, Ymir). One the
  same scene takes off again doesn't join (Elice in Prologue I's ending).
- The prologue is Normal's only: Chapter 1's opening places the starting army ('mikata1'-'mikata3') on the Hard modes, and Frey and
  Norne never join there. The Endgame's opening places Nagi if 24x was played, Gotoh if not.

Serenes Forest lists a unit joining at a chapter's end under the next chapter; the test allows for it.

## Reclassing (overlay 05, the battle preparations: `sally::JobS`)

- The list (0x2211058): every class whose +0x34 is the unit's current class's, over the whole Job table. A unit's set is so fixed by the
  class it joins in: a reclass stays within the code, and a promotion goes from 1-3 to 4-6.
- Of the female promoted set's two column-0 classes it offers the Dracoknight, or the Falcoknight instead to a unit with flag 0x20000000
  (tested at 0x203c810: the unit's runtime flags +0x98, the person's +0x24, the class's +0x38; no person or class has it). Only the
  promotion sets it, when promoting with the Elysian Whip: a promotion item (+0x11 kind 5) with +0x28 bit 0x04 names the Falcoknight as
  the target (on the map overlay 00 0x21ce594, at the preparations overlay 05 0x220eac0), and the promotion (arm9 0x203d840) sets the
  flag when it's given a target. It's never cleared (loading a save carries it over from an older bit, 0x203b4e8).
- Committing a reclass (0x22103ac) moves the class-limit count from the old column (+0x35) to the new, and sets the class (+0x44); the
  level and experience stay.

## Stats, level-ups and promotion (arm9)

- A stat (0x203c6c0): the person's base (+0x0c) + the class's base (+0x08) + what the unit has gained (unit +0x50), shown as 0 below 0,
  held at the class's cap (+0x20). Mov (0x203c77c): the class's + a bonus (unit +0x6d). So a class change swaps one class's bases for the
  other's, and a stat a lower cap holds back comes back in a class with a higher one.
- A level-up (0x203d6dc), each stat: the chance is the person's growth + the class's, plus a catch-up bonus of a tenth of how far the
  points gained (x100) are behind a running total of the growths (unit +0x58, adding each level the growth, never below 0, unless the
  stat is at its cap). 100 or more gives a point and the rest is rolled; nothing is added at the cap. The app's averages don't count the
  catch-up.
- The promotion (0x203d840): the class given, or the class's own (+0x40); Lv 1, experience 0.

## Not found in the program (Serenes Forest's)

- Reclassing opening in Chapter 4, a Master Seal working from Lv 10, and the limits' numbers (1 plus the units of that line you could
  have recruited).
- Norne's condition (4 or fewer units after the prologue) and Minerva needing Maria first.
- The faceless replacement units (`PID_REP_*`, arm9 0xd5154) aren't listed.
- No supports in this game.
