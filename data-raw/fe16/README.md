# Fire Emblem: Three Houses (FE16): the unit data's formats

Read from the user's own dumps in `Documents\FE Games\Switch dumps\NSP` (nxdumptool, from their console; keys in `~/.switch`, never in
the repo): the base game (`[010055D009F78000][v0][BASE]`), the 1.2.0 update (`[010055D009F78800][v327680][UPD]`) and the six DLC
packages (`[010055D009F7900n]`). `scripts/fe16_extract.py` (adapted from the Armory's) opens them with `scripts/switch_nsp.py`, lays
the update's patch RomFS (BKTR) over the base game's, and copies the archive files the readers need into `Documents\FE Games\Switch
dumps\extracted\fe16\romfs` (`FE16_ROMFS`) and the DLC's small files into `...\fe16\dlc` (`FE16_DLC`); nothing from the dump is
committed. `scripts/fe16_units.py` reads them (`scripts/fe16_data.py`: the containers and text) and `scripts/build-fe16-units.py`
writes `src/data/fe16/fe16Units.ts`. The Armory's `data-raw/fe16/README.md` covers the weapons, maps, battles and battle formulas.

## Containers

- **The archive**: `DATA0` (32-byte records: u64 offset, size, stored size, compressed) indexes `DATA1`, 31,160 files. A compressed
  file is Koei's chunked zlib (u32 chunk size, chunk count, total, then each chunk's stored size; each chunk on a 0x80 boundary, u32
  length + zlib, or stored as it is).
- **The update** (`patch4/INFO0`: the 1,210 files it replaces, with their paths; `INFO1`: the 4,062 it adds) reshapes the tables:
  v1.0's persondata is 1059 records of 76 bytes with 37 character slots, its classdata 90 x 108. Read the 1.2.0 files only (the
  community's 010 templates are partly v1.0's: their combat art layout is a byte short).
- **A data file** is sections: u32 count, then (u32 offset, u32 size) each. A table section starts with a 0x40-byte header (u32 magic
  0x16121900, u32 record count, u32 record size), its records after.
- **Text** (file 0): a section per language (1 = US English), each four Koei 'XL' string tables (the first an index). Table 1 holds
  the names: a person's at 1157 + the person's +0x12, a class's at 3453 + class (descriptions 3554 on; the War Cleric's name 3553),
  a combat art's at 6014 (descriptions 6314), an ability's at 7236 (7536), a spell's at 7836 (8136), a crest's at 9590 (descriptions
  9677; 0-21 major, 22-43 minor, 86 none), an allegiance's at 9498.

## Units (file 12, fixed_persondata.bin)

- **Persons** (section 0, 1201 x 80): +0x12 the name's person, +0x1A class, +0x1B age, +0x1C/+0x1E birthday (99: Byleth's, set by
  the player), +0x20 the character slot, +0x22 HP maximum, +0x24 allegiance, +0x26 gender (1 female), +0x29 HP growth, +0x2B HP
  base, +0x2C/+0x2D crests, +0x2F/+0x30 height (Part I, II), +0x33 the bases, +0x3C the growths and +0x45 the maximums, each 9
  bytes: Str, Mag, Dex, Spd, Lck, Def, Res, Mov, Cha (a Mov maximum of 99 is none). The bases are Lv 1's.
- **Character slots** (+0x20) index the 45-row tables: rows 0-36 are persons 0-36, 37 Sothis, 38-41 Yuri, Balthus, Constance and Hapi
  (persons 1040-1043; 550-553 are only their names), 42 Aelfric (1044), 43 Jeritza (1045), 44 Anna (1046). Playable: persons 0-34 and
  the DLC's six (41 characters, both Byleths counted); Jeralt, Rhea, Sothis and Aelfric have records but aren't.
