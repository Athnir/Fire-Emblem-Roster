import { describe, expect, it } from 'vitest'
import { averageShown, joinState, levelUp, type GrowthState } from '../dynamicGrowth'

const run = (levels: number, growth: number, base = 0, cap?: number, state: GrowthState = joinState()) => {
  for (let i = 0; i < levels; i++) state = levelUp(state, growth, base, cap)
  return state
}

describe("Shadow Dragon's level-ups with the catch-up bonus", () => {
  it('rolls the growth alone on the first level-up', () => {
    expect(averageShown(run(1, 50), 0)).toBeCloseTo(0.5, 10)
  })

  it('adds a tenth of the shortfall after a miss: 50% then 55%', () => {
    // A miss leaves 50 behind (bonus 5: 55%); a hit is 50 ahead (no bonus: 50%). 0.5 * 1.5 + 0.5 * 0.55.
    expect(averageShown(run(2, 50), 0)).toBeCloseTo(1.025, 10)
  })

  it('gives a point and rolls the rest at 100 or more', () => {
    expect(averageShown(run(1, 130), 0)).toBeCloseTo(1.3, 10)
  })

  it('keeps averages a little above the growth alone, and never below it', () => {
    for (const g of [5, 20, 35, 50, 70, 90]) {
      const avg = averageShown(run(19, g), 0)
      expect(avg).toBeGreaterThanOrEqual((g / 100) * 19 - 1e-9)
      expect(avg).toBeLessThan((g / 100) * 19 + 1)
    }
  })

  it('never goes past the cap, and stops the running total there', () => {
    const state = run(20, 90, 15, 20)
    expect(averageShown(state, 15, 20)).toBeLessThanOrEqual(20 + 1e-9)
    for (const key of state.keys()) expect(Number(key.split(',')[0])).toBeLessThanOrEqual(5)
  })

  it('can raise a 0% stat once a class with a growth has left it behind', () => {
    // Behind after misses at 40%, then a 0% class: the bonus alone can give points.
    const behind = run(5, 40)
    const before = averageShown(behind, 0)
    expect(averageShown(run(3, 0, 0, undefined, behind), 0)).toBeGreaterThan(before)
  })

  it('floors a stat below 0 at 0 when shown, keeping what is underneath', () => {
    expect(averageShown(joinState(), -2)).toBe(0)
    expect(averageShown(joinState(), 3)).toBe(3)
  })
})
