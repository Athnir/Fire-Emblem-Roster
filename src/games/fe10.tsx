import { FE10_BONDS, FE10_CHAPTERS, FE10_CLASSES, FE10_SKILLS, FE10_SUPPORTS, FE10_UNITS } from '../data/fe10/fe10Units'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import { TelliusPlanner } from '../tellius/TelliusPlanner'
import { TelliusRoster } from '../tellius/TelliusRoster'
import { TelliusSupports } from '../tellius/TelliusSupports'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

export const FE10_DATA: TelliusData = {
  gameId: 'fe10',
  chapters: FE10_CHAPTERS,
  units: FE10_UNITS,
  classes: FE10_CLASSES,
  skills: FE10_SKILLS,
  supports: [],
  maxLevel: 20,
  openSupports: FE10_SUPPORTS,
  bonds: FE10_BONDS,
}

const fe10: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <TelliusRoster data={FE10_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <TelliusPlanner data={FE10_DATA} /> },
    { id: 'supports', label: 'Supports', component: () => <TelliusSupports data={FE10_DATA} /> },
  ],
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={FE10_DATA} title="Radiant Dawn" onClose={onClose} />,
}

export default fe10
