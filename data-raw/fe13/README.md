# Fire Emblem Awakening (FE13): the unit data's formats

Read from the user's own dumps in `Documents\FE Games` (the cartridge image and the DLC; see the Armory's `data-raw/fe13/README.md`):
`scripts/fe13_extract.py` copies what's read into `data-raw/fe13/romfs/` (git-ignored, never committed). The readers (`fe13_bin.py`,
`fe13_data.py`, `fe13_events.py`, `fates_lz.py`, `fates_text.py`, `fates_cmb.py`, `fates_schedule.py`, `ncch_romfs.py`, `fe13_code.py`)
are the Armory's, copied. `scripts/build-fe13-units.py` writes `src/data/fe13/fe13Units.ts`.

## The army: `data/person/static.bin`, 568 bytes per person

+0 SID flags (0x01 a woman), +8 PID, +16 the class (JID), +20 the name label, +28-+35 their own bases (HP, Str, Mag, Skl, Spd, Lck,
Def, Res; signed), +36-+43 the growths, enciphered (below), +52-+59 the stat modifiers (HP's always 0, then Str to Res; signed), +69 the
level, +108 / +112 / +116 the classes a Second Seal opens to them as a man and +120 / +124 / +128 as a woman (a child takes each
parent's set for the child's own gender), +132 a child's fixed parent (the mother, Chrom for Lucina, the Avatar for Morgan), +136 on
their supports: [partner PID][the points C, B, A and S need] (99: no S).

The Avatar's record names only the Tactician: the Avatar's set is every base class of their gender but the special ones (Lord,
Dancer, Villager, Manakete, Taguel, and the unique classes), as Serenes Forest gives it.

## Classes: GameData's `JobData`, 128 bytes

+0 flags (0x01 a woman's, 0x08 promoted), +24-+31 bases, +32-+39 the growths, enciphered, +48-+55 maximums, +64 and +66 the skills it
teaches (indexes into `RemovableSkillData`, 28 bytes each, the name label at +8): at Lv 1 and 10, or 5 and 15 promoted (Serenes
Forest), +81 Mov, +92 and +96 pointers to the classes it promotes to (Cavalier: Paladin, Great Knight). (The Armory's reader calls
+64-+71 pair-up bonuses; they're these two skills.)

## The Avatar's asset and flaw: GameData's `PersonalityData`

Nine 56-byte records (`PersonalityDataNum`): +0 the name label (MID_個性_...), +8 the asset's bases, +16 its growths, +24 its
modifiers, then the flaw's at +32, +40 and +48; 8 signed bytes each, HP to Res (HP's modifier is always 0). The first record (無し)
changes nothing; the rest are HP to Res in order (HP asset: HP +5, growths HP +30, Def and Res +5, modifiers Str and Mag +1, Lck, Def
and Res +2). It matches Serenes Forest's tables. The app adds the chosen asset's and flaw's rows to both Avatars' bases (and own
bases), growths and modifiers; none leaves the person record's own numbers.

## Growths: enciphered, decoded as the program does (`scripts/fe13_growths.py`)

A person's growths are 8 bytes at +36, a class's at JobData +32. The program (code.bin) decodes each byte with a key from the record's
place in its table and the stat (0 HP to 7 Res), then looks it up in GameData's `CipherData` (256 signed bytes, found by name at start-up,
0x3d52f4):

- A person (read at 0x264858, decoded at 0x2cf0ec): the index is the record's offset from the table's records over 568 (0x2da13c; the
  records follow an 8-byte header). key = (((index ^ 0xa7) - 33 i) * 99) ^ 0xd9; growth = CipherData[(byte - key) & 0xff].
- A class (0x2cf094): the index is its place in JobData. key = (((index ^ 0x46) - 241 i) * 35) ^ 0x78.

The 8 bytes after each (a person's +44, a class's +40) aren't read for growths: they're made from the same key, which is why the two
halves' difference looked like an encoding of its own. 0x264858 adds to the person's growth the Avatar's asset's
(PersonalityData +16) and flaw's (+40); the class's is decoded on its own (0x2cf094). Every unit and class matches Serenes Forest's tables (the
test); the generic units (the Risen, the merchant) decode to 0.

