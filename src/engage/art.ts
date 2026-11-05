import { assetKeys } from '../data/assetStorage'
import { matchByStem, type GameArt, type MatchResult } from '../logic/bulkAssetImport'
import { telliusArt } from '../tellius/art'
import type { TelliusData } from '../tellius/types'
import { artId } from './hooks'
import type { Fe17BondRingSet, Fe17Emblem } from './types'

// Engage's art: the units' portraits, as the other games' (src/tellius/art.ts), each Bond Ring's face, kept under the game's
// "rings/", and each Emblem's, under "emblems/", so a hero who shares a unit's name (the Heroes ring Anna, Engage's Anna) or an
// Emblem's (the Bond Ring Chrom, the Emblem Chrom) stays apart.

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

/** The Emblems the game has no face of: Ephraim shows only beside Eirika (data-raw/fe17/README.md, "Portraits"). */
const NO_FACE = new Set(['Ephraim'])

function ringEntries(gameId: string, sets: Fe17BondRingSet[]) {
  return sets.flatMap((s) => s.rings.map((r) => ({ id: stem(gameId, r.name), label: `${r.name} (Bond Ring)` })))
}

function emblemEntries(gameId: string, emblems: Fe17Emblem[]) {
  return emblems.map((e) => ({ id: stem(gameId, e.name), label: `${e.name} (Emblem)` }))
}

/** Bond Ring faces by file name ("caeda.png"). */
export function matchRingFaces(gameId: string, sets: Fe17BondRingSet[], files: File[]): MatchResult {
  return matchByStem(files, ringEntries(gameId, sets), (id) => assetKeys.portrait(`${gameId}/rings/${id}`))
}

/** Emblem faces by file name ("sigurd.png"). */
export function matchEmblemFaces(gameId: string, emblems: Fe17Emblem[], files: File[]): MatchResult {
  return matchByStem(files, emblemEntries(gameId, emblems), (id) => assetKeys.portrait(`${gameId}/emblems/${id}`))
}

const inFolder = (f: File, folder: string) =>
  ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name).replace(/\\/g, '/').toLowerCase().split('/').includes(folder)

/** Engage's folder for Bulk Upload: files in a "rings" folder are Bond Ring faces, in an "emblems" folder Emblem faces, the rest are
 * read as the other games' are. */
export function fe17Art(data: TelliusData, sets: Fe17BondRingSet[], emblems: Fe17Emblem[]): GameArt {
  const rest = telliusArt(data)
  return {
    match: (files) => {
      const rings = matchRingFaces(data.gameId, sets, files.filter((f) => inFolder(f, 'rings')))
      const faces = matchEmblemFaces(data.gameId, emblems, files.filter((f) => inFolder(f, 'emblems')))
      const others = rest.match(files.filter((f) => !inFolder(f, 'rings') && !inFolder(f, 'emblems')))
      return {
        matched: [...others.matched, ...rings.matched, ...faces.matched],
        unmatched: [...others.unmatched, ...rings.unmatched, ...faces.unmatched],
      }
    },
    expected: [
      ...rest.expected,
      ...ringEntries(data.gameId, sets).map((e) => `rings/${e.id}.png`),
      ...emblemEntries(data.gameId, emblems.filter((e) => !NO_FACE.has(e.name))).map((e) => `emblems/${e.id}.png`),
    ],
  }
}
