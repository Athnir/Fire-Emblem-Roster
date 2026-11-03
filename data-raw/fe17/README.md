# Fire Emblem Engage (FE17): the unit data's formats

Read from the user's own dumps in `Documents\FE Games\Switch dumps\NSP` (nxdumptool; keys in `~/.switch`, never in the repo): the
digital base game (`[0100A6301214E000][v0][BASE]`) and the 2.0.0 update (`[0100A6301214E800][v327680][UPD]`), whose RomFS is a
patch (BKTR) over the base game's; the Expansion Pass's content is in the update, the two DLC packages only its licences.
`scripts/fe17_extract.py` (the Armory's, copied, with `scripts/switch_nsp.py` and `scripts/unity_bundle.py`) copies the tables,
text, Lua scripts and the program into `Documents\FE Games\Switch dumps\extracted\fe17\romfs` (`FE17_ROMFS`); nothing from the dump
is committed. `scripts/fe17_units.py` reads them (`scripts/fe17_data.py`: the XML books and the MSBT text) and
`scripts/build-fe17-units.py` writes `src/data/fe17/fe17Units.ts`. The Armory's `data-raw/fe17/README.md` covers the containers,
items, maps, battles and what supports give.

Field names are the game's own (the tables name their fields; the program's metadata names its types and methods). Addresses are
offsets in the update's program (`main.bin`, IL2CPP; `global-metadata.dat` names them).

## 1. Formats

- **person.xml 個人** (1523 rows, App.PersonData): Pid, Name, Help; Jid; Gender 1 M 2 F; Age, BirthMonth, BirthDay, Hometown
  (1 Lythos, 2 Firene, 3 Brodia, 4 Elusia, 5 Solm, 6 Gradlon); Level (join level; placement rows have 0); InternalLevel (0 = the
  class's: base 0, advanced 20); OffsetN/H/L.* (added to class bases; identical on all three for every playable unit); Limit.* (cap
  modifiers); Grow.*; AutoGrowOffsetN/H/L (enemies); Aptitude (innate proficiency bits: 1 Sword, 2 Lance, 3 Axe, 4 Bow, 5 Knife,
  6 Tome, 7 Staff, 8 Arts, 9 Special); SubAptitude; SupportCategory (Default, Balanced, Hit, Crit, Avoid, Dodge); SkillPoint;
  CommonSids (personal skills + hidden ones); Normal/Hard/LunaticSids (enemy only); Flag (1 CandidateForFriend; 32 DressReverse);
  ExistDieCid/ExistDieTiming (protection); Attrs (16 Dragon: Alear, Zelestia; 32 Fell Dragon: Veyle, Nel, Rafal). The roster = the
  support table's 41 rows (Flag & 1, less Nel's and Rafal's dragon-form persons). Story-only persons: Prologue Alear
  (PID_M000_リュール, Lv 20, JID_M000_神竜ノ子); Fell Xenologue copies (PID_E00n_<name>, kept as other_versions); "Nil" (not playable).
- **job.xml 兵種** (111 rows) and 戦闘スタイル: Rank 0 base, 1 advanced; MaxLevel 20 or 40 (special); InternalLevel; Flag (1 CanCC,
  2 AnyoneCC, 4 FemaleOnly, 8 EncountMap; without AnyoneCC only the person whose default class it is, or promotes to it); MoveType
  (1 Foot, 2 Horse, 3 Fly, 4 Dragon); StyleName; Weapon<Kind> (1 always, 2 choose 1, 3 choose 2); MaxWeaponLevel<Kind> (D-S; a
  trailing + = one rank higher with innate proficiency); Base.*, Limit.*; DiffGrow.* (player growth modifiers); BaseGrow.*
  (generic enemies); DiffGrowNormal/Hard/Lunatic (auto-levelled enemies); HighJob1/2; LowJob; Skills (Unlock, Dance, Dragonstone,
  Enchant, Bullets); LearningSkill (class level 5, or 25 in a 40-level class); LunaticSkill; UniqueItems.
