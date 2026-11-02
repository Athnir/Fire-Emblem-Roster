import { classesByName } from '../data/classes'
import { storyLevelForChapter } from '../data/childLeveling'
import { STAT_KEYS, type Character, type Route, type StatBlock } from '../data/types'
import { classGrowthRate, classStatCap, getBaseStats, getStartingLevel } from './levelProjection'

/**
 * A late recruit's join level and stats once the story has reached `chapter` (only for units with joinScalesFrom: Izana, Flora,
 * Fuga, Yukimura). Like the children, each story level past their threshold adds a level (0x3d396c); the game sums those levels'
 * growth, the class's included, divides by 100 rounding half up, and adds it under the class's caps (0x3d7164). Undefined for
 * everyone else.
 */
export function lateRecruitJoin(
  character: Character,
  route: Route,
  chapter: number,
): { level: number; baseStats: StatBlock } | undefined {
  const joinClass = classesByName[character.joinClass ?? character.startingClass]
  if (character.joinScalesFrom === undefined || !joinClass) return undefined
  const startLevel = getStartingLevel(character.startingLevel, route)
  const levels = Math.min(Math.max(0, storyLevelForChapter(chapter) - character.joinScalesFrom), 20 - startLevel)
  const growth = classGrowthRate(character.growthRates, joinClass)
  const caps = classStatCap(joinClass, character.maxStatModifiers)
  const bases = getBaseStats(character, route)
  const baseStats = {} as StatBlock
  for (const key of STAT_KEYS) {
    baseStats[key] = Math.min(bases[key] + Math.floor((Math.max(0, growth[key]) * levels + 50) / 100), caps[key])
  }
  return { level: startLevel + levels, baseStats }
}
