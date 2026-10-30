# The Binding Blade (FE6): the unit data's formats

Read from the user's clean Japanese ROM, `Fire Emblem - Fuuin no Tsurugi (J) [!].gba` (`FE6_ROM` overrides the path), with English
names from the FE6 Localization patch applied in memory (`scripts/fe6_names.py`, `scripts/ups.py`, `FE6_PATCH`). Nothing from either
is committed; `scripts/build-fe6-units.py` writes `src/data/fe6/fe6Units.ts`. The fuller ROM notes are in `Documents\FE Games\notes`
and the Armory's `data-raw/fe6/README.md`; `fe6_rom.py`, `fe6_names.py` and `fe6_events.py` are its readers, copied.

## Characters: `0x6076D0`, 48 bytes from id 1

+5 class, +9 affinity (1-7: Fire, Thunder, Wind, Ice, Dark, Light, Anima, by the later games' order), +0x0B level, +0x0C-0x13 their
own bases added to the class's (HP, Str, Skl, Spd, Def, Res, Lck, Con), +0x14-0x1B weapon experience (sword, lance, axe, bow, staff,
anima, light, dark), +0x1C-0x22 growths (HP, Str, Skl, Spd, Def, Res, Lck), +0x2C a pointer to the support data or 0.

## Classes: `0x60A0E8`, 72 bytes

+5 the class it promotes to, +0x0B-0x12 bases (HP, Str, Skl, Spd, Def, Res, Con, Mov), +0x13-0x19 caps (HP, Str, Skl, Spd, Def, Res,
Con; Luck is 30).

## Supports

The character's support data (32 bytes): 10 partner ids, 10 starting points, 10 points gained per turn, then the partner count. C, B
and A at over 60, 120 and 200 points, five levels per unit at most; the bonus per level is both affinities' rows (`0x66350C`, 8 bytes:
id, Atk, Def, Hit, Avoid, Crit, Dodge) summed and halved (the Armory read these in the support code).

## Joins (`scripts/fe6_joins.py`)

Each chapter's scripts played in story order: the opening (the starting enemies, then each turn-1 event on your phase; the army
group when no script places your units) gives who starts; each later turn, talk, location and misc event gives who it recruits or
brings in on your side (a talk: the other speaker; a village: every visitor the script lets recruit); the end scene gives who joins
at the end. Matches Serenes Forest's recruitment page. By hand: Cath (joins on her third talk with Roy, Chapter 12 at the
earliest) and Dayan's level (12, Serenes').

## Not read yet

- The trial maps' bonus units (Hector, Eliwood...): the game's code adds them once it has been cleared.
- Hard mode's bonus stats; the promotion item level and gains (taken as Serenes': from Lv 10, the difference in bases).