- **Section 3** (45 x 34): +3..+7 the classes certified as they join, +9..+19 their starting ranks, +20..+30 proficiency (3 a strength,
  2 neutral, 1 a weakness), +31..+33 the classes the story gives them later (as foes: unconfirmed). Skills in the game's order:
  Sword, Lance, Axe, Bow, Brawling, Reason, Faith, Authority, Heavy Armor, Riding, Flying; ranks 0 E to 11 S+.
- **Section 4** (spells): +0 the Faith ranks, +5 the Reason spells, +10 the Faith spells, +15 the Reason ranks (five each).
- **Section 5** (abilities): +0 skill x20, +20/+21 the personal ability before and after the time skip, +22 ability x20, +42 rank x20.
- **Section 7** (combat arts): art x10, skill x10, rank x10.
- **Section 10** (support list, 270 x 12): u16 person A, u16 person B, u16 flags at +9: bits 0-6 the conversations S, A+, A, B+, B, C+,
  C; with Byleth, bit 7 an S with a male Byleth and bit 8 with a female one; bit 9 an ending together (the endings script, file 362,
  agrees). Byleth's pairs name person 0.
- **Section 11** (budding talents): u16 person, a parameter (12; 6 Byleth's: unconfirmed), skill, art, ability.
- **Section 12** (12 x 22): what every unit learns at each rank, E to S+: +0..+10 the combat art, +11..+21 the ability, by skill.

## Classes (file 11, fixed_classdata.bin)

- **Section 0** (100 x 118): +16 HP boost, +20 the growth modifiers HP to Res, Mov, Cha (signed), +39 the stat boosts Str to Cha
  (signed), +48 the mount's bonus (signed; lost on foot), +57 skill EXP bonus x11, +69 tier (0 starting, 1 beginner, 2 intermediate,
  3 advanced, 4 master, 5 DLC, 6 unique), +75 base HP, +77 movement type, +78 on foot, +79 weapon type, +81 class types (infantry,
  armoured, cavalry, flying, dragon, monster bits), +85 base Str to Res.
- **Section 1** (certification): item, exam type, gender (0 male, 1 female, 2 any), the skill ranks the exam asks for.
- **Section 2**: the level each tier needs: 5 beginner, 10 intermediate, 20 advanced, 30 master, 20 DLC.
- **Section 3**: the mastery ability and combat art, the class abilities.
- The playable Pegasus Knight is class 54 (intermediate); 23 is the foes'. Jeritza's Death Knight is 91 (59 is the foes').

## Recruitment (file 24, fixed_lobby_common.bin section 4)

101 x 14: u16 person, u16 an item (probably what they drop as a foe: unconfirmed), u16, u8 the class if recruited early, u8 Byleth's
level needed (the staff; 255 none), u8 the class if recruited late, u8 stat (Str to Cha; 9 none), u8 skill (11 none), u8 rank, u8 1:
joins a female Byleth with no requirement (Sylvain), u8 the stat's value. The monastery script (file 360, LO08_00.bsi) holds a
`RecruitTalk` event per recruitable unit, under its chapter and route conditions.

## Mechanics read in the program

The program is the update's `main` NSO (`romfs/main.bin`, relocated at 0; AArch64, no symbols): function starts from
`.eh_frame_hdr` (0x188d300), and each data table reached through its GOT entry, which the loader at 0x3b5330 names (persondata
section 0 at 0x1aa7810, classdata section 0 at 0x1aa7948, lobby_common section 4 at 0x1aa9a30). A unit is a 0x24c-byte slot (60 at
GameData +0x644): +0x20 its own random seed, +0x4a level, +0x4b class, +0x4c HP, +0x4e..+0x56 Str to Cha, +0xac flags (bit 5
riding). GameData +0x2427c is the chapter, +0x2449c the difficulty, +0x2449e the route (0 Black Eagles / Silver Snow, 1 Azure Moon,
2 Verdant Wind, 3 Crimson Flower).

- **Level-up** (`0x3d3020`): each stat's growth is the person's + the class's modifier (+ 20 with Aptitude, Cyril's personal
  ability: ability property 58); nothing from difficulty, items, crests or supports. The unit's own seed (x * 1103515245 + 12345,
  (x >> 16) % 100) rolls ten stats in order, Mov included; a growth of 101 or more gives (g − 1) / 100 sure points first. A stat
  gains when the roll is below its growth. **The two-point minimum**: for a person whose section 3 +8 has bit 7 (Byleth, the
  students, Flayn, Cyril, the Ashen Wolves, Jeritza, Anna; not Seteth, Hanneman, Manuela, Gilbert, Alois, Catherine, Shamir), a level
  that gained 0 or 1 points gets the rest up to 2, one each to the stats that missed (growth 1 or more) by the least. Caps: the
  person's own (HP at most 199, others 99), and a Saint Statue at level 9 adds 5 to two of them (`0x3f32b0`; fixed_shopdata section
  5). Mov never grows. EXP per level: growthdata section 5; Lv 99 the top.
