# Fire Emblem Roster: the ruleset

The unit half of a pair of apps. Its partner, the Fire Emblem Armory (`../Fates Armory`), covers weapons, forging, shops, maps,
true hit and what supports give. This app covers the units. The rules below were settled with the user. When the user settles a
new rule, add it here.

## Scope

- **Unit data only.** Who joins and when, bases, growths, caps, class sets and promotions, skills, affinities, who supports whom,
  marriages and children, and unit builds. Weapon, shop, map and battle-formula data belongs in the Armory.
- **Pair-up is the one thing in both apps** (user, 2026-11-02): the Armory shows what a class gives on its own; the Roster puts it in
  full builds, with the partner and their stats, as the Fates tab does.
- **The Armory is a separate repo, worked on in its own session. Never edit it from here.** Reading it for reference is fine. If
  one of its readers (`scripts/*_rom.py`, `fe13_*.py` and the rest) is needed, copy it into this repo's `scripts/`.
- **One game picker; every tool for that game sits in the same tabs.** No extra menus or tool-picker steps. A game with nothing
  like a tool (no marriages, no skills) has no tab for it.
- **The picker lists the games in the series' order, by number** (user, 2026-11-04): "14. Fire Emblem Fates", and each mainline
  game the app doesn't have (Gaiden, New Mystery of the Emblem, Fortune's Weave) in its place, greyed out.
- **Every game gets a Bulk Viewer** (user, 2026-11-02): at least the Team Viewer, with saved sets of plans; a game with a second
  generation adds the Parent Checker. The games still without one get theirs in their review. It shows only the units with a plan
  (or in the set shown), never the whole roster, as Fates' does (user, 2026-11-05).
- **Rules too long for the tabs go in an Info tab** (user, 2026-11-02, Thracia's rescue, capture and fatigue): the user checks them by
  hand, rather than the tabs working them out and getting busy.
- **Finish one game across every tab before starting the next.** Order: Fates, Path of Radiance, Radiant Dawn, Genealogy of the
  Holy War, Thracia 776, The Binding Blade, The Blazing Blade, The Sacred Stones, Mystery of the Emblem, Awakening, then Shadows of
  Valentia (the user added its files, 2026-10-30), then Shadow Dragon (added 2026-10-30). The Switch games (the FE1 re-release,
  Three Houses, Engage) come once the user can dump them. Fortune's Weave is skipped (too new for solid data).
- **Fates is finished** and is the model for the most any game will need (no other game has a web as complex). It's only
  touched to fix bugs.
- **Only what the user owns.** Missing DLC is left out (or taken from wikis later), never obtained.
- **Mainline games only** (user, 2026-11-03): the spin-offs (the Warriors games, Heroes, Tokyo Mirage Sessions, BS Archanea War
  Chronicles) stay out. ROM hacks may come later, each only with its author's permission.

## Art: the game's own, never shipped

- **The app uses the games' real portraits and icons, but none ship in the repo.** `public/art/` and `public/skills/` are
  git-ignored; the repo and the deploy carry blank placeholders, and whoever installs the app supplies the files (Edit Mode →
  Bulk Upload, stored on that device only). See `ART_ASSETS.md`.
- **Placeholders are plain blanks** (a silhouette, an empty icon), never drawn icons: the pixel sprites are the Armory's look.
- **Never commit or push game art, dumped game files, or ROMs.**
- **Every game's art can be loaded at once** (user, 2026-11-03): the home screen's Bulk Upload takes one folder or .zip with a
  folder per game named by its number (`fe9`, `fe14` for Fates...), each laid out as that game's own Bulk Upload takes it, so a name two games
  share (Ike, Marth) can't land in the wrong one. A game's `art` (GameParts) says how its folder is matched and what it can hold.
  Each game's portraits come from a script reading the user's dump into `data-raw/<game>/art/`; `scripts/pack_art.py` packs them
  into the user's personal zip (`Documents\FE Games\FE Roster Art.zip`), never into the repo.
- **Engage's portraits are its 3D models, waist up** (user, 2026-11-04): posed and lit as its status and inventory screens draw
  them (`scripts/fe17_models.py`), since its only 2D art of the units ends at the neck. Each Bond Ring shows its hero's face, and
  each Emblem Ring its Emblem's, from the Somniel's ring book (user, 2026-11-04; Ephraim's, which the book lacks, drawn from his
  model). Skills show the game's icons.
- **The Avatar is two units, a man and a woman, as Fates' Corrins are** (user, 2026-11-04): both always listed, no gender pick
  (Engage's two Alears, each with her or his own portrait; Three Houses' two Byleths). The Emblem Alear shows both faces.
- **Three Houses' abilities and combat arts show the game's icons** (user, 2026-11-04): an ability's square one, a combat art its
  weapon's round one, as the game draws them; spells have none of their own.

## Data sources

- **The game's own files first** (the user's dumps), then Serenes Forest / fireemblemwod.com / the wikis for what the files
  lack. Fates keeps its hand-entered Serenes Forest data.
