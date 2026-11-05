import { describe, expect, it } from 'vitest'
import { FE17_CLASSES, FE17_UNITS } from '../../data/fe17/fe17Units'
import { FE17_DATA } from '../../games/fe17'
import { estimate, internalAfter, levelAfter, levelGain, PACT_RING_CHAPTER, pactPartners, pathTo, shownStats } from '../logic'
import { FE17_STATS, type Fe17Stats } from '../types'

/** The level-up's re-roll straight from the routine (Unit.LevelUp 0x1a3a040), to check levelGain's averages against. */
function simulate(growths: Fe17Stats, runs = 100000): Fe17Stats {
  // mulberry32: a generator good enough that the averages settle.
  let seed = 987654321
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * 100)
  }
  const sum = Object.fromEntries(FE17_STATS.map((s) => [s, 0])) as Fe17Stats
  for (let n = 0; n < runs; n++) {
    let best: Fe17Stats | null = null
    let bestCount = -1
    for (let t = 0; t < 4; t++) {
      const got = {} as Fe17Stats
      let count = 0
      for (const s of FE17_STATS) {
        const g = growths[s]
        got[s] = Math.floor(g / 100) + (rand() < g % 100 ? 1 : 0)
        count += got[s]
      }
      if (count > bestCount) {
        best = got
        bestCount = count
      }
      if (count >= 2) break
    }
    for (const s of FE17_STATS) sum[s] += best![s]
  }
  for (const s of FE17_STATS) sum[s] /= runs
  return sum
}

describe('Engage: the level-up (0x1a3a040)', () => {
  it('averages the rolls with the re-roll below two points, up to four tries', () => {
    const cases: Fe17Stats[] = [
      { hp: 60, str: 35, mag: 20, dex: 45, spd: 50, def: 40, res: 25, lck: 25, bld: 5 },
      { hp: 10, str: 5, mag: 0, dex: 10, spd: 5, def: 5, res: 0, lck: 5, bld: 0 },
      { hp: 120, str: 10, mag: 5, dex: 10, spd: 5, def: 5, res: 5, lck: 5, bld: 0 },
    ]
    for (const g of cases) {
      const want = simulate(g)
      const got = levelGain(g)
      for (const s of FE17_STATS) expect(Math.abs(got[s] - want[s])).toBeLessThan(0.012)
    }
  })
})

describe('Engage: stats and class changes', () => {
  it("shows every unit's join stats as the class's bases plus their own, held at the caps", () => {
    for (const u of FE17_UNITS) expect([u.name, shownStats(FE17_CLASSES[u.classId], u, u.own)]).toEqual([u.name, u.joinStats])
  })

  it('starts a changed class at Lv 1, or 21 into a class to Lv 40 from an advanced one; the internal level adds the levels', () => {
    const base = Object.values(FE17_CLASSES).find((c) => c.tier === 'base' && c.maxLevel === 20)!
    const adv = Object.values(FE17_CLASSES).find((c) => c.tier === 'advanced')!
    const special = Object.values(FE17_CLASSES).find((c) => c.maxLevel === 40)!
    expect(levelAfter(base, 10, adv)).toBe(1)
    expect(levelAfter(adv, 5, special)).toBe(21)
    expect(levelAfter(base, 15, special)).toBe(1)
    expect(internalAfter(0, 10, 1, 30)).toBe(9)
    expect(internalAfter(25, 20, 1, 30)).toBe(30)
    expect(internalAfter(20, 20, 21, 40)).toBe(19)
  })
})

describe('the Pact Ring', () => {
  it("is planned from an Alear's A supports, the same for both Alears, and opens with Paralogue: The Connector", () => {
    const m = pactPartners(FE17_DATA, 'fe17-alear')
    expect(m.length).toBeGreaterThan(30)
    expect(pactPartners(FE17_DATA, 'fe17-alear-female')).toEqual(m)
    expect(FE17_DATA.chapters.find((c) => c.id === PACT_RING_CHAPTER)?.label).toBe('Paralogue: The Connector')
  })
})

describe('the estimate (as Fates\' Projected Stats)', () => {
  it('takes the shortest way to a class, promoting at Lv 20 unless told, and gives the stats there', () => {
    const alear = FE17_DATA.units.find((u) => u.id === 'fe17-alear')!
    expect(pathTo(FE17_DATA, alear, 'divine-dragon')).toEqual([{ at: 20, to: 'divine-dragon' }])
    expect(pathTo(FE17_DATA, alear, 'divine-dragon', 10)).toEqual([{ at: 10, to: 'divine-dragon' }])
    const stages = estimate(FE17_DATA, alear, { steps: [], targetLevel: 1 }, 'divine-dragon', 20)
    expect(stages.at(-1)).toMatchObject({ classId: 'divine-dragon', level: 20 })
    // The male Alear can't be a flier only women can be.
    expect(pathTo(FE17_DATA, alear, 'sword-flier')).toEqual([])
  })
})
