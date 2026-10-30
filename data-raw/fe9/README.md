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
| 0x5C-0x63 | small signed values (±5); not used by the app. Unconfirmed: what reads them |

Promotion adds the promoted class's bases minus the base class's, and the Con, Mov and capacity differences (they match Serenes
Forest's promotion gains).

### Skills: one `SID_` table each, 40 bytes

0 `SID_`, 8 `MSID_` name label, 0x0C and 0x10 help labels (`Mess_Help_skill_*`), 0x14 an effect id, 0x18 index, 0x19 icon,
0x1A capacity, 0x1B 1 if it can be removed, 0x1C a count; 0x24 points at that many `JID_` or `PID_` strings, the only classes or
units that can have it (the mastery skills' classes, Sothe's Blossom); the word at 0x20 points one entry earlier, at the scroll
item (`IID_ESOTERIC`, the Occult scroll, for every mastery skill).

Skill scrolls are items named like the skill (`SID_AMBUSH` -> `IID_AMBUSH`, "Vantage"). Some have no name (Paragon, Celerity,
Tempest, Serenity, Daunt, Canto, Blossom, Reinforce, Insight, Vigilance): the app takes those as never handed out, so only those
who start with the skill have it. Unconfirmed in-game.

### RelianceData: supports

A count (41 people), then for each: `PID_`, a partner count, and 8-byte entries (partner `PID_`, then three bytes C, B, A). An
entry whose partner pointer is 0 is empty and skipped. Every pair appears under both people, 68 pairs in all.

The three bytes are totals: Serenes Forest's chapters together are C, B - 1 and A - 2 for all 136 entries. Unconfirmed: why the
stored totals run one higher for each level already reached.

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
  `G_漆黒の騎士倒した` is set, `bmap30_m01_c` (Ena) otherwise. C29's handler 11 sets the flag when the Black Knight falls.
  C30's and C31's `Opening0` also set it, beside the debug joins, so that's taken as the debug path (unconfirmed).
- **Tibarn, Naesala or Giffca (Endgame, C31):** a turn-3 handler places `bmap31_m_tibarn_c`, `_m_naesala_c` or `_m_giffca_c` for
  `BMGetValue(0)` = 0, 1 or 2. Serenes Forest says the player chooses; what sets the value isn't traced (unconfirmed).
