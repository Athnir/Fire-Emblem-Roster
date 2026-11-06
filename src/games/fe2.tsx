import {
  FE2_CHAPTERS,
  FE2_CLASS_CHANGE_SPELLS,
  FE2_CLASS_SPELLS,
  FE2_CLASSES,
  FE2_EXPECTED_GROWTHS,
  FE2_SPELL_STATS,
  FE2_SPELLS,
  FE2_STORIES,
  FE2_UNITS,
} from '../data/fe2/fe2Units'
import { GbaPlanner, GbaRoster, type GbaData } from '../gba/screens'
import { GbaSpells } from '../gba/spells'
import { telliusArt } from '../tellius/art'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

// Gaiden on the shared screens, read from the user's own ROM (the Famicom game with an English fan translation; scripts/build-fe2-units.py,
// data-raw/fe2/README.md). Units and classes go by Shadows of Valentia's official names, the translation's beside each unit.

const VILLAGER = '14'
const MAGE = '15'
const SPELL_TEXT =
  "A spell is learned at the level-up where the game's count of the unit's levels reaches its number, and only if the class has the spell then (1:$ADDE). The level they join at counts as 1, a Villager's levels don't count, and becoming a Mage from a Villager starts the count again, knowing Fire alone. Becoming a Sage or a Priestess gives Recover, and a Saint Angel (8:$A9DF)."

export const FE2_DATA: GbaData = {
  gameId: 'fe2',
  stories: FE2_STORIES,
  chapters: FE2_CHAPTERS,
  units: FE2_UNITS,
  classes: FE2_CLASSES,
  // HP, Str, Skl, Spd, Lck, Def, Res and Mov: no Magic. Res is the unit's own and never grows.
  stats: ['hp', 'str', 'skl', 'spd', 'lck', 'def', 'res', 'mov'],
  growing: ['hp', 'str', 'skl', 'spd', 'lck', 'def'],
  statLabels: { str: 'Str' },
  promotion: { difference: ['mov', 'res'], raise: ['hp', 'str', 'skl', 'spd', 'lck', 'def'], noneRaised: { hp: 1 } },
  promotionText:
    "A class change at a Mila statue needs the level shown and starts again at Lv 1 with no EXP: HP, Str, Skl, Spd, Lck and Def are each lifted to the new class's bases where lower, and max HP rises by 1 when none is (8:$A96C). Res isn't touched (a Dread Fighter adds 15 while one) and Mov becomes the new class's. Lv 20 is the last level in every class (9:$8858), and the caps are HP 52 and 40 for the rest, in every class (9:$88CD).",
  expectedGrowths: FE2_EXPECTED_GROWTHS,
  expectedGrowthText:
    "A level-up rolls all six stats from one random number, 55 apart for each (15:$C04E), against (the number × 99) / 256 + 1 (15:$C068): a growth of G grows a little under G% of the time (50 is 49.6%, and 1 never), and a level-up where nothing grows adds 1 HP (9:$88E0). The averages use these real chances, the six rolls together.",
  spells: FE2_SPELLS,
  classSpells: FE2_CLASS_SPELLS,
  classChangeSpells: FE2_CLASS_CHANGE_SPELLS,
  spellCount: { skip: VILLAGER, restart: { from: VILLAGER, to: MAGE } },
  spellText: SPELL_TEXT,
  spellStats: FE2_SPELL_STATS,
  spellBookText: `${SPELL_TEXT} A spell can't be cast unless the caster has more HP than it costs (9:$8B63). The ROM has no words for what a spell does: the white magic's are Serenes Forest's.`,
  altNameLabel: 'In the translation',
  supports: [],
  supportLevels: [],
  affinities: [],
}

// The bulk upload matches portraits by unit name; there are no skill icons here.
const UPLOAD_DATA = { gameId: 'fe2', units: FE2_UNITS, skills: {} } as unknown as TelliusData

// No supports in Gaiden: its two fixed bonuses (the triangle attack, and Alm with Celica) are in the Roster as the units' own.
const fe2: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <GbaRoster data={FE2_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <GbaPlanner data={FE2_DATA} /> },
    { id: 'spells', label: 'Spells', component: () => <GbaSpells data={FE2_DATA} /> },
  ],
  spoiler: "Each tab follows the chapter you're on with the army picked (Alm's or Celica's, each keeping its own place): units show once they join.",
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="Gaiden" onClose={onClose} />,
  art: telliusArt(UPLOAD_DATA),
}

export default fe2
