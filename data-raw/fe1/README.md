# Shadow Dragon and the Blade of Light (FE1): the unit data's formats

Read from the user's own dump of the Switch release (2020), the Famicom original of 1990 with Nintendo's English: `Fire Emblem_
Shadow Dragon and the Blade of Light [0100A12011CC8000][v0][BASE].nsp` in `Documents\FE Games\Switch dumps\NSP` (`FE1_NSP`
overrides it). `scripts/switch_nsp.py` (the Armory's, copied) opens the package with the console's own keys from `~/.switch` (never in
the repo); `scripts/fe1_units.py` reads the units; `scripts/build-fe1-units.py` writes `src/data/fe1/fe1Units.ts`. Nothing from the
dump is committed. The Armory's `data-raw/fe1/README.md` covers the package, the text, items, maps, foes and battle.

## Where the data is

The Program NCA has no RomFS: everything is in the ExeFS's `main` (an NSO: three segments, LZ4 where flagged, relocated as if loaded
at 0). Its data holds the cartridge whole: a `FA5J` record with the Japanese title (ファイアーエムブレム　暗黒竜と光の剣), the emulator's
settings at +0x3C (mapper 0x0A, MMC4; 16 PRG banks; 16 CHR banks), 256 KB of PRG (bank n at $8000-$BFFF, bank 15 fixed at
$C000-$FFFF) and 128 KB of CHR. The Switch side only draws Nintendo's English over the cartridge's Japanese: a dictionary keyed by
the Japanese as the NES draws it, and the English by text number (the Armory's notes). All unit data is the cartridge's.

Addresses below are bank:$addr.

## Units

- **A unit** (27 bytes; your army in battery RAM from $6A90, 54 slots): +0 character (a foe: 0x80 + its name), +1 class, +2 level,
  +3 HP, +4 max HP, +5 EXP (a foe: what it's worth), +6 the tile under it, +7 Str, +8 Skl, +9 weapon level, +10 Spd, +11 Lck, +12 Def,
  +13 Mov, +14 unknown (only the unused telescope raises it), +15 Res (bit 7: the Talisman's, permanent), +16 row, +17 column,
  +18 0xFF once gone, +19..+22 items (item + 1), +23..+26 their uses.
- **Growths** (15:$E1E0, u16 pointers by character − 1): 7 bytes, Str, Skl, weapon level, Spd, Lck, Def, HP, in tenths (Gotoh
  shares Elice's). The level-up (15:$D085, at 100 EXP, none at Lv 20) rolls a random byte / 25 (0-10) for each: a stat grows when
  that's below its growth in tenths, always at 10. So a growth of G tenths is a chance of 25G/256 (a listed 90% is 87.9%). Res and Mov
  never grow. With the Mercurius equipped (Marth's), a stat that grows gets +2 one time in four (15:$D116).
- **Caps** (15:$D0FE): 20 for every stat but HP, 52 for HP, in every class; Lv 20. Boots hold Mov at 12; the Talisman's Res is 7.

## Classes and promotion

- **Class bases** (15:$EC04, u16 pointers by class − 1, classes 1-22): Str, Skl, weapon level, Spd, Lck, Def, Mov, HP, and the EXP a
  foe of the class is worth. Classes 23 and 24 are the Manaketes' dragon forms, with no bases.
- **Promotion** (6:$980B): the item for the class (6:$989D and $98A2 the two classes each takes, $98A7 the class it gives; item 79 +
  index), from Lv 10: Paladin's Honor (Cavalier to Paladin), Hero Crest (Mercenary to Hero), Bishop's Ring (Mage or Curate to
  Bishop), Orion's Bolt (Archer to Sniper), Skydrake Whip (Pegasus Knight to Wyvern Knight). The level becomes 1; HP, Str, Skl, the
  weapon level, Spd, Lck, Def and Mov are each lifted to the new class's base where lower (6:$9852), and nothing is added.
- **Weapons** (6:$A3D1 bounds, 6:$A3DA class lists): a locked item belongs to one character whatever the class (Marth's Rapier,
  Mercurius and Falchion; Tiki's Divinestone; Bantu's Firestone; Linde's Aura; Merric's Excalibur; Lena's Hammerne).

## Joins

- **Units each chapter brings** (8:$8490, u16 pointers by chapter − 1): whole 27-byte records ended by a 0 character. Chapter 1's is the
  starting army.
- **Village recruits** (3:$9466): whole records, given by a place to visit (3:$A0F1) whose first byte is 0x80; 0x81 / 0x82 give
  Samson and Arran in Chapter 16, each only while the other isn't in your army (3:$9B46). Only Marth can visit (3:$9AEA).
  Seizing Chapter 23's throne frees Elice.
- **Talks** (15:$EDB5 talker, $EDC4 foe, $EDE0 the character it becomes).
- **Recruits that come to Marth** (3:$A3C1 -> 3:$A3DA: foe, character, conversation, a character that must be in your army): the foe
  joins on ending an enemy-phase move next to Marth (3:$8CE0). Minerva needs Maria; Catria, Palla (Chapter 14) and Est (Chapter 18)
  arrive at all only with Minerva in your army (3:$91EC).
- **A recruited foe** keeps the stats its class bases and level give (8:$BBF4: + (Lv − 1) / 2 to Str, Skl, the weapon level, Spd and
  Def, HP three times that) and gets a random Luck of 0-7 (3:$8E52; the app shows its average, 3.5).

## Checked against Serenes Forest

Every unit's class, level, bases and growths match (`src/data/fe1/__tests__/fe1Units.test.ts`), except: Roshea's Mov (9 in his
record; Serenes 8), and the recruited foes' Luck (random; Serenes gives none, but Astram's 3, his Mystery of the Emblem Luck).
Serenes calls Gordin Gordon, puts Elice at the start of Chapter 24 (freed by the Chapter 23 throne: the same), and has Wendell and
Rickard talk with Marth (no talk exists: they come to him).

## Unconfirmed

- Whether EXP is kept after promotion (the routine doesn't touch it).
- The recruits' starting EXP (read from the code, not seen in the game).
- Foe byte +22 bit 0 (it blocks a recruit coming to Marth) and unit byte +14.
- Whether the Switch side changes anything in the cartridge as it runs (no option for difficulty or stats; the tables match 1990's).
- Which phase Catria and Palla's "turn 5" arrival is.
