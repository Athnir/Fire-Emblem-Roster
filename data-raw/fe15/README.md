# Fire Emblem Echoes: Shadows of Valentia (FE15): the unit data's formats

Read from the user's own cartridge image, `Fire Emblem Echoes Shadows of Valentia.3ds` in `Documents\FE Games` (title CTR-P-AJJE,
decrypted: its NCCH has the NoCrypto flag; `FE15_ROM` overrides the path). `scripts/fe15_extract.py` copies `Data/`, `Scripts/`, the
North American English text (`m/@NOA_EN`) and the program into `data-raw/fe15/romfs/` (git-ignored, never committed);
`scripts/build-fe15-units.py` writes `src/data/fe15/fe15Units.ts`. The tables are Awakening's binary format (`scripts/fe13_bin.py`),
one table per file; English names are `m/@NOA_EN/Name.bin` (MPID) and `Job.bin` (MJID).

## People: `Data/Person.bin`, 168 bytes per PID

+0 PID, +4 the name label, +8 the class (JID), +24 the army (BID_アルム軍 Alm's, BID_セリカ軍 Celica's), +29 the level, +52-+58
bases (HP, Atk, Skl, Spd, Lck, Def, Res; absolute), +60-+66 their own maximums (the same stats: Shadows of Valentia keeps maximums
per character, not per class), +68-+74 growths. Everything matches Serenes Forest's tables for every unit.

## Classes: `Data/Job.bin`, 160 bytes per JID

+4 the name label, +36-+43 bases (HP, Atk, Skl, Spd, Lck, Def, Res, Mov), +88 the class it changes from (the class tree: a Villager
branches into five classes for men, four for women). The level each class must reach to change isn't in these records; it's Serenes
Forest's (`CHANGE_LEVEL` in the generator), as is the rule: a class change lifts every stat but Res that's below the new class's bases
to them, and starts again at Lv 1. A Dread Fighter's change back to Villager, and the Pitchfork, aren't shown.

## Supports: `Data/Reliance.bin`

Four tables, read by `read_supports` in the generator:

- 支援効果: per character (SUPID_), a count and a list of 20-byte entries, [partner PID][16 bytes]: what that character gets from the
  partner in reach, four signed bytes (Hit, Crit, Avoid, Crit avoid) for each of no rank, C, B and A. A pair with only the first four
  set has a fixed bonus from the start and no conversations (Alm and Gray). Bytes can be negative: Faye gets Avoid -5/-10/-15 from Alm.
- 支援関係: a 40-byte row per PID, [PID][a byte per character in the same row order]; the lower half holds each pair once: the points
  pattern of a pair with conversations (0 none).
- 必要経験値: the patterns (REXID_), C, B and A's points: 1 is 20/45/90, 2 is 15/35/60, 3 is 10/25/45.
- 支援会話条件: per character (RCID_), a count and 8-byte entries, [partner PID][the act C, B and A open in][0]. A pair with
  conversations but no entry opens from Act 1.

All of it matches Serenes Forest's support-bonus page but three values (the test lists them): Celica and Conrad's ranks open in Act 4
here (Serenes Forest: 3; Conrad joins in Act 4), and Tatiana's B with Zeke gives Avoid +7 (Serenes Forest: +5). The range (3 tiles)
is Serenes Forest's.

## Joins (`scripts/fe15_joins.py`)

From the event sheets (`Data/Event/<location>.bin`, one per place, in Awakening's container) and the map scripts (`Scripts/*.cmb`, Fates'
bytecode, `scripts/fates_cmb.py`):

- A sheet is sections (DAT_ labels: 共通 shared, 1章-5章 an act's) of 44-byte rows: [sequence (where one starts), command, condition 1,
  comparison (1 ==, 2 !=, 4 >=), condition 2, arguments 1-6]. A unit joins by `仲間入り` (join the party; the people in arguments 1, 4
  and 5). The `アドベンチャーをスキップ` sequences (skipping the adventure parts) repeat the joins and are left out.
- Back from the join: sequences are entered by `サブルーチン呼び出し`, `ジャンプ`, `はい選択` / `いいえ選択` (a yes/no answer) and
  `イベントジャンプ`, or by talking to a portrait a spot adds (`立ち絵追加`: argument 1 the sequence, argument 4 the person). A talk to
  the person before any scene jump makes the join a talk (most are a talk then a yes/no); an act's closing event (`...エンディング`) an
  ending; otherwise a scene on arrival (Lukas, Gray and Tobin; Mae and Boey; Clive).
- The act: an act section on the way, a chapter condition (`*章` == or >= N), or the act the game's own variable names carry
  (`G_<location><N>_...`), the earliest; with none on the way, the act the location's variables carry. The place: the location's name
  (`m/@NOA_EN/Name.bin`, MID_<location>). The army: the person's (Person.bin +24); Ram Village's talks with Faye and Kliff also have a
  Celica's-army branch, opened from Act 4.
- Conrad joins in Dolth Keep's map script (its winning handler calls `ev::JoinUnit('PID_コンラート')`); the only script join.
- Alm joins as the Prologue ends and Celica as Act 1 ends (each in that part's closing event): each is listed from the next act's start.

Every act matches Serenes Forest's recruitment page, and so does the way but Clair's (there "automatically"; the file's cell scene is a
talk with a choice). The conditions a join's variables carry (survived the battle, Sonya or Deen, after Clive joins) are Serenes Forest's
words (`scripts/fe15_recruitment.py`). The DLC's Cipher Legends units aren't in the user's dump.
