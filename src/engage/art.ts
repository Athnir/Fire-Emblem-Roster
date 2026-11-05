import { assetKeys } from '../data/assetStorage'
import { matchByStem, type GameArt, type MatchResult } from '../logic/bulkAssetImport'
import { matchSkillIcons, skillIconEntries, telliusArt } from '../tellius/art'
import type { TelliusData } from '../tellius/types'
import { artId } from './hooks'
import type { Fe17BondRingSet } from './types'

// Engage's art: the units' portraits, as the other games' (src/tellius/art.ts), each Bond Ring's face, kept under the game's
// "rings/", each Emblem's, under "emblems/", and each skill's icon, under "skills/", so a hero who shares a unit's name (the Heroes
// ring Anna, Engage's Anna) or an Emblem's (the Bond Ring Chrom, the Emblem Chrom) stays apart.

/** The name the female Alear's art is kept under (alear_female.png), as a portrait (the female Alear is a unit of her
 * own, as Fates' two Corrins) and as the Emblem (shown beside the male face). */
export const FEMALE_ALEAR = 'Alear Female'

/** A face's file name, without ".png": the name as a unit's portrait is named ("Black Knight": black_knight). */
function stem(gameId: string, name: string): string {
  return artId(gameId, name).slice(gameId.length + 1)
}

/** The id a Bond Ring's face is kept and looked up by: 'fe17/rings/caeda'. */
export function ringFaceId(gameId: string, ring: string): string {
  return `${gameId}/rings/${stem(gameId, ring)}`
}

/** The id an Emblem's face is kept and looked up by: 'fe17/emblems/sigurd'. */
export function emblemFaceId(gameId: string, emblem: string): string {
  return `${gameId}/emblems/${stem(gameId, emblem)}`
}

// A skill's icon is kept as the "+" games' are (src/tellius/art.ts skillIconId): Engage has both Lunar Brace and Lunar Brace+ (and
// Unyielding++), which would otherwise share one.
export { matchSkillIcons, skillIconId } from '../tellius/art'

function ringEntries(gameId: string, sets: Fe17BondRingSet[]) {
  return sets.flatMap((s) => s.rings.map((r) => ({ id: stem(gameId, r.name), label: `${r.name} (Bond Ring)` })))
}

function emblemEntries(gameId: string, emblems: string[]) {
  return emblems.map((e) => ({ id: stem(gameId, e), label: `${e} (Emblem)` }))
}

/** Bond Ring faces by file name ("caeda.png"). */
export function matchRingFaces(gameId: string, sets: Fe17BondRingSet[], files: File[]): MatchResult {
  return matchByStem(files, ringEntries(gameId, sets), (id) => assetKeys.portrait(`${gameId}/rings/${id}`))
}

/** Emblem faces by file name ("sigurd.png"). */
export function matchEmblemFaces(gameId: string, emblems: string[], files: File[]): MatchResult {
  return matchByStem(files, emblemEntries(gameId, emblems), (id) => assetKeys.portrait(`${gameId}/emblems/${id}`))
}

const inFolder = (f: File, folder: string) =>
  ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name).replace(/\\/g, '/').toLowerCase().split('/').includes(folder)

/** Engage's folder for Bulk Upload: files in a "rings" folder are Bond Ring faces, in "emblems" Emblem faces, in "skills" skill
 * icons; the rest are portraits, read as the other games' are (data.units: the units, and the female Alear). */
export function fe17Art(data: TelliusData, sets: Fe17BondRingSet[], emblems: string[], skills: string[]): GameArt {
  const portraits = telliusArt({ ...data, skills: {} })
  const own = (f: File) => inFolder(f, 'rings') || inFolder(f, 'emblems') || inFolder(f, 'skills')
  return {
    match: (files) => {
      const parts = [
        portraits.match(files.filter((f) => !own(f))),
        matchRingFaces(data.gameId, sets, files.filter((f) => inFolder(f, 'rings'))),
        matchEmblemFaces(data.gameId, emblems, files.filter((f) => inFolder(f, 'emblems'))),
        matchSkillIcons(data.gameId, skills, files.filter((f) => inFolder(f, 'skills'))),
      ]
      return { matched: parts.flatMap((p) => p.matched), unmatched: parts.flatMap((p) => p.unmatched) }
    },
    expected: [
      ...portraits.expected,
      ...ringEntries(data.gameId, sets).map((e) => `rings/${e.id}.png`),
      ...emblemEntries(data.gameId, emblems).map((e) => `emblems/${e.id}.png`),
      ...skillIconEntries(data.gameId, skills).map((e) => `skills/${e.id}.png`),
    ],
  }
}
