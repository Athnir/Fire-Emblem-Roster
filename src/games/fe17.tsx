import { UploadSection } from '../components/BulkAssetUpload'
import { LinearSpoilerBar } from '../components/LinearSpoilerBar'
import { FE17_BOND_RINGS, FE17_BOOSTERS, FE17_CHAPTERS, FE17_CLASS_TYPES, FE17_CLASSES, FE17_EMBLEMS, FE17_SKILL_CHAINS, FE17_SKILLS, FE17_SUPPORTS, FE17_UNITS } from '../data/fe17/fe17Units'
import { FEMALE_ALEAR, fe17Art, matchEmblemFaces, matchRingFaces, matchSkillIcons } from '../engage/art'
import { Fe17BulkViewer } from '../engage/bulk'
import { Fe17Classes } from '../engage/classes'
import type { Fe17Data } from '../engage/logic'
import { Fe17Planner } from '../engage/planner'
import { Fe17Emblems, Fe17Info, Fe17Roster, Fe17Supports } from '../engage/screens'
import { Fe17SkillPlanner } from '../engage/skills'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

export const FE17_DATA: Fe17Data = {
  gameId: 'fe17',
  chapters: FE17_CHAPTERS,
  units: FE17_UNITS,
  classes: FE17_CLASSES,
  emblems: FE17_EMBLEMS,
  bondRings: FE17_BOND_RINGS,
  supports: FE17_SUPPORTS,
  skills: FE17_SKILLS,
  boosters: FE17_BOOSTERS,
  chains: FE17_SKILL_CHAINS,
  classTypes: FE17_CLASS_TYPES,
}

// The bulk upload matches portraits by unit name (and the female Alear's, alear_female.png), Bond Ring faces (in a "rings" folder)
// by the ring's name, Emblem faces (in an "emblems" folder) by the Emblem's, skill icons (in a "skills" folder) by the skill's.
const UPLOAD_DATA = {
  gameId: 'fe17',
  units: [...FE17_UNITS, { name: FEMALE_ALEAR }],
  skills: {},
} as unknown as TelliusData
const EMBLEM_FACES = [...FE17_EMBLEMS.map((e) => e.name), FEMALE_ALEAR]
const SKILL_NAMES = Object.keys(FE17_SKILLS)
const UPLOAD_ART = fe17Art(UPLOAD_DATA, FE17_BOND_RINGS, EMBLEM_FACES, SKILL_NAMES)
const RING_COUNT = FE17_BOND_RINGS.reduce((n, s) => n + s.rings.length, 0)

const fe17: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <Fe17Roster data={FE17_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <Fe17Planner data={FE17_DATA} /> },
    { id: 'supports', label: 'Supports', component: () => <Fe17Supports data={FE17_DATA} /> },
    { id: 'emblems', label: 'Emblems', component: () => <Fe17Emblems data={FE17_DATA} /> },
    { id: 'classes', label: 'Classes', component: () => <Fe17Classes data={FE17_DATA} /> },
    { id: 'skills', label: 'Skill Planner', component: () => <Fe17SkillPlanner data={FE17_DATA} /> },
    { id: 'viewer', label: 'Bulk Viewer', component: () => <Fe17BulkViewer data={FE17_DATA} /> },
    { id: 'info', label: 'Info', component: () => <Fe17Info /> },
  ],
  spoiler: "Every tab follows the chapter you're on: units show once they join (the paralogues after the chapters that open them, the Expansion Pass's after Chapter 6). The Emblems tab shows each Emblem's ring, and its world's Bond Rings, from the chapter the ring first comes in.",
  spoilerBar: () => <LinearSpoilerBar gameId="fe17" chapters={FE17_CHAPTERS} />,
  bulkUpload: ({ onClose }) => (
    <TelliusBulkUpload
      data={UPLOAD_DATA}
      title="Engage"
      onClose={onClose}
      folder={{
        hint: 'Portraits named like "alear.png" (the female Alear: "alear_female.png"); Bond Ring faces in a "rings" folder, named like "caeda.png"; Emblem faces in an "emblems" folder, named like "sigurd.png"; skill icons in a "skills" folder, named like "lunar_brace_plus.png".',
        match: UPLOAD_ART.match,
      }}
      skills={{
        hint: `Files named after each skill, each "+" as "plus", like "lunar_brace_plus.png" (${SKILL_NAMES.length} skills).`,
        match: (files) => matchSkillIcons('fe17', SKILL_NAMES, files),
      }}
    >
      <UploadSection
        title="Bond Ring faces"
        hint={`Files named after each ring's hero, like "caeda.png" (${RING_COUNT} rings).`}
        match={(files) => matchRingFaces('fe17', FE17_BOND_RINGS, files)}
      />
      <UploadSection
        title="Emblem faces"
        hint={`Files named after each Emblem, like "sigurd.png" (${FE17_EMBLEMS.length} Emblems, and "alear_female.png").`}
        match={(files) => matchEmblemFaces('fe17', EMBLEM_FACES, files)}
      />
    </TelliusBulkUpload>
  ),
  // Engage's folder: the portraits, the Bond Ring and Emblem faces, and the skill icons.
  art: UPLOAD_ART,
}

export default fe17
