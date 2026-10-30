import { FE15_CHAPTERS, FE15_CLASSES, FE15_STORIES, FE15_SUPPORTS, FE15_UNITS } from '../data/fe15/fe15Units'
import { GbaPlanner, GbaRoster, GbaSupports, type GbaData } from '../gba/screens'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

export const FE15_DATA: GbaData = {
  gameId: 'fe15',
  stories: FE15_STORIES,
  chapters: FE15_CHAPTERS,
  units: FE15_UNITS,
  classes: FE15_CLASSES,
  // HP, Atk, Skl, Spd, Lck, Def, Res and Mov; Mov doesn't grow.
  stats: ['hp', 'str', 'skl', 'spd', 'lck', 'def', 'res', 'mov'],
  growing: ['hp', 'str', 'skl', 'spd', 'lck', 'def', 'res'],
  statLabels: { str: 'Atk' },
  // A class change lifts every stat but Res that's below the new class's bases to them; Mov is the class's (Serenes Forest).
  promotion: { difference: ['mov'], raise: ['hp', 'str', 'skl', 'spd', 'lck', 'def'] },
  promotionText:
    "A class change at a Mila statue needs the level shown, lifts every stat but Res that's below the new class's bases to them, and starts again at Lv 1 (Serenes Forest).",
  supports: [],
  supportLevels: [],
  affinities: [],
  rankedSupports: FE15_SUPPORTS,
  rankedSupportText:
    "From the game's support table: what each gets fighting near the other (within 3 tiles, Serenes Forest). Some pairs have a bonus from the start; the rest earn points fighting together and raise their rank by talking, once they have the points and have reached the act shown. Ranks with one partner replace each other; they don't stack.",
}

// The bulk upload matches portraits by unit name; there are no skill icons here.
const UPLOAD_DATA = { gameId: 'fe15', units: FE15_UNITS, skills: {} } as unknown as TelliusData

const fe15: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <GbaRoster data={FE15_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <GbaPlanner data={FE15_DATA} /> },
    { id: 'supports', label: 'Supports', component: () => <GbaSupports data={FE15_DATA} /> },
  ],
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="Shadows of Valentia" onClose={onClose} />,
}

export default fe15
