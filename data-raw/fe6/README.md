# The Binding Blade (FE6): the unit data's formats

Read from the user's clean Japanese ROM, `Fire Emblem - Fuuin no Tsurugi (J) [!].gba` (`FE6_ROM` overrides the path), with English
names from the FE6 Localization patch applied in memory (`scripts/fe6_names.py`, `scripts/ups.py`, `FE6_PATCH`). Nothing from either
is committed; `scripts/build-fe6-units.py` writes `src/data/fe6/fe6Units.ts`. The fuller ROM notes are in `Documents\FE Games\notes`
and the Armory's `data-raw/fe6/README.md`; `fe6_rom.py`, `fe6_names.py` and `fe6_events.py` are its readers, copied.

## Characters: `0x6076D0`, 48 bytes from id 1

+5 class, +9 affinity (1-7: Fire, Thunder, Wind, Ice, Dark, Light, Anima, by the later games' order), +0x0B level, +0x0C-0x13 their
own bases added to the class's (HP, Str, Skl, Spd, Def, Res, Lck, Con), +0x14-0x1B weapon experience (sword, lance, axe, bow, staff,
anima, light, dark), +0x1C-0x22 growths (HP, Str, Skl, Spd, Def, Res, Lck), +0x2C a pointer to the support data or 0.

## Classes: `0x60A0E8`, 72 bytes

+5 the class it promotes to, +0x0B-0x12 bases (HP, Str, Skl, Spd, Def, Res, Con, Mov), +0x13-0x19 caps (HP, Str, Skl, Spd, Def, Res,
Con; Luck is 30).

## Supports

The character's support data (32 bytes): 10 partner ids, 10 starting points, 10 points gained per turn, then the partner count. C, B
and A at over 60, 120 and 200 points, five levels per unit at most; the bonus per level is both affinities' rows (`0x66350C`, 8 bytes:
id, Atk, Def, Hit, Avoid, Crit, Dodge) summed and halved (the Armory read these in the support code).

## Joins (`scripts/fe6_joins.py`)

Each chapter's scripts played in story order: the opening (the starting enemies, then each turn-1 event on your phase; the army
group when no script places your units) gives who starts; each later turn, talk, location and misc event gives who it recruits or
brings in on your side (a talk: the other speaker; a village: every visitor the script lets recruit); the end scene gives who joins
at the end. Matches Serenes Forest's recruitment page. By hand: Cath (joins on her third talk with Roy, Chapter 12 at the
earliest) and Dayan's level (12, Serenes').

## Not read yet

- The trial maps' bonus units (Hector, Eliwood...): the game's code adds them once it has been cleared.
- Hard mode's bonus stats; the promotion item level and gains (taken as Serenes': from Lv 10, the difference in bases).

## Portraits (`scripts/gba_portraits.py`)

For the user's own copy of the art only: the PNGs go to `data-raw/fe6/art/` (git-ignored) and are loaded through Bulk Upload.

- **Which face:** the character's +6 (u16) is its portrait id (the status screen's GetUnitPortraitId, 0x080184F0, falls back to
  the class's +8 only when it's 0, which no playable unit's is).
- **Table:** `0x66074C`, 16 bytes per portrait id, indexed directly (GetPortraitData, 0x08007FC0: table + id × 16; id 0 is
  unused). +0 the sheet (LZ77, 136 tiles), +4 the 32x32 mini portrait (stored plain, 0x200 bytes), +8 the palette (16 BGR555
  colours, colour 0 transparent), +0xC mouth x, +0xD mouth y (in 8-pixel tiles from the 96x80 face's top left), +0xE unknown (0 or
  1). A record with mouth x or y 0 is a class card, drawn as an 80x72 bitmap instead.
- **Sheet:** 4bpp tiles, 32 to a row as they sit in OBJ VRAM. The face sprite (0x5C3A94) builds the 96x80 face from it: columns 0-7
  (the top 64x32, at x 16), 8-15 (the next 64x32 below it), 16-19 rows 0-1 and 2-3 (the bottom 32x16 halves, at y 64), 20-21 and
  22-23 (the side strips, 16x32 each at y 48, left and right); the top 48 pixels of the side strips are always empty. Columns 24-31
  hold the talking mouth frames (tiles 0x18, 0x58, 0x1C, 0x5C) and row 4 (tiles 0x80-0x87) the closed mouth in two 32x8 halves.
- **As the status screen draws it:** PutFace80x72 (0x08008BE0, called by the status screen at 0x08070036) lays the sheet out with a
  fixed tilemap (0x101974: the 96x80 face less 8 pixels at each side and the bottom; Fae's, 0x101A2C, a tile row higher) and adds no
  mouth: the face's own closed mouth (the same as row 4's) and open eyes are what it shows. The script writes the whole 96x80 face.
- **Run:** `python scripts/gba_portraits.py fe6` (add `--contact DIR` for a labelled contact sheet).