- **Shown stats** (`0xb0240`): the unit's own + the class's boosts, + the mount's while mounted and riding; held at 0-99 (Mov 1-19).
  A boost can go past the maximum. Max HP adds the class's HP boost.
- **Class bases** (`0x412fa0`): own = max(own, the class's base), for good, on passing an exam and on every class change (and after
  a join's averaging); nothing lowers them again.
- **Joining partway** (`0x3d0dc0`, `0x3d4260`): the level is the chapter's battle's (fixed_flow route table +0x1e, fixed_scenario
  +0x1c: 2k − 1 in Part I's Chapter k; Part II per route); the class is the recruitment record's early class from Lv 5, its late one
  from Lv 10 (both certified); the stats are the Lv 1 bases plus, for each, growth = the person's + the class's join growths
  (classdata +0x13 HP, +0x1e Str to Cha) + Aptitude, any non-zero total at least 5, Def and Res at most 60, times (level − 1) / 100
  rounded half up; held at the maximums; lifted to the class's bases. Fire Emblem Wiki's Hanneman recruited in Chapter 8 (Lv 15:
  32, 10, 19, 12, 9, 9, 7, 15, 11) matches exactly (`src/houses/__tests__/housesRules.test.ts`).
- **Story joins** (`0x3d7720`, at chapter changes; `0x3d91b0`, the time skip): Flayn after Chapter 6 (Lv 11); on Silver Snow,
  Catherine, Cyril and Shamir (not yet yours) at the Chapter 11 change (Lv 21) as Edelgard and Hubert leave (`0x3d8400`); Seteth on
  Silver Snow, or on Azure Moon and Verdant Wind with Flayn yours; Gilbert on Azure Moon (Lv 25, then his time-skip level); Jeritza
  on Crimson Flower with the Expansion Pass.
- **The time skip** (`0x3d91b0`): every person but Byleth gets section 3 +0 random level-ups (0 to 4); on Normal, anyone below 20
  is raised to 20. Ashe (Silver Snow, Verdant Wind) and Lorenz (Silver Snow, Azure Moon) leave if yours; Dimitri becomes a High
  Lord, Claude a Wyvern Master (Failnaught), Edelgard an Armored Lord (Aymr), with the bases applied.
- **Recruiting** (`0x2423c0`): a student's request (a flag a B support can bring) or Sylvain with a female Byleth passes at once;
  otherwise with s the support level with Byleth (0 none, 1 C, 2 C+, 3 B, 4 B+, 5 A; the lower of the points' level and the
  pair's top), need(v) = max(v − ⌊s·v·20/100⌋, 0) of Byleth's own stat (no boosts), of Byleth's rank (E 0 to S+ 11), and of Byleth's
  level for the staff. Serenes Forest's table agrees but one cell (Felix's Sword with a B+ support: D here, D+ there).
- **Class access** (`0x651160`, used by every class list): the class's gender (no exceptions: Hapi can't be a Dark Mage, Yuri a
  Gremory); the Lord only for persons 2-4; a class without an exam only once certified; the Dark Bishop needs the Dark Mage
  certified; the DLC classes the Expansion Pass. The Emperor, Great Lord and Barbarossa are certified by a ceremony (script
  command 2790) at the start of Crimson Flower's and Azure Moon's Chapter 16 and Verdant Wind's 17, with no level or seal;
  Enlightened One in Chapter 11; the Dancer for the White Heron Cup's winner only (`0x1ffaf0`); the Death Knight 91 is Jeritza's.
- **Certification exams** (`0x64e590`, the rate `0x633f60`): the exam needs the class not yet certified, the Thief first for the
  Trickster, the level (classdata section 2: 5/10/20/30, DLC 20), one exam a day (unit +0xdf bit 1), the seal, and a rate of at least
  30 (`0x1a274c8`). The rate: classdata section 1 +0 is the cost per rank short (40; 32 for the two-skill advanced classes and the
  DLC's; 20 Master), +4..+14 the ranks asked (0 none); each skill's shortfall is max(asked − the unit's rank, 0) in ranks (E 0 to S+
  11, each "+" a rank; EXP within a rank isn't read, and going past adds nothing); a beginner exam (tier 1, section 0 +0x45) takes the
  smallest, the others the sum; rate = round(100 − shortfall × cost + Luck / 2) held at 0-100, Luck the unit's own (+0x52, no class
  boost; the 50% at `0x1a271e4`). Tiers 0 and 6 have no rate (Noble, Commoner, Verrat). The roll (`0x64efa4`) is one LCG draw,
  ((S × 1103515245 + 12345) >> 16) % 100 from the day's seed (GameData +0x250d0) plus the class, tier and person, a pass at
  roll ≤ rate (so 65% passes on 66 of 100); the seed changes only with the day (`0x3de7b0`, unconfirmed), so a reload gives the same
  result. The seal is taken before the roll (`0x3d2440`, the convoy `0x40ce00`). Master exams also need professor level C (GameData
  +0x25623 bit 4, `0x3dca00`). The generator writes the cost as `exam.cost` and a beginner exam as `exam.anyOne`; the Classes tab's
  calculator works the rate out.
- **Who can be the Dancer**: the Cup is in Chapter 9 (the Ethereal Moon) on every route: each chapter's flow record (file 7) has a
  monastery script at +14, Chapter 9's is 39 everywhere, `LO00_09.bsi` (archive file 274), the only script with
  `ChooseForHeronCup` (command 2640), quest 24. It has an event group per candidate, each needing the person in the army and alive:
  persons 2-25 (the 24 students, the house leaders among them) and 27 (Flayn). Byleth, the staff and knights, Jeritza, Anna and the
  Ashen Wolves have none, and no DLC script has the command. No gender rule (the certification record's gender is 2). The winner
  (`0x1ffaf0`, stored per house) gets the Dancer certified (`0x3d2a10`), Sword Avo +20 (ability 56, `0x4124f0`) and Sword Dance (art
  76, `0x412420`). `0x3d2a10`'s other callers are the exams, the story ceremonies and Enlightened One: no seal, exam or other way.
  The generator writes the 25 as the Dancer's `who` and the two skills as its `alsoTeaches`.
- **Personal abilities' Part II forms** (`0x40e520`): persondata section 5 +0x14 is the first, +0x15 the second (255: none; only
  Byleth and the three house leaders have one). The second is used once GameData +0x2449f, the Part II flag, is 1, which the chapter
  change (`0x3d8980`, at `0x3d8eac`) sets for a battle whose fixed_scenario record has bit 6 at +0x24: scenarios 13-30 and 32-39, so
  from Chapter 13 on every route (Chapter 12, Crimson Flower's 31 too, is still Part I; the routes part there). Byleth's also follows
  bit 1 of the unit's +0xae, set by the Sothis fusion partway through Chapter 10 (movie 11: `0x54c36c` -> `0xa7b50`; kept by
  `0x415330`, set again at the end of scenario 11, `0x97510`): Byleth has Professor's Guidance+ for all of Chapter 11 on (Fire
  Emblem Wiki says after the time skip). With the spoiler block on, the app shows the second in place of the first from 11 and 13.
- **Abilities that come in levels** (fixed_skill.bin section 0 +3, the upgrade group; 255 none): learning one (`0x4124f0`, the only
  reader) keeps the highest of its group the unit has learned, takes every lower one out of the equipped slots (+0x7f..+0x83) and
  clears its learned bit; a lower one learned later is dropped at once. Groups 0-7 are Sword/Lance/Axe/Bow/Brawling Prowess, Reason,
  Faith and Authority Lv 1-5; 9 Bowrange +1/+2 and 10 White Magic Heal +5/+10 (class abilities, never learned, so never replaced);
  11 Weight -3/-5; 13 Alert Stance/+. Groups 8 (the Lineages and Paragon) and 12 (Mastermind, Discipline) hold different abilities;
  the generator's chains split a group where the names' stems differ. The breakers and their "+" forms, the Magic Range and Uses
  abilities are in no group: both stay.

## Spells (fixed_data.bin section 1, the Spells tab)

38 x 24, the weapons' layout: +4 what it does (0 an attack, 1 heals an ally, 2 heals allies around, 5 hits around the target, 6 drains,
7 Torch, 8 Restore, 9 Ward, 10 Silence, 11 Rescue, 12 Warp, 13 the whole map), +5 its kind (5 black magic, 6 white, 7 dark: the names the
Uses and Range abilities use), +7 max range (100 or more: worked out from Mag, as the help text says; Quake's 130 the whole map), +10 min
range, +11 uses, +12 the status it inflicts (0x60 none), +14 effective against (the class-type bits), +16 Mt (a healing spell's heal),
+17 Hit, +18 Crit, +19 Wt, +22 the weapons' flags (0x10 no follow-up, 0x04 leaves 1 HP, 0x08 not fliers). Each unit's own spells are
persondata section 4. Classdata +83/+84 name two spells per class (a Mage's Fire, a Bishop's Physic and Abraxas): what foes of the class
carry, unconfirmed; a unit isn't given them.

## Tea parties, gifts and lost items (the Affection tab)

- **Favorite teas** (fixed_lobby_common.bin section 10, 101 x 10): u16 person, four bytes not traced, +6..+9 the teas (materials
  192-212, text 5056 + material; 255 none). A tea's grade is fixed_materialdata.bin section 0 +8 (1-4; the Hresvelg Blend and Leicester
  Cortania 4).
- **Topics** (section 13, 150 x 43): a row per topic (0-99 the general ones, text 14781 + row, 66 named; 100-149 the personal ones, text
  14881 + row - 100, one person's each), a byte per character slot - 2 (no Byleth), 1 where they like it. The tea party (`0x238650`, the
  lookups `0x406af0` and `0x406a50`) counts a liked topic and plays the lively reaction; any other draws "They don't seem very interested
  in this topic..." (an Intuition, event flag 0xbd, lets a miss be taken back once). Section 12, the same layout, only starts a 90-frame
  expression (`0x238814` -> `0x4069e0`, the timer at +0x50): not counted.
- **The final lines** (section 11, 392 x 14): u16 person, u8 the set (Constance's second, 1, her other self's), u8 a code, then a byte
  per reaction (text 14931: Nod, Laugh, Commend, Disagree, Admonish, Sigh, Chat, Sip tea, Blush, Praise), 1 where it's right
  (`0x4066d0` looks one up by person and code). A person's k-th record of a set is their k-th final line, scrdata table 0 block 45 + k:
  27 of 27 against the guides' (Edelgard, Dimitri, Seteth). Which of Constance's sets a tea party uses isn't traced.
- **The lines' text** (archive file 1, scrdata.bin): a section per language (1 US English), each 8 Koei XL tables of several columns
  (`fe16_data.xl_rows`). Table 0 is the monastery's lines: blocks of 100 rows, a row per character slot; column 0 the line (1 to a
  female Byleth where it differs: no final line does), 3 the voice. Blocks 37-41 the greetings and the tea, 42-44 the looks, 45-53 the
  final lines, 54 the goodbye, 58/59 a lost item taken or not. The DLC characters' are the update's added file
  `/patch4/common/common/scrdataDLC.bin` (INFO1 entry 3682; `fe16_extract.py --added` copies it): its table 0 in blocks of 10 rows
  (person - 1040; row 7 is a Rhea), columns 0-3 the line and the second set's (2).
