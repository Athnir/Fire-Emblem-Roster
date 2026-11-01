/**
 * Shadow Dragon's level-ups (arm9 0x203d6dc), stat by stat, as exact probabilities. Each stat keeps the points it has gained (unit +0x50)
 * and a running total of its growths (unit +0x58, in hundredths of a point). On a level-up:
 *
 * - the chance is the growth (the person's + the class's) plus a tenth of how far the points gained (x100) are behind the running total,
 *   rounded down, when they are behind;
 * - 100 or more gives a point (if the stat is under its cap) and the rest is rolled against a number 0-99 (0x203dbc0), the point again
 *   only under the cap;
 * - the running total adds the growth (never below 0) unless the stat is at its cap.
 *
 * A stat as shown (0x203c6c0) is the unit's own base + the class's + the points gained, 0 below 0, held at the class's cap. A unit joins
 * with no points gained and running totals of 0 (0x2039ff8; every recruit's placement record has +0x1c-+0x23 at 0).
 *
 * The state is a distribution over [points gained, running total]; its keys are `${points},${total}`.
 */
export type GrowthState = Map<string, number>

export const joinState = (): GrowthState => new Map([['0,0', 1]])

/** A stat as shown: `base` is the unit's own base plus the class's. */
export const shownStat = (base: number, points: number, cap?: number) => {
  const v = Math.max(0, base + points)
  return cap === undefined ? v : Math.min(cap, v)
}

/** One level-up of one stat. `growth`: the person's + the class's (may be negative); `base`: the unit's own + the class's; `cap`: the
 * class's. */
export function levelUp(state: GrowthState, growth: number, base: number, cap?: number): GrowthState {
  const out: GrowthState = new Map()
  const add = (points: number, total: number, p: number) => {
    if (p <= 0) return
    const key = `${points},${total}`
    out.set(key, (out.get(key) ?? 0) + p)
  }
  const under = (points: number) => cap === undefined || shownStat(base, points, cap) < cap
  for (const [key, p] of state) {
    const [points, total] = key.split(',').map(Number)
    const behind = total - 100 * points
    let chance = (behind > 0 ? Math.floor(behind / 10) : 0) + growth
    let after = points
    if (chance >= 100) {
      chance -= 100
      if (under(points)) after = points + 1
    }
    const hit = Math.max(0, Math.min(100, chance)) / 100
    const nextTotal = under(points) ? total + Math.max(0, growth) : total
    const rolled = under(after) ? after + 1 : after
    add(rolled, nextTotal, p * hit)
    add(after, nextTotal, p * (1 - hit))
  }
  return out
}

/** The average of a stat as shown. */
export function averageShown(state: GrowthState, base: number, cap?: number): number {
  let sum = 0
  for (const [key, p] of state) sum += p * shownStat(base, Number(key.split(',')[0]), cap)
  return sum
}
