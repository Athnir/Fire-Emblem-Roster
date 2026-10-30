# Fire Emblem Roster: the ruleset

The unit half of a pair of apps. Its partner, the Fire Emblem Armory (`../Fates Armory`), covers weapons, forging, shops, maps,
true hit and what supports give. This app covers the units. The rules below were settled with the user. When the user settles a
new rule, add it here.

## Scope

- **Unit data only.** Who joins and when, bases, growths, caps, class sets and promotions, skills, affinities, who supports whom,
  marriages and children, and unit builds. Weapon, shop, map and battle-formula data belongs in the Armory.
- **The Armory is a separate repo, worked on in its own session. Never edit it from here.** Reading it for reference is fine. If
  one of its readers (`scripts/*_rom.py`, `fe13_*.py` and the rest) is needed, copy it into this repo's `scripts/`.
- **One game picker; every tool for that game sits in the same tabs.** No extra menus or tool-picker steps. A game with nothing
  like a tool (no marriages, no skills) has no tab for it.
- **Finish one game across every tab before starting the next.** Order: Fates, Path of Radiance, Radiant Dawn, Genealogy of the
  Holy War, Thracia 776, The Binding Blade, The Blazing Blade, The Sacred Stones, Mystery of the Emblem, Awakening. Fortune's Weave
  is skipped (too new for solid data).
- **Fates is finished** and is the model for the most any game will need (no other game has a web as complex). It's only
  touched to fix bugs.
- **Only what the user owns.** Missing DLC is left out (or taken from wikis later), never obtained.

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
- **Commit and push each finished step.** End commit messages with the co-author line.
