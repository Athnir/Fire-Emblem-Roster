import { Fe13Pairings, Fe13Planner, Fe13Roster, Fe13Supports } from '../awakening/screens'
import type { Fe13Data } from '../awakening/logic'
import { FE13_CHAPTERS, FE13_CLASSES, FE13_UNITS } from '../data/fe13/fe13Units'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

export const FE13_DATA: Fe13Data = { chapters: FE13_CHAPTERS, units: FE13_UNITS, classes: FE13_CLASSES }

// The bulk upload matches portraits by unit name; Awakening's skill icons aren't uploaded here.
const UPLOAD_DATA = { gameId: 'fe13', units: FE13_UNITS, skills: {} } as unknown as TelliusData

const fe13: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <Fe13Roster data={FE13_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <Fe13Planner data={FE13_DATA} /> },
    { id: 'supports', label: 'Supports', component: () => <Fe13Supports data={FE13_DATA} /> },
    { id: 'pairings', label: 'Pairings', component: () => <Fe13Pairings data={FE13_DATA} /> },
  ],
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="Awakening" onClose={onClose} />,
}

export default fe13
