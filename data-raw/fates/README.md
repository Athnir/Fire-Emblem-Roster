# Fire Emblem Fates (FE14): what the unit data checks against

Fates keeps its hand-entered Serenes Forest data (`src/data/characters.ts`, `classes.ts`, `supports.ts`). What's checked against
the game itself:

- **The class sets:** read from `GameData.bin` in the romfs the Fire Emblem Armory extracted from the user's own Birthright
  cartridge (`../Fates Armory/data-raw/fates/romfs`; `FATES_ROMFS` overrides the path) by `scripts/build-fates-class-sets.py`,
  which writes the test fixture `src/data/__tests__/fatesGameClassSets.ts`.
- **Joins:** every unit's join level, class and stats on each route, the late recruits' scaling, the story level per chapter,
  where My Castle is skipped, and the base classes' promotions, by `scripts/build-fates-joins.py` into
  `src/data/__tests__/fatesGameJoins.ts`. The romfs holds the Conquest and Revelation route DLC too.
- **Class inheritance and the Partner and Friendship Seals:** read in the program, a memory dump of the running game taken with
  Azahar in an Armory session (`code_trim.bin`, loaded at 0x100000). The addresses below are in that dump. Nothing from either
  is committed but what's derived here.

## GameData.bin

Records are counted from their ID pointer. Each has an 8-byte flag word just before it: bit N is the Nth `SPID_` name in the
file's string pool. Bit 0 `SPID_女性` female, 3 `SPID_上級職` promoted, 38 `SPID_継承禁止` (never passed on: Songstress only),
39 `SPID_支援継承禁止` (not passed by a support: Nohr Prince(ss), Kitsune, Wolfskin, Villager).

**Classes:** 128 bytes from the JID pointer. Each class has a male and a female record.

| Offset | Field |
| --- | --- |
| +0x08 | name label (MJID_) |
| +0x10 | class number |
| +0x14 | bases |
| +0x1c | growths |
| +0x2c | maximums |
| +0x5c | the two promotions |
| +0x60 | the class a promoted one comes from |
| +0x68 | the other-gender counterpart (Monk M ↔ Shrine Maiden F; Songstress has none) |
| +0x6a | the parallel class |

The parallel classes are Serenes Forest's table exactly, Kitsune → Apothecary and Wolfskin → Outlaw included
(`PARALLEL_CLASS_TABLE` in `src/data/types.ts`).

**People:** 152 bytes from the PID pointer.

| Offset | Field |
| --- | --- |
| +0x0c | name label (MPID_) |
| +0x22 | a child's fixed parent (their person number) |
| +0x24 | the class |
| +0x26 | the other class: the default is whichever is a base class (0x53e1b0) |
| +0x2a | the join level |
| +0x2d | for units who join late: the story level past which each one adds a level on joining (0x3d396c). The children 10; Izana and Flora 28, Fuga and Yukimura 33; Felicia and Jakob 5, but they join in Chapter 2, at story level 1 |
| +0x30 | their own (personal) stats; the class's bases are added |
| +0x38 | the growths |
| +0x40 | the cap modifiers (HP first, always 0) |
| +0x6c | the personal skill (three copies) |
| +0x74, +0x76 | the class set's other two classes; children have none |

Flag bits 23 `SPID_マムクート` (dragon: the Avatars and Kana) and 24 `SPID_ラグズ` (beast: Kaden, Keaton, Selkie, Velouria) are only
on these people's records, never on a class.

**Skills:** 32 bytes from the SEID pointer (the program's skill objects start there too).

| Offset | Field |
| --- | --- |
| +0x04 | name label (MSEID_) |
| +0x10 | skill number |
| +0x19 | whether a child can inherit it: 0 yes (117 skills); 1 never (Inspiring Song alone); 2 only a dragon-flagged child (no skill uses it); 3 only a beast-flagged child (Beastbane); 4 never (110: personal, DLC and Amiibo skills) |
| +0x1a | the price at other castles |

Nine units have a third class: Gunter, Flora, Shura, Izana, Reina, Scarlet, Yukimura, Fuga and Anna.

**Chapters:** 28 bytes from the CID pointer; +0x12 is the chapter's story level. The prologue is chapter 0 and the endgame 28.

## Other files

- **`Person/A_HANDOVER.bin`, `B_HANDOVER.bin`, `C_HANDOVER.bin`:** person records (the GameData layout, `PID_A_`, `PID_B_` and
  `PID_C_` names) for the units who join Birthright, Conquest or Revelation at another level than their GameData record. A route
  without one uses the GameData record: Fire Emblem Wiki's Revelation Gunter (Lv 3) is the GameData record, his Conquest one (Lv
  10) is `PID_B_`. Revelation has the most (Silas joins it at Lv 18, Hinoka at Lv 17); the app keeps them in `baseStatsByRoute`.
- **`castle/castle_join.bin`:** the My Castle recruits and the chapter after which each route has them: Izana after Birthright 18 and
  Conquest 22, Fuga after Revelation 18, Yukimura after Birthright 22, Flora after Conquest 18 and Revelation 22 (and Felicia and
  Jakob after 15 on every route, a case the app doesn't model).
- **Anna's map (`dlc/00000074`, E032):** the Anna on the map is an NPC record of her own, `PID_E032_アンナ`, with 5 more HP and
  Defense and a late-join level of 10, so she catches up to the story like the children (promoted Lv 18 at Ch27). The Anna who
  joins is placed from the map's `Support` group at the end: `PID_アンナ`, her GameData record, Lv 10 with no catch-up, as Fire
  Emblem Wiki has her.
- **The chapter scripts:** a chapter whose script calls `ev::ChapterSetSkipChapterSaveCastle` goes on to the next without a My
  Castle visit: Chapter 27 on every route (straight into the endgame) and Revelation's Chapter 16.

## The program

In the program, each record starts at its flag word, so the offsets are 8 more than above.

- **A child's parents (0x3d396c, unit set-up).** The child keeps two parent slots: their fixed parent (person +0x22) and that
  parent's S-rank partner. The father always goes in the first slot: the two swap when the fixed parent is female (0x533950
  tests `SPID_女性`), so Shigure and male Kana are no exception.
