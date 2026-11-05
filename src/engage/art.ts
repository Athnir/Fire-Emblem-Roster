import { assetKeys } from '../data/assetStorage'
import { matchByStem, type GameArt, type MatchResult } from '../logic/bulkAssetImport'
import { telliusArt } from '../tellius/art'
import type { TelliusData } from '../tellius/types'
import { artId } from './hooks'
import type { Fe17BondRingSet } from './types'

// Engage's art: the units' portraits, as the other games' (src/tellius/art.ts), and each Bond Ring's face, kept under the game's
// "rings/" so a hero who shares a unit's name (the Heroes ring Anna, Engage's Anna) stays apart.

/** A Bond Ring face's file name, without ".png": the ring's name as a unit's portrait is named ("Black Knight": black_knight). */
function ringStem(gameId: string, ring: string): string {
  return artId(gameId, ring).slice(gameId.length + 1)
}

/** The id a Bond Ring's face is kept and looked up by: 'fe17/rings/caeda'. */
export function ringFaceId(gameId: string, ring: string): string {
  return `${gameId}/rings/${ringStem(gameId, ring)}`
}

function ringEntries(gameId: string, sets: Fe17BondRingSet[]) {
  return sets.flatMap((s) => s.rings.map((r) => ({ id: ringStem(gameId, r.name), label: `${r.name} (Bond Ring)` })))
}

/** Bond Ring faces by file name ("caeda.png"). */
export function matchRingFaces(gameId: string, sets: Fe17BondRingSet[], files: File[]): MatchResult {
  return matchByStem(files, ringEntries(gameId, sets), (stem) => assetKeys.portrait(`${gameId}/rings/${stem}`))
}

const inRings = (f: File) =>
  ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name).replace(/\\/g, '/').toLowerCase().split('/').includes('rings')

/** Engage's folder for Bulk Upload: files in a "rings" folder are Bond Ring faces, the rest are read as the other games' are. */
export function fe17Art(data: TelliusData, sets: Fe17BondRingSet[]): GameArt {
  const rest = telliusArt(data)
  return {
    match: (files) => {
      const faces = matchRingFaces(data.gameId, sets, files.filter(inRings))
      const others = rest.match(files.filter((f) => !inRings(f)))
      return { matched: [...others.matched, ...faces.matched], unmatched: [...others.unmatched, ...faces.unmatched] }
    },
    expected: [...rest.expected, ...ringEntries(data.gameId, sets).map((e) => `rings/${e.id}.png`)],
  }
}