- **Gifts and lost items** (fixed_presentdata.bin): section 0 (245 x 12), by key item (names text 10142 + n, descriptions 255 on): u16
  its price, +4 its rank (0-4), +5 a quest's item, +6 a flower, +7 everyone likes it (the Owl Feather), +8 a lost item. Section 1
  (45 x 17), by slot: +0 the flower they like, +1..+3 their lost items (the Ashen Wolves two), +4..+6 the gifts they dislike, +7..+11
  the ones they like, +12..+16 the quest items they take. Giving an item (`0x209a30`): a lost item draws their 'mine' line if it's
  theirs (`0x3dd6c0`); a liked gift, the Owl Feather or their flower the liked line (`0x4088b0`); a disliked one the disliked line
  (`0x4089f0`, never for the Owl Feather); anything else the plain one. How many support points each gives isn't traced.

## Checked against Serenes Forest and Fire Emblem Wiki

Every unit's bases, growths and maximums, and every class's bases, growths, boosts and mount bonus, match Serenes Forest
(`src/data/fe16/__tests__/fe16Units.test.ts`); so do the ranks, strengths, budding talents, learnsets, recruitment requirements and
crests (1,863 values in the research pass), and every support conversation matches Fire Emblem Wiki's support pages (501 pair views).
Where the game differs: the Valkyrie's mount gives Def +1 (Serenes: Res +1) and its third class ability is Dark Magic Range +1; Hapi
starts with Lance E+ (Serenes: Sword); Claude's Riding is a strength; Balthus learns Seraphim at Faith C and Restore at B (Serenes:
B and A); Ingrid learns Hit and Run at Lance C+ (Serenes: C); Shamir's recruitment opens in Chapter 5 on every route (Serenes: 6);
Jeritza's personal ability is Murderous Intent, and he learns Mastermind at Sword E+.

