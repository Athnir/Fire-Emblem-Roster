# Fire Emblem Echoes: Shadows of Valentia (FE15): the unit data's formats

Read from the user's own cartridge image, `Fire Emblem Echoes Shadows of Valentia.3ds` in `Documents\FE Games` (title CTR-P-AJJE,
decrypted: its NCCH has the NoCrypto flag; `FE15_ROM` overrides the path). `scripts/fe15_extract.py` copies `Data/`, `Scripts/`, the
North American English text (`m/@NOA_EN`) and the program into `data-raw/fe15/romfs/` (git-ignored, never committed);
`scripts/build-fe15-units.py` writes `src/data/fe15/fe15Units.ts`. The tables are Awakening's binary format (`scripts/fe13_bin.py`),
one table per file; English names are `m/@NOA_EN/Name.bin` (MPID) and `Job.bin` (MJID).

## People: `Data/Person.bin`, 168 bytes per PID

+0 PID, +4 the name label, +8 the class (JID), +24 the army (BID_アルム軍 Alm's, BID_セリカ軍 Celica's), +29 the level, +52-+58
bases (HP, Atk, Skl, Spd, Lck, Def, Res; absolute), +60-+66 their own maximums (the same stats: Shadows of Valentia keeps maximums
per character, not per class), +68-+74 growths. Everything matches Serenes Forest's tables for every unit.

## Classes: `Data/Job.bin`, 160 bytes per JID

+4 the name label, +36-+43 bases (HP, Atk, Skl, Spd, Lck, Def, Res, Mov), +88 the class it changes from (the class tree: a Villager
branches into five classes for men, four for women). The level each class must reach to change isn't in these records; it's Serenes
Forest's (`CHANGE_LEVEL` in the generator), as is the rule: a class change lifts every stat but Res that's below the new class's bases
to them, and starts again at Lv 1. A Dread Fighter's change back to Villager, and the Pitchfork, aren't shown.

## Supports: `Data/Reliance.bin`

Four tables, read by `read_supports` in the generator:

- 支援効果: per character (SUPID_), a count and a list of 20-byte entries, [partner PID][16 bytes]: what that character gets from the
  partner in reach, four signed bytes (Hit, Crit, Avoid, Crit avoid) for each of no rank, C, B and A. A pair with only the first four
  set has a fixed bonus from the start and no conversations (Alm and Gray). Bytes can be negative: Faye gets Avoid -5/-10/-15 from Alm.
- 支援関係: a 40-byte row per PID, [PID][a byte per character in the same row order]; the lower half holds each pair once: the points
  pattern of a pair with conversations (0 none).
- 必要経験値: the patterns (REXID_), C, B and A's points: 1 is 20/45/90, 2 is 15/35/60, 3 is 10/25/45.
- 支援会話条件: per character (RCID_), a count and 8-byte entries, [partner PID][the act C, B and A open in][0]. A pair with
  conversations but no entry opens from Act 1.

All of it matches Serenes Forest's support-bonus page but three values (the test lists them): Celica and Conrad's ranks open in Act 4
here (Serenes Forest: 3; Conrad joins in Act 4), and Tatiana's B with Zeke gives Avoid +7 (Serenes Forest: +5). The range (3 tiles)
is Serenes Forest's.

## Joins

Joins are spread over the town and dungeon events (`Data/Event/*.bin`: labels like エフィ加入, "Faye joins", in a module per act), the
chapter scripts and the game's code; they aren't read yet. The act each unit joins in and how are Serenes Forest's recruitment page's
(`scripts/fe15_recruitment.py`), and say so. The DLC's Cipher Legends units aren't in the user's dump.