- **Dumps stay where the user extracted them** (each game's reader has the default path), or in `data-raw/<game>/`, which is
  git-ignored except each game's `README.md` (the formats). Only data derived from them goes in the repo.
- **Japanese-only games:** read the clean Japanese files; English names come from the community translation patches' name
  tables, applied in memory only (as the Armory does).
- **Everything generated comes from a re-runnable script**; fix the generator, never the output. Formats go in
  `data-raw/<game>/README.md`.
- **The game wins.** When the data contradicts a wiki or memory, say so plainly and point to the file.
- **Check mechanics in the program code for each game; never assume they match another game** (stat inheritance, caps, growth
  formulas, support and pair-up bonuses).
- **Anything not confirmed goes under `unconfirmed`, not stated as fact.**
- **Fates' child base stats stay a low estimate** (user, 2026-11-01): the parents count at their join stats and the levels
  above 10 grow at the child's personal growth alone. There's no field for the parents' real stats (it's complex enough); the
  screens say a child usually comes out a point or two higher.
- **Awakening's children join as the game works it out** (user, 2026-11-02): their own stats plus a third of how far each parent
  is above them, from the parents' Unit Planner stats (the program, 0x3a44d0). The parents' stats are already in the planner there.
- **A planner keeps every class change the game allows, up to 30** (user, 2026-11-02, Awakening): the game has no limit; 30 is
  past what most playthroughs use, and can be raised.
- **Planners estimate; they don't promise exact numbers** (user, 2026-11-02, Path of Radiance and Radiant Dawn): Fixed mode counts a
  level as one 100-EXP award, without the weapon's and the foe's growth changes, and Radiant Dawn's +1 on a level where every roll
  fails is left out. The screens say the numbers can run a little low or a point off.
- **Blossom** (user, 2026-11-02): in Path of Radiance it's in Sothe's skills from the start and can be removed; in Radiant Dawn it's
  a tickbox, assumed kept on for the whole plan, as Aptitude is in Fates. Either way it's a carried skill and takes capacity.
- **The story's choices of who joins are picked in the Roster** (user, 2026-11-02: Path of Radiance's Nasir or Ena, and the
  Endgame royal; Genealogy's Iuchar or Iucharba; Thracia's route by Ch.15's exit, Olwen or Ilios, and Ced or Saias); the other
  options' units drop out of every tab. Genealogy's children and their
  substitutes follow the pairings the same way (a mother not picked yet keeps both).
- **Genealogy's children join as the game makes them** (user, 2026-11-02): the code's formulas ($87:A869, $87:A6E6), from the
  parents' Unit Planner plans. A child's Luck shows its average and range (the game adds a random 1 to 10), and a stat stored
  at 16 or more shows a warning (the save keeps 4 bits, so a reload wraps it).