- **The Heart Seal list (0x21a900).**
  - A bond unit (`SPID_絆`) uses its stored set.
  - The Avatar (`SPID_プレイヤー`) gets Nohr Prince(ss) and their Talent.
  - Anyone else gets their default class and their two other classes.
  - A child then adds one class per parent slot, the first slot first, so when both parents would give the same class, the
    mother gives way.
- **What a parent gives (0x3c5c48).** The parent tries these in order:
  1. their default class;
  2. their second class;
  3. for a second-generation parent, the class their own fixed parent gives them;
  4. the default's parallel class;
  5. the second class's parallel class.

  The Avatar as a parent (in 0x21a900), and the Avatar or Kana as a seal partner (0x3c5dd8), tries Nohr Prince(ss), then the
  Talent, then the Talent's parallel.
- **Whether a class fits (0x3c5a0c).**
  - It's turned into the receiver's gender first, through +0x68; a class with no counterpart doesn't fit.
  - It can't be the receiver's default class, a class already in the list, a promoted class, or `SPID_継承禁止`.
  - In seal mode it can't be `SPID_支援継承禁止` either.
- **The seals.** The Partner Seal (0x21a62c) and the Friendship Seal (0x21a284) run 0x3c5c48 in seal mode with no list, so only
  the receiver's default class counts.
  - The Friendship Seal never takes the Avatar as the partner.
  - The Avatar's own Friendship Seal takes every same-gender partner at A rank.
- **Growths (0x5330cc).** A unit's growth is their personal growth, plus their class's, plus 10 with Aptitude. For a child,
  the personal part is the child's and the variable parent's added and halved, rounding down, before the class's is added.
  The variable parent is the slot whose gender isn't the fixed parent's (0x53b6e4). A second-generation variable parent counts
  as their own and their variable parent's personal growths added and halved, rounding down too (0x53b758).
- **The story level (0x1b72f0).** Playing a chapter raises it to the chapter's +0x12. A unit with a late-join level (person
  +0x2d) gains a level per story level past it when they join (0x3d396c); a child stops at their class's top level and the rest go
  through their promotion. The last chance to recruit is before Chapter 27, at story level 38: promoted Lv 18 for a child, Lv 15
  for the late recruits.
- **Levelling on joining (0x3d7164).** Each level adds the unit's full growth (0x5330cc, the class's included) to a running sum per
  stat; at the end the sum is divided by 100, rounding half up, and added under the caps.
- **Recruiting a child (0x3d44a8 calls 0x3d8718).** In this order:
  1. The base stats. C is the child's personal stat after the levelling. Each parent's personal stat less C is floored at 0;
     the two are summed and divided by 4, rounding down, and capped at C/10 (rounded down) + 2.
  2. One skill from each parent, the father's first (0x3d69c0). From the lowest equipped slot up, the child takes the first skill
     that can pass (+0x19) and that they don't already know; at most three known ones are skipped.
  3. The parents' dragon, beast and Dragon Vein flags are copied to the child. This comes after the skills, so a beast flag from a
     parent never counts for Beastbane: Shigure or Kana with Kaden or Keaton as father can't inherit it.
- **Stat caps (0x533808).** The cap is the class maximum, plus the person's modifier, plus for a child 0x53bddc, plus the
  Avatar's boon and bane, plus the unit's own bonus, held between 0 and 99. 0x53bddc gives a child the father's modifiers plus the
  mother's, each with the Avatar's boon and bane rows when the parent is the Avatar. A second-generation parent counts as their
  own parents' modifiers, without their +1. Then it adds 1 to every stat but HP.

The app follows this in `offeredClasses`, `parentContribution` and `getSealReclassClass` (`src/logic/classResolution.ts`),
`inheritClasses` (`src/logic/childCalculator.ts`), `computeGrowthRate` and `computeBaseStat` (`src/logic/statCalculator.ts`;
the base stats keep the user's low estimate, so the levelling there uses the personal growth alone), the story level and recruit
chapters in `src/data/childLeveling.ts`, and `lateRecruitJoin` (`src/logic/lateRecruit.ts`).

## Where the wikis differ from the program

- **Which parent gives way.** Serenes Forest's class-sets page says the variable parent gives way when both parents would give
  the same class; the program has the mother give way, as Fire Emblem Wiki's Inheritance page says.
- **Nina (Niles × Nyx).** Serenes Forest says Archer; the program gives Diviner, the parallel of Nyx's default class.
- **The last fallback step.** Neither wiki has the second class's parallel:
  - Shigure × Jakob: Azura gives Wyvern Rider.
  - A male Kana whose father takes the Talent: Corrin gives the Talent's parallel.
- **What a seal checks.** Serenes Forest's class-changing page has it right: a seal only checks the receiver's first class. So a
  seal can lend a class the receiver already has (Kaze's Friendship Seal with Saizo gives Samurai).
- **Kana's +1.** Serenes Forest gives a second-generation parent their +1 and Kana none; the program does the reverse. Either way
  Kana gets one +1.
- **HP.** Neither wiki says so, but a child's +1 skips HP, so a child's HP cap is the class's.
- **Skills.** Fire Emblem Wiki is right that Inspiring Song and DLC skills never pass, and so do personal skills. Beastbane passes
  only to Selkie and Velouria, whose own records have the beast flag.
