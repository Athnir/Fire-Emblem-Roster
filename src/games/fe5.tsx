import { FE5_CHAPTERS, FE5_CLASSES, FE5_SCROLLS, FE5_SUPPORTS, FE5_UNITS } from '../data/fe5/fe5Units'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import { Fe5Planner, Fe5Roster, Fe5Supports, type Fe5Data } from '../thracia/screens'
import type { GameParts } from './index'

export const FE5_DATA: Fe5Data = {
  gameId: 'fe5',
  chapters: FE5_CHAPTERS,
  units: FE5_UNITS,
  classes: FE5_CLASSES,
  supports: FE5_SUPPORTS,
  scrolls: FE5_SCROLLS,
}

// The bulk upload matches portraits by unit name; Thracia has no skill icons yet.
const UPLOAD_DATA = { gameId: 'fe5', units: FE5_UNITS, skills: {} } as unknown as TelliusData

const fe5: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <Fe5Roster data={FE5_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <Fe5Planner data={FE5_DATA} /> },
    { id: 'supports', label: 'Supports', component: () => <Fe5Supports data={FE5_DATA} /> },
  ],
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="Thracia 776" onClose={onClose} />,
}

export default fe5
