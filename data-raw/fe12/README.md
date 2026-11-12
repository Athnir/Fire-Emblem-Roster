# Fire Emblem: New Mystery of the Emblem (FE12): the unit data's formats

Read from the user's own cartridge image, `Fire Emblem - Shin Monshou no Nazo - Hikari to Kage no Eiyuu.nds` in `Documents\FE Games`
(Japanese, VI2J, DSi-enhanced, revision 1, no translation patch). `scripts/fe12_extract.py` copies `data/`, `dispos/`, `script/`, `m/`
(the Japanese text), `cpu/` and `pcmake/`, decompressed (LZ11 / LZ10), plus the ARM9 program (loaded at 0x02004000) and its 22
overlays, into `data-raw/fe12/rom/` (git-ignored, never committed). `scripts/fe12_data.py` reads the tables, `scripts/fe12_joins.py`
the joins, `scripts/fe12_names.py` the English names, `scripts/build-fe12-units.py` writes `src/data/fe12/fe12Units.ts`, and
`scripts/fe12_portraits.py` the portraits. The readers it shares with Shadow Dragon: `nds_rom.py`, `fe13_bin.py`, `fe11_portraits.py`.

## The dump

The cartridge image is `FIREEMBLEM12_VI2J01_01.nds`. An earlier dump of it (`Fire Emblem - Shin Monshou no Nazo - Hikari to Kage
no Eiyuu.nds`, since removed) had every byte of all 119 `script/*.cmb` files zeroed, and the small faces (`sf/`), the shop and shield
screens, parts of `sound/FE12_Sound.sdat` and of 6 battle animations: its DSi digest table (header +0x1f0: 0x5340800, an HMAC-SHA1 per
1 KB sector) gave 20,611 of its zero sectors values of their own. The joins were then built from the placements and the text, with
Serenes Forest's table for when each group comes and for the gaiden chapters' requirements. Every file read from the old dump is byte
for byte the same in this one, and the scripts are all there: the timings and requirements are read from them now (`fe12_joins.py`,
with `fe12_cmb.py`, the Armory's script reader with New Mystery's opcodes). Every timing from Serenes Forest's table matched the
scripts; its gaiden requirements left out each chapter's turn limit (and 20x's Binding Shield), and Prologue III's Norne turned out
never to be placed.

## Containers and text

