import { FE4_BLOODS, FE4_CHAPTERS, FE4_CLASSES, FE4_UNITS } from '../data/fe4/fe4Units'
import type { Fe4Data } from '../genealogy/logic'
import { Fe4Pairings, Fe4Planner, Fe4Roster } from '../genealogy/screens'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

export const FE4_DATA: Fe4Data = {
  gameId: 'fe4',
  chapters: FE4_CHAPTERS,
  units: FE4_UNITS,
  classes: FE4_CLASSES,
  bloods: FE4_BLOODS,
}

// The bulk upload matches portraits by unit name; Genealogy has no skill icons yet.
const UPLOAD_DATA = { gameId: 'fe4', units: FE4_UNITS, skills: {} } as unknown as TelliusData

const fe4: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <Fe4Roster data={FE4_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <Fe4Planner data={FE4_DATA} /> },
    { id: 'pairings', label: 'Pairings', component: () => <Fe4Pairings data={FE4_DATA} /> },
  ],
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="Genealogy of the Holy War" onClose={onClose} />,
}

export default fe4