- **A Path of Radiance save is ticked per unit in Radiant Dawn's Unit Planner** (user, 2026-11-02): the stats that were at their
  cap there, and the A supports, which become +5 bonds. Volug shows half-transformed for Part 1.
- **Thracia keeps each unit's own stats apart from the class, as the game does** (user, 2026-11-02): what's shown is the class's base
  plus their own, held at 20 (HP is kept whole), so a promotion moves the shown stats by the classes' bases and leaves HP. The
  Unit Planner toggles a mounted unit on foot (its dismounted class) and adds up every holy scroll carried (a growth below 0 counts
  as 0).
- **No per-unit stat-up items in the Unit Planners** (user, 2026-11-05): Engage's stat boosters and Thracia's rings are left out;
  what's unlocked for everyone stays (Three Houses' Saint Statues, which raise the maximums).
- **Story class changes are planner steps** (user, 2026-11-02, Thracia: Leif's Prince at the end of Ch.18, Linoan's Sage, Lara's Dancer
  before her Master Seal), as Path of Radiance's story promotions are.
- **What the game has one copy of is flagged, not blocked** (user, 2026-11-02, Thracia's skill manuals): two plans can use it, and a
  note says the game doesn't allow it and names the other unit, as Fates' warning for a spouse picked twice.
- **When units leave and come back shows in the Roster** (user, 2026-11-02, Thracia), and stays blank under the spoiler block.
- **Support levels are written out with their half levels** (user, 2026-11-03, Three Houses): C+, B+ and A+ where a pair has them,
  and a pair that stops before A shows where it stops.
- **Engage and Three Houses follow Fates' tabs** (user, 2026-11-04): the Avatar as two units, the Unit Planner's growths and
  maximums before the projected stats, the Skill Planner's rows by source (a class, a skill rank, an Emblem) under the loadout,
  saved sets in the planners, the Team Viewer table. Engage's Pact Ring is only noted on Alear's Emblem Ring (user, 2026-11-05), not
  planned in the Supports tab.
- **Engage and Three Houses have a Classes tab** (user, 2026-11-04): each class's fixed things, its skills and bases (the least a
  unit shows in it), growths and caps or boosts; Three Houses' adds the exam (level, seal, ranks) and a calculator for its pass chance
  from the ranks and Luck put in, as the game works it out (0x633f60).
