import { FE11_CHAPTERS, FE11_CLASSES, FE11_RECLASS_SWAP, FE11_UNITS } from '../data/fe11/fe11Units'
import { GbaPlanner, GbaRoster, type GbaData } from '../gba/screens'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

export const FE11_DATA: GbaData = {
  gameId: 'fe11',
  chapters: FE11_CHAPTERS,
  units: FE11_UNITS,
  classes: FE11_CLASSES,
  // HP, Str, Mag, Skl, Spd, Lck, Def, Res and Mov; Mov doesn't grow.
  stats: ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res', 'mov'],
  growing: ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res'],
  statLabels: { str: 'Str' },
  promotionText:
    "Growths are the unit's own plus the class's, never below 0, and a stat that has fallen behind its growths gets a catch-up bonus of a tenth of the shortfall; the averages count it exactly, through every level-up and class change (the game's code). A stat is the unit's own plus the class's bases, held at the class's cap and shown as 0 below 0, so a class change swaps one class's bases for the other's and a lower cap hides nothing for good (the game's code). From Chapter 4, at the battle preparations, a unit can reclass within its set and tier, keeping its level; one promoted with the Elysian Whip is offered the Falcoknight in place of the Dracoknight. A Master Seal promotes from Lv 10, back to Lv 1 (the code; the Lv 10 and Chapter 4 are Serenes Forest's). Lords, Thieves, Ballisticians, the Freelancer and Manaketes have no set.",
  reclassSwap: FE11_RECLASS_SWAP,
  catchUp: true,
  supports: [],
  supportLevels: [],
  affinities: [],
}

// The bulk upload matches portraits by unit name; there are no skill icons here.
const UPLOAD_DATA = { gameId: 'fe11', units: FE11_UNITS, skills: {} } as unknown as TelliusData

// No supports in Shadow Dragon, so no Supports tab.
const fe11: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <GbaRoster data={FE11_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <GbaPlanner data={FE11_DATA} /> },
  ],
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="Shadow Dragon" onClose={onClose} />,
}

export default fe11
