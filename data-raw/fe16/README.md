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