`data/FE12Data.bin` is Awakening's container (`fe13_bin.Bin`); its labels name the tables, which the program loads by name into a
global table (arm9 0x2048d3c, the pointer at 0x21be658: +8 Person, +0xc Job, +0x10 Item ... +0x38 PCData, +0x4c CipherData, +0x50
FooterData: the counts, 403 people, 57 classes, 194 items). The text (`m/*`) is the same container, label -> Shift-JIS string; a
name is `MPID_<x>` (the face record's name label), a class `MJID_<x>`. A message names the faces it shows (`\x06\x08MATIS|`).

### Scrambled growths

Growth bytes are stored through a key and the 256-byte CipherData table (a permutation): the value is
`s8(Cipher[(stored - key) & 0xff])`, with

- a person (arm9 0x2049280; index = (record - table) / 92, 0x20491e4): `key = (((index ^ 0x3e) - 3 * stat) * 0x57) ^ 0xf5`;
- a class (0x2049418; index by / 80, 0x20493dc): `key = (((index ^ 0x9d) - 7 * stat) * 0xb3) ^ 0xdb`;
- an avatar answer (0x2049814; question 0-2, answer 0-4): `key = ((((5 * question + answer) ^ 0x7b) - 9 * stat) * 0xe1) ^ 0xb7`.

## People: Person, 92 bytes

+0 PID, +4 FID, +8 a generic's army name, +0x0c their own bases (HP, Str, Mag, Skl, Spd, Lck, Def, Res; signed, added to the
class's), +0x14 growths (scrambled), +0x1c a foe's extra growths on the Hard modes (scrambled; 0 for everyone who joins), +0x24 weapon
experience (sword, lance, axe, bow, tome, staff), +0x2c flags (0x01 a woman, 0x4000 the avatar), +0x30 five support slots of 8
bytes (below). Playable: indices 0-76 (PID_MARS to PID_ERICE); the extra chapters' casts (`PID_TR1_*`...) and the `_J` prologue
versions (PID_JEIGUN_J...) never join. Jagen isn't playable.

## Classes: Job, 80 bytes

+8 bases (signed), +0x10 growths added to the person's (scrambled), +0x18 a foe's Hard-mode growths, +0x20 caps, +0x28 its row of
TerrainCost, +0x29 Mov, +0x2c weapon experience (as the person's; 0 = can't use; a promoted class's 31 or 76 lifts the rank), +0x34 the
reclass set and tier (1 male A, 2 male B, 3 female, 4-6 their promoted classes, 0 none), +0x35 its column (the class line the
limits count, -1 none), +0x36 kinds (0x04 armour, 0x08 ballistician, 0x10 horseback, 0x20 flier, 0x40 manakete), +0x38 flags (u32:
0x01 a woman's class, 0x800 promoted, 0x80000000 no player has it: the male Pegasus Knight, the female Knight, Barbarian...), +0x3c the
class it promotes from, +0x40 the one it promotes to (pointers), +0x44 its description, +0x48 a generic's face.

## Stats, level-ups, promotion (arm9)

- A stat (0x204efa4 HP, 0x204f000 Str, 0x204f0ec Mag, ...): the person's base + the class's base + what the unit has gained (unit
  +0x50) + the avatar's answer bonuses (0x2028b04, for a unit with flag 0x4000), held at the class's cap; Str and the others show 0
  below 0. A Bond or potion's +2 for the chapter (unit +0x8d-+0x8f) and items' bonuses are added on top.
- A level-up (0x205092c): for each stat the person's growth + the class's (+ the avatar's answers, 0x2028b60), and 100 or more gives
  a point per 100; the rest is rolled once (0-99). A total of 0 or less gives nothing. There's **no catch-up bonus** (Shadow Dragon's
  running totals, FE11 0x203d6dc, are gone; the unit keeps no such totals). Each stat stops at the class's cap.
- A level gained in a battle of overlay 11 (the Training Grounds, `traning::`; the battle flag +0xaf 0x20, 0x2230160) uses 0x2050b08
  instead: the points of each 100 first, then the remainders' sum / 100 more points (plus one more on a 0-99 roll under the sum's last
  two digits), each going to a stat picked at random, weighted by its remainder, no stat twice.
- A unit with flag +0x94 0x400000 gets +20 HP / +10 other growths; only item use 0x18 sets it (moving it from whoever had it), and
  that use comes only from downloaded (online shop) item data (0x20499fc). Not planned.
- Max level (0x2049460): 20, or 30 for a class that isn't promoted and doesn't promote (Lord, Thief, Manakete, Dancer, Freelancer).
- Promotion (0x2050d7c): the class given, or the class's +0x40; Lv 1, experience 0. A promotion item (use 6) needs a class with +0x40
  and Lv 10 (0x2049ecc); the Elysian Whip (+0x28 bit 0x04) only the female Pegasus Knight (0x2049f08), and names the Falcoknight as
  the target (overlay 10 0x223b198), which sets unit +0x90 0x40000000.
- Weapon experience (0x204f7ec): the class's (if not 0) + the person's + the unit's gains (+0x74). Ranks (WeaponLevel): E 1, D 31, C
  76, B 136, A 196.

## Reclassing (overlay 10, the battle preparations: `sally::`)

- The menu (`MIS_JobSlide`) shows where the chapter's MapTable +0x18 has bit 0x08: from Chapter 1 (0x2232624).
- The list (0x223c6a8): every class whose +0x34 is the current class's. Once a game has been cleared on Hard or above (global flag 2,
  [0x21bd448]+0x6c, set at arm9 0x205b334 for difficulty 3+; the message MAFT_OPEN_BONUS3), any class with a set of the unit's gender
  and tier (+0x38 bits 0x01 and 0x800): for men, sets A and B together.
- The female promoted set's column 0: the Falcoknight only for a unit with +0x90 0x40000000, the Dracoknight only without (0x223c740).
- A full class line is refused: the army's units in each column (+0x35) are counted and must stay under the chapter's limit,
  MapTable +0x1c-+0x27 (0x223cb18). A unit with +0x94 0x40000 skips the check (what sets it is unconfirmed).
- Committing (0x223daa0) moves the count to the new column and sets the class; level and experience stay.

## Difficulty

The save's difficulty (+0x1a9) is Normal 0, Hard 3, Maniac 4, Lunatic 5 (and Lunatic' 5 with a flag) (overlay 15, the mode menu). A
placement can be gated (overlay 00 0x2205b5c, flags +0x2c): 0x10000 needs 2+, 0x400 Hard+, 0x800 Maniac+, 0x1000 Lunatic, 0x2000
below Hard, 0x4000 below Maniac, 0x8000 below Lunatic. Recruits on the foe's side have a pair of records (below Hard / Hard+) with the
same level, class and no preset gains, so their stats don't change with the mode; only foes flagged 0x10 / 0x100 get extra levels.

