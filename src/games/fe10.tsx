import { FE10_BONDS, FE10_CHAPTERS, FE10_CLASSES, FE10_SKILLS, FE10_SUPPORTS, FE10_UNITS } from '../data/fe10/fe10Units'
import { LinearSpoilerBar } from '../components/LinearSpoilerBar'
import { telliusArt } from '../tellius/art'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import { TelliusBulkViewer } from '../tellius/TelliusBulkViewer'
import { TelliusPlanner } from '../tellius/TelliusPlanner'
import { TelliusRoster } from '../tellius/TelliusRoster'
import { TelliusSkillPlanner } from '../tellius/TelliusSkillPlanner'
import { TelliusSupports } from '../tellius/TelliusSupports'
import { useTelliusView } from '../tellius/spoiler'
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
  rules: {
    transform: 'double',
    capacity: 'allButOwn',
    maxSkills: { count: 6, withClassSkills: true },
    laguzCapacity: [
      [15, 15],
      [30, 50],
    ],
    blossom: 'SID_BLOSSOM',
    celerity: 'SID_CELERITY',
    bexp: true,
    transferCopies: 'PID_SOTHE',
  },
}

const fe10: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <TelliusRoster data={useTelliusView(FE10_DATA)} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <TelliusPlanner data={useTelliusView(FE10_DATA)} /> },
    { id: 'supports', label: 'Supports', component: () => <TelliusSupports data={useTelliusView(FE10_DATA)} /> },
    { id: 'skills', label: 'Skill Planner', component: () => <TelliusSkillPlanner data={useTelliusView(FE10_DATA)} /> },
    { id: 'viewer', label: 'Bulk Viewer', component: () => <TelliusBulkViewer data={useTelliusView(FE10_DATA)} /> },
  ],
  spoiler: "Every tab follows the chapter you're on: units show once they join, and the picks once their chapter is reached.",
  spoilerBar: () => <LinearSpoilerBar gameId={FE10_DATA.gameId} chapters={FE10_DATA.chapters} />,
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={FE10_DATA} title="Radiant Dawn" onClose={onClose} />,
  art: telliusArt(FE10_DATA),
}

export default fe10
