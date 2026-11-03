# Path of Radiance (FE9) game files: the units

Read from the user's own disc (NA, GFEE01), extracted with Dolphin (Properties > Filesystem > Extract Entire Disc). The files stay
on the user's PC (`scripts/fe9_files.py` has the default path; `FE9_FILES` overrides it) and are never committed; only data built
from them is. GameCube files are big-endian. The readers `fe9_files.py` and `fe9_cmb.py` are copied from the Armory, whose
`data-raw/fe9/README.md` covers the weapons, maps and scripts.

Generator: `scripts/build-fe9-units.py` (readers in `scripts/fe9_units.py`) writes `src/data/fe9/fe9Units.ts`.
`src/data/fe9/__tests__/fe9Units.test.ts` checks it against Serenes Forest's tables.

## FE8Data.bin's named tables

`FE8Data.bin` is pointer-relocated: header `size, data size, pointer count, name count`, the data at 0x20 (pointers are offsets
from there), then the pointer offsets, then `(data offset, name offset)` pairs naming 112 tables, then the names. Among them:
`PersonData`, `JobData`, `ItemData`, one `SID_*` table per skill, `RelianceData` (supports), `ChapterData`, `KiznaData` (not
decoded) and `DivineData` (not decoded).

### PersonData: a count, then 84-byte records

| Offset | |
| --- | --- |
| 0 | `PID_` |
| 4 | `MPID_` name label (`common.m`) |
| 0x0C | `FID_` portrait |
| 0x10 | `JID_` class |
| 0x14 | affinity: `telius`, `heaven`, `light`, `dark`, `water`, `wind`, `thunder`, `fire`; their names are `MDV_TELI` (Earth), `MDV_HV` (Heaven), `MDV_LIT`, `MDV_D`, `MDV_WAT`, `MDV_WD`, `MDV_TH`, `MDV_FI` in `common.m` |
| 0x18 | weapon ranks, a 9-letter string: sword, lance, axe, bow, fire, thunder, wind, staff, light (`-` none) |
| 0x1C-0x24 | up to three skills (`SID_`) |
| 0x36 | level |
| 0x37, 0x38 | Con and Wt, added to the class's (signed) |
| 0x39-0x40 | HP, Str, Mag, Skl, Spd, Lck, Def, Res, added to the class's bases (signed) |
| 0x41-0x48 | growth rates, same order |
| 0x49-0x50 | Fixed mode's starting growth points, same order (they match Serenes Forest's table for every unit) |

