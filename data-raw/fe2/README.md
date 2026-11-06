# Fire Emblem Gaiden (FE2): the unit data's formats

Read from the user's own ROM, `Fire Emblem Gaiden.nes` in `Documents\FE Games` (`FE2_ROM` overrides it): the Famicom game of 1992
with an English fan translation patched in. No clean Japanese ROM is to hand, so everything is read from this one; the patch rewrote
text and its pointers, and the unit tables match Serenes Forest's numbers but one value (below), so it left the data alone.
`scripts/fe2_rom.py` reads the cartridge and its text, `scripts/fe2_units.py` the units, `scripts/build-fe2-units.py` writes
`src/data/fe2/fe2Units.ts`, `scripts/fe2_portraits.py` the portraits. Nothing from the ROM is committed.

## The cartridge

iNES: a 16-byte header (`NES` 1A, 16 PRG banks of 16 KB, 16 CHR banks of 8 KB, flags 6 = $A2: mapper 10, MMC4, with battery RAM),
256 KB of PRG, 128 KB of CHR. MMC4 switches $8000-$BFFF (a write to $A000 picks the bank, 15:$CA40) and fixes bank 15 at
$C000-$FFFF; CHR is switched in 4 KB banks ($B000/$C000 for pattern table $0000). Addresses below are bank:$addr. A call into another
bank goes through 15:$CA94: A the bank, $4A the function, each bank's table of functions at its $BFA0.

## Text (the patch's)

