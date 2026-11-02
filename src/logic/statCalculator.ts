import { STAT_KEYS, type StatBlock } from '../data/types'

/**
 * child_growth_rate[stat] = (variable_parent_growth_rate[stat] + child_base_growth_rate[stat]) / 2, rounded down: the game
 * halves with integer division (0x5330cc), before it adds the class's growth and Aptitude's 10. A second-generation variable
 * parent's own growth is halved and rounded down first (0x53b758); resolveSecondGenParent gets that from this function too.
 * Non-variable parent's growths do not factor in at all.
 */
export function computeGrowthRate(variableParentGrowth: number, childBaseGrowth: number): number {
  return Math.trunc((variableParentGrowth + childBaseGrowth) / 2)
}

export function computeGrowthRates(
  variableParentGrowths: StatBlock,
  childBaseGrowths: StatBlock,
): StatBlock {
  const result = {} as StatBlock
  for (const stat of STAT_KEYS) {
    result[stat] = computeGrowthRate(variableParentGrowths[stat], childBaseGrowths[stat])
  }
  return result
}

export interface BaseStatInputs {
  childAbsoluteBaseStat: number
  /** The child's own default class's base-stat contribution (added once, flat, on top of C+bonus). */
  childClassBaseStat: number
  /** The growth for the levels above 10. computeChild passes the inherited personal growth alone, a deliberate low estimate (Serenes Forest's formula adds the class's growth). */
  childFullGrowthRate: number
  level: number
  /** Parent's actual current stat total at recruitment time (not their base stats, ideally). */
  fatherCurrentStat: number
  /** Base-stat contribution of whichever class the father's fatherCurrentStat was measured in. */
  fatherClassBaseStat: number
  motherCurrentStat: number
  motherClassBaseStat: number
}

/**
 * Step 1: C = child's "natural" stat at their join level (their own absolute base + any growth
 * from levels above the level-10 baseline).
 * Step 2: parental bonus — each parent's contribution is their PERSONAL stat (current stat minus
 * their own class's base-stat contribution), not their raw displayed/current stat — capped.
 * Step 3: the child's own class's base-stat contribution is added once, flat, on top.
 * Serenes Forest's child-stat formula (its base-stats pages), less the class's growth (see childFullGrowthRate), with the
 * game's rounding: the levels' growth is summed and divided by 100, rounding half up (0x3d7164); the bonus is divided by 4 and
 * the cap's C by 10, both rounding down (0x3d8718).
 */
export function computeBaseStat(inputs: BaseStatInputs): number {
  const {
    childAbsoluteBaseStat,
    childClassBaseStat,
    childFullGrowthRate,
    level,
    fatherCurrentStat,
    fatherClassBaseStat,
    motherCurrentStat,
    motherClassBaseStat,
  } = inputs

  // childFullGrowthRate is a percentage integer (e.g. 45 meaning 45%), same units as every other
  // growth rate in the data (characters.ts, computeGrowthRate) — dividing by 100 here converts it
  // to stat points. Missing this turned a few points of expected growth into hundreds (e.g. growth
  // 45, 8 levels above baseline: 45*8=360 instead of 360/100 = 3.6, which the game rounds to 4) —
  // every existing test happened to use level: 10, zeroing out (level - 10) and hiding the bug
  // completely regardless of this term's scale.
  const C = childAbsoluteBaseStat + Math.floor((childFullGrowthRate * (level - 10) + 50) / 100)
  const fatherPersonalStat = fatherCurrentStat - fatherClassBaseStat
  const motherPersonalStat = motherCurrentStat - motherClassBaseStat
  const fatherDiff = Math.max(fatherPersonalStat - C, 0)
  const motherDiff = Math.max(motherPersonalStat - C, 0)
  const bonus = Math.trunc((fatherDiff + motherDiff) / 4)
  const bonusCapped = Math.min(bonus, Math.trunc(C / 10) + 2)
  return childClassBaseStat + C + bonusCapped
}

export function computeBaseStats(
  childAbsoluteBaseStats: StatBlock,
  childClassBaseStats: StatBlock,
  childFullGrowthRates: StatBlock,
  level: number,
  fatherCurrentStats: StatBlock,
  fatherClassBaseStats: StatBlock,
  motherCurrentStats: StatBlock,
  motherClassBaseStats: StatBlock,
): StatBlock {
  const result = {} as StatBlock
  for (const stat of STAT_KEYS) {
    result[stat] = computeBaseStat({
      childAbsoluteBaseStat: childAbsoluteBaseStats[stat],
      childClassBaseStat: childClassBaseStats[stat],
      childFullGrowthRate: childFullGrowthRates[stat],
      level,
      fatherCurrentStat: fatherCurrentStats[stat],
      fatherClassBaseStat: fatherClassBaseStats[stat],
      motherCurrentStat: motherCurrentStats[stat],
      motherClassBaseStat: motherClassBaseStats[stat],
    })
  }
  return result
}

/**
 * child_max_stat_modifiers = father + mother + bonus, the bonus 1 on every stat but HP (HP has no cap modifier: the game's
 * child-cap code, 0x53bddc, skips the +1 for it). The bonus is 0 when the child is Kana AND one of Kana's own parents is a child
 * character: a second-generation parent's modifiers here already carry their own +1. The game counts it the other way round
 * (it adds that parent's own parents' modifiers without their +1, then Kana's +1) and comes to the same total: one +1 per stat.
 */
export function computeMaxStatModifiers(
  fatherMaxStatModifiers: StatBlock,
  motherMaxStatModifiers: StatBlock,
  isKanaWithChildParent: boolean,
): StatBlock {
  const bonus = isKanaWithChildParent ? 0 : 1
  const result = {} as StatBlock
  for (const stat of STAT_KEYS) {
    result[stat] = fatherMaxStatModifiers[stat] + motherMaxStatModifiers[stat] + (stat === 'hp' ? 0 : bonus)
  }
  return result
}
