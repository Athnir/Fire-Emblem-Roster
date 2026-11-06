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

+4 the name label, +34 (u16, `武器`) the weapons it can use (a bit per item kind: 2 sword, 4 lance, 8 axe, 16 bow, 32 black magic, 64
white magic, 128 monster weapons; the equip check 0x44fe64, `scripts/class_weapons.py`), +36-+43 bases (HP, Atk, Skl, Spd, Lck, Def, Res, Mov), +88 the class it changes from (the class tree: a Villager
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

## Spells (the Spells tab)

Read with `scripts/fe15_bin.py` (copied from the Armory's): Echoes' tables describe themselves, so each field is read by its name.

- **The lists**: each person (Person.bin) names two 習得魔法 records, 習得魔法系 (+116, the black magic list) and 習得神聖系 (+120, the
  white magic list); each record is six entries of [the spell (IID_), s16 rank, u16 level]. Most people share the generic lists; the
  units who can reach a casting class have their own (MSID_<name>).
- **Which list** (Job.bin): a class's 魔法成長 (+23) picks it, 1 the black magic list (Mage, Sage, Priestess, Celica's Priestess and
  Princess), 2 the white (Cleric, Saint), 0 none; its ランク (+20) is 0 for a first class, 1 a promoted one.
- **What a unit knows** (code.bin `0x1a9d0c`, worked out from the class each time): every entry of the class's list whose level is at
  most `0x450ec8`'s level, and of rank 1 only in a promoted class (`0x4487cc`). `0x450ec8`: the unit's level (+0xe1), plus for a rank-0
  entry the levels it carries (+0xee). A class change (`0x353e8c`, `0x356114`) sets the carried levels to the larger of what they were
  and the level it was made at less 1, at most 20; a new unit starts at 0 (`0x356774`). So a Villager made a Mage at Lv 3 carries 2.
- **The spells** (Item.bin, 種類 5 black magic, 6 white): 威力 Mt (a healing spell's heal: 効果 2 or 3), 命中 Hit, 必殺 Crit, 内射程 and
  外射程 the range (255: set by a skill, SID_魔力射程 Atk, SID_半魔力射程 Atk/2, SID_四半魔力射程 Atk/4), 消費HP the HP it costs, ヘルプ the
  help text. The three Invokes, all named "Invoke", summon different classes (召喚, a person): the tab names each by its class.
  Nosferatu's two hidden skills, SID_神殺し_非表示 and SID_眼光封じ, have no English text; Serenes Forest gives what they do (it can
  KO a god, and Oculus doesn't stop it).
- **Who**: the classes a unit can reach through the class tree, and a male one through a Dread Fighter's change back to Villager
  (Job.bin's ＣＣ table: each class's class changes with the level they need, CC_魔戦士男 Villager at 10, CC_村人男 its five at 3; the
  other final classes list a Villager too, at 1, which the app leaves out, as Serenes Forest does). 19 units.

Every spell's HP cost, Mt, range and Hit matches Serenes Forest's black and white magic pages
(`src/data/fe15/__tests__/fe15Spells.test.ts`).

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

## Portraits and icons (`scripts/fe15_portraits.py`)

For the app's Bulk Upload only: read from the cartridge image directly (the face files aren't copied into `romfs/`), written to
`data-raw/fe15/art/` (git-ignored) and never committed. No skill icons are written.

- A person's face is Person.bin +12 (`FID_<name>`). `face/FaceData.bin` (88 bytes a record) has one per use: `FSID_BU_<name>` is the
  bust-up (the program builds `FSID_BU_%s`, and `FSID_BU_%s%s` for a variant: `上級`, Alm's and Celica's once promoted, and `下画面`,
  the lower screen's); its +12 names the archive, `face/face/<+12>.arc` (`player/アルム_bu`).
- The archive is Awakening's container: its Info table has [name, index, size, offset] per expression, offsets counted from the Data
  label; each is an LZ11 BCH (`通常.bch.lz` the normal one).
- The BCH has one texture. Its GPU commands set texture unit 0's size (register 0x82, width << 16 | height), its address in the data
  section (0x85) and its format (0x8e: 13, ETC1A4): 256x256, decoded by `scripts/ctr_texture.py` (`scripts/ctr_formats.py` takes the
  other formats).

`python scripts/fe15_portraits.py` writes `<name>.png` for each of the 34 units, as they join (Alm and Celica unpromoted).
The texture is the figure down to the waist; the file is cut to the head and shoulders (a 136-pixel square from just above the
head, centred on it, scaled to 256), as the app's square portrait boxes show the other games'. `--full` keeps the whole texture.