A byte is the tile the game draws (CHR bank 0 holds the font): $45-$4D a-i, $4E j, $4F ' (an apostrophe), $50-$5F k-z, $60-$69 0-9,
$6A-$83 A-Z, $FF space, $8B , $8C ; $8D : $8F . $9C ? $9D ! $3F -. Some tiles draw two letters: $39 ll, $3C lt, $3D ti, $3E it,
$40 il, $41 li, $42 's, $43 't, $44 'r, $38 lf; $36 $37 draw "ata" and $3A $3B "att" between them. $30-$34 are the icons item names
end with (lance, sword, bow, shield, ring); $96-$9A are leftover kana. $EF ends a string, $ED is a new line. Dialogue adds control
codes (10:$8588): $E8 x y p shows portrait p (a character's number), $DF $E1 $E9 $EC $F0 take one byte, $E4 two, $E0 $E2 $E3 $E5
$E6 $E7 $EA $EB $EE $F1 none. A town scene's text n (13:$9550) is bank 3's text table 0 when n < $4C, else bank 10's table 1 at
n - $4C; a bank's text tables are listed at its $BFE0 (15:$E6DA).

Some of the patch's pointers start a letter in or point elsewhere: the menus show "and" for the Hand Lance (item 4) and "ibro" for
Libro (41); the foe class names of classes 6, 7 and 20 are "n", "al" and "ighter"; foe 136 (Deen) points at no string, foe 157
(Sonya) at "ean", foe 139 (Zeke) at an empty one. Some text tables are still the Japanese tiles.

## Characters

- **Records** (8:$90E2, 12 bytes by character - 1; 34 of them): character, class, level, max HP, EXP, Str, Skl, Spd, Lck, Def, the
  spells known (a bit per spell of the class's list), the item. A join copies the record whole into the army (8:$A6C0, then
  15:$FA0D into the army's list of 12-byte records at $6AF8); on a battle map a unit is 21 bytes ($67AE yours, $6953 the foes',
  20 each): the record, then +12 Res, +13 Mov (15:$EDD3 by class, 6:$8C2D), +14 HP, +16/+17 the tile, +18 $FF once dead, +19 flags
  ($84 a guest: no EXP, 9:$885B), +20 set for a class with bows.
- **Growths** (9:$8DE9, u16 pointers by character - 1): 6 bytes Str, Skl, Spd, Lck, Def, HP, in percent.
- **Res** (15:$EE00 by character - 1): a character's own, fixed: it isn't in the record, never grows, and no class change moves it.
  A Dread Fighter adds 15 (15:$EDF3, put in as the unit is placed, 6:$8C47), so it goes again on the change back to Villager. (The
  status screen also adds 13 for the Dragon Shield, 11:$8771.)
- **Names** (15:$DEA9, u16 pointers by character - 1; the foes' at 15:$DFBA): four or five tiles, so mostly short ("Celic", "Kreb").
  The app takes the dialogue's spelling where the translation gives one (Celica, Norma, Claire, Cleve, Balbo, Zeke; checked against
  the scenes), else the menu's.
- **Portraits**: 9:$BDBF by character (below).
- Character 11 is a second copy of Clive's record (10), the one his join uses (its first byte is 10, so he joins as 10). Character 24
  never joins: a Paladin, Lv 5, its name pointer Forsyth's, its portrait Alm's promoted one.

## The level-up (9:$8858)

- At 100 EXP, below Lv 20 (so Lv 20 is the last in every class; no EXP is gained there), and not for a guest.
- For HP, Def, Lck, Spd, Skl, Str in turn: a roll of (random byte x 99) / 256 + 1 (1-99, 15:$C068 through the multiply at
  15:$C6C9), and the stat grows when the roll is below its growth. So a growth G is a chance of ceil(256 (G - 1) / 99) / 256: 50 is
  49.6%, 20 is 19.5%, 10 is 9.4%, 5 is 4.3%, 1 never. The random byte is $37; each call of 15:$C04E adds 55 to it (the main loop
  calls it once a frame too), so one level-up's six rolls are r + 55, r + 110 ... of one r.
- A level-up where no stat grows adds 1 HP (9:$88E0). With the rolls tied together, that is worked out exactly over the 256 r for
  each unit (`expected_gains`, FE2_EXPECTED_GROWTHS): Mycen's 5% growths make his HP rise 0.87 a level.
- With the Angel Ring (item $37) equipped every gain is 2, the HP one too (9:$8886).
- Caps: HP 52, every other stat 40, in every class (9:$88CD-$88D9). No class has caps of its own.
- EXP (the Armory's to show; for the record): a kill is ceil(foe's EXP x the class strength x the level factor / 100) (9:$8B74;
  rounded up, where Serenes says fractions are dropped), a foe's EXP being its class's + (Lv - 1) x its class's / 10, at most 255
  (8:$A396); the class strengths are 9:$8F21 (Serenes' "CS"), the level factors 9:$8EF9 (10, 10, 9, 8, 7, 6, 5, 4, 3, then 2 to
  Lv 19, 1 at 20). Every unit placed in a battle and alive at its end gets ceil(20 x CS x LF / 100), held at 99 (6:$B74B). A hidden
  option set on the new-game screen ($6E8C, 2:$BC2B) doubles EXP (9:$8BAC).

## Classes

The game numbers 22 classes and gives the same number to one of yours and a foe's (15:$DB73 names yours, $DC2E the foes', u16
pointers by class - 1): 3 Pegasus Knight / Gargoyle, 5 Falcon Knight / Dragon Zombie, 11 Priestess / Zombie, 14 Villager / Thief,
16 Mage (women) / Witch, 17 Saint / Skeleton, 18 Cleric / Bigl, 19 Sage / Shaman, 21 Fighter / Duma, so they share their bases.

