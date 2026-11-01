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
  (tested at 0x203c810: the unit's runtime flags +0x98, the person's +0x24, the class's +0x38; no person or class has it). Loading a save
  carries it over from an older bit (0x203b4e8). What sets it isn't traced; the app takes it to be having been a Falcoknight (unconfirmed).
- The counts the class limits use (0x2211030): units per column (+0x35).
- The Elysian Whip (0x220eac0): a promotion item (+0x11 kind 5) with +0x28 bit 0x04 promotes to the Falcoknight.

## Not found in the program (Serenes Forest's)

- The rules: reclassing from Chapter 4 keeps the level, a Master Seal promotes from Lv 10 to Lv 1, and either adds the difference between
  the classes' bases. The limits' numbers (1 plus the units of that line you could have recruited).
- Norne's condition (4 or fewer units after the prologue) and Minerva needing Maria first.
- The faceless replacement units (`PID_REP_*`, arm9 0xd5154) aren't listed.
- No supports in this game.
