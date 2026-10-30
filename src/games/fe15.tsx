import { FE15_CHAPTERS, FE15_CLASSES, FE15_STORIES, FE15_SUPPORT_PAIRS, FE15_UNITS } from '../data/fe15/fe15Units'
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
  supportPairs: FE15_SUPPORT_PAIRS,
  supportPairsText: "Who each unit can support, from the game's support table. What each support gives isn't read yet.",
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
