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
teaches (indexes into `RemovableSkillData`, 28 bytes each, the name label at +8): at Lv 1 and 10 for a class that promotes, 5 and
15 promoted, and 1 and 15 for a class that's neither (0x2d0f14), +81 Mov, +92 and +96 pointers to the classes it promotes to (Cavalier: Paladin, Great Knight). +56-+63 is what it gives in a
pair-up, Mov then Str to Res (signed; 0x2b2c8c reads it), and +84-+89 the weapons it uses (1 each for Sword, Lance, Axe, Bow, Tome,
Staff); +90 bit 0x40 marks a Manakete and 0x80 a Taguel, who use stones, which have no rank. (The Armory's reader calls +64-+71
pair-up bonuses; they're the two skills, and the bonuses are +56.)

## The Avatar's asset and flaw: GameData's `PersonalityData`

Nine 56-byte records (`PersonalityDataNum`): +0 the name label (MID_個性_...), +8 the asset's bases, +16 its growths, +24 its
modifiers, then the flaw's at +32, +40 and +48; 8 signed bytes each, HP to Res (HP's modifier is always 0). The first record (無し)
changes nothing; the rest are HP to Res in order (HP asset: HP +5, growths HP +30, Def and Res +5, modifiers Str and Mag +1, Lck, Def
and Res +2). It matches Serenes Forest's tables. The app adds the chosen asset's and flaw's rows to both Avatars' bases (and own
bases), growths and modifiers; none leaves the person record's own numbers.

## Hair: `face/FaceData.bin.lz`

792 records of 40 bytes: +0 the FSID label, +4 the MPID, +8 the face archive, +12 the hair colour as RGBA. A person's (by their FID,
static.bin +12) is `FSID_BU_<FID less "FID_">_通常`, or `FSID_FC_..._通常` (0x2bacb0). The Avatar has none: the hair menu picks from 20
colours the program builds at 0x2c8128 (`fe13_code.avatar_hair_palette`, the app's `FE13_AVATAR_HAIR`).

A unit's hair is kept in the unit (+0x104) and set at its creation, at a child's join and on refresh (0x2cdfd8): Lucina keeps her own;
any other child takes the hair of their fixed parent's spouse (the father, but Morgan (F)'s mother), the Avatar's chosen colour from
the Avatar, a child spouse's own; with no spouse found, the child's own. The village maiden never decides one (Lucina skips the step).
The app follows this in `hairOf`.

## Portraits: `face/` (`scripts/fe13_portraits.py`)

A face's archive is named at FaceData +8: `face/<name>_bu_通常.arc` for the bust-up (also `_fc_` close-ups and `_ct_pose0.ctpk.lz`
conversation portraits). The archive is the binary format, each label a texture package: the expressions (`通常` normal, `笑`, `怒`...)
and `髪0`, the hair. Each is a CTPK of one 256x256 ETC1A4 texture (`scripts/ctr_texture.py` decodes them: 8x8 tiles of four 4x4
blocks, eight bytes of alpha before each). A child's hair layer is drawn over the face and tinted with their hair colour; an adult's
(and Lucina's) is a 16x16 blank, their hair being part of the face.

`python scripts/fe13_portraits.py` writes every unit's portrait (`<name>.png`, the hair in their own colour) and each child's two
layers (`children/<name>/base.png` and `raw.png`) to `data-raw/fe13/art/` for the app's Bulk Upload, or with `--public` into
`public/art/` (both git-ignored). The app tints a child's hair as it does Fates' (`colorizeRawHairTexture`: the hair's highlights
stretched, then multiplied by the colour). The game's own blend is set up in the graphics library's texture combiner (the program sets
`dmp_TexEnv[n].constRgba`) and wasn't traced; the hair textures are built the same way as Fates' (a muted grey with white
highlights, the fill at about half brightness).

The Avatar's portrait is built like Fates' Corrin, from a bald body and a hairstyle. The creation menu's Build 01-03 pick the face files'
body: the program's table at 0x4d5500, read with the appearance's gender (+0x1c) times 3 plus its build (+0x1d), gives 童顔, 青年 and
ゴツイ for men and ロリ, 少女 and 妙齢 for women (`fe13_code.avatar_builds`); the face (+0x1e) picks 顔立ちA-E, and the file is
`FID_マイユニ_<body>_顔立ち<face>` (0x2bad80). Each body's `bu` archive has the bald portrait and the five hairstyles, `髪0`-`髪4` (the
menu's Hair 01-05). The app has Build, Hair and the hair colour for each gender, with the face left at the default, 01 (the game's own
default Avatar portrait, `プレイヤー`, is 青年's face A), and no accessories, as its Corrin has none.

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
  - The class sets for the unit's gender of seven people: the unit, both parents and the four grandparents. Lord, Dancer and Conqueror
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
  Lord, Dancer or Conqueror, the Tactician. A Manakete or Taguel sets Morgan's flag for it.
- **Skills a child inherits (0x27bc80):** one from the father, then one from the mother: the parent's equipped skills from the last slot up,
  the first that can pass (RemovableSkillData +0x14: 0 any child, 2 a manakete child, 3 a taguel child; 1 Special Dance, 4 the enemies'
  skills and 5 the DLC's never) and that the child doesn't know. Up to two known ones are passed over; a third ends the search. Chrom or
  Lucina as the parent gives a daughter Aether and a son Rightful King instead, and nothing if the child has it. Walhart gives Conquest,
  Aversa Shadowgift. The app doesn't model this: the Skill Planner's pool has every skill a child could inherit in some playthrough.
- **Pair-up (0x2b2c8c):** the one behind gives the lead, on each stat but HP, a tenth of their own stat (before any bonus), at most 3;
  on the stats their class boosts (JobData +57-+63), the class's part plus 1 at C or B and 2 at A or S (the support rank, 0x2de238);
  1 more on each with the lead's Defender. Mov gets the class's +56, 2 more with the lead's Deliverer (0x2cd408). Nothing holds a stat
  at its maximum after it. The rank (0x2de238) is the pair's support points against the thresholds in the person's support list;
  parent and child, and siblings, support each other on their own scale, 1, 6 and 16 points for C, B and A (0x2b0020, 0x2affc4).
  Serenes Forest's and the Fire Emblem Wiki's class tables match JobData's for every class (the test), as do their rules. Where their
  words differ, the program settles it: Defender and Deliverer count only on the lead (the wiki; Serenes Forest says "when paired
  up"), the partner's stat is their own before any boost (Serenes Forest; the wiki says "current stats"), and a bonus can go past a
  maximum (Serenes Forest; the wiki doesn't say).
- **Weapons:** a unit's experience in a weapon is the person's (+62-+67) plus the class's byte (0x2d0b60); GameData's WeaponLevelData
  turns it into a rank (91 A, 61 B, 36 C, 16 D, 1 E). It stops at 91 (0x2ceed8), so every class's weapons go up to A and none to S.
  WeaponBonusData has what each rank adds (a Sword at A Atk +3; a Lance, Bow or Tome Atk +2 and Hit +5; an Axe Atk +1 and Hit +10; a
  Staff recovery +3). Boots add 2 Mov, and a second adds nothing (the item's +0x25, held at 2, 0x2ec438).
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
