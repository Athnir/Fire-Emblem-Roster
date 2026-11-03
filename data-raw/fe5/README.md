# Thracia 776 (FE5): the unit data's formats

Read from the user's clean Japanese ROM, `Fire Emblem - Thraki 776 (J).smc` (CRC32 FC519952; `FE5_ROM` overrides the path), with
English names from the Lil' Manster patch's tables (`scripts/fe5_names.py`). Nothing from either is committed;
`scripts/build-fe5-units.py` writes `src/data/fe5/fe5Units.ts`. LoROM: `$BB:AAAA` is file offset `(BB & 0x7F) * 0x8000 +
(AAAA & 0x7FFF)`; `python scripts/fe5_asm.py 83:DCCD 80 m16 x16 stop` disassembles. The Armory's `data-raw/fe5/README.md` covers
items, maps, events and battle; `fe5_rom.py`, `fe5_names.py` and `fe5_events.py` are its readers, copied. Zane Avernathy's VoltEdge
and the Lil' Manster team's labelled disassembly (github.com/famitino/fe776br) were the map; every rule below was traced in the
clean ROM (2026-11-02), and the level-up, Master Seal, story promotion, rings, leadership, supports, movement stars and rescue
routines were run on `fe4_cpu.py` with test units.

## Characters: `$86:9A2D`, 48 bytes from id 1

+0-8 their own bases (HP, Str, Mag, Skl, Spd, Def, Con, Lck, Mov; signed; bit 7 of +0 set builds a generic unit at random, $83:A970),
+9 movement stars x 5, +0x0A the pursuit critical coefficient, +0x0B-0x13 growth rates (same order), +0x14-0x1D weapon points
(sword, lance, axe, bow, staff, fire, thunder, wind, light, dark), +0x1E-0x27 weapon EXP rates (100 for every playable unit, 20
for Galzus), +0x28 1 for women, +0x29-0x2B skills (bits), +0x2C class, +0x2D leadership stars, +0x2E map sprite, +0x2F portrait. A
unit's level is in the placement record that brings them in (`fe5_events.unit_group`, +15).

## What a unit keeps, and what's shown

The loader ($83:9507) copies the record's Str to Mov and Luck into the unit unchanged: the unit keeps its own numbers, apart from the
class. HP alone is kept whole: the class's HP plus their own ($83:953A). Whenever a unit is shown or fights, $83:90BE adds the
class's bases and holds each sum at 20 (Luck has no class base). So Galzus (own Spd 13, Hero 8) shows 20, as Serenes Forest lists.

## Classes: `$86:8000`, 36 bytes from id 1

+0-7 bases (HP, Str, Mag, Skl, Spd, Def, Con, Mov; no Luck), +8 relative power, +9-0x12 weapon ranks (the class's base points; 0
can't use the type), +0x13-0x15 skills, +0x17-0x1E terrain pointers, +0x23 the base class the EXP formula uses ($83:A9C4; not a
promotion link).

- **Dismounting** ($87:9500, the 28 pairs at `$88:8000` and `$88:801C`): indoors a mounted class becomes its pair, which changes only
  the class (and so its bases, weapons and skills): usually Str, Skl and Def -1, Spd -2, Mov -3; the dracos Str -3, Skl -2, Spd -2,
  Def -5. HP stays. A unit joining indoors comes in the dismounted class; it's listed in its mounted one.

## Level-ups (`$83:DCCD`)

100 EXP a level, Lv 20 in both tiers ($83:DD3D). Each stat's growth is the unit's own plus every holy scroll in their seven slots
(several add up; $83:DD73, $83:DDCC), held at 0 to 255 ($83:DEE0); the class adds nothing. Each of the nine stats rolls once
($83:E2B0): a sure point per 100, then one roll on the rest, so the average gain is the growth. The caps ($83:DFC4) are HP 80 and 20
for every other stat, Con and Mov too, on the unit's own number: a stat already showing 20 still rises underneath. ($85:F0A9, once
taken for the caps, is the arena's.)

## Class changes

- **Master Seal** (Serenes' Knight Proof; the check $87:C09E): Lv 10 or more, and an entry in the table at `$88:82F1` (3 bytes: the
  character u16, the class; ended by a 0 character; looked up at $83:A9A6) that isn't the class they're in. One class per unit
  (Fighters and Myrmidons promote to Hero or Swordmaster by who they are). Ralph's entry is the Hero class he already is.
