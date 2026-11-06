import { FE15_CHAPTERS, FE15_CLASSES, FE15_SPELL_BOOK, FE15_SPELL_STATS, FE15_STORIES, FE15_SUPPORTS, FE15_UNITS } from '../data/fe15/fe15Units'
import { GbaPlanner, GbaRoster, GbaSupports, type GbaData } from '../gba/screens'
import { GbaSpells } from '../gba/spells'
import { telliusArt } from '../tellius/art'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

export const FE15_DATA: GbaData = {
  gameId: 'fe15',
  stories: FE15_STORIES,
  chapters: FE15_CHAPTERS,
  units: FE15_UNITS,
  classes: FE15_CLASSES,
  // HP, Atk, Skl, Spd, Lck, Def, Res and Mov; Mov doesn't grow.
  stats: ['hp', 'str', 'skl', 'spd', 'lck', 'def', 'res', 'mov'],
  growing: ['hp', 'str', 'skl', 'spd', 'lck', 'def', 'res'],
  statLabels: { str: 'Atk' },
  // A class change lifts every stat but Res that's below the new class's bases to them; Mov is the class's (Serenes Forest).
  promotion: { difference: ['mov'], raise: ['hp', 'str', 'skl', 'spd', 'lck', 'def'] },
  promotionText:
    "A class change at a Mila statue needs the level shown, lifts every stat but Res that's below the new class's bases to them, and starts again at Lv 1 (Serenes Forest).",
  supports: [],
  supportLevels: [],
  affinities: [],
  rankedSupports: FE15_SUPPORTS,
  rankedSupportText:
    "From the game's support table: what each gets fighting near the other (within 3 tiles, Serenes Forest). Some pairs have a bonus from the start; the rest earn points fighting together and raise their rank by talking, once they have the points and have reached the act shown. Ranks with one partner replace each other; they don't stack.",
  spellBook: FE15_SPELL_BOOK,
  spellStats: FE15_SPELL_STATS,
  spellBookText:
    "A unit's spells come from one of their two lists: the black magic one in a Mage, Sage, Priestess or Princess, the white magic one in a Cleric or Saint (Job.bin's 魔法成長); the game works them out from the class each time (0x1a9d0c). A spell at a level comes once the unit's level plus the levels they carry reaches it: each class change carries the level it was made at, less 1, the highest kept, up to 20 (0x353e8c, 0x450ec8). So a Villager made a Mage at Lv 3 carries 2 (a Lv 9 spell comes at Mage Lv 7), and a Mage made a Sage at Lv 12 gets a Lv 18 one at Sage Lv 7. A promoted class's own spells (Sage Lv 5) count its level alone and need that class. Range by Atk: the Atk stat, halved or quartered as shown.",
}

// The bulk upload matches portraits by unit name; there are no skill icons here.
const UPLOAD_DATA = { gameId: 'fe15', units: FE15_UNITS, skills: {} } as unknown as TelliusData

const fe15: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <GbaRoster data={FE15_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <GbaPlanner data={FE15_DATA} /> },
    { id: 'supports', label: 'Supports', component: () => <GbaSupports data={FE15_DATA} /> },
    { id: 'spells', label: 'Spells', component: () => <GbaSpells data={FE15_DATA} /> },
  ],
  spoiler: "Each tab follows the act you're on with the army picked (Alm's or Celica's, each keeping its own place): units show once they join.",
  bulkUpload: ({ onClose }) => <TelliusBulkUpload data={UPLOAD_DATA} title="Shadows of Valentia" onClose={onClose} />,
  art: telliusArt(UPLOAD_DATA),
}

export default fe15
