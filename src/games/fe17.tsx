import { LinearSpoilerBar } from '../components/LinearSpoilerBar'
import { FE17_BOOSTERS, FE17_CHAPTERS, FE17_CLASSES, FE17_EMBLEMS, FE17_SKILLS, FE17_SUPPORTS, FE17_UNITS } from '../data/fe17/fe17Units'
import { Fe17BulkViewer } from '../engage/bulk'
import type { Fe17Data } from '../engage/logic'
import { Fe17Planner } from '../engage/planner'
import { Fe17Emblems, Fe17Info, Fe17Roster, Fe17Supports } from '../engage/screens'
import { Fe17SkillPlanner } from '../engage/skills'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

export const FE17_DATA: Fe17Data = {
  gameId: 'fe17',
  chapters: FE17_CHAPTERS,
  units: FE17_UNITS,
  classes: FE17_CLASSES,
  emblems: FE17_EMBLEMS,
  supports: FE17_SUPPORTS,
  skills: FE17_SKILLS,
  boosters: FE17_BOOSTERS,
}

// The bulk upload matches portraits by unit name; skill icons (in a "skills" folder) by skill name.
const UPLOAD_DATA = {
  gameId: 'fe17',
  units: FE17_UNITS,
  skills: Object.fromEntries(Object.keys(FE17_SKILLS).map((name) => [name, { name }])),
} as unknown as TelliusData

const fe17: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <Fe17Roster data={FE17_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <Fe17Planner data={FE17_DATA} /> },
    { id: 'supports', label: 'Supports', component: () => <Fe17Supports data={FE17_DATA} /> },
    { id: 'emblems', label: 'Emblems', component: () => <Fe17Emblems data={FE17_DATA} /> },
    { id: 'skills', label: 'Skill Planner', component: () => <Fe17SkillPlanner data={FE17_DATA} /> },
    { id: 'viewer', label: 'Bulk Viewer', component: () => <Fe17BulkViewer data={FE17_DATA} /> },
    { id: 'info', label: 'Info', component: () => <Fe17Info /> },
  ],
  spoiler: "Every tab follows the chapter you're on: units show once they join (the paralogues after the chapters that open them, the Expansion Pass's after Chapter 6). The Emblems tab isn't set up for it yet.",
  spoilerBar: () => <LinearSpoilerBar gameId="fe17" chapters={FE17_CHAPTERS} />,
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="Engage" onClose={onClose} />,
}

export default fe17