## Placements: dispos/, 88-byte records

Groups as Shadow Dragon's (name, records, count). +0 person, +2 class, +4 / +6 tiles, +8 army (0 yours, 1 the foe's), +9 level, +0xa
the Hard modes' level, +0xb (unit +0x84), +0xc flags OR'd into unit +0x90, +0x10 five items (u16 item, u16 flags: 0x01 dropped,
0x04-0x80 the difficulty gates above), +0x24 preset gains (signed, unit +0x50), +0x2c flags, +0x30 four AI names.
A record makes its unit (overlay 00 0x2205b5c) as follows: with 0x02 / 0x04 / 0x08 / 0x200 it only places an existing unit; else, for
your side, it reuses the person's unit from force 2 (set aside) if there is one, and with 0x80 (or on another army) creates it.

## Joins (`scripts/fe12_joins.py`)

- A playable person placed on your side with 0x80 joins there, when the handler of the chapter's scripts that places the group runs
  (`group_when`): the map's begin or opening, or its first turn's player phase (the start), a later turn's handler (that turn), the
  Ending (after the battle), a village of its terrain script (a visit; its message shows Marth). A group no handler places never joins.
- A talk (`MSnnn_TKn`) showing a person placed on the foe's side recruits them, the other faces (who have joined by then) being the
  talkers (each matches a talk handler of the chapter's script, type 0x08).
- The prologue (Prologue I-VIII, bmap201-208, every difficulty: each mode's menu starts bmap201) has three choices: the first
  answer at the end of Prologue III, V and VI plays the chapter's B version (MapTable bmap204B / 206B / 207B; the placements' B
  groups), so Athena, Draug or Cain joins instead of Gordin, Ogma or Est (Serenes Forest; the B groups say who). Units not in
  Chapter 1's deployment leave after Prologue VIII (their goodbyes are MS208_ED3_*) and come back where they're next created; Gordin
  and Draug are created by Chapter 1's deployment whichever answer was picked.
- Excluded as a scene: Nyna, Elice, Maria and Lena in Chapter 20's ending (its Ending places them as Gharnef takes them; the Endgame's
  talks recruit them). Prologue III's `m01` (Norne) is never placed by its script.
- The gaiden chapters' requirements (`gaiden`): each FlagSet of the chapter's gf_<n>ｘ分岐 flag at the end of the chapter before, under
  the checks just before it: cleared by a turn (GetTurn() <= GetNormalizeTurn(n), the turn scaled by the mode: 100, 120, 140, 160 and
  180% for Normal to Reverse Lunatic, arm9 0x2028510), or another way (Rickard in your army, 3 of the 6 enemy Clerics left, no foe
  escaped, Kris promoted at Lv 5 or over, 3 of Roshea, Wolf, Sedgar, Vyland and Midia); Prologue VIII's ChapterNext sets 3x's flag too
  (at most one unit fallen in the prologue), and Chapter 20 goes on only once the Binding Shield is completed (else BadEnd).
