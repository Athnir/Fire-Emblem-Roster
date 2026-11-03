import { FE1_CHAPTERS, FE1_CLASSES, FE1_UNITS } from '../data/fe1/fe1Units'
import { GbaPlanner, GbaRoster, type GbaData } from '../gba/screens'
import { telliusArt } from '../tellius/art'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

export const FE1_DATA: GbaData = {
  gameId: 'fe1',
  chapters: FE1_CHAPTERS,
  units: FE1_UNITS,
  classes: FE1_CLASSES,
  // A weapon level and no Con; Res and Mov never grow (the level-up, 15:$D085).
  stats: ['hp', 'str', 'skl', 'wlv', 'spd', 'lck', 'def', 'res', 'mov'],
  growing: ['hp', 'str', 'skl', 'wlv', 'spd', 'lck', 'def'],
  statLabels: { str: 'Str' },
  // Promoting lifts each stat to the new class's base where lower and adds nothing (6:$980B).
  promotion: { difference: [], raise: ['hp', 'str', 'skl', 'wlv', 'spd', 'lck', 'def', 'mov'] },
  promotionText:
    "A promotion item works from Lv 10 for the class it's made for (Paladin's Honor, Hero Crest, Bishop's Ring, Orion's Bolt, Skydrake Whip) and starts again at Lv 1. Promoting adds nothing: HP, Str, Skl, the weapon level, Spd, Lck, Def and Mov are each lifted to the new class's base where lower (the game's code, 6:$980B).",
  growthScale: {
    factor: 250 / 256,
    text: 'The game rolls a random byte / 25 against each growth in tenths, so a listed 90% is really 87.9% (15:$D085); the averages use the real chance.',
  },
  supports: [],
  supportLevels: [],
  affinities: [],
}

// The bulk upload matches portraits by unit name; there are no skill icons.
const UPLOAD_DATA = { gameId: 'fe1', units: FE1_UNITS, skills: {} } as unknown as TelliusData

const fe1: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <GbaRoster data={FE1_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <GbaPlanner data={FE1_DATA} /> },
  ],
  spoiler: "Each tab follows the chapter you're on: units show once they join.",
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="Shadow Dragon & the Blade of Light" onClose={onClose} />,
  art: telliusArt(UPLOAD_DATA),
}

export default fe1
