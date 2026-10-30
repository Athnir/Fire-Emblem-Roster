import { FE9_CHAPTERS, FE9_CLASSES, FE9_SKILLS, FE9_SUPPORTS, FE9_UNITS } from '../data/fe9/fe9Units'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import { TelliusPlanner } from '../tellius/TelliusPlanner'
import { TelliusRoster } from '../tellius/TelliusRoster'
import { TelliusSupports } from '../tellius/TelliusSupports'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

export const FE9_DATA: TelliusData = {
  gameId: 'fe9',
  chapters: FE9_CHAPTERS,
  units: FE9_UNITS,
  classes: FE9_CLASSES,
  skills: FE9_SKILLS,
  supports: FE9_SUPPORTS,
  maxLevel: 20,
  fixedMode: true,
}

const fe9: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <TelliusRoster data={FE9_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <TelliusPlanner data={FE9_DATA} /> },
    { id: 'supports', label: 'Supports', component: () => <TelliusSupports data={FE9_DATA} /> },
  ],
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={FE9_DATA} title="Path of Radiance" onClose={onClose} />,
}

export default fe9