- **skill.xml スキル** (1255 rows): Name, Help; Priority (skill groups); InheritanceCost (SP); EnhanceValue.* (flat stat bonus
  while held: the sync stat bonuses are skills like SID_力＋１); Work/WorkOperation/WorkValue (2 JobGrowChange: Jean's Expertise
  doubles class growths; 3 TotalGrowChange: Tiki's Starsphere +15 to all growths); EngageSid; ChangeSids; SyncConditions/SyncSids;
  RootCommandSid (JSON keeps these as `variants`).
- **god.xml 神将**: Gid, Mid; Change (switch partners); Gbid (shared bond: Robin uses Chrom's); GrowTable; EngageAttack;
  EngageAttackLink + LinkGid; EngageCount 7 (Robin 9); LevelCap 11 base rings, 99 bracelets (UnlockLevelCapVarName); Flag (2
  EnableRingList, 16 OnlyEngageWeapon (Tiki), 32 Armlet); Link (Emblem Alear <-> PID_リュール); SynchroEnhance.* 0. **成長表**: 20
  rows per emblem: InheritanceSkills, SynchroSkills, EngageSkills, engage weapons by style; Aptitude (proficiency granted);
  AptitudeCost* 100 (no reader); Flag 1 UnlockSkillInheritance at bond 5, 2 AddEngageTurnLimit at 11, 4 SubEngageCountLimit at 20.
  **絆レベル**: bond EXP; conversations at C 5, B 10, A 20.
- **reliance.xml 支援関係**: a row per unit, ExpType0..41 = partners in row order (36-40 Nel, Rafal, Zelestia, Gregory, Madeline);
  n > 0 = the pair supports with pattern n; lower-triangular, symmetric. **必要経験値**: REXID_パターンn, cumulative C/B/A points.
  **支援効果**: what supports give (the Armory's).
- **ring.xml 指輪** (487): Rnid (RNID_<series>_<hero>_<rank>), Gid (10 heroes per base emblem + 3 DLC rings: Alfonse, Sharena,
  Anna), Rank 0 C .. 3 S, Enhance.*, EquipSids, IsSingleRank.
- **item.xml**: UseType 21 GrowUp (boosters, Enhance.*), 23 Master Seal, 24 Second Seal, 40 Mystic Satchel, 41 Mage Cannon, 42 SP
  books.
- dispos Force 0 player, 1 enemy, 2 green; scripts: UnitJoin; <map>_kizuna.lua post-battle; hub_* the Somniel; calculator.xml
  内部レベル計算; params.xml engage meter 7, turns 3.

## 2. Mechanics (main.bin, IL2CPP; file offsets)

- **2.1 Stored vs shown**: a unit stores offsets relative to its class (Unit.m_BaseCapability +0x58). Shown
  (Unit.GetCapabilityImpl 0x1a5ba20) = min(max(stored + job.Base, 0), cap) + enhancements (sync stat skills, equipment, tonics,
  meals), clamped 0-255 (GetNoEnhanceCapability 0x1a30d10 without). Cap (GetCapabilityLimit 0x1a30a90) = clamp(job.Limit +
  person.Limit, 0, 255); enhancements can exceed it. A class change keeps the stored values: shown stats move by the class bases'
  difference; stats above an old cap reappear under a higher one.
- **2.2 Join stats** (Unit.Create 0x1a086e0 -> CreateImpl1 0x1a08740 -> AutoGrowCapability 0x1a0b1b0/0x1a0ded0 ->
  CalculateAutoGrowCapability 0x1a0e0a0): total = level + 19 in an advanced class (JobData.IsHigh 0x2055d10), else level; stored =
  person.Offset<difficulty> + GetRoundGrow(person.Grow * (total - 1)); GetRoundGrow (UnitUtil 0x1c759d0) = max((x + 50) / 100, 0);
  stored clamped -120..120 (Mov 0..2); class growths not used; shown = min(stored + class base, class cap + person cap modifier).
  PersonData.GetCapabilityOffset 0x1f264d0 picks N/H/L. Map joins (CreateFromDispos 0x1a08de0) use the placement level (0 -> the
  person's); off-map joins (UnitUtil.JoinUnit 0x1c738d0) the same. Internal level = person's, else the class's (CreateImpl2
  0x1a08b60). All 41 units match Serenes Forest exactly.
- **2.3 Growth at a level-up** (Unit.GetCapabilityGrow 0x1a2ff20): person.Grow + CalcWork(skills, class.DiffGrow, JobGrowChange)
  (Expertise x2) + the equipped item's GrowRatio (enemy weapons only); then CalcWork(skills, growth, TotalGrowChange) (Starsphere
  +15); clamped 0..255 (SkillArray.CalcWork 0x24891d0). No emblem, ring or difficulty term for players.
- **2.4 Level-up, EXP, SP**: Unit.LevelUp(n) 0x1a3a040 (LevelUp(2) from LevelUpSequnece.Prepare 0x1be1260). Rolls from new
  Random(m_GrowSeed) (xorshift128), seed replaced by its next value; IsProbability100(p) 0x23754b0 draws 0-99999, succeeds when
  p*1000 is greater. **Random mode** (GetGrowMode 0x2514f60 = 0): each of HP..Bld: +1 per full 100, then one roll at the
  remainder; each +1 only if the unenhanced stat is below the cap; **fewer than 2 increases -> the whole level-up is re-rolled, up
  to 4 tries (LevelUpRetryMax 4, GrowAbortCount 2); the try with the most increases is kept.** **Fixed mode**: accumulators
  (m_GrowCapability +0x60) start at the person's growths (CreateImpl1); each level adds the growth; at 100+ the stat +1 and 100 off;
  a capped stat neither rises nor accumulates. EXP (AddExp 0x1a39d40) 100 a level; 0 at max level. SP (ExpToSkillPoint
  0x1a39fe0) = EXP with an emblem equipped, EXP/2 with a bond ring, else 0; cap 9999 (AddSkillPoint 0x1a39db0).
- **2.5 Class skills**: learned at level 5, or 25 when MaxLevel > 39 (Thief, Dancer, the Fell Childs, Melusine)
  (JobData.GetLearnJobSkillLevel 0x2056ca0; Unit.LearnJobSkill 0x1a3c290/0x1a3c3b0, on joining too); ClassChange clears
  m_LearnedJobSkill when the class differs (0x1a3cbc4); re-entering the same class keeps it.
- **2.6 Class change** (ClassChange.ChangeJobData.CCCheck 0x19c6700; GetSelectJobList 0x1ea1be0): who: AnyoneCC, or the unit's
  default class or a promotion of it; Fliers female only. Proficiency (Unit.CCCheckAptitude 0x1a3c5f0): every "always" weapon +
  1 (or 2) of the "choose" weapons; the Mage Cannoneer needs only GameUserData.CanCCGunner; the Enchanter CanCCEnchant + Knife and
  Arts. Level/item by the current class: base -> its promotions: Master Seal, Lv 10; base -> other base/special: Second Seal, any;
  base -> same: Second Seal, 20; advanced -> any other it may be: Second Seal, any; advanced -> same: 20; special -> base/special:
  any; special -> advanced: 21; special -> same: 40; base or special -> Enchanter/Mage Cannoneer: Mystic Satchel/Mage Cannon, 10;
  advanced -> those: any. Unit.ClassChange 0x1a3c7b0: level 1 (into a 40-level class: 21 when coming from an advanced class, or from
  a 40-level class at 21+); EXP 0; internal level (before the reset) clamp(IL + level - 1, 0, cap) (cap 30 Normal / 40 Hard / 50
  Maddening); when the new level is 21: max(IL - 20, 0); stored stats untouched; HP above the new max cut, then set to max
  (UnitGrowSequence.ClassChange 0x1f7f580); "choose" weapons re-picked (0x1a3cdf0). The item-menu route (GetJobList 0x1ea2310)
  lists nothing below Lv 10 for base classes with either seal; the wiki matches CCCheck (no level on the Second Seal).
- **2.7 Weapons and proficiencies**: a class's weapons = its "always" kinds + the chosen (0x20564f0, 0x2056300): Hero Sword + Lance
  or Axe; Paladin, General, Griffin Knight 1 of Sword/Lance/Axe; Great Knight, Wyvern Knight 2 of them. Max rank (0x2056c30) =
  the class's, +1 where marked + and the unit has innate proficiency (Unit.GetWeaponLevel 0x1a0c050); D-S, no E. At creation:
  innate | additional | the starting class's weapons (AddAptitudeFromWeaponMask 0x1a0bf10). After that from emblem bonds only:
  each bond level-up (GodLevelUpSequence.LeveUp 0x23341a0 -> Unit.InheritAptitude 0x1a3dd90) adds that level's Aptitude
  (GodUnit.GetAptitude 0x2342ee0).
- **2.8 Emblems**: bond 1-20; base rings stop at 10 until their paralogue sets G_<name>レベルキャップ解放 (common.lua, S003-S014);
  bracelets don't stop; conversations at 5, 10, 20; +1 for the Pact Ring partner (GodBond.GetMaxLevel 0x2b4db90: Emblem Alear's
  bond with them reaches 21). Synced: cumulative SynchroSkills (GodUnit.GetSyncroSkills 0x2342530); engaged (status 0x800000):
  EngagedSkills. Sync stat bonus = the stat skills' EnhanceValue; a group's higher skill replaces lower ones (SkillData.GroupAssign
  0x248d0c0: consecutive rows whose Priority rises by at most 50). Inheritance from bond 5 (GodUnit.CanInheritSkills 0x2341360), at
  InheritanceCost SP, 2 slots (Unit.EquipSkillMax). Engage meter 7, -1 at bond 20, -1 with Divine Spirit (0x1a57b90); engage turns
  3, +1 from bond 11 (0x1a57d60).
- **2.9 Supports and the Pact Ring**: the fifth level ("Ring", RelianceData.Level.APlus) is Alear and one partner only
  (HubUtil.CanPromiseEngage 0x2a5fdc0 via UnitPool.GetHero; UnitReliance.CanBeLevelAPlus 0x1c5ac10;
  LinkGodUnitCanBeRelianceLevelS 0x1c5ad60; GodBond.CanBeRelianceLevelS 0x2b4e700); needs GameUserData.IsRelianceAPlusPermit and no
  partner chosen; the permit is set at the end of Paralogue "The Connector" (S015, opens after Chapter 22: s015.lua Ending calls
  UnitReliancePermitAPlus()).
- **2.10 Stat boosters** (2500 G each): Seraph Robe HP +5, Energy Drop Str +2, Spirit Dust Mag +2, Secret Book Dex +2, Speedwing
  Spd +2, Goddess Icon Lck +2, Dracoshield Def +2, Talisman Res +2, Boots Mov +1. Usable only while the stat is below its cap
  (Unit.CanGrowUp 0x1a5d980); Mov while its stored bonus is under 2 (two Boots at most). The amount is added to the stored value
  (ItemUseImpl 0x1a4c690 -> AddBaseCapability 0x1a2a800): a +2 at cap - 1 stores one over the cap.
- **2.11 Permadeath protection** (Unit.IsExistDie 0x1a22540 -> GetDieType 0x1c78890 returns Exist): always Vander, Alfred,
  Diamant, Ivy, Timerra, Veyle; until Ch 3 ends Clanne, Framme; Ch 5 ends Céline; Ch 11 ends Alcryst; Ch 13 ends Fogado; Ch 16
  begins Hortensia; Ch 22 begins Mauvier.

## 3. Joins (UnitJoin calls; the reader asserts each site)

Alear Ch 1 (hero group; the Prologue's is a separate Lv 20 Alear); Vander Ch 1 (Ally group, Force 0); Clanne, Framme Ch 2 (green
in Ch 1, removed in the Marth event); Alfred, Etie, Boucheron Ch 3 (turn 2); Céline Ch 4 (turn-1 event); Louis, Chloé Ch 4 (green,
turn 1); Yunaka Ch 6; Alcryst, Citrinne, Lapis Ch 7; Diamant, Amber Ch 8; Jade Ch 9 (green; talk with Alear or Diamant, or after
the chapter if alive); Ivy, Kagetsu, Zelkov Ch 11 (mid-map event; MapEnding fallback); Fogado, Pandreo, Bunet Ch 12; Timerra,
Merrin, Panette Ch 13; Hortensia after Ch 14 (post-battle scene); Seadall Ch 15 (green; talk with Alear); Rosado, Goldmary Ch 16;
Lindon Ch 18 (enemy; talk with Alear, Ivy or Hortensia); Saphir Ch 19 (green; talk with Alear, Diamant or Alcryst, or after the
chapter if alive); Mauvier Ch 21; Veyle Ch 22; Jean Paralogue "Budding Talent" (after Ch 5; talk with Alear, or after the battle if
alive); Anna Paralogue "Mysterious Merchant" (after Ch 6; from the chest at (13,3): joins at once if Alear opened it, else talk with
Alear, or after the battle if alive); Nel, Rafal, Zelestia, Gregory, Madeline after Fell Xenologue 6 (in the Somniel,
HubSolanelEvilEnd). No choices or exclusions; no unit leaves and returns; Lindon the only recruitable enemy.

## 4. Emblems

Bond cap (paralogue) / engage attack / proficiency (bond level): Marth S014 Lodestar Rush, Sword 8; Sigurd S009 Override, Lance 6
Sword 9; Celica S013 Warp Ragnarok, Tome 6 Sword 9; Micaiah S011 Great Sacrifice, Staff 3 Knife 6 Tome 9; Roy S012 Blazing Lion,
Sword 6; Leif S010 Quadruple Hit, Axe 2 Bow 3 Knife 4 Staff 6 Lance 7 Sword 8; Lucina S003 All for One, Sword 6 Bow 8; Lyn S004 Astra
Storm, Bow 6 Sword 8; Ike S005 Great Aether, Axe 6 Sword 9; Byleth S006 Goddess Dance, Arts 6 Sword 9; Corrin S007 Torrential Roar,
Sword 6; Eirika/Ephraim S008 Twin Strike, Lance 6 Sword 9; Alear (no unlock variable) Dragon Blast, Sword 10 Arts 10;
Edelgard/Dimitri/Claude (EP) 20 Houses Unite, Axe 6 Lance 9 Bow 13; Tiki (EP) Divine Blessing, Arts 6; Hector (EP) Storm's Eye, Axe
6; Veronica (EP) Summon Hero, Staff 6 Tome 16; Soren (EP) Cataclysm, Knife 6 Staff 12 Tome 16; Camilla (EP) Dark Inferno, Axe 6 Tome
17; Chrom (EP; Robin shares the bond) Giga Levin Sword, Sword 6 Tome 16. Per bond level the JSON lists the new inheritable skills
with SP, new sync and engage skills (with forms and commands), the cumulative skills, the sync stat bonus, the proficiency granted,
new engage weapons by style, and the flags.

## 5. Cross-check (Serenes Forest; Fire Emblem Wiki on disputed points)

Checked: 41 units' bases, growths, cap modifiers, SP, gender, age, birthday, proficiencies; 42 personal skill rows; 36
recruitments; 462 directed support entries; 58-59 classes' bases, growth modifiers, caps, weapons, ranks and + marks, class and
Maddening skills; every emblem stat boost, skill, unlock and SP row (20 pages); the 9 boosters. All match but 61 lines: 46 Expansion
Pass units' supports (Serenes lists cumulative totals for them, increments elsewhere: same REXID data); 6 class skill levels of the
40-level classes (25, not 5: program 0x2056ca0; the wiki says 25 for Thief and Dancer); 4 Xenologue units' join proficiencies
(+ starting-class weapons: creation code 0x1a0bf10; unverified in game); Mage Cannoneer Mov 4 (Serenes 5; the wiki 4); Edelgard's
Assembly Gambit / Str/Dex +1 at bond 1 / 2 (Serenes 2 / 3; the wiki agrees with the game); Alear's recruitment Ch 1 (Serenes:
Prologue: a separate person); "Nil" not playable.

