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
- **Every game gets a Bulk Viewer** (user, 2026-11-02): at least the Team Viewer, with saved sets of plans; a game with a second
  generation adds the Parent Checker. The games still without one get theirs in their review.
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
  Unit Planner toggles a mounted unit on foot (its dismounted class), adds up every holy scroll carried (a growth below 0 counts as
  0), and counts the rings used.
- **Story class changes are planner steps** (user, 2026-11-02, Thracia: Leif's Prince at the end of Ch.18, Linoan's Sage, Lara's Dancer
  before her Master Seal), as Path of Radiance's story promotions are.
- **What the game has one copy of is flagged, not blocked** (user, 2026-11-02, Thracia's skill manuals): two plans can use it, and a
  note says the game doesn't allow it and names the other unit, as Fates' warning for a spouse picked twice.
- **When units leave and come back shows in the Roster** (user, 2026-11-02, Thracia), and stays blank under the spoiler block.
- **Skill Planners don't work out which skill a child inherits** (user, 2026-11-02): the skills are picked, and the general pool
  lists every skill the unit can have in some playthrough, following the game for what can pass (as Fates' looser pool does). In
  Awakening the classes show as chips to pick, as the DLC classes do, since the lists are long.

## Saved data

- **Never rename a storage key.** The Fates data keeps its `fates-planner-` localStorage keys and the `fates-planner-assets`
  IndexedDB from when the app was the Fates Unit Planner. Renaming either would lose what people have saved and break their
  backups. A new game gets its own prefix.
- **Every save is in the backup.** A new store must be picked up by Export Backup / Import (`src/logic/backup.ts`).

## Spoiler block

A global switch, as in the Armory: on, a game is played along chapter by chapter, and nothing is shown before the chapter that
reveals it. What that means for each tab is settled with the user as each game is built.

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
