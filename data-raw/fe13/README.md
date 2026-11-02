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

A set that names the Tactician (the Avatar's record names only the Tactician, as do the DLC's templates) opens every regular class of
the gender: the Second Seal's list adds the program's own list of them (0x2cff38, read by `fe13_code.full_class_list`: thirteen for
each gender, from the Tactician to the Dark Mage).

`PID_ダミー` is the village maiden, Chrom's wife when he marries no one (below): every byte of bases and modifiers 0, growths that
decode to 0, level 1, no sets, and the class `JID_ダミー男`, which has no record. The app has her as `FE13_MAIDEN`.

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
  modifiers likewise. Its class set is its template's: the Tactician (and the old Marth's Lodestar), so every regular class of its
  gender (0x2cff38). Its own class, if it's none of those or what they promote to, it can only take again at its top level. They have
  no supports.
- English: the episode's `m/E/E000.bin` (its title, MCID_E000, and the unit's name) and the global archives' `m/E/E0xxG.bin` (the DLC
  classes and skills: Dread Fighter, Bride, Resistance +10, Aggressor, Rally Heart, Bond, Limit Breaker...), read from the archives.
- Every recruit's level, stats, Mov, skills and modifiers match Serenes Forest's DLC pages (the test); Roy's growths are its worked
  example. Lodestar's record teaches no skills. When an episode opens (after Chapter 4) and the Path of a Grandmaster episodes'
  conditions are Serenes Forest's.

## The program (`code.bin`)

The rules the planners follow are read in the game's program: `data-raw/fe13/romfs/code.bin`, decompressed, loaded at 0x100000 (`scripts/fe13_code.py`
has the disassembly helpers). Nothing from it is committed but what's derived here. In a unit: +0x64 the person, +0x68 the class, +0x74 the
Avatar's asset and flaw, +0x78 the parents (the father's record at +0, the mother's at +0x1c: person, asset, flaw, and that parent's own
two parents), +0x84 the points gained in each stat, +0x8d the level, +0xb4 the five equipped skills, +0xfc Boots.

- **Stats (0x2f3ac0):** the person's base, plus the asset and flaw, plus the class's base, plus the points gained, held at the maximum.
- **Maximums (0x2c48f8):** the class's, plus the person's modifier, plus the asset and flaw (0x419d28), plus for a child both parents'
  modifiers (0x264768: each parent's own, with their asset and flaw, and a child parent's own parents', without their +1), plus 1 on every
  stat but HP; plus 10 on every stat but HP with Limit Breaker.
- **Growths (0x27d230):** the person's, with the asset and flaw (0x264858); a child's is their own and both parents' added and divided by 3,
  rounded down (a child parent counts with what they inherited). Then the class's, then 20 more with Aptitude.
- **Level-ups (0x2cef88):** each stat's growth gives a point per 100 and a chance at the rest, while the stat is under its maximum. A level
  that rolls nothing is rolled once more, unless a growth is 100 or more.
- **Top levels (0x2d0ad8):** 20 for a class that's promoted or promotes, else 30 (Villager, Dancer, Taguel, Manakete, Conqueror, Lodestar,
  Dread Fighter, Bride).
- **Seals (0x2d4d3c):** a Master Seal needs Lv 10 and a class that promotes; a Second Seal works once promoted, or from Lv 10.
- **The Second Seal's list (0x2cff38):**
  - Every regular class of the unit's gender (0x214098) when the unit's, a parent's or a grandparent's set holds the Tactician, plus
    Manakete or Taguel for a unit flagged as one.
  - The class sets for the unit's gender of seven people: the unit, both parents and the four grandparents. Lord, Great Lord and Dancer
    come only from the unit's own.
  - What those classes promote to, only for a promoted unit at Lv 10 or more, or an unpromoted one at Lv 30.
  - The unit's own class at its top level. The add step (0x2bbde4) skips a class already listed, and the current one below its top level.
- **Changing class (0x2d0fb8):** the new class at Lv 1 with no EXP; the points gained are kept, and HP is held to the new maximum. A stat
  over the new class's maximum shows held there and comes back in a class with higher ones.
- **The Dread Fighter's seal (0x214278):** its own list of one class, for men only, once promoted or from Lv 10.
- **Movement (0x2cd408):** the class's, plus Boots (up to 2), plus 1 for Movement +1, plus what a pair-up gives. No person has Movement of
  their own: Chrom's is 5, Cynthia's and Gerome's 7 (Serenes Forest gives 6, 8 and 8).
- **A child joining (0x3a44d0):** after their parents' records are filled in (0x27c0a8), each stat gains a third, rounded down, of how far
  each parent is above the child (a parent below adds nothing). A parent's stat and the child's are the person's base plus the asset and
  flaw plus the points gained, before the maximums; the class's base isn't counted. So a child never joins below their own stats. Then
  Morgan takes a class, then the skills.
- **Morgan's class (0x27c150):** the other parent's first class for Morgan's gender (person +108 for a son, +120 for a daughter); after a
  Lord, Great Lord or Dancer, the Tactician. A Manakete or Taguel sets Morgan's flag for it.
- **Skills a child inherits (0x27bc80):** one from the father, then one from the mother: the parent's equipped skills from the last slot up,
  the first that can pass (RemovableSkillData +0x14: 0 any child, 2 a manakete child, 3 a taguel child; 1 Special Dance, 4 the enemies'
  skills and 5 the DLC's never) and that the child doesn't know. Up to two known ones are passed over; a third ends the search. Chrom or
  Lucina as the parent gives a daughter Aether and a son Rightful King instead, and nothing if the child has it. Walhart gives Conquest,
  Aversa Shadowgift. The app doesn't model this: the Skill Planner's pool has every skill a child could inherit in some playthrough.
- **Who can marry (0x2d9e08):** not a parent or child (0x2d9dac), nor a sibling: a shared father or mother (0x2b5b50).
- **Chrom's wife (ev::HeroMarrige, 0x3b2700):** at the end of Chapter 11, the unmarried candidate he has the highest support with, from C
  up; a tie goes to whoever is first of the Avatar, Sully, Sumia, Maribelle and Olivia; failing that, anyone he has some support with. With
  no one, he's marked married to the maiden (0x2afefc), and his spouse is then the person record `PID_ダミー` (0x2ef8f8): all zeros, no
  classes, no skills.

The app follows this in `src/awakening/logic.ts`: `childOf` and `parentOf` (inheritance), `classChanges` and `legalSteps` (the seals),
`project` and `levelGain` (average stats).

Taken from Serenes Forest, not the program:

- What a script leaves to the player (Donnel's level, Gangrel's three talks, Walhart, Emmeryn and Aversa surviving), as above.
- The SpotPass characters aren't listed (by choice).