A unit's stats when they join are the class's bases plus their own; every playable unit matches Serenes Forest except Rhys (see
`unconfirmed` on him). Personal growths are the whole growth rate (they match Serenes Forest's for every unit).

### JobData: a count, then 100-byte records

| Offset | |
| --- | --- |
| 0 | `JID_` |
| 4 | `MJID_` name label |
| 0x0C | the class it promotes to (a base class), comes from (a promoted class), or transforms to (laguz) |
| 0x14 | weapon ranks (the 9-letter string; `*` is a type picked at promotion: the Paladins' second weapon, the Sages' staff or knife) |
| 0x18-0x24 | class skills (`SID_HIGHER` marks a promoted class, `SID_LYCANTHROPE` a transformed laguz) |
| 0x2C-0x34 | attributes (`human`, `alize` = laguz, `mage`, `fly`, `armor`, `knight`, `beast`, `bird`, `dragon`) |
| 0x3C, 0x3D, 0x3E | Con, Wt, Mov |
| 0x40 | skill capacity |
| 0x42 | movement type |
| 0x44-0x4B | base stats |
| 0x4C-0x53 | caps |
| 0x54-0x5B | growth rates, used for generic units (Serenes Forest's class growth rates) |
| 0x5C-0x63 | small signed values (±5): by Serenes Forest's Fixed mode formula, what defeating this class adds to the growth rate when growth points are counted; the app's projection doesn't count them |

Promotion adds the promoted class's bases minus the base class's, and the Con, Mov and capacity differences (they match Serenes
Forest's promotion gains). In the program (`sys/main.dol`, read with `scripts/gc_dol.py`): a unit stores only what it has gained,
and each stat is class base + personal base + gains, held at the class's cap (0x8003b490; Luck is personal + gains, held at 40).
Promoting (0x8003d2c4) switches the class, so the bases change; level goes to 1, HP fills, weapon ranks rise to at least the new
class's, and Fixed mode's growth points are halved, rounding down (0x8003d464). A unit promotes on its own at Lv 20 plus 100 EXP
(0x8003d13c). The Master Seal (0x8003d538) needs Lv 10, and refuses a class with `SID_HIGHER` (promoted, and every laguz),
`SID_ANIMALIZE` or `SID_EVENTCC`. `SID_EVENTCC` marks the Ranger and the Thief, which only the story promotes: Ike in Ch.18's
`Opening0` (C19) and Volke at Ch.19's end (C20, if you pick "Hire." when he asks). Sothe never promotes. The generator finds the
story's promotions by their `UnitClassChange` calls (`story_promotions()`).

Loading a class (0x8001a958) gives it Shove (`SID_TACKLE`) unless it has Canto (`SID_TWICE`): every foot and laguz class shoves,
the mounted and flying ones don't. The app lists Shove among those classes' skills.

Laguz: transforming (0x8003bbd4) switches the unit to the class's other form (`+0x0C`), so the transformed class's bases and caps
apply, and Con, Wt and Mov follow the form. Nothing is doubled (that's Radiant Dawn). Laguz classes have `SID_HIGHER`, so they stop
at Lv 20 and count as level + 20 for EXP.

### Skills: one `SID_` table each, 40 bytes

0 `SID_`, 8 `MSID_` name label, 0x0C and 0x10 help labels (`Mess_Help_skill_*`), 0x14 an effect id, 0x18 index, 0x19 icon,
0x1A capacity, 0x1B the number of items at the list 0x20 points to, 0x1C the number of `JID_` or `PID_` strings at the list 0x24
points to. The learn check (0x801058c4) wants an icon, every item of the first list in the convoy or held by a unit (each skill's
own scroll, or `IID_ESOTERIC`, the Occult scroll, for a mastery skill), and, if the second list has any, the unit or its class in
it (the mastery skills' classes, Sothe's Blossom). Smite (index 0x45) also needs Shove (0x44).

Carrying skills: capacity used is every skill but the class's own, a unit's own included (0x8017c3c8); the learn screen
(0x801be92c) refuses a unit with five skills besides the class's. A skill can be removed (0x8017bc94) if it has an icon and a
capacity and isn't the class's; it's gone for good. Blossom (`SID_FRAC90`, Sothe's): a failed growth roll is rolled again
(0x80034130), Fixed mode turns 90 points into a stat (0x80034ba8), and EXP is cut to 7/10 (0x8003d094).

Skill scrolls are items named like the skill (`SID_AMBUSH` -> `IID_AMBUSH`, "Vantage"). Some have no name (Paragon, Celerity,
Tempest, Serenity, Daunt, Canto, Blossom, Reinforce, Insight, Vigilance): the app takes those as never handed out, so only those
who start with the skill have it. Unconfirmed in-game.

### RelianceData: supports

A count (41 people), then for each: `PID_`, a partner count, and 8-byte entries (partner `PID_`, then three bytes C, B, A). An
entry whose partner pointer is 0 is empty and skipped. Every pair appears under both people, 68 pairs in all.

The three bytes are totals: Serenes Forest's chapters together are C, B - 1 and A - 2 for all 136 entries, because viewing a
conversation adds a point to both units (0x8017fc70). A pair gains a point for each chapter they start deployed together
(0x80015234, from each map's opening), none while a conversation is waiting, and none in Ch.27-2. A conversation is offered when
the points equal C, B or A and both units have fewer than five support levels (C counts 1, B 2, A 3; 0x80036b20).

## Who joins, and when (`Scripts/Cnn.cmb`, `zmap/bmapNN/dispos.cmp`, `zmap/always/dispos.cmp`)

Chapter file `Cnn` is the chapter before it in the game's numbering (01 the Prologue, 29 Ch.27-2, 31 the Endgame); `MCTnn` in
`common.m` is its title. A unit joins in the first chapter where the script:

- calls `Join(group)` on a group from `zmap/always/dispos.cmp` (a placement file outside any map). In a base handler (trigger kind
  14, an Info conversation) that's a join at the base: Sothe (`always_saza`), Calill (`always_kariru`), Largo (`always_rarugo`). In
  a chapter's `Opening0`, at its start: Lethe and Mordecai (Ch.10), Tormod and Muarim (`always_c16`, Ch.16). The `always_dbg_*`
  groups are the debug starts' and `always_T_03`...`always_T_15` the bonus units (Oliver, Shiharam, Petrine, Bryce, Ashnard),
  which the app doesn't list yet;
- calls `UnitTransferToForceByPID(pid, 0)`. In a talk handler (trigger kind 8, whose first two arguments are the two speakers'
  PIDs), or a function only talks call, it's a talk recruit;
- sets down a group with a side-0 unit that isn't a deployment template (not `mikata`/`mik...`) or a cutscene (`event`): Ranulf's
  `bmap24_m01_c`, Bastian's and Lucia's `bmap25_m01_c` (a turn-2 handler), the Endgame royals' turn-3 groups;
- sets down a `mikata` group with `InstantDisposFirst`: how the first chapters bring in their new units.

The other `mikata` groups are deployment templates. They can list units before they join (Ranulf in Ch.21's `bmap22_mikata_c`;
its Normal copy has Calill in his slot), so they count only for a unit nothing else joins (Geoffrey, Ch.25). Every join matches
Serenes Forest's recruitment page (Kieran, Brom and Nephenee are freed during Ch.10, which Serenes counts as Ch.11).

Conditions the scripts put on joins:

- **Nasir or Ena (Ch.28, C30):** `RestoreSallyDisposition` and `Opening1` add `bmap30_m02_c` (Nasir) when the flag
  `G_漆黒の騎士倒した` is set, `bmap30_m01_c` (Ena) otherwise. C29's handler 12 sets it when the Black Knight is defeated and ends
  the chapter; handler 13, the five turns survived, ends it without. C30's and C31's `Opening0` set it only on the debug starts
  (when `DBG_最初からやってる`, set by the Prologue, is unset).
- **Tibarn, Naesala or Giffca (Endgame, C31):** `BMSetValue(0, DialogGetRes())` after a four-way question: Tibarn 0, Naesala 1,
  Giffca 2, "Don't call." 3 (none). A turn-3 handler places `bmap31_m_tibarn_c`, `_m_naesala_c` or `_m_giffca_c` by the answer.
  On Easy and Normal (the script's `Normal()`) it's asked on turn 2 (handler 18); on Hard, after Ashnard's first defeat (51, 22, 23).

The Roster lets you pick both (`FE9_CHOICES`), and the other options' units drop out of every tab's lists.

## Bands (ItemData)

ItemData records are 96 bytes (the Armory's README has the weapon fields). Bytes 85-92 are signed growth changes, HP, Str,
Mag, Skl, Spd, Lck, Def, Res, which the item gives while equipped. The accessories (type `acc`) with any are the eleven bands
and the Knight Ward (Spd +30); they match Serenes Forest's accessories page. The Knight Ward's rule flag `eqD` limits it to
classes with the skill `SID_EQ_D` (Soldiers, Halberdiers, Knights, Generals, the horseback knights and Paladins). Weapons have
values there too (the Iron Sword's Str -5, Skl +5, Spd +5, Res -5...): Serenes Forest's Fixed mode formula counts them as
the weapon's alteration. Only the first equipped accessory counts, in both modes and for bonus EXP (Random 0x800341a0, Fixed
0x80035a98); a weapon's values count in Fixed mode only. The Unit Planner counts the bands and leaves weapons out.

## Fixed mode

From a second playthrough the game offers Fixed mode (bit 0x80 of 0x803307a7). Each award of EXP adds, per stat, (growth rate +
the class fought's change at JobData +0x5C + the weapon's + the first equipped accessory's) × EXP / 100, rounded half up, held
between 0 and 255 (0x800351fc, 0x80034ff0). The level-up (0x80034ba8) turns 100 points into +1, twice at most (90 with Blossom);
a stat at its cap still spends its points. Promotion halves them. Each unit starts with its own points (PersonData 0x49-0x50).
The Unit Planner counts a level as one award of 100 EXP with the band worn: close, not exact (the user's choice, 2026-11-02).

Random mode (0x80034130): each stat rolls the unit's growth plus the accessory's; a sure point per 100 (two at 200); gains cut at
the caps after all eight are rolled; a level that gains nothing stays empty. No class growth, nothing by difficulty. Bonus EXP
levels a unit up exactly as battle does (0x801bccc4).

## The trial maps' units

`zmap/always/dispos.cmp` also holds `always_T_03`, `_05`, `_07`, `_10` and `_15`: Oliver (Bishop, Lv 2), Shiharam (Wyvern Lord,
Lv 10), Petrine (Paladin, Lv 18), Bryce (General, Lv 20) and Ashnard (King Daein, Lv 20). Serenes Forest: they join the trial
maps once the game has been cleared that many times from beginning to end, Oliver, Shiharam and Ashnard with their Normal mode
stats and Petrine and Bryce with their Hard mode ones. Only Ashnard's are his class's bases plus his own; the others include the
game's enemy level-ups, which aren't decoded, so their stats are Serenes Forest's boss tables (`TRIAL_STATS` in the generator).

## Portraits and icons (`Face/`, `window/icon.tpl`; `scripts/tellius_art.py`)

`python scripts/tellius_art.py fe9` writes every unit's portrait (`art/<name>.png`, 256x256) and every skill's icon
(`art/skills/<name>.png`, 32x32) for the app's Bulk Upload, and a labelled `contact_sheet.png` to check them by eye (all
git-ignored). The names are the app's (`artId`), read from the generated `src/data/fe9/fe9Units.ts`. `scripts/gc_texture.py`
decodes the GameCube textures (TPL: magic 0x0020AF30, then (image header, palette header) offset pairs; the formats' 4x4/8x4/8x8
tiles, CMPR, and the palettes).

- `Face/facedata.bin` (pointer-relocated like `FE8Data.bin`): a count and a pointer to 32-byte records, `FID_`, `MPID_`, the
  file, then 16-bit numbers: eye 1 x, y; eye 2 x, y; mouth x, y (-1 when the face has none: Oscar's eyes); the rest not
  decoded. PersonData +0x0C is the unit's `FID_` (a laguz's is the untransformed face). `FID_L_<name>` records name the
  conversation portraits (`L_<name>.cms`, 232x296 or 336x336, the same scale).
- `Face/<name>.cms`: LZ10, then a TPL of C8 (8-bit paletted, RGB5A3 palette) textures: the status screen's 192x128 bust, six
  mouth frames (open, half, closed, then the same again), three frames per eye (open, half, closed; when both eyes share one
  position the frames cover both and the two sets are the same), and the 64x64 face for the map and lists. The bust has
  transparent holes where the frames go; each frame's top-left is the record's x, y.
- A portrait is the bust with both eyes open and the mouth closed (the third mouth frame), cut to a 128x128 square (its full
  height, centred on the eyes and mouth) and scaled up 2x with Lanczos.
- `window/icon.tpl`: two C8 textures; the second (1024x96) holds the skill icons, 32x32 in rows of 32. A skill's icon byte
  (+0x19) is its place plus one; 0 is none. Shove (`SID_TACKLE`) has none, so the app's Shove icon has no file.
