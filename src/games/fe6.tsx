import { FE6_AFFINITIES, FE6_CHAPTERS, FE6_CLASSES, FE6_SUPPORT_LEVELS, FE6_SUPPORTS, FE6_UNITS } from '../data/fe6/fe6Units'
import { GbaPlanner, GbaRoster, GbaSupports, type GbaData } from '../gba/screens'
import { telliusArt } from '../tellius/art'
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
  // The two splits, as the spoiler block asks for them (the Armory's FE6_FORK): 10A or 10B after Chapter 9, and Ilia or Sacae after
  // 16x. Without the block, both ways' chapters and units show.
  branches: [
    {
      id: 'ch10',
      after: 'fe6-9',
      question: 'The story splits after Chapter 9: pick the way you went to carry on.',
      choices: [
        { id: 'a', label: '10A and 11A', chapters: ['fe6-10a', 'fe6-11a'] },
        { id: 'b', label: '10B and 11B', chapters: ['fe6-10b', 'fe6-11b'] },
      ],
    },
    {
      id: 'ch17',
      after: 'fe6-16x',
      question: 'The story splits after Chapter 16: pick the way you went to carry on.',
      choices: [
        { id: 'ilia', label: 'Ilia (17A to 20A)', chapters: ['fe6-17a', 'fe6-18a', 'fe6-19a', 'fe6-20a', 'fe6-20ax'] },
        { id: 'sacae', label: 'Sacae (17B to 20B)', chapters: ['fe6-17b', 'fe6-18b', 'fe6-19b', 'fe6-20b', 'fe6-20bx'] },
      ],
    },
  ],
}

// The bulk upload matches portraits by unit name; the GBA games have no skill icons.
const UPLOAD_DATA = { gameId: 'fe6', units: FE6_UNITS, skills: {} } as unknown as TelliusData

const fe6: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <GbaRoster data={FE6_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <GbaPlanner data={FE6_DATA} /> },
    { id: 'supports', label: 'Supports', component: () => <GbaSupports data={FE6_DATA} /> },
  ],
  spoiler: "Each tab follows the chapter you're on: units show once they join, and the bar asks for 10A or 10B, then Ilia or Sacae, when you reach them.",
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="The Binding Blade" onClose={onClose} />,
  art: telliusArt(UPLOAD_DATA),
}

export default fe6
