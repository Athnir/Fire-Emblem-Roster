import { FE7_AFFINITIES, FE7_CHAPTERS, FE7_CLASSES, FE7_STORIES, FE7_SUPPORT_LEVELS, FE7_SUPPORTS, FE7_UNITS } from '../data/fe7/fe7Units'
import { GbaPlanner, GbaRoster, GbaSupports, type GbaData } from '../gba/screens'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

export const FE7_DATA: GbaData = {
  gameId: 'fe7',
  stories: FE7_STORIES,
  chapters: FE7_CHAPTERS,
  units: FE7_UNITS,
  classes: FE7_CLASSES,
  supports: FE7_SUPPORTS,
  supportLevels: FE7_SUPPORT_LEVELS,
  // The support code (0x08026900) adds a pair's points when the two are side by side, or one carries the other.
  supportGain: 'each turn the two are side by side (or one carries the other)',
  affinities: FE7_AFFINITIES,
}

// The bulk upload matches portraits by unit name (each name once: a unit can be in all three stories); the GBA games have no
// skill icons.
const UPLOAD_UNITS = FE7_UNITS.filter((u, i) => FE7_UNITS.findIndex((v) => v.name === u.name) === i)
const UPLOAD_DATA = { gameId: 'fe7', units: UPLOAD_UNITS, skills: {} } as unknown as TelliusData

const fe7: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <GbaRoster data={FE7_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <GbaPlanner data={FE7_DATA} /> },
    { id: 'supports', label: 'Supports', component: () => <GbaSupports data={FE7_DATA} /> },
  ],
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="The Blazing Blade" onClose={onClose} />,
}

export default fe7
