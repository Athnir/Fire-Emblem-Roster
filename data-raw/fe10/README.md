# Radiant Dawn (FE10): the unit data's formats

The user's own disc, extracted with Dolphin (`Extracted Games Dolphin\FE 10\DATA\files`, NA release RFEE01; `FE10_FILES`
overrides the path). Nothing from it is committed; `scripts/build-fe10-units.py` writes `src/data/fe10/fe10Units.ts`.
The Armory's `data-raw/fe10/README.md` covers the file containers, weapons, maps and the battle rules.

`FE10Data.cms` is LZ10-compressed into Path of Radiance's pointer-relocated layout: header `size, data size, pointer
count, name count`, data at 0x20 (pointers are offsets from there), then the pointer offsets, then `(data offset, name
offset)` pairs naming the tables. Big-endian. Unlike Path of Radiance's, most records here are variable-length: a count
in the record says how many pointers follow, so tables are walked record by record (`scripts/fe10_units.py`). The walks
end exactly where the next table starts, which the reader checks.

## PersonData (461 records)

- 4-byte head: skill count, 0, level, 1 for women.
- Pointers: PID, MPID (name), MNPID (set for named characters), FID (portrait), JID, affinity, weapon ranks (12 places:
  sword, lance, axe, bow, knife, strike, fire, thunder, wind, light, dark, staff; `*` is SS).
- The skills (the head's count), a pointer (unused here), four animation pointers (AID_).
- 28 bytes: 0 biorhythm type; 1-2 always 3, 8; 3 the laguz gauge it starts at; 4 leadership stars; 5-8 the laguz gauge's
  changes (signed); 9-16 their own bases, signed, added to the class's (HP, Str, Mag, Skl, Spd, Lck, Def, Res); 17 Con and
  18 Wt, signed, added to the class's; 19-26 growth rates; 27 unused.
- Serenes Forest's bases are class + own for all 73 playable units, and their growths are bytes 19-26 (tested).

## JobData (171 records)

- Pointers: JID, MJID (name: the game's own short names, `Lance Pal`, `Seraph Kn`), the Japanese name, help, the class it
  promotes from, the class it promotes to, the laguz form it changes into, the laguz weapon, AID, starting ranks, top ranks.
- 12 bytes: 0 Con; 1 a kind (1 beorc, 6 beast, 7 dragon, 8 bird); 2 the unit's weight over its Con, signed (-3 herons);
  3 unknown; 4 a mount's weight (20 horse, 15 pegasus, 25 wyvern); 5 skill count; 6 attribute count; 8 movement type;
  9 Mov; 10 skill capacity.
- A pointer, the skills, the class's mastery skill (laguz classes only), the attributes (`SFXC_HUMAN` beorc,
  `SFXC_ALIZE` laguz, `SFXC_BEAST`/`BIRD`/`DRAGON` on the transformed forms, `SFXC_MAGE`...).
- 32 bytes: caps, bases, generic units' growths, and the promotion gains into this class (8 bytes each).
- Wt = Con + byte 2 + byte 4 (+ the person's byte 18): fits every Serenes row.
- Promotion adds this class's gains (Serenes' promotion-gains page has the same numbers; third tiers use one of four
  sets). Con changes by the difference in the classes' Con.
- `SID_HIGHER` marks a second tier, `SID_HIGHEST` a third, `SID_EVENT_CC` a class only the story promotes (Ike's Hero,
  Micaiah's Light Mage and Light Sage, Sothe's Rogue). A beorc class's mastery skill is in its skill list: the one of
  capacity 25 or more without a scroll (Aether, Astra, the Black Knight's Eclipse).

## SkillData (`SID_` tables, 44 bytes)

0 SID, 4 name, 8 and 12 help, 16 and 20 effects, 24 the scroll (IID), 28 icon, 29 kind (3: the game's markers, never shown),
30 capacity, 31 order, 32 and 33 two list lengths, 36 and 40 the lists. Each list entry is 8 bytes: a flag (byte 0) and a
pointer to a `SID_`, `PID_`, `JID_` or `SFXC_` string.

Who can learn a scroll, read from the lists and checked against Serenes Forest's notes (tested; not traced in the code):
- First list, flag 1: a unit matching any can't (already having it; herons for most; priests for Counter...).
- First list, flag 0: a unit must match every one (`SFXC_ALIZE` and `SFXC_DRAGON`: dragons only; `SFXC_HUMAN` and Elincia:
  Mercy). A laguz's tags are split between its two forms, so either form's count.
- Second list: a unit must match one, when there is one (Shriek's hawk and raven classes; Blessing's herons;
  `SFXC_HUMAN`, `SFXC_ALIZE`: anyone).
- With no second list and no flag-0 entry, beorc only (Shade, Discipline, Disarm, Corrosion, Stillness).
- A scroll item named "dummy" (Serenity, Tempest) is never handed out.

## Supports: RelianceData, RelianceParam, KiznaData

- `RelianceData`: 71 people, each with a list of all 71 (themselves included): partner PID, a signed byte (-1 on 302
  pairs, use unknown), the pair's kind 0-4. Everyone listed can support everyone else.
- `RelianceParam`: `32 64 96 97` the totals for C, B and A (50, 100, 150) and one more; seven points per action
  (`0f 1e 03 05 04 01 02`, see the Armory's notes); `02 01 00 ff fe` what each kind adds to every gain.
- `KiznaData`: a count, then 12-byte bonds: PID, PID, then 1 and the bond's value (5 or 10). The last entries are
  test names, not PIDs.

## Scripts: joins and armies

`scripts/fe10_cmb.py` reads the scripts: Path of Radiance's format, with op 0x37 calling another handler by number (one
byte, or two when the first has its top bit: `81 81` is handler 0x181) and op 0x47 storing into a variable.

Teams: your army is team 5 while a chapter is set up and team 0 on the map; 8, 9 and 10 hold the armies not being played
(Part 4: Micaiah's, Ike's and Tibarn's), 7 those away from every army, and 1-4 are the map's other sides. `startup.cmb`'s
helpers move units: 382 `UnitTransferToForceALL(from, to)`, 383 `TeamCheckTransferPID` (a listed unit of team `from` goes
to `to`), 384 `UnitCheckTransferPID(pid, from, to)`, 385 `TeamTransferPID(pid, to)`. Its `TEAM_ppnn_OP*` / `_ED*`
functions are each chapter's moves, called from the chapter's opening (`_OP`) or its end (kind 1 handlers, `_ED`).

First joins (`walk()`), the first rule that finds the unit; within a chapter an opening beats a base talk, a talk and an
event:
- `JoinRank(group, 5)` / `Join(group, 5)`: at the base (handler kind 14) or the chapter's start (an opening).
- A talk (kind 8: the two speakers' PIDs come first) moving them to team 0. One who isn't a speaker joins "when they
  talk" (Muarim and Vika with Tormod).
- `TeamTransferPID(pid, 5)` or `SallyAddByGroupRank` in an opening; a side-0 group placed by a turn event (kind 3: that
  turn; a `Normal()` guard means Easy only, `not Normal()` the other modes).
- A move to your side at the chapter's end: the start of the next chapter (Fiona; Gareth and Nasir).
- The first deployment template (`bmapPPNN_mikata`) listing them (Part 1's first units).
All 73 match Serenes Forest's recruitment page (tested), except Sothe's turn: Serenes says turn 2, when he only walks
through a scene and off the map; turn 3 places him.

Who's in your army each chapter: the teams followed through the chapters: openings' moves, then team 5 and whoever joins
during the chapter (less `UnitNeverSallyByPID`), then the `_ED` moves. A move out of a map side (1-4) is taken from
wherever the unit is. Whole-army moves outside the TEAM_ functions only stage cutscenes and are skipped. A recruit by
talk always counts (Jill and Zihark, talked back to Ike's side in Part 3, are then with him). Not yet checked in-game.

Story promotions: `UnitClassChange` on Micaiah at Part 1's Endgame (its end) and Part 4's Endgame (1), on Sothe and Ike in
Part 4's Prologue (C0111, C0401, C0407a; the units are found through the handler's stored variables).

## Unconfirmed

- The growth formula (each level adds the unit's own rate; the class's growths are for generic units) and promotion
  gains are Serenes Forest's account, not traced in `main.dol`.
- Transformed laguz stats: everything but HP and Luck doubled, held at the transformed caps (the caps double those
  stats too); not traced in the code. Laguz levels go to 40 (Serenes Forest).
- The skill list rules above; the support table's signed byte; what a bond's value does.
- Story promotions' conditions (Ike's in the Endgame is behind a check not yet read).
- Path of Radiance save transfers raise some bases (Serenes' stars); the app shows the bases without one.
