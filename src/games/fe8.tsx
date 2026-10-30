import { FE8_AFFINITIES, FE8_CHAPTERS, FE8_CLASSES, FE8_STORIES, FE8_SUPPORT_LEVELS, FE8_SUPPORTS, FE8_UNITS } from '../data/fe8/fe8Units'
import { GbaPlanner, GbaRoster, GbaSupports, type GbaData } from '../gba/screens'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

export const FE8_DATA: GbaData = {
  gameId: 'fe8',
  stories: FE8_STORIES,
  chapters: FE8_CHAPTERS,
  units: FE8_UNITS,
  classes: FE8_CLASSES,
  supports: FE8_SUPPORTS,
  supportLevels: FE8_SUPPORT_LEVELS,
  // The support code (0x08028490) adds a pair's points when the two are side by side, or one carries the other.
  supportGain: 'each turn the two are side by side (or one carries the other)',
  affinities: FE8_AFFINITIES,
}

// The bulk upload matches portraits by unit name (each name once: a unit can be on both routes); the GBA games have no skill icons.
const UPLOAD_UNITS = FE8_UNITS.filter((u, i) => FE8_UNITS.findIndex((v) => v.name === u.name) === i)
const UPLOAD_DATA = { gameId: 'fe8', units: UPLOAD_UNITS, skills: {} } as unknown as TelliusData

const fe8: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <GbaRoster data={FE8_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <GbaPlanner data={FE8_DATA} /> },
    { id: 'supports', label: 'Supports', component: () => <GbaSupports data={FE8_DATA} /> },
  ],
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="The Sacred Stones" onClose={onClose} />,
}

export default fe8