- **The Unit Planner estimates any class at any level** (user, 2026-11-04, as Fates' Projected Stats): pick a class the unit can be
  in and a level, and see that class's growths and maximums and the rough stats there, by the shortest way from the class they join
  in (Engage: promoted at Lv 20 unless set). It doesn't change the plan.
- **A skill that comes in levels shows its top level alone** (user, 2026-11-04): Sword Prowess Lv 1-4 beside Lv 5, Sword Agility
  1-4 beside 5, Unyielding beside Unyielding++ (the game replaces a lower level with a higher), unless the tickbox shows every level.
  The chains are the game's own upgrade groups.
- **Three Houses' and Engage's Rosters keep to who the unit is** (user, 2026-11-04 and 11-05): no supports, growths, skill levels
  or skills there (the planners and the Supports tab have them; Engage's proficiencies in the Unit Planner, SP in the Skill Planner,
  support type in the Supports tab, the class's weapons in the Classes tab). Each unit is a Noble or a Commoner, never both. In the Skill Planner a skill's ranks are
  tiers and the classes are grouped by tier. What the ranks (or a budding talent) teach is starred by how many units can learn it,
  any way but as a personal ability (user, 2026-11-05): ★ half the units or fewer, ★★ three or fewer. A dark magic skill and its
  black magic twin work the same and count as one (Black and Dark Tomefaire, Magic Range +1: every unit learns one, no star).
- **A class only some can be in keeps its skills to them** (user, 2026-11-04): Three Houses' Dancer and its dances, Sword Avo +20
  and Sword Dance only for the White Heron Cup's candidates (the 24 students and Flayn); Engage's Dancer is Seadall's.
- **Skill Planners don't work out which skill a child inherits** (user, 2026-11-02): the skills are picked, and the general pool
  lists every skill the unit can have in some playthrough, following the game for what can pass (as Fates' looser pool does). In
  Awakening the classes show as chips to pick, as the DLC classes do, since the lists are long.

## Saved data

- **Never rename a storage key.** The Fates data keeps its `fates-planner-` localStorage keys and the `fates-planner-assets`
  IndexedDB from when the app was the Fates Unit Planner. Renaming either would lose what people have saved and break their
  backups. A new game gets its own prefix.
- **Every save is in the backup.** A new store must be picked up by Export Backup / Import (`src/logic/backup.ts`).
- **The desktop app keeps one address and one data folder** (user, 2026-11-03): it loads from `app://roster/` and saves to
  `%APPDATA%\Fire Emblem Roster`, both set in `electron/main.cjs`. Changing either strands what's saved and leaves a copy behind, as
  the old random port did (a new address every launch: 34 copies, 517 MB). It has no service worker, since its files are on disk.

## Spoiler block

A global switch, as in the Armory: on, a game is played along chapter by chapter, and nothing is shown before the chapter that
reveals it. What that means for each tab is settled with the user as each game is built.

- **On by default, and the app opens on the home screen while it's on** (user, 2026-11-03, as the Armory does): no game picked,
  a few notes on what the app is and the games it covers, and the Bulk Upload for every game. With the block off it opens on the
  last game. Saves from before the default changed were switched on once (the store's version 1).

- **A story split is picked when you reach it** (user, 2026-11-03, Three Houses): with the block on, the Roster asks for what's known
  at the start (Three Houses: the house) and asks for the route only once the chapter bar reaches the split (Chapter 12). With the
  block off, the route is picked straight away.
- **A personal skill's later form replaces the first once the chapter reaches it** (user, 2026-11-04, Three Houses): Professor's
  Guidance+ from Chapter 11 (the Sothis fusion in Chapter 10), the house leaders' Lineage+ from Part II (Chapter 13); before then
  only the first shows. With the block off, both.
- **Every game gets the block** (user, 2026-11-03): its chapter bar, units shown once they can have joined, picks asked at their
  chapter, time-away lines blank.
- **Felicia and Jakob both stay listed** (user, 2026-11-03, Fates): a note says you get the one of the opposite gender to Corrin,
  and nothing says if or when the other comes.
- **Engage's rings show with their Emblem** (user, 2026-11-03): an Emblem Ring (major), and the Bond Rings (minor) of its world,
  from the chapter the ring first comes in; the six rings taken after Chapter 10 don't hide again. The Heroes Bond Rings come from
  the first visit to the Somniel (after Chapter 3). The Emblems tab shows Major or Minor rings, picked at its top.

## Build and offline

- **Each game is its own file** (`src/games/<id>.ts`, loaded when the game is first picked). Shared screens must not import a
  game's data directly; pass it in.
- **Every file is precached** so each game works offline without being opened first.
- **The deploy reads the repo's own name for its path** (`PAGES_BASE` in `.github/workflows/deploy-pages.yml`).
- **A deploy that fails is urgent:** GitHub Pages stays on the last good build.

## Look and layout

- **Everything fits a phone screen.**
- **Wording works for every game** ("Lord", not "Corrin", in shared screens).

## Process

- **Build the base from the data first; the user then checks in-game.** Their corrections become rules here.
- **Check counts and values against outside sources in the tests**, with every exception explained.
- **Back each rule with a test where it can be checked.**
- **Look at each change in the browser before calling it done.**
- **Commit each finished step; push once a whole game is done.** A push to `main` deploys, and the user wants one deploy per
  game, not one per tab (user, 2026-10-29). End commit messages with the
  co-author line.
