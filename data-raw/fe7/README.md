# The Blazing Blade (FE7): the unit data's formats

Read from the user's own cartridge image, `Fire Emblem (U) [!].gba` (CRC32 2A524221; `FE7_ROM` overrides the path). The game is in
English, so every name is its own text. Nothing from it is committed; `scripts/build-fe7-units.py` writes `src/data/fe7/fe7Units.ts`.
The fuller ROM notes are in the Armory's `data-raw/fe7/README.md`; `gba_rom.py` and `fe7_events.py` are its readers, copied.

## Three stories

Lyn's story (chapter entries 0-11) is its own army, played before the rest; its units rejoin Eliwood's and Hector's stories with
their own records (Lyn, Wil, Kent, Sain, Florina, Rath: separate character ids) or the same ones (Dorcas, Serra, Erk, Matthew,
Lucius, Wallace, Nils). Eliwood's and Hector's stories share one army: every unit joins both at the same level and class, so each
has one id, listed once per story with that story's chapter (Hector's numbers run one or two ahead from Chapter 15). Farina and
Karla join in Hector's story only. A chapter with two versions (Chapter 23 against Lloyd or Linus, 25 against Kenneth or Jerme) is
one chapter here; a unit found in only one says so.

## Characters: `0xBDCE18`, 52 bytes, indexed by id

+5 class, +9 affinity (1-7: Fire, Thunder, Wind, Ice, Dark, Light, Anima), +0x0C-0x13 their own bases added to the class's (HP,
Str, Skl, Spd, Def, Res, Lck, Con; signed), +0x14-0x1B weapon experience (sword, lance, axe, bow, staff, anima, light, dark; E 1,
D 31, C 71, B 121, A 181, S 251), +0x1C-0x22 growths (HP, Str, Skl, Spd, Def, Res, Lck), +0x2C a pointer to the support data or 0.
A unit's level is its group record's (byte 3 >> 3), not the character's.

## Classes: `0xBE015C`, 84 bytes

+5 the class it promotes to (a promoted class points back at the one it promotes from), +0x0B-0x12 bases (HP, Str, Skl, Spd, Def,
Res, Con, Mov), +0x13-0x19 caps (HP, Str, Skl, Spd, Def, Res, Con; Luck is 30), +0x22-0x27 what promoting into the class adds (HP,
Str, Skl, Spd, Def, Res), +0x28 abilities (0x100 promoted).

Promotion (0x08029818, from the promotion's battle-screen setup): the unit's class's +5 gives the new class; its +0x22-0x27 are
added to the unit's stats, each held at the new class's caps. Con and Mov are the class's plus the character's, so they change by
the difference between the two classes. Merlinus's two Transporter classes point at each other; that's no promotion (the new class
must have 0x100). Matches Serenes Forest's promotion gains for every class.

## Supports

The character's support data (24 bytes): 7 partner ids, 7 starting points, 7 points gained per turn, then the partner count. The
gain routine (0x080266E4) does nothing in Lyn's story (the chapter state's byte 0x1B is 1) and is called (0x08026900) for a partner
side by side (distance 1) or carried (distance 0, the rescue byte). C, B and A at over 80, 160 and 240 points (0x08026690), five
levels per unit at most; the bonus per level is both affinities' rows (`0xC9A1C0`) summed and halved (the Armory's
`build-gba-supports.py`).

## Joins (`scripts/fe7_joins.py`)

Each story's chapters played in order, on Normal: the opening scene, then (with preparations) the story's enemies and army, then each
turn-1 event on your phase, gives who starts; each later turn, talk, village and misc event gives who it brings in on your side or
recruits; an event that goes to the next chapter (0x81), and the end scene, give who joins at the end. On top of the Armory's runner:

