# Thracia 776 (FE5): the unit data's formats

Read from the user's clean Japanese ROM, `Fire Emblem - Thraki 776 (J).smc` (CRC32 FC519952; `FE5_ROM` overrides the path), with
English names from the Lil' Manster patch's tables (`scripts/fe5_names.py`). Nothing from either is committed;
`scripts/build-fe5-units.py` writes `src/data/fe5/fe5Units.ts`. LoROM: `$BB:AAAA` is file offset `(BB & 0x7F) * 0x8000 +
(AAAA & 0x7FFF)`. The Armory's `data-raw/fe5/README.md` covers items, maps, events and battle; `fe5_rom.py`, `fe5_names.py`
and `fe5_events.py` are its readers, copied.

## Characters: `$86:9A2D`, 48 bytes from id 1

+0-8 their own bases, signed, added to the class's (HP, Str, Mag, Skl, Spd, Def, Con, Lck, Mov), +9 movement stars x 5, +0x0A the
pursuit critical coefficient, +0x0B-0x13 growth rates (same order), +0x15-0x1E weapon experience (sword, lance, axe, bow, staff,
fire, thunder, wind, light, dark; ranks as Serenes lists them: E 1, D 51, C 101, B 151, A 201, S 251, unconfirmed), +0x28 1 for
women, +0x29-0x2B skills (bits, not named yet), +0x2C class, +0x2D leadership stars, +0x2E portrait. A unit's level is in the
placement record that brings them in (`fe5_events.unit_group`, +15).

## Classes: `$86:8000`, 36 bytes from id 1

+0-7 bases (HP, Str, Mag, Skl, Spd, Def, Con, Mov; no Luck), +9-0x12 weapon ranks, +0x13-0x15 skills, +0x23 the class it promotes
from. A unit joining on an indoor map comes in its dismounted class (the Armory's list); it's listed in its mounted one.

- Promotion options: every class whose +0x23 names the unit's class, one per name. Some of those links aren't promotions in
  Serenes Forest's promotion-gains page (Bow Knight to Master Knight, Pegasus Rider to Falcon Knight...) and are left out
  (`NOT_PROMOTIONS`). Swordfighters keep both options (Swordmaster, Hero): which a character gets isn't found in the code yet.
- Promotion adds the difference between the classes' bases (Serenes' promotion gains are exactly that) and starts again at Lv 1;
  a Knight Proof works from Lv 10 (Serenes).

## Caps (`$85:F0A9`)

The level-up code holds HP at 80 and the next seven stats at 20. Galzus's record gives Spd 21 (Serenes: 20).

## Supports: `$88:80CD`

5-byte entries: the character who gets the bonus (u16), the one who gives it (u16), the bonus (u8); ended by a 0 character. The
Armory read what the bonus does ($83:E5A5): hit, avoid, crit and crit avoid, while the giver is alive, on the map, within 3 tiles.

## Holy scrolls: `$88:8054`

12 entries of 10 bytes: the scroll's item id, then a signed growth bonus per stat in the character order (Od's: Skl +30).

## Joins (`scripts/fe5_joins.py`)

Each chapter's scripts played with the event runner: the preparations groups, the opening and turn-1 events (yours at the start),
then each turn, action, talk and location event (a unit it brings on your side or makes yours; a talk whose script makes its
target yours is a talk recruit), then the ending. A unit's level is the one its placement record gives in the join chapter. Misha
(talked to by Karin, then captured) isn't found this way and is added by hand from Serenes Forest's recruitment page.

## Unconfirmed

- Which promotion a Swordfighter gets; the Con and Mov caps (taken as 20); rank letters from weapon experience.
- Skills aren't named yet.
