import { FE9_BANDS, FE9_CHAPTERS, FE9_CHOICES, FE9_CLASSES, FE9_SKILLS, FE9_SUPPORTS, FE9_UNITS } from '../data/fe9/fe9Units'
import { LinearSpoilerBar } from '../components/LinearSpoilerBar'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import { TelliusBulkViewer } from '../tellius/TelliusBulkViewer'
import { TelliusPlanner } from '../tellius/TelliusPlanner'
import { TelliusRoster } from '../tellius/TelliusRoster'
import { TelliusSkillPlanner } from '../tellius/TelliusSkillPlanner'
import { TelliusSupports } from '../tellius/TelliusSupports'
import { useTelliusView } from '../tellius/spoiler'
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
  bands: FE9_BANDS,
  choices: FE9_CHOICES,
  rules: {
    transform: 'form',
    capacity: 'nonClass',
    maxSkills: { count: 5, withClassSkills: false },
    blossom: 'SID_FRAC90',
    celerity: 'SID_SWIFT',
  },
}

const fe9: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <TelliusRoster data={useTelliusView(FE9_DATA)} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <TelliusPlanner data={useTelliusView(FE9_DATA)} /> },
    { id: 'supports', label: 'Supports', component: () => <TelliusSupports data={useTelliusView(FE9_DATA)} /> },
    { id: 'skills', label: 'Skill Planner', component: () => <TelliusSkillPlanner data={useTelliusView(FE9_DATA)} /> },
    { id: 'viewer', label: 'Bulk Viewer', component: () => <TelliusBulkViewer data={useTelliusView(FE9_DATA)} /> },
  ],
  spoiler: "Every tab follows the chapter you're on: units show once they join, and the picks once their chapter is reached.",
  spoilerBar: () => <LinearSpoilerBar gameId={FE9_DATA.gameId} chapters={FE9_DATA.chapters} />,
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={FE9_DATA} title="Path of Radiance" onClose={onClose} />,
}

export default fe9
