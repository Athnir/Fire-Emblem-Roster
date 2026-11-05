import type { GameArt } from '../logic/bulkAssetImport'
import { matchSkillIcons, skillIconEntries, telliusArt } from '../tellius/art'
import type { TelliusData } from '../tellius/types'

// Three Houses' art: the units' portraits, as the other games' (src/tellius/art.ts), and each ability's and combat art's icon, in
// "skills/", each "+" spelled out (skillIconId), as the game has both Alert Stance and Alert Stance+.

const inSkills = (f: File) =>
  ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name).replace(/\\/g, '/').toLowerCase().split('/').includes('skills')

/** Three Houses' folder for Bulk Upload: files in a "skills" folder are ability and combat art icons, the rest portraits. */
export function fe16Art(data: TelliusData, skills: string[]): GameArt {
  const portraits = telliusArt({ ...data, skills: {} })
  return {
    match: (files) => {
      const parts = [portraits.match(files.filter((f) => !inSkills(f))), matchSkillIcons(data.gameId, skills, files.filter(inSkills))]
      return { matched: parts.flatMap((p) => p.matched), unmatched: parts.flatMap((p) => p.unmatched) }
    },
    expected: [...portraits.expected, ...skillIconEntries(data.gameId, skills).map((e) => `skills/${e.id}.png`)],
  }
}