## Unconfirmed

1. Whether emblem-earned proficiencies survive a class change (Unit.ResetWeaponMask 0x1a0b9b0 resets to innate + additional, on a
   copy of the unit in UnitGrowSequence.ClassChange; where the copy replaces the unit wasn't found). Check in game.
2. The Xenologue units' starting-class proficiencies.
3. Whether the Pact Ring needs an A support (only the item text says so).
4. Bond ring Enhance stats assumed to be enhancements (past the cap, not stored).
5. AptitudeCost* (100) has no reader.
6. Second Seal on a base class below Lv 10: CCCheck allows it, the item menus (GetJobList) don't.
7. HP after a class change: set to max except under an unidentified flag test (0x1f7f6c0).
8. Ivy's group's join condition (Serenes: the turn after an ally is 6 squares from the end).
9. What DieType.Exist does in Classic.
10. Emblem Alear's bond cap (LevelCap 11, no unlock variable; Serenes lists 20/21).


## Portraits (`scripts/fe17_portraits.py`)

For the user's own copy of the art only: the PNGs go to `data-raw/fe17/art/` (git-ignored) and are loaded through Bulk Upload. Read
straight from the NSPs (the bundles aren't copied into `romfs/`).

- **Which art:** the status screen draws the units in 3D; the 2D art every unit has is the face the level-up shows: Addressables
  key `Telop/LevelUp/FaceThumb/<name>` (the catalog, `aa/catalog.bundle`), bundle `fe_assets_telop/levelup/facethumb/<name>.bundle`,
  where `<name>` is the person's Name label less `MPID_` (person.xml), which matches all 41 (Rafal is `Rafale`, though his
  UnitIconID is `049Il`). Alear's record is male (Gender 1): `Lueur`; the female look is `LueurW` (`--alear-female` writes it too).
- **Format:** one Texture2D, 640x340, ASTC 4x4, Tegra block-linear swizzled; read and decoded with UnityPy (texture2ddecoder).
- **Crop:** a square of the full height, centred on the opaque columns' middle, scaled to 256x256 (Lanczos on premultiplied alpha).
- **Other 2D art found, not used:** the unit list's 188x74 strips (`fe_assets_ui/common/unitlist/facethumb`), the Somniel
  notebook's photos (3D renders with backgrounds, `fe_assets_ui/hub/notebook/pictures`); the emblem room's faces are the bond-ring
  heroes'.
- **Run:** `python scripts/fe17_portraits.py` (41 portraits; `--sheet <png>` for a labelled contact sheet). Needs
  `pip install UnityPy`.