- **Your army's group** (0x36-0x38 and a chapter's deploy tiles) only places units already yours: its characters are placeholders
  for the tiles (Chapter 18's lists Canas).
- **A unit a script places as yours and then takes off by name** (0x6B, 0x6F) doesn't join there, but stays in your army, off the
  map: Serra and Matthew arrive with Hector in Eliwood's Chapter 12 and are deployed from Chapter 13.
- **0x33, a cutscene's load of your living units** (0x0800D098): skips a character whose unit (0x08017D34) is dead. For a character
  not yet yours the lookup returns 0 and the check reads address 0x0C, outside the ROM; taken as skipped, which is how the story
  plays (Dragon's Gate's opening lists Canas). Unconfirmed.
- **A recruit on a branch the plain run doesn't take** (a payment, a duel) still has its change of side (0x65 to side 0); the talker
  is the chapter's talk with that character, or the talk that sets the flag the event waits on (Farina's 20,000 gold). In an ending,
  that talk is what it checks for (Jaffar, if Nino talked to him).
- **A side quest you can skip:** the story is played again without it, and where its joiners come in instead is noted (Merlinus).
- **Turn events** run when the turn counter equals the event's turn, on its phase (0x080782FC): Hector and Oswin arrive on turn 4 in
  Eliwood's Chapter 12 (Serenes Forest: "during turn 3").
- **Levels:** a character already on the map keeps its unit when another record for them is loaded (0x0800A618), so the first
  record counts: Nils is Lv 3 (Lyn's Chapter 7 places him at Lv 3 in its opening scene, then Lv 1 on turn 1; Serenes Forest: Lv 1).

What a check routine decides (Karel or Harken, Vaida, Karla's duel, Renault's ruins) is taken from Serenes Forest's recruitment page
and says so.

## Not read yet

- Hard mode's bonus stats.
- The promotion item level (taken as Serenes Forest's: from Lv 10).

## Portraits (`scripts/gba_portraits.py`)

For the user's own copy of the art only: the PNGs go to `data-raw/fe7/art/` (git-ignored) and are loaded through Bulk Upload.
Lyn's-story and later records of the same person share one portrait id, so each name has one file.

- **Which face:** the character's +6 (u16) is its portrait id (GetUnitPortraitId, 0x08018BD8: the class's +8 only when it's 0).
- **Table:** `0xC96584`, 28 bytes per portrait id, indexed directly (GetPortraitData, 0x08006B20: table + id × 28; id 0 is unused).
  +0 the sheet (LZ77, 128 tiles), +4 the mini portrait (LZ77), +8 the palette (16 BGR555 colours, colour 0 transparent), +0xC the
  mouth frames (stored plain, 0x600 bytes: six 32x16 frames, 4 tiles across; 0-2 smiling, 3-5 not, the third of each the closed
  mouth a face rests on), +0x10 a class card (0 for a face), +0x14 mouth x, +0x15 mouth y, +0x16 eyes x, +0x17 eyes y (in 8-pixel
  tiles from the 96x80 face's top left), +0x18 the blink kind.
- **Sheet:** 4bpp tiles, 32 to a row as they sit in OBJ VRAM. The face sprite (0xB906AC) builds the 96x80 face: columns 0-7 (the
  top 64x32, at x 16), 8-15 (the next 64x32 below it), 16-19 rows 0-1 and 2-3 (the bottom 32x16 halves, at y 64), 20-21 and 22-23
  (the side strips, 16x32 each at y 48); the top 48 pixels of the side strips are always empty. Columns 24-27 hold the blink frames
  (rows 0-1 half shut, rows 2-3 shut) and columns 28-31 rows 0-1 a mouth (the mouth sprite's slot).
- **As the status screen draws it:** PutFace80x72 (0x080074C4, called by the status screen at 0x080811DA) lays the sheet out with a
  fixed tilemap (0x195680; a tile row higher for some faces, 0x195738) and puts the slot's tiles (0x1C-0x1F, 0x3C-0x3F) over the
  face at the mouth position (0x08007170, 0x080071C4). That mouth is closed but mostly the smile's (it matches mouth frame 2 more
  often than not); the face under it is mouth frame 5, the plain closed mouth a face rests on in dialogue, for every unit. The eyes
  are the sheet's own, open. The script writes the whole 96x80 face with the status screen's mouth; `--neutral` keeps frame 5.
- **Run:** `python scripts/gba_portraits.py fe7` (add `--contact DIR` for a labelled contact sheet).