- Chapters: 1-23, then the Endgame (bmap024, 終章); gaiden 3x, 6x, 10x, 13x, 16x, 20x (bmap1xx). The extra chapters (bmap301-304,
  BS Fire Emblem's) and the downloadable ones (dl001-003) are left out.

## The avatar (Kris; PCData, overlay 19 `pcmake::`)

- PCData: +0 / +4 pointers to the man's and the woman's class lists (4 bytes each, ending in -1: u16 the starting weapon, u8 the
  class, u8 the outfit), then 15 answers of 16 bytes (8 base bonuses, 8 growth bonuses, scrambled), question 1's five first.
- Man: Mercenary (Iron Sword, outfit B), Knight (Iron Lance, A), Cavalier (Iron Lance, A), Fighter (Iron Axe, D), Archer (Iron Bow,
  B), Mage (Fire, C). Woman: Myrmidon (Iron Sword, B), Pegasus Knight (Iron Lance, A), Cavalier (Iron Sword, A), Archer (Iron Bow, B),
  Mage (Fire, C). The starting weapon's kind starts at rank D (arm9 0x204ce24); the class's other weapons at E.
- The record (0x20289ac; saved): +0 name, +0x20 gender, +0x21 class choice, +0x22-+0x24 the three answers, +0x25 hair, +0x26 hair
  colour, +0x27 eyes, +0x28 outfit (the class entry's byte 3). Bonuses: 0x2028b04 (bases, in every stat), 0x2028b60 (growths).
- The menu (display order differs; the label `Mエディット_Q_n_k` is answer k-1) offers 13 hair styles, 10 colours and 10 eye styles
  (counts 0x2230024, 0x222ffcc, 0x222ff74). Story scripts can set the rest (`PCSetHair`, `PCSetHairColor`, `PCSetEye`, `PCSetClothes`,
  arm9 0x205adec-0x205af18): hair 13-17 (N-R: a man's bald head, a headband, a hat, a circlet, a tiger or wolf hood), eyes K (a
  mask), outfit E (a man's). Prologue VIII has Kris change hairstyle and asks whether to keep it (MS208_OP0 / ED4); which index is in
  the missing scripts.
- The portrait (`scripts/fe12_portraits.py` has the parts' formats): body, then eyes, then hair, hue-turned 36 degrees a colour step.

## Supports

- Each person has five slots (Person +0x30): the partner, the points they start with, the points C, B and A need (99 never). They're
  one way: a unit gets the bonus from a partner on its own list.
- Points rise by 1 a turn (map sequence step 0x21d3198, where each unit's turn flags are cleared) for each partner also on the map,
  up to the highest level reachable (arm9 0x2050db0).
- In battle (overlay 00 0x21f2e0c): each partner within 3 tiles adds, at C, Hit +5 and Avoid +5; at B, +10 / +10; at A, +10 / +10 and
  Crit +5, Crit avoid +5. A held Earth Orb adds Crit +10 to allies in the same reach.
- FE12BaseTalk.bin (64-byte records): 69 story conversations (by chapter) and 297 support conversations (99 pairs, C / B / A; most
  with Kris): +0x2c / +0x30 the pair, +0x34 the item the A conversation gives (a Bond, +2 to one stat for the chapter, use 0x17),
  +0x39 the points it names, +0x3a the conversation before it. What +0x39 is compared with is in the missing BaseTalk script
  (unconfirmed); its numbers differ from the battle slots' (Arran and Kris: 3 / 6 / 10 against 5 / 11 / 18).

## Portraits (`scripts/fe12_portraits.py`)

For the app's Bulk Upload only: written to `data-raw/fe12/art/` (git-ignored), never committed. `f/face.bin` (36 bytes a face: +4 the
name label, +8 the file in `f/`); the files are LZ11, LZ10 or Shadow Dragon's zero-run code; 0x200 bytes of palette, 0x6400 of tiles,
128x128. `kris_m.png` / `kris_f.png` are drawn from the avatar parts at the creation's defaults; `avatar/<m|f>/` holds each part.

## English names (`scripts/fe12_names.py`)

Shadow Dragon's official names where it has the Japanese name (its Japanese and North American text matched by label); the rest
Serenes Forest's FE12 names: Kris, Luke, Rody, Cecil, Ryan, Katarina, Malliesia, Warren, Yumina, Yubello, Sirius, Samto, Feena,
Ellerean, Dice, Maris, Robert, Belf, Leiden, Sheema, Frost, and the Dancer.

## Cross-checks (Serenes Forest, light-and-shadow; 2026-11-05)

- All 77 units' join level, bases, Mov and weapon ranks, and their growths with their class (personal + class, below 0 as 0), match.
- The joins match its recruitment table (it lists an end-of-chapter join under the next chapter, and the Endgame as "24").
- The avatar's answers match the Fire Emblem Wiki's Kris page; it says twelve hair styles, the menu has 13 (0x2230024).
- Its reclassing page agrees on the sets, Chapter 1, the Elysian Whip and the cleared-game unlock; its limit formula ("1 + the units
  of that line you could have recruited") is its own reading of MapTable's numbers.
- Its names differ where Shadow Dragon has official ones: Shiida (Caeda), Nabarl (Navarre), Chameleon (Freelancer).
