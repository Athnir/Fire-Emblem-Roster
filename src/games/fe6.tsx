import { FE6_AFFINITIES, FE6_CHAPTERS, FE6_CLASSES, FE6_SUPPORT_LEVELS, FE6_SUPPORTS, FE6_UNITS } from '../data/fe6/fe6Units'
import { GbaPlanner, GbaRoster, GbaSupports, type GbaData } from '../gba/screens'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

export const FE6_DATA: GbaData = {
  gameId: 'fe6',
  chapters: FE6_CHAPTERS,
  units: FE6_UNITS,
  classes: FE6_CLASSES,
  supports: FE6_SUPPORTS,
  supportLevels: FE6_SUPPORT_LEVELS,
  affinities: FE6_AFFINITIES,
}

// The bulk upload matches portraits by unit name; the GBA games have no skill icons.
const UPLOAD_DATA = { gameId: 'fe6', units: FE6_UNITS, skills: {} } as unknown as TelliusData

const fe6: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <GbaRoster data={FE6_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <GbaPlanner data={FE6_DATA} /> },
    { id: 'supports', label: 'Supports', component: () => <GbaSupports data={FE6_DATA} /> },
  ],
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="The Binding Blade" onClose={onClose} />,
}

export default fe6