## Joins (`scripts/fe13_joins.py`)

Each chapter's and paralogue's script (each paralogue after the chapter whose clearing opens it, ChapterData +20) and placements, with
the Armory's readers:

- The load handler's groups and the opening's (turn 1, your phase: the Prologue places Chrom's party there) are the start.
- Talks first: a talk that hands over its target (UnitTransferByIndex) recruits it by its talker; one that hands over its talker is the
  recruit's own (Severa talks to Holland).
- Villages: the `_Terrain` script's tiles of kind 8; a group a visit places on your side, for the visitors the script names (Laurent,
  for Chrom or Miriel).
- Then turn, area and condition handlers (a handler on turn -1 runs on a condition), and the end handler last.
- A unit a handler takes off again in the same handler doesn't join.

What a script leaves to the player (Donnel's level, Gangrel's three talks, Walhart, Emmeryn and Aversa surviving) is Serenes Forest's
and says so.

## The DLC recruits (`scripts/fe13_dlc.py`)

From the user's DLC dump (`dlc/E0xx`, each episode's files; `dlc/<content id>/E0xx_GLB.arc`, its global archive):

- `data/OtherData_DLC.bin`, table `ユニットデータ`: the unit the episode gives. +4 its name label, +8 an id (0x01000000 a woman), +12 its
  asset and +13 its flaw (PersonalityData indexes, 1 HP to 8 Res), +36 the person it's made from (`旧マルス`, the old Marth, for Marth;
  `プレイヤー援軍`, the Avatar's twin, for the rest: both in static.bin), +40 its class, +44 its level, +46-+53 its stats as it joins,
  +54 weapon experience, +80 its skills. 17 episodes give one; E004, E005 and E022-E027 none.
- Growths: the template's, plus its asset's and flaw's (the level-up's growth, 0x264858, adds the unit's asset and flaw to its person's);
  modifiers likewise. Its class set is its own class and every regular class of its gender, as the Avatar's (Serenes Forest's class sets).
  They have no supports.
- English: the episode's `m/E/E000.bin` (its title, MCID_E000, and the unit's name) and the global archives' `m/E/E0xxG.bin` (the DLC
  classes and skills: Dread Fighter, Bride, Resistance +10, Aggressor, Rally Heart, Bond, Limit Breaker...), read from the archives.
- Every recruit's level, stats, Mov, skills and modifiers match Serenes Forest's DLC pages (the test); Roy's growths are its worked
  example. Lodestar's record teaches no skills. When an episode opens (after Chapter 4) and the Path of a Grandmaster episodes'
  conditions are Serenes Forest's.

## Not traced in the code (taken from Serenes Forest or the Fire Emblem Wiki)

- Changing class adds the difference between the two classes' bases and starts at Lv 1; seals work from Lv 10.
- Inheritance (`childOf` in `src/awakening/logic.ts`; Serenes Forest's children, base-stat, growth and modifier pages and the Fire
  Emblem Wiki's inheritance page; tested against Serenes Forest's worked examples, Nah with Donnel and Severa with Henry):
  - growths: the child's own, the mother's and the father's added, a third, rounded down;
  - modifiers: both parents' added, plus 1 (no +1 for a Morgan whose other parent is a child);
  - bases as they join: both parents' current stats less their class's bases, plus the child's own (+28), a third, plus the start
    class's bases (the rounding is assumed). A parent's current stats are their Unit Planner plan's last row, or as they join;
  - classes: the child's own set and each parent's set for the child's gender (the game's swaps), but never Lord (only Lucina has it),
    Dancer or Conqueror; Taguel and Manakete pass only to Morgan;
  - Morgan starts in the other parent's first class (Tactician after a Lord, Dancer or Conqueror).
- Assumed, not in the sources: a child married to the Avatar passes Morgan what they inherited themselves (growths, modifiers,
  classes) when their own parents are in the plan.
- A special class (neither promoted nor promoting: Villager, Dancer, Taguel, Manakete, Conqueror, Lodestar, Dread Fighter, Bride) goes
  to Lv 30, the rest to 20 (no field for it was found in JobData).
- The SpotPass characters aren't listed (by choice).
