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
- Byte 7 is 21 on classes that can still promote, 0 elsewhere. The class growth rates are never read by the program.
- The top-ranks string (`max_ranks`) is each weapon's highest rank in the class; the Unit Planner shows it.

## SkillData (`SID_` tables, 44 bytes)

0 SID, 4 name, 8 and 12 help, 16 and 20 effects, 24 the scroll (IID), 28 a running number, 29 kind (3: the game's markers, never
shown), 30 capacity, 31 the icon (its place in the icon sheet plus one; see "Portraits and icons"), 32 and 33 two list lengths, 36
and 40 the lists. Each list entry is 8 bytes: a flag (byte 0) and a
pointer to a `SID_`, `PID_`, `JID_` or `SFXC_` string.

Who can learn a scroll (0x80119dc8; matching 0x80127650): never if byte 31 is 0 or the first list is empty; every entry of
the first list must hold (flag 0: the unit matches it, by PID, JID, a skill it has, or an SFXC tag of either laguz form; flag 1:
it doesn't); and one entry of the second list, if there is one. Every scroll skill's first list has the skill itself (flag 1),
and Serenes Forest's notes come out the same (tested). A scroll item named "dummy" (Serenity, Tempest) is never handed out.

Carrying skills: at most six, the class's included (0x802279c4). Capacity used is every skill's but the ones the unit joins with
(PersonData's, flagged at 0x8010a078): the class's Shove (5) and Canto (10) count, and the mastery skill. A laguz's capacity is
the class's, +15 from Lv 15 and +50 from Lv 30 (0x80127a90): 20, 35, 70 (royals 50, 65, 100).

Growth (0x8006d380): each stat rolls the unit's own rate (plus a per-unit byte at unit+0x121, only ever 0); a sure point per 100,
then the rest rolled; a stat at its cap isn't rolled and a gain is cut to the room left. A level where nothing rises gives +1 to the
highest growth with room (the app leaves that out: its averages can run a little low). Blossom rolls a failed roll again
(0x8006d2c8) and halves battle EXP; Paragon doubles it (0x801207b4).

Bonus EXP (0x8006d790): the level is rolled as usual without Blossom or Paragon, then the risen stat with the lowest growth is
dropped until three are left (the earlier on a tie), or the highest growths that didn't rise and have room are added until there
are three (the earlier on a tie). Cost (0x80120524): 100 EXP at 1 + f × (L × m − 1) each, L the level + 20 in a second tier or
+ 40 in a third (laguz none), m 1.5 for laguz, f 1/3 Easy, 1/2 Normal, 1 Hard. Serenes Forest's and the Fire Emblem Wiki's Easy
and Hard costs are off.

Promotion (0x8011ffd0): the listed gains, Lv 1, the new class's caps, Con, Mov and capacity; ranks rise to at least the class's.
Automatic at Lv 20 plus 100 EXP (0x8006d1fc), bonus EXP included. The Master Seal (first tier) and Master Crown (second) need
Lv 10, a beorc, no `SID_EVENT_CC` (0x8011ff28); Mist needs the Holy Crown.

Laguz: transformed, every stat but HP and Luck doubled; ×1.5 rounded down while half-transformed (`SID_FIXEDHALFBEAST`, or
Wildheart); held at the transformed caps, which are exactly double (0x80122770). Level 40 (0x8010a7d4). Volug's Part 1
placements carry `SID_FIXEDHALFBEAST` (a placement's skills are at +60...+72 of its 104 bytes), so he's half-transformed there.

## Supports: RelianceData, RelianceParam, KiznaData

- `RelianceData`: 71 people, each with a list of all 71 (themselves included): partner PID, a signed byte (-1 on 302
  pairs; the program never reads it), the pair's kind 0-4. Everyone listed can support everyone else. Each gain adds the
  kind's `RelianceParam` value, floored at 0 (0x8012eab4); points stop at 50, 100 and 150 until the conversation is seen,
  which adds 1.
- `RelianceParam`: `32 64 96 97` the totals for C, B and A (50, 100, 150) and one more; seven points per action
  (`0f 1e 03 05 04 01 02`, see the Armory's notes); `02 01 00 ff fe` what each kind adds to every gain.
- `KiznaData`: a count, then 12-byte bonds: PID, PID, then 1 and the bond's value (5 or 10). The last entries are
  test names, not PIDs. A bond adds its value to the unit's critical and dodge while the bonded unit is next to them
  (0x80112cd4). No script adds one (`AddKizna` is never called); a Path of Radiance save does (below).

## A Path of Radiance save (0x8011d580, 0x8026d02c, 0x8026d0f8)

The program's table at main.dol 0x803922e8 (71 entries: a Path of Radiance name, and the Radiant Dawn one or 0 for the same)
matches the two games' units; the generator reads it. A unit takes the first entry naming it (0x8026d02c): 51 of the 73 do.
Danved takes Devdan's (`DALAHOWE`). Largo's entry names Calill too, but hers comes first, so she never gets his. The Black
Knight's entry names `DARKKNIGHT`, but his unit is `PID_DARKKNIGHT_0`, so he never gets one.

- A unit that finished at Lv 20 in a promoted class (level byte 40; laguz count) gets +5 HP or +2 for each stat at its cap
  there (a bitmask in their record), held at the caps here. Sothe instead takes his stats there if he finished at Lv 20.
- Weapon ranks there add 40, 80, 120 or 160 weapon EXP for C to S (not counted in the app).
- Supports there (0x8026d0f8, by each Path of Radiance name's entry) speed the pair's support and set `FLG_8_<A>_<B>_C/B/A`;
  an A support adds a +5 bond (0x801130d4) unless the pair has one, or either is Largo.
- The flags gate some talks: a condition handler before a talk (kind 8), or a base conversation (kind 14), tests
  `TstConversationFlag('FLG_8_<A>_<B>_A')`. Jill and Lethe (Part 3 Ch.6), Jill and Mist, Ilyana and Zihark, Brom and Zihark
  (Ch.7 and the Endgame, talking Jill or Zihark back), Ike and Soren (the base before Part 4 Endgame (5)). Stefan (C0404
  handler 3): Micaiah always finds him; Lethe or Mordecai only with `IsInheritFE8Data()` and his record in the save.

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

Story promotions: `UnitClassChange` on Micaiah at Part 1's Endgame (its end) and Part 4's Endgame (1), on Ike at the start of
Part 4's Prologue and on Sothe at its end (C0111, C0401, C0407a; the units are found through the handler's stored variables).
Sothe's is in C0401's handler 18 (the `MS_0401_ED_02` scene), which the chapter's end (handler 72) calls; the opening calls it
only when `EvKeyReadY()` is true, which startup.cmb makes false on the final build (`IsFinalVersion()`). The natives do nothing
unless the class has `SID_EVENT_CC` and a promotion.

## Unconfirmed

- Nothing above is checked in-game yet (the user's spot checks: an Archer's capacity, two bonus EXP level-ups).
- Two flags that switch bonds off (global 0x804cb700 bit 0x20000, battle +0x108 bit 0x800) aren't understood.
- Whether a Path of Radiance save keeps dead units' records (Path of Radiance's own code isn't read for it).

## Portraits and icons (`Face/`, `window/icon.cms`; `scripts/tellius_art.py`)

`python scripts/tellius_art.py fe10` writes every unit's portrait (`art/<name>.png`, 256x256) and every skill's icon
(`art/skills/<name>.png`, 32x32) for the app's Bulk Upload, and a labelled `contact_sheet.png` (all git-ignored). The names are
the app's (`artId`), read from the generated `src/data/fe10/fe10Units.ts`. Path of Radiance's README has the shared parts.

- `Face/facedata.bin`: 48-byte records, `FID_`, `FID_L_`, `MPID_`, the file, then 16-bit numbers: eye 1 x, y; eye 2 x, y;
  mouth x, y (in the big portrait; -1 when missing: Oscar's eyes, Volke's mouth, all three for the Black Knight); then where
  the 192x128 bust sits in the big portrait; the rest not decoded. PersonData +16 is the unit's `FID_`.
- `Face/<name>.cms`: LZ10, then a TPL of C8 textures: the 192x128 bust, the big conversation portrait (232x296, 336x296 or
  336x336) it's cut from, the mouth and eye frames (as Path of Radiance's), the 64x64 face. The bust is the same pixels as the
  big portrait at that place, except that a winged laguz's (Tibarn, Naesala, Janaff, Ulki, Vika, the herons, Nealuchi) leaves
  the wings out. `Face/wide/` holds the 16:9 versions, the frames squeezed to 4/5 of the width; `window/icon_wide.cms` the
  same for the icons (24x32). The 4:3 ones are used here.
- A portrait is the bust with both eyes open and the mouth closed, cut to a 128x128 square centred on the face, scaled up 2x.
- `window/icon.cms`: LZ10, a TPL whose second texture (1024x96) holds the skill icons, 32x32 in rows of 32. The icon is the
  SkillData byte at +31, its place plus one (0: none): the "skill learned" message (0x80031b64) puts
  byte 31 - 1 in its icon code (`#K#P%03X#k`). Byte 28 is only a running number: byte 28 - 60 equals
  byte 31 from Canto to Maelstrom, but the two Wildheart records (`SID_HALFBEAST_DUMMY` and `SID_HALFBEAST`) share an icon,
  so from Blessing on it's one ahead.