## Unconfirmed

- The chapter Seteth's join counts its level from (Serenes Forest: 12), and whether the chapter variable during a month is that
  month's chapter (Hanneman's and Gilbert's numbers say so).
- What ends recruiting after Part I; the odds of a student's request at B; the Ashen Wolves', Anna's and Jeritza's flags.
- Which saint each statue is; what clears the riding bit; Ashe's and Lorenz's levels when they come back.
- The support flag at +6, the value at +8, bit 10; the budding talent's parameter; the classes at section 3 +31..+33.

## Portraits (`scripts/fe16_portraits.py`)

For the user's own copy of the art only: the PNGs go to `data-raw/fe16/art/` (git-ignored) and are loaded through Bulk Upload. Read
straight from the NSPs (the files aren't copied into `romfs/`). Each unit's portrait is its Part I card: the 512x512 bust from
`nx/ui/still`.

- **Files:** the program's still loader (`0x69f000`) loads 22 still files: slot 1 is archive file 6127 (face_school_card: 39
  entries, persons 0-37 and a silhouette), slot 19 the update's `/patch4/nx/ui/still/face_school_card_DLC.bin` (file 31524, INFO1
  entry 364; 7 entries). Slots 2 / 20 are the Part II cards (6128, `face_war_card_DLC.bin`); 3 / 21 the 256x256 battle faces
  (6125, `face_btl_l_cmn_DLC.bin`); 4 / 18 the expressions (6126, `face_school_normal_DLC.bin`).
