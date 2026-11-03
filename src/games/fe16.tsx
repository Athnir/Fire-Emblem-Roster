import {
  FE16_ABILITIES,
  FE16_ARTS,
  FE16_CLASSES,
  FE16_CRESTS,
  FE16_JOIN_LEVELS,
  FE16_RANK_REWARDS,
  FE16_SPELLS,
  FE16_STATUES,
  FE16_SUPPORTS,
  FE16_UNITS,
} from '../data/fe16/fe16Units'
import { labelOf, type Fe16Data } from '../houses/logic'
import { Fe16BulkViewer } from '../houses/bulk'
import { Fe16Planner } from '../houses/planner'
import { Fe16Info, Fe16Roster, Fe16SpoilerBar, Fe16Supports } from '../houses/screens'
import { Fe16SkillPlanner } from '../houses/skills'
import { telliusArt } from '../tellius/art'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

export const FE16_DATA: Fe16Data = {
  gameId: 'fe16',
  units: FE16_UNITS,
  classes: FE16_CLASSES,
  supports: FE16_SUPPORTS,
  rankRewards: FE16_RANK_REWARDS,
  abilities: FE16_ABILITIES,
  arts: FE16_ARTS,
  spells: FE16_SPELLS,
  crests: FE16_CRESTS,
  joinLevels: FE16_JOIN_LEVELS,
  statues: FE16_STATUES,
}

// The bulk upload matches portraits by unit name: "byleth_male.png" and "byleth_female.png" for the two Byleths.
const UPLOAD_DATA = { gameId: 'fe16', units: FE16_UNITS.map((u) => ({ ...u, name: labelOf(u) })), skills: {} } as unknown as TelliusData

const fe16: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <Fe16Roster data={FE16_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <Fe16Planner data={FE16_DATA} /> },
    { id: 'supports', label: 'Supports', component: () => <Fe16Supports data={FE16_DATA} /> },
    { id: 'skills', label: 'Skill Planner', component: () => <Fe16SkillPlanner data={FE16_DATA} /> },
    { id: 'viewer', label: 'Bulk Viewer', component: () => <Fe16BulkViewer data={FE16_DATA} /> },
    { id: 'info', label: 'Info', component: () => <Fe16Info /> },
  ],
  spoiler: "The Roster follows the chapter you're on: units show once they can be yours, the Black Eagles' route is asked at the split (Chapter 12), and when units leave stays blank.",
  spoilerBar: () => <Fe16SpoilerBar data={FE16_DATA} />,
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="Three Houses" onClose={onClose} />,
  art: telliusArt(UPLOAD_DATA),
}

export default fe16