- **The story** ($8A:8745, the same change without the level check): Leif becomes a Prince at the end of Ch.18 ($E7:8AE7); Linoan a
  Sage when she visits the Ch.21 church ($FD:E78C); Lara a Dancer if she recruits Perne in 12x ($FD:9501). A Dancer can still use
  a Master Seal.
- **What changes** ($87:C113): the class, Lv 1, EXP 0. The unit's own stats, weapon points and HP stay, so the shown stats move by the
  classes' bases (held at 20). The old class's skills go and the new class's come ($83:AC5B), even a skill the unit has of their
  own: Lara's own Steal goes when she becomes a Dancer, and the scene gives it back ($FD:9507).

## Weapon ranks

What's shown ($83:91B4): for each type the class can use, its base points plus the unit's own, 250 past 255; a letter every 50, E 50
to A 250, no S ($83:936D). A type is usable if the class has it and the total reaches the item's rank ($83:965E). Each attack adds the
unit's rate / 100 points, hit or miss, up to 250 ($83:E2DA, $83:E4C0).

## Skills

A unit's skills are their own OR their class's, set when they load ($83:95C6). A weapon's (item +0x13/+0x14) count in its battles only;
holy scrolls anywhere. Bits, where the code tests them:

- +0x29 / class +0x13: 0x01 Dance ($87:93B3), 0x02 Steal ($87:99BF; the target must have less Spd), 0x04 a terrain cost nobody has,
  0x08 Bargain ($85:A1E1), 0x10 Renewal (5-10% of max HP a turn, $83:8335), 0x20 a class that can dismount, 0x40 Canto ($83:A7BA),
  0x80 civilians the AI ignores.
- +0x2A / class +0x14: 0x01 Adept ($83:D6FC), 0x02 Charm ($83:E342), 0x04 can't be captured ($87:9B10), 0x08 Miracle ($83:D4C5),
  0x10 Vantage ($83:DC0D), 0x20 Accost ($83:D66E), 0x40 Pavise ($83:D8A1), 0x80 Nihil ($83:D1D0).
- +0x2B / class +0x15: 0x01 Wrath ($83:D8C4), 0x02 Astra ($83:D6D8), 0x04 Luna ($83:D843), 0x08 Sol ($83:D86A), 0x10 Paragon
  ($83:EFCA), 0x20 a holy scroll's crit guard, 0x40 brave (items), 0x80 can't die in battle ($83:D4BD).
- Class skills: Thief Steal; Rogue (Thief Fighter) Steal and Vantage; Dancer Dance; Swordmaster and Sage Adept; every mounted class
  Canto. **Skill manuals** (items 158-167, $87:BDAF): each teaches its skill for good, refused if the unit has it. Eight are in the
  chapters (Paragon Ch.6 house, Wrath 8x chest, Vantage Colho Ch.12, Accost 12x chest, Sol Ilios 16A, Nihil Conomor 16A, Luna a
  Sellsword 16B, Adept Gustav Ch.18); Bargain and Miracle are in none. Mareeta learns Astra talking to Shannam in Ch.15 ($FD:AD54).
  The manuals are the item table's last records: it holds 0xA8 (ids 0-0xA7, `ITEM_COUNT` in `fe5_rom.py`), ending where the name
  pointers start (`$B0:8FC3` = `$B0:80AB` + 23 x 0xA8), so a reader that stops at 0xA0 loses Bargain to Luna.

## Stars, supports and the rest

- **Leadership** ($83:E414): every unit with the same leader (Leif for yours; the chapter ends set it, $83:FB5F) gets 3 hit and avoid
  per star of every such unit on the map, their own included. Stars come from the record ($83:94FE) and the scripts only: Finn and
  Eyvel 1 from Ch.1, Perne, Ilios and Misha 0, Xavier, Conomor and Amalda 1, Saias 5 then 3 as they join; Leif 0, 1 during 2x, 1
  from Ch.6, 2 from the end of Ch.9, 1 from the end of Ch.18 (`LEADERSHIP` in the generator).
- **Movement stars** ($83:A8D2): after acting, a (stars x 5)% roll, once a turn, for a second move and action.
- **Pursuit critical coefficient** ($83:D805): a follow-up's crit is multiplied by it, up to 100; other attacks' crit is held at 25.
- **Supports** (`$88:80CD`, 5-byte entries: gets u16, gives u16, bonus u8; 68): a giver in any army, not dead, undeployed, set aside
  or captured (carried still counts), within 3 tiles adds the bonus (10; 20 for four pairs) to hit, avoid, crit and crit avoid
  ($83:E5A5); bonuses add up; a unit attacked by its own giver doesn't counter. Five givers aren't playable: Ced's 4x/Ch.6 record
  (69) and Reinhardt's (71, 146).
