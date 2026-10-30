import { FE3_CHAPTERS, FE3_CLASSES, FE3_STORIES, FE3_SUPPORT_BONUSES, FE3_UNITS } from '../data/fe3/fe3Units'
import { GbaPlanner, GbaRoster, GbaSupports, type GbaData } from '../gba/screens'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

export const FE3_DATA: GbaData = {
  gameId: 'fe3',
  stories: FE3_STORIES,
  chapters: FE3_CHAPTERS,
  units: FE3_UNITS,
  classes: FE3_CLASSES,
  // A weapon level and no Con; Mov doesn't grow (the level-up code, $83:BAF5).
  stats: ['hp', 'str', 'skl', 'spd', 'lck', 'wlv', 'def', 'res', 'mov'],
  growing: ['hp', 'str', 'skl', 'spd', 'lck', 'wlv', 'def', 'res'],
  statLabels: { str: 'Str' },
  // Promoting swaps the classes' Str, Skl, Spd, Mov, Def and Res, and lifts HP and the weapon level to the new class's ($83:FD2B).
  promotion: { difference: ['str', 'skl', 'spd', 'mov', 'def', 'res'], raise: ['hp', 'wlv'] },
  supports: [],
  supportLevels: [],
  affinities: [],
  supportBonuses: FE3_SUPPORT_BONUSES,
  supportBonusText:
    "Fixed supports, no points to build: with the giver within 3 steps, the receiver gets the bonus to hit, avoid, crit and crit avoid (the support code, $83:B9E1). A unit carrying the Geosphere gives everyone of its side in reach +10.",
}

// The bulk upload matches portraits by unit name (each name once: most units are in both books); there are no skill icons.
const UPLOAD_UNITS = FE3_UNITS.filter((u, i) => FE3_UNITS.findIndex((v) => v.name === u.name) === i)
const UPLOAD_DATA = { gameId: 'fe3', units: UPLOAD_UNITS, skills: {} } as unknown as TelliusData

const fe3: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <GbaRoster data={FE3_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <GbaPlanner data={FE3_DATA} /> },
    { id: 'supports', label: 'Supports', component: () => <GbaSupports data={FE3_DATA} /> },
  ],
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="Mystery of the Emblem" onClose={onClose} />,
}

export default fe3