- **Bases** (15:$ED04, u16 pointers by class - 1, classes 1-23): 7 bytes Str, Skl, Spd, Lck, Def, HP, the EXP a foe of it is worth.
  23 is the Hero (Alm's promotion reads it). The Fighter's HP 182 is Duma's.
- **Mov** 15:$EDD3 and the foes' **Res** 15:$EDEA, by class - 1. Your units' Res is their own (above).
- **Weapons** (15:$F460): items below 2 anyone; 2-10 the lances (15:$F512 list 1: classes 1-7 and 22, but a Soldier not the Hand
  Lance or the Galdius, 15:$F46F), 11-19 the swords (8, 9, 10, 11, 21, 14), 20-22 the bows (13, 12, 20, and the Fighter once Alm is
  a Hero, 15:$F4FA), 23-47 the spells (15-19 and 11). An item whose 15:$D9F4 byte has bit 7 is the character's in its low bits: the
  Falcion and the Royal Sword are Alm's. For a spell that byte is the HP it costs.
- Names: 24 is "Royal", Celica's once promoted (13:$A1C2), and 23 "Hero", Alm's.

### Class changes at a Mila statue (8:$A804)

From 15:$E3A7 to $E3B5 at the level $E3C2: Knight (Cavalier) to Paladin at 7, Paladin to Gold Knight 10, Soldier to Armor (Knight) 7,
Armor to Baron 10, Mage (women) to Priestess 20, Archer to Sniper 7, Mercenary to Myrmidon 7, Mage (men) to Sage 12, Cleric to
Saint 12, Pegasus Knight to Falcon Knight 12, Sniper to Bow Knight 10, Myrmidon to Dread Fighter 10, Dread Fighter to Villager 10.
A Villager at Lv 3 becomes one of $E3CF's five at random ((random byte x 5) / 256: Knight 52/256, Mercenary, Archer, Mage and Soldier
51/256 each); the change can be refused (8:$A8F2) and asked for again.

The change (8:$A96C): the level becomes 1 and EXP 0; HP, Str, Skl, Spd, Lck and Def (8:$A3E2: +3, +5-+9) are each lifted to the new
class's bases where lower, and if none is, max HP rises by 1 (if that stays within 52). Res isn't touched (Serenes Forest says it is
lifted too; there is no Res in the record to lift). Mov is the new class's. A Villager becoming a Mage knows Fire alone and starts its
count of spell levels again (8:$AA24); a change into Priestess, Sage or Saint learns the class's eighth spell (Recover, Recover,
Angel: 8:$A9F2).

### Alm's and Celica's promotions

- **Alm** can't use a statue: a Fighter needs Lv 21 there (8:$A854). His promotion is a scene, Celica's army talking to Hark at the
  Sage Village (13 script 57, special 9 at 13:$96B4), which runs the statue's change into class 23 (8:$A96F): level 1, EXP 0, lifted
  to the Hero's bases or HP + 1. His class byte stays 21; a flag ($744A) names him Hero, gives his portrait, lets him use bows
  (15:$F4FA) and draws his range (6:$A63D). Nothing reads class 23's Mov (6), so his Mov stays the Fighter's 5 (6:$8C2D; Serenes
  gives the Hero 6).
- **Celica** promotes in a scene at Fort Geeth, walking onto its spot (13 script 37, special 2 at 13:$97D8): her level becomes 1 and
  nothing else changes; her class stays 11 and a flag ($744B) names her Royal and gives her portrait.

The app keeps Celica's Priestess apart ("11c") so a Mage who becomes a Priestess isn't offered Royal, gives "23" the Fighter's Mov, and
"24" bases of 0 (her promotion lifts nothing).

## Spells

- Each casting class has eight spells (15:$E199, 8 bytes each: Priestess, Mage (men), Mage (women), Saint, Cleric, Sage): a bit of
  the record's spell byte is the spell in that place. Fire, Thunder, Ragnarok, Angel, Excaliber, Arrow, Aura, then Recover for the
  Priestess and Sage (none for the Mages); Recover, Libro, Drain, Warp, Reserve, Illusion, Dear, then Angel for the Saint (Fire for the
  Cleric, never set).