- **Holy scrolls**: `$88:8054`, 12 entries of 10 bytes: the item id, then a signed growth bonus per stat (character order).
- **Rings** (items 125-133; $87:BC34, $87:BCBF): a level-up roll with growths from `$88:8297` (10-byte rows by (use effect - 2) / 2)
  x 4, so a fixed gain: Life HP +7; Strength, Skill, Speed, Luck and Body (Con) +3; Magic, Shield (Def) and Leg (Mov) +2. Held at the
  caps on the unit's own number; refused once it's 20 (HP 80).
- **Rescue and capture** ($83:A855, $87:9800, $87:9AA3): effective Con is 20 for a mounted unit, else the class's plus their own, held
  at 20; the other unit's must be lower. Carrying halves Str to Def ($83:9148), and Mov too when the carried unit's Con is more than
  half the carrier's ($83:8830); a capture attack halves the same ($83:E470).
- **Fatigue**: +1 a battle for both sides, dances and the arena; staves +1 to +5 by rank ($83:DB85, $83:EA2B); no deploying above max
  HP ($85:F51B); Leif never tires.

## Joins and leaves (`scripts/fe5_joins.py`, then the fixes in the generator)

Each chapter's scripts played with the event runner: the preparations groups, the opening and turn-1 events (yours at the start),
then each turn, action, talk and location event (a unit it brings on your side or makes yours; a talk whose script makes its target
yours is a talk recruit), then the ending. The runner plays one path, so the joins behind a branch, and every condition, were traced
by hand through every branch of every chapter's lists (`JOIN_FIXES`, `JOIN_NOTES`): Lifis and Safy join at the end of 2x, Salem at
the start of 12x, Misha at the end of 17A, Sara in 17A or (route B) 16B, and so on.

- **The route**: where Leif leaves Ch.15 ($FD:A9BC west, $FD:A91F the church, $FD:A9A1 east) picks 16A or 16B; the church also lets
  Schroff join. Route A brings Schroff, Ilios, Misha and Amalda; route B Miranda, Shannam and Conomor. Ilios needs Olwen dead or never
  recruited ($8C:B6C6); Saias stays after Ch.23 only if Ced isn't on the map ($FD:FA4E). The Roster picks these (`FE5_CHOICES`).
- **Leaves** (set aside $8C:A464, back $8C:A486, deleted $8C:A343): the end of Ch.3 sets aside Eyvel, Finn, Osian, Halvan, Dagdar,
  Marty, Ronan, Safy and Tanya; they come back in Ch.5 (Eyvel), Ch.7, Ch.8 or 8x (`AWAY` in the generator); Dean leaves at a
  chapter's end from 14x on without Linoan; captured units come back in 11x or 21x.

## Unconfirmed

- How much HP Sol drains.
- Whether capturing needs a weapon in hand at 1 range (the Fire Emblem Wiki says so).
- Whether fatigued units deploy when too few units are left (the wiki says so).

## Portraits (`scripts/snes_portraits.py`)

For the user's own copy of the art only: the PNGs go to `data-raw/fe5/art/` (git-ignored) and are loaded through Bulk Upload.

- **Which face:** byte +0x2F of the character record (`$86:9A2D`). Shiva's is 119 and Galzus's 23, as the records say.
- **Table** (`$8C:BFB1`, `$8C:BFC7`): 4 bytes per portrait id at `$8C:D12A`: the graphics pointer (unpacked by the game's
  decompressor, `$80:B574`, to 2048 bytes), then a palette number; the palette is 16 BGR555 colours at `$EA:C000` + 32 x that number
  (colour 0 the backdrop, transparent). Generic faces share graphics under several ids with different palettes.
- **Layout:** as Genealogy's: a VRAM block 16 tiles wide, the 48x64 face its columns 0-5 over columns 6-11, columns 12-15 the mouth
  and eye frames. Checked pixel for pixel against Mesen in Ch.1's opening talk.
- **Run:** `python scripts/snes_portraits.py fe5` (add `--sheet` for a labelled contact sheet, `data-raw/fe5/portraits-sheet.png`).