- **Which card** (`0x69fd60`, `0x3e6450`): a person below 1040 is its own number in the base file; persons 1040-1046 go to the DLC
  file at person − 1040, one less from 1044 on (Aelfric has none): Yuri 0, Balthus 1, Constance 2, Hapi 3, Jeritza 4, Anna 5. Entry
  6 is Constance's shade look, used only under a flag (the default, 2, is written). Byleth is persons 0 (male) and 1 (female).
- **Format:** a still file is u32 count, then (u32 offset, u32 size) per entry; each entry is Koei's chunked zlib around a G1T
  (`scripts/g1t.py`) holding one 512x512 BC3 texture, stored linear (not block-linear swizzled), decoded with texture2ddecoder.
- **Run:** `python scripts/fe16_portraits.py` (41 portraits, scaled to 256x256; `--sheet <png>` for a labelled contact sheet).
  Needs `pip install texture2ddecoder` (it comes with UnityPy).

## Ability and combat art icons (`scripts/fe16_icons.py`)

The same way: PNGs to `data-raw/fe16/art/skills/` (git-ignored), straight from the NSPs. No data file says where an icon is; the
1.2.0 program (the update's `main` NSO) does, and the script checks the instruction words it rests on before reading.

- **Sprites:** a UI sprite id names a 16-byte record: u16 texture, u16 index, u16 x, y, w, h, u16 the texture's w, h. The id's
  range picks the bank (`0x5c5540`): 0-725 bank 0, from 31572 bank 9; their records are at the pointers `main.bin` keeps at
  `0x1ab0b78` (bank 0 at `0xd52d64`, 725 records; bank 9 at `0x11991c4`, 75).
- **Textures:** bank 0's are archive file 6026 + the language (`0x69b010`; 6027 US English, which differs from the Japanese 6026
  only in sprites 464-467, none of them icons), a G1T of 15 BC3 textures; bank 9's the update's
  `/patch4/nx/ui/700_patch/700_patch.g1t.gz` (file 31503, INFO1 entry 343). BC3, stored linear, one mip.
