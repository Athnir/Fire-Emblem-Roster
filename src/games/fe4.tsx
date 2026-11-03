import { LinearSpoilerBar } from '../components/LinearSpoilerBar'
import { FE4_BLOODS, FE4_CHAPTERS, FE4_CHOICES, FE4_CLASSES, FE4_LOVE, FE4_RINGS, FE4_UNITS } from '../data/fe4/fe4Units'
import { Fe4BulkViewer } from '../genealogy/bulk'
import type { Fe4Data } from '../genealogy/logic'
import { Fe4Pairings, Fe4Planner, Fe4Roster } from '../genealogy/screens'
import { telliusArt } from '../tellius/art'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import { useReached } from '../state/spoilerStore'
import type { GameParts } from './index'

export const FE4_DATA: Fe4Data = {
  gameId: 'fe4',
  chapters: FE4_CHAPTERS,
  units: FE4_UNITS,
  classes: FE4_CLASSES,
  bloods: FE4_BLOODS,
  choices: FE4_CHOICES,
  love: FE4_LOVE,
  rings: FE4_RINGS,
}

/** The data as the spoiler block opens it: the chapters reached, the units they've brought and the picks asked in them. A child shows
 * once their chapter is reached; their parents (the first generation) are already there. */
function useFe4Data(): Fe4Data {
  const reached = useReached(FE4_DATA.gameId, FE4_DATA.chapters)
  if (!reached) return FE4_DATA
  return {
    ...FE4_DATA,
    chapters: FE4_DATA.chapters.filter((c) => reached.has(c.id)),
    units: FE4_DATA.units.filter((u) => !u.joinChapter || reached.has(u.joinChapter)),
    choices: FE4_DATA.choices?.filter((c) => reached.has(c.chapter)),
  }
}

// The bulk upload matches portraits by unit name; Genealogy has no skill icons yet.
const UPLOAD_DATA = { gameId: 'fe4', units: FE4_UNITS, skills: {} } as unknown as TelliusData

const fe4: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <Fe4Roster data={useFe4Data()} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <Fe4Planner data={useFe4Data()} /> },
    { id: 'pairings', label: 'Pairings', component: () => <Fe4Pairings data={useFe4Data()} /> },
    { id: 'viewer', label: 'Bulk Viewer', component: () => <Fe4BulkViewer data={useFe4Data()} /> },
  ],
  spoiler: "Every tab follows the chapter you're on: units show once they join (the children with their chapter), and the picks once their chapter is reached.",
  spoilerBar: () => <LinearSpoilerBar gameId={FE4_DATA.gameId} chapters={FE4_DATA.chapters} />,
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="Genealogy of the Holy War" onClose={onClose} />,
  art: telliusArt(UPLOAD_DATA),
}

export default fe4
