# Fire Emblem Awakening (FE13): the unit data's formats

Read from the user's own dumps in `Documents\FE Games` (the cartridge image and the DLC; see the Armory's `data-raw/fe13/README.md`):
`scripts/fe13_extract.py` copies what's read into `data-raw/fe13/romfs/` (git-ignored, never committed). The readers (`fe13_bin.py`,
`fe13_data.py`, `fe13_events.py`, `fates_lz.py`, `fates_text.py`, `fates_cmb.py`, `fates_schedule.py`, `ncch_romfs.py`, `fe13_code.py`)
are the Armory's, copied. `scripts/build-fe13-units.py` writes `src/data/fe13/fe13Units.ts`.

## The army: `data/person/static.bin`, 568 bytes per person

+0 SID flags (0x01 a woman), +8 PID, +16 the class (JID), +20 the name label, +28-+35 their own bases (HP, Str, Mag, Skl, Spd, Lck,
Def, Res; signed), +36-+51 the growths, encoded (below), +52-+59 the stat modifiers (HP's always 0, then Str to Res; signed), +69 the
level, +108 / +112 / +116 the classes a Second Seal opens to them as a man and +120 / +124 / +128 as a woman (a child takes each
parent's set for the child's own gender), +132 a child's fixed parent (the mother, Chrom for Lucina, the Avatar for Morgan), +136 on
their supports: [partner PID][the points C, B, A and S need] (99: no S).

The Avatar's record names only the Tactician: the Avatar's set is every base class of their gender but the special ones (Lord,
Dancer, Villager, Manakete, Taguel, and the unique classes), as Serenes Forest gives it.

## Classes: GameData's `JobData`, 128 bytes

+0 flags (0x01 a woman's, 0x08 promoted), +24-+31 bases, +32-+47 the growths, encoded, +48-+55 maximums, +64 and +66 the skills it
teaches (indexes into `RemovableSkillData`, 28 bytes each, the name label at +8): at Lv 1 and 10, or 5 and 15 promoted (Serenes
Forest), +81 Mov, +92 and +96 pointers to the classes it promotes to (Cavalier: Paladin, Great Knight). (The Armory's reader calls
+64-+71 pair-up bonuses; they're these two skills.)

## Growths: encoded, so taken from Serenes Forest

A record's 16 growth bytes pair byte i with byte i + 8: their difference (mod 256) depends on the growth alone within a set of
records (every character but the Avatars and Yen'fay shares one mapping: 40 gives 2, 10 gives 223, 35 gives 209...), but the Avatars,
Yen'fay and the classes use other mappings, and the routine that decodes them wasn't found. So the personal and class growths are
Serenes Forest's (`scripts/fe13_growth_tables.py`): its personal growths, and its class growths with Luck 0 (its full growths less the
personal ones give 0 for every class).

## Joins (`scripts/fe13_joins.py`)

Each chapter's and paralogue's script (each paralogue after the chapter whose clearing opens it, ChapterData +20) and placements, with
the Armory's readers:

- The load handler's groups and the opening's (turn 1, your phase: the Prologue places Chrom's party there) are the start.
- Talks first: a talk that hands over its target (UnitTransferByIndex) recruits it by its talker; one that hands over its talker is the
  recruit's own (Severa talks to Holland).
- Villages: the `_Terrain` script's tiles of kind 8; a group a visit places on your side, for the visitors the script names (Laurent,
  for Chrom or Miriel).
- Then turn, area and condition handlers (a handler on turn -1 runs on a condition), and the end handler last.
- A unit a handler takes off again in the same handler doesn't join.

What a script leaves to the player (Donnel's level, Gangrel's three talks, Walhart, Emmeryn and Aversa surviving) is Serenes Forest's
and says so.

## Not traced in the code (taken from Serenes Forest or the Fire Emblem Wiki)

- Changing class adds the difference between the two classes' bases and starts at Lv 1; seals work from Lv 10.
- A child's growths are their own, their mother's and their father's averaged; their modifiers both parents' plus 1 (the Fire Emblem
  Wiki's inheritance page). A child's real bases also take after their parents' stats; only the class's plus their own are shown.
- DLC and SpotPass characters aren't listed yet.
