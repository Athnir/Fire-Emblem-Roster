import { Fe13BulkViewer } from '../awakening/bulk'
import { LinearSpoilerBar } from '../components/LinearSpoilerBar'
import { Fe13MarriagePlanner, Fe13Planner, Fe13RobinPanel, Fe13Roster, Fe13Supports } from '../awakening/screens'
import { Fe13SkillPlanner } from '../awakening/skills'
import type { Fe13Data } from '../awakening/logic'
import { FE13_ASSETS, FE13_AVATAR_HAIR, FE13_CHAPTERS, FE13_CLASSES, FE13_MAIDEN, FE13_SKILLS, FE13_UNITS, FE13_WEAPON_BONUS } from '../data/fe13/fe13Units'
import { telliusArt } from '../tellius/art'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import { useReached } from '../state/spoilerStore'
import type { GameParts } from './index'

export const FE13_DATA: Fe13Data = { chapters: FE13_CHAPTERS, units: FE13_UNITS, classes: FE13_CLASSES, assets: FE13_ASSETS, maiden: FE13_MAIDEN, skills: FE13_SKILLS, weaponBonus: FE13_WEAPON_BONUS, avatarHair: FE13_AVATAR_HAIR }

/** The data as the spoiler block opens it: the chapters and paralogues reached and the units they've brought (a child with their
 * paralogue). */
function useFe13Data(): Fe13Data {
  const reached = useReached('fe13', FE13_DATA.chapters)
  if (!reached) return FE13_DATA
  return { ...FE13_DATA, chapters: FE13_DATA.chapters.filter((c) => reached.has(c.id)), units: FE13_DATA.units.filter((u) => !u.joinChapter || reached.has(u.joinChapter)) }
}

// The bulk upload matches portraits by unit name, and skill icons (in a "skills" folder) by skill name.
/** The layers scripts/fe13_portraits.py writes: each child whose hair the game tints (all but Lucina), and the Avatar's builds. */
const FE13_LAYERS = [
  ...FE13_UNITS.filter((u) => u.parent && u.name !== 'Lucina').flatMap((u) => {
    const name = u.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    return [`children/${name}/base.png`, `children/${name}/raw.png`]
  }),
  ...['m', 'f'].flatMap((g) => [1, 2, 3].flatMap((n) => ['base', 'hair1', 'hair2', 'hair3', 'hair4', 'hair5'].map((l) => `avatar/${g}_${n}/${l}.png`))),
]
// Robin's portraits stay matched as avatar_m.png and avatar_f.png, the names they had (the art pack and what's already uploaded).
const UPLOAD_UNITS = FE13_UNITS.map((u) => (u.id === 'fe13-avatar-m' ? { ...u, name: 'Avatar (M)' } : u.id === 'fe13-avatar-f' ? { ...u, name: 'Avatar (F)' } : u))
const UPLOAD_DATA = { gameId: 'fe13', units: UPLOAD_UNITS, skills: FE13_SKILLS } as unknown as TelliusData

const fe13: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <Fe13Roster data={useFe13Data()} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <Fe13Planner data={useFe13Data()} /> },
    { id: 'supports', label: 'Supports', component: () => <Fe13Supports data={useFe13Data()} /> },
    { id: 'pairings', label: 'Marriage Planner', component: () => <Fe13MarriagePlanner data={useFe13Data()} /> },
    { id: 'skills', label: 'Skill Planner', component: () => <Fe13SkillPlanner data={useFe13Data()} /> },
    // As Fates: the Parent Checker sits in the Bulk Viewer, next to the Team Viewer.
    { id: 'viewer', label: 'Bulk Viewer', component: () => <Fe13BulkViewer data={useFe13Data()} /> },
  ],
  banner: Fe13RobinPanel,
  spoiler: "Every tab follows the chapter you're on: units show once they join, the children with their paralogues.",
  spoilerBar: () => <LinearSpoilerBar gameId="fe13" chapters={FE13_DATA.chapters} />,
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="Awakening" onClose={onClose} />,
  art: telliusArt(UPLOAD_DATA, FE13_LAYERS),
}

export default fe13