- The spells' numbers, by item (bank 15): Mt $D9B9, Hit $DA54 (9:$8227; 0 for the white magic that doesn't roll), Crit $DA84
  (9:$83EA), the HP it costs $D9F4, the range bits $DAFD (6:$9AD0: 0x02 a foe next to the caster, 0x04 two tiles away, 0x10 an ally's
  spell, 0x20 any range; Thunder reaches three, 6:$A646) and what it's effective against $DAB4 (9:$8298: an index into $DAE4's
  pointers, each a list of classes ended by $FF; Mt x3 against them: Angel's is the monsters, classes 3, 5, 11, 17 and 18 as foes).
  Items 23-29 and 40-46 are the casting classes' (two items are named Recover and two Reserve: 35 and 36 are the foes'). A spell can't
  be cast unless the caster has more HP than it costs (9:$8B63: the unit's weapon becomes item $2F). The ROM has no words for what a
  spell does: the Spells tab gives Serenes Forest's for the white magic, and every number matches its Gaiden magic pages
  (`src/data/fe2/__tests__/fe2Spells.test.ts`).
- Learned (15:$E299, 11 bytes: character, then five (count, spell item)): a character in the table counts its level-ups in any class
  but Villager ($6E7A, 9:$891E), and on the level-up that brings the count to the table's number - 1 it learns the spell, if its
  class is a casting one and has it (1:$ADDE). So the joining level counts as 1 (Luthier joins at 7: Thunder at count 4 is Lv 10),
  becoming a Mage from a Villager starts the count again, and other class changes carry it on (Serenes' note: "Previous Level - Level
  before promotion + 1"). Mycen's entry (Aura at 17) can't be reached: a Gold Knight never changes class.

## Town scenes and who joins (bank 13)

A town is entered from a world-map node (49 onward): 13:$B98C[node - 49] is the town (13:$853B), and the node's name is
11:$B821[node - 1] (11:$96AD). In a town only the army's leader walks. Rooms 3 (the Liberation HQ's other room), 32 (in the Thief Shrine) and 34
(below the Mira Temple) aren't on the world map; their scenes say where they are.

- **Scripts** ($B61B, u16 pointers; 62): blocks of [actor] commands ... $00, ended by $EF (13:$99A1). A command's high nibble
  (13:$949B): 0 wait, 1 face, 2 and D move, 3 text (+1 byte), 4 special (the low nibble: 2 Celica's promotion, 9 Alm's), 5 music
  (+1), 6 and B (+1 when the low nibble isn't 0), 7 **join** (+1: the character, 13:$9809: its record goes into the current army,
  $05B8), 8 place, 9 battle, A flag event (+1, 15:$FACC), C walk to (+2), E **next chapter** ($744C + 1 and 12:$ABC2's start of
  that chapter, then a warp from $BEF0: 1 to the Monastery, 2 Sofia Castle's room 44, 3 the Sewer Gate, 4 Regal Castle), F end the
  scene. The fourth (Mycen's scene) is only a warp: "Chapter 5"'s start puts the chapter back to 4 (12:$AC6A), and nothing else
  raises it (6:$8850 sets 1, 13:$98F4 adds).
- **Triggers** ($B4FA, u16 pointers by town - 1): up to eight 3-byte entries, bit k of the town's third flag byte ($6E32) opening
  entry k: $FF, actor + 1, script for a talk (13:$AF3D), else x, y, script for a step (13:$8F0B).
- **People** (10:$8C6B, two u16 pointers per town: the second when the town's first flag byte, $6D9C, has bit 7): 9-byte entries,
  actor 1 first, $FE skips a slot, $EF ends; the first flag byte's bit k takes actor k + 1 away (10:$8C16).
- **Flag events** (10:$8000, u16 pointers; 92): 7 bytes, town - 1, then an AND and an OR for each of the town's three flag bytes
  ($6D9C people, $6DCE, $6E32 triggers), applied by 15:$FACC. Their first state: 15:$FB8F (town - 1, $6E32 pairs; the rest 0).
- **Arriving** (15:$FB2F, $FB62: town, event for Alm's army, event for Celica's): the Desert Fortress (town 12) opens Jesse's talk for
  Celica's army and closes it for Alm's; the Regal Village (21) opens Zeke's for Alm's.
- **Deaths** (15:$F18D, 3 bytes: the character, a kind, a value; checked as a unit dies, 9:$8BC8): kind 1 runs a flag event. A
  guest dying closes their talk (Kamui 13, Leon 14, Valbar 15, Mathilda 33, Palla 38, Catria 39); the foes Delthea (145, 8:$9606),
  Deen (136, 8:$9557), Sonya (157, 8:$9567) and Zeke (139, 8:$9634) take themselves away, and Zeke Tatiana with him (31); the
  foe the patch calls Gaha (158, a Thief, 8:$951E) opens Palla's and Catria's talks (37). Forsyth dying takes the Liberation HQ's
  people away (59, 60). One entry is for character 57, which no unit is (dead data).
- **Guests** (6:$8B48: 15:$F16B by battle -> 15:$F178 lists of (character, $84)): Mathilda; Palla and Catria; Valbar, Kamui and
  Leon fight on your side, getting no EXP.
- **The armies**: a new game makes Alm's army of Alm alone (8:$A6F2, list 0 at $90E0) at Ram (node 49, 6:$8889); Chapter 2's start
  (12:$ABC2, run by the next-chapter command) makes Celica's (12:$ABD3).

Every join's town, talk and conditions are read and checked by `fe2_units.py` (JOIN_RULES: the build stops if the ROM disagrees),
with the words in JOIN_NOTES. Which army visits a town and in which chapter is the story's, as Serenes Forest's recruitment page has
it; the ROM settles it for Jesse and Zeke (by arriving), Nomah (his talk opens in the scene that starts Chapter 4) and Mycen (the
chapter is 4 from then on).

## Special attacks

There are no supports. Two fixed bonuses: Palla, Catria and Est's triangle attack (one of them attacking a foe next to her with the
other two on the four tiles around her, 6:$9C20) and Alm attacking with Celica on a tile next to him (6:$AAF6): both make the
attacker's strikes criticals that do 5 more damage (9:$830F, 9:$8556).

## Checked against Serenes Forest

Every unit's army, chapter, class, level, bases (Res and Mov too) and growths match (`src/data/fe2/__tests__/fe2Units.test.ts`),
but Valbar's Skl: 5 in his record (8:$91B4; Shadows of Valentia gives him 5 too), Serenes 4. The class bases, Mov, class
strengths and every class change and level match Serenes' class pages. The magic levels match but Nomah's: his record knows Thunder
on joining (spell byte $B3), which Serenes leaves out. Where Serenes differs on rules: a class change doesn't lift Res; EXP is rounded
up; promoted Alm's Mov stays 5.

## English names

The app shows Shadows of Valentia's official names for the units and the classes (`SOV_NAMES` in `scripts/fe2_units.py`, `SOV_CLASSES` in
`scripts/build-fe2-units.py`, both checked against the app's Shadows of Valentia data): the translation's menus fit four or five tiles
("Pala", "Bird", and "Knight" for four classes). Each unit keeps the translation's own name beside it (`altName`: the dialogue's where it
gives one, else the menu's), as the patched game shows it, and places keep the translation's names, since they're what the game shows
when looking for a unit. The menus' names (four or five tiles), the dialogue's where it differs, and Shadows of Valentia's:

| # | Menu | Dialogue | SoV | | # | Menu | Dialogue | SoV |
|---|---|---|---|---|---|---|---|---|
| 1 | Alm | | Alm | | 19 | Matil | | Mathilda |
| 2 | Celic | Celica | Celica | | 20 | Pay | | Python |
| 3 | Misen | Misen, Mycen | Mycen | | 21 | Leo | | Leon |
| 4 | Norm | Norma | Nomah | | 22 | Atla | | Atlas |
| 5 | Ruka | | Lukas | | 23 | Jesi | Jesi | Jesse |
| 6 | Cliff | | Kliff | | 25 | Soni | Soni | Sonya |
| 7 | Bird | | Tobin | | 26 | Dean | Dean | Deen |
| 8 | Grey | | Gray | | 27 | Sevr | | Saber |
| 9 | Clea | Claire | Clair | | 28 | Ryu | | Luthier |
| 10 | Kreb | Cleve | Clive | | 29 | Dute | Dute | Delthea |
| 12 | Fols | | Forsyth | | 30 | Tita | Tita, Teeta | Tatiana |
| 13 | May | | Mae | | 31 | Catu | | Catria |
| 14 | Silk | Silk | Silque | | 32 | Pala | | Palla |
| 15 | Jeni | | Genny | | 33 | Est | Est | Est |
| 16 | Boey | | Boey | | 34 | Shek | Zeke | Zeke |
| 17 | Cami | | Kamui | | | | | |
| 18 | Baro | Balbo | Valbar | | | | | |

Classes (the patch's, then SoV's): 1 Knight (Cavalier), 2 Armor (Knight), 3 Knight (Pegasus Knight), 5 Knight (Falcon Knight), 7 Knight
(Gold Knight), 8 Mercn (Mercenary), 9 SwordM (Myrmidon), 10 MagicKn (Dread Fighter), 11 Priest (Priestess), 15 and 16 Wizard (Mage),
17 Nun (Saint), 18 Sister (Cleric), 20 Bowman (Bow Knight), 24 Royal (Princess); Paladin, Soldier, Archer, Sniper, Villager, Sage,
Fighter, Baron and Hero are the same. Places and others: Sofia (Zofia), Regal / Regel (Rigel), Mira / Mera (Mila), Nowhere (Novis),
Tozeh (Desaix), Geeth (Grieth), Doma (Duma), Judah (Jedah), Tatara (Tatarrah), Hark (Halcyon), Sreida (Slayde), Anteze (Anthiese),
Ripurel (Liprica).

## Unconfirmed

- The chapter of each town and the army that visits it, but where the ROM settles it (above): Serenes Forest's.
- Zeke: Serenes says he joins only if Tatiana was recruited; nothing in the towns' flags says so (it may be in his battle).
- The death entry for character 57, and Forsyth's death taking the Liberation HQ's people away (events 59, 60): read, not seen.
- The rooms 3, 32 and 34's places, from their scenes.
- Promoted Alm's Mov 5 (the code; Serenes 6).
- The special attacks when a foe attacks, and with the Hand Lance (9:$819E clears the bonus for item 4).
- The hidden option's buttons ($6E8C: held on the new-game screen, then a yes; 2:$BC2B).
- That the random byte is evenly spread when a level-up rolls (the averages assume it).

## Portraits (`scripts/fe2_portraits.py`)

For the user's own copy of the art only: the PNGs go to `data-raw/fe2/art/` (git-ignored) and are loaded through Bulk Upload. Bank 9
draws them as 36 sprites, 6 x 6 (9:$AC23 and $ACBF):

- **Which face:** $BDBF[character] is the portrait P (9:$AE34); Alm once promoted shows $BDBF[$24], Celica $BDBF[$25].
- **Graphics:** $B014[P] is the 4 KB CHR bank, at pattern table $0000. **Palette:** $BAFD[P] points to 12 bytes, three colours for
  each sprite palette; colour 0 is black ($0F, 9:$AC92).
- **Sprites:** $AE97[P] points to the 36 tiles, row by row, at y $AE4F[k] and x $AE73[k]; $AF6B[P] to 18 bytes of attributes, two
  sprites each (bits 7-6 and 5-4 the first's flips and palette, 3-2 and 1-0 the second's). The mouth frames ($AF01[P]) aren't drawn
  at rest.
- **Colours:** a standard NES (2C02) palette. **Backdrop:** the sprites paint it in (an orange in most), so it's cleared where it
  touches the edge, as fe1_portraits.py does; `--keep-box` keeps it.
- **Run:** `python scripts/fe2_portraits.py` (32 portraits, 48x48; `--promoted` adds Alm's and Celica's promoted faces;
  `--sheet <png>` a labelled contact sheet).
