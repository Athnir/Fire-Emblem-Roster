import { Fe13BulkViewer } from '../awakening/bulk'
import { Fe13MarriagePlanner, Fe13Planner, Fe13Roster, Fe13Supports } from '../awakening/screens'
import { Fe13SkillPlanner } from '../awakening/skills'
import type { Fe13Data } from '../awakening/logic'
import { FE13_ASSETS, FE13_AVATAR_HAIR, FE13_CHAPTERS, FE13_CLASSES, FE13_MAIDEN, FE13_SKILLS, FE13_UNITS, FE13_WEAPON_BONUS } from '../data/fe13/fe13Units'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

export const FE13_DATA: Fe13Data = { chapters: FE13_CHAPTERS, units: FE13_UNITS, classes: FE13_CLASSES, assets: FE13_ASSETS, maiden: FE13_MAIDEN, skills: FE13_SKILLS, weaponBonus: FE13_WEAPON_BONUS, avatarHair: FE13_AVATAR_HAIR }

// The bulk upload matches portraits by unit name, and skill icons (in a "skills" folder) by skill name.
const UPLOAD_DATA = { gameId: 'fe13', units: FE13_UNITS, skills: FE13_SKILLS } as unknown as TelliusData

const fe13: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <Fe13Roster data={FE13_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <Fe13Planner data={FE13_DATA} /> },
    { id: 'supports', label: 'Supports', component: () => <Fe13Supports data={FE13_DATA} /> },
    { id: 'pairings', label: 'Marriage Planner', component: () => <Fe13MarriagePlanner data={FE13_DATA} /> },
    { id: 'skills', label: 'Skill Planner', component: () => <Fe13SkillPlanner data={FE13_DATA} /> },
    // As Fates: the Parent Checker sits in the Bulk Viewer, next to the Team Viewer.
    { id: 'viewer', label: 'Bulk Viewer', component: () => <Fe13BulkViewer data={FE13_DATA} /> },
  ],
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="Awakening" onClose={onClose} />,
}

export default fe13
