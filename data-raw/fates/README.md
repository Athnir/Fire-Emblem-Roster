# Fire Emblem Fates (FE14): what the unit data checks against

Fates keeps its hand-entered Serenes Forest data (`src/data/characters.ts`, `classes.ts`, `supports.ts`). Two things are checked
against the game itself:

- **The class sets:** read from `GameData.bin` in the romfs the Fire Emblem Armory extracted from the user's own Birthright
  cartridge (`../Fates Armory/data-raw/fates/romfs`; `FATES_ROMFS` overrides the path) by `scripts/build-fates-class-sets.py`,
  which writes the test fixture `src/data/__tests__/fatesGameClassSets.ts`.
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
| +0x74, +0x76 | the class set's other two classes; children have none |

Nine units have a third class: Gunter, Flora, Shura, Izana, Reina, Scarlet, Yukimura, Fuga and Anna.

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

The app follows this in `offeredClasses`, `parentContribution` and `getSealReclassClass` (`src/logic/classResolution.ts`) and
`inheritClasses` (`src/logic/childCalculator.ts`).

## Where the wikis differ from the program

- **Which parent gives way.** Serenes Forest's class-sets page says the variable parent gives way when both parents would give
  the same class; the program has the mother give way, as Fire Emblem Wiki's Inheritance page says.
- **Nina (Niles × Nyx).** Serenes Forest says Archer; the program gives Diviner, the parallel of Nyx's default class.
- **The last fallback step.** Neither wiki has the second class's parallel:
  - Shigure × Jakob: Azura gives Wyvern Rider.
  - A male Kana whose father takes the Talent: Corrin gives the Talent's parallel.
- **What a seal checks.** Serenes Forest's class-changing page has it right: a seal only checks the receiver's first class. So a
  seal can lend a class the receiver already has (Kaze's Friendship Seal with Saizo gives Samurai).