- **An ability** (`0x5d9160`): `fixed_skill.bin` section 0 +8 is its icon number i; the sprite is 146 + i below 238 (bank 0's
  texture 2, the 2048x2048 icon sheet, 96x96 cells) and 31335 + i from 238 on (bank 9's texture 1: the DLC's abilities). Several
  abilities share one (seven personal abilities use Hunter's Boon's). Ability 0xF0, a "TBD", gets 146 whatever its record says.
  Six abilities, the two "On Hold" ones and four monster abilities, point at the sheet's empty-slot tile; it's written for them,
  as the game would draw it (no unit or class has them).
- **A combat art** (`0x5d8fe0`): `fixed_data.bin` section 7 +13, its weapon bits. One weapon gives sprite 548 + the weapon (sword,
  lance, axe, bow, gauntlets), several (Swap, Shove, Smite and the other arts any weapon can use) 546, a star: every art of a
  weapon has that weapon's round red icon, as the game shows it.
- **Spells** have no icon of their own (their +13 is 255): none is written, and the screens show them without one.
- **Names:** the unit's-name rule with each "+" spelled out (`src/tellius/art.ts` `skillIconId`), as the game has both Alert
  Stance and Alert Stance+ (and Swordbreaker+, the Lineage+ abilities, Professor's Guidance+), each with its own icon:
  `alert_stance_plus.png`, `hp_plus5.png`.
- **Run:** `python scripts/fe16_icons.py` (331: the 251 named abilities and 80 combat arts, at their native 96x96; `--sheet <png>`
  for a contact sheet).
