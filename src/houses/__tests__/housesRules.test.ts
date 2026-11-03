import { describe, expect, it } from 'vitest'
import { FE16_DATA } from '../../games/fe16'
import { canTake } from '../logic'
import { joinOf, joinOptions, levelGain, project, shownStats } from '../plan'
import { FE16_STATS, type Fe16Stats } from '../types'

const unit = (name: string) => FE16_DATA.units.find((u) => u.name === name)!
const cls = (name: string) => Object.values(FE16_DATA.classes).find((c) => c.name === name)!

/** The two-point minimum straight from the routine (0x3d3020), to check levelGain's averages against. */
function simulate(growths: Fe16Stats, minimum: boolean, runs = 40000): Fe16Stats {
  let seed = 12345
  const rand = () => {
    seed = (seed * 1103515245 + 12345) >>> 0
    return (seed >>> 16) % 100
  }
  const sum = Object.fromEntries(FE16_STATS.map((s) => [s, 0])) as Fe16Stats
  for (let n = 0; n < runs; n++) {
    let gained = 0
    const missed: { s: (typeof FE16_STATS)[number]; margin: number }[] = []
    for (const s of FE16_STATS) {
      let g = growths[s]
      const sure = g >= 101 ? Math.floor((g - 1) / 100) : 0
      g -= 100 * sure
      sum[s] += sure
      gained += sure
      const roll = rand()
      if (roll < g) {
        sum[s] += 1
        gained += 1
      } else if (g >= 1) missed.push({ s, margin: roll - g })
    }
    if (minimum && gained <= 1) {
      missed.sort((a, b) => a.margin - b.margin)
      for (const m of missed.slice(0, 2 - gained)) sum[m.s] += 1
    }
  }
  for (const s of FE16_STATS) sum[s] /= runs
  return sum
}

describe('Three Houses: the level-up (0x3d3020)', () => {
  it('averages each roll, and the two-point minimum as the routine gives it', () => {
    const cases: Fe16Stats[] = [
      { hp: 45, str: 45, mag: 35, dex: 45, spd: 45, lck: 45, def: 35, res: 30, cha: 45 },
      { hp: 20, str: 10, mag: 5, dex: 10, spd: 15, lck: 5, def: 10, res: 0, cha: 10 },
      { hp: 150, str: 30, mag: -10, dex: 20, spd: 25, lck: 10, def: 5, res: 5, cha: 20 },
    ]
    for (const g of cases) {
      for (const minimum of [false, true]) {
        const want = simulate(g, minimum)
        const got = levelGain(g, minimum)
        for (const s of FE16_STATS) expect(Math.abs(got[s] - want[s])).toBeLessThan(0.015)
      }
    }
  })

  it('keeps the minimum to the units the person table marks: not the staff and knights', () => {
    expect(FE16_DATA.units.filter((u) => !u.minimumTwo).map((u) => u.name)).toEqual(['Seteth', 'Hanneman', 'Manuela', 'Gilbert', 'Alois', 'Catherine', 'Shamir'])
  })
})

describe('Three Houses: classes', () => {
  it('lifts stats to a class\'s bases for good, and shows the boosts past the maximums', () => {
    const bernie = unit('Bernadetta')
    const plan = { steps: [{ at: 10, to: cls('Armored Knight').id }, { at: 10, to: cls('Noble').id }], targetLevel: 10 }
    const stages = project(FE16_DATA, bernie, plan, {})
    const armored = stages.find((s) => s.classId === cls('Armored Knight').id)!
    const back = stages[stages.length - 1]
    expect(armored.own.def).toBeGreaterThanOrEqual(cls('Armored Knight').bases.def)
    expect(back.own.def).toBe(armored.own.def)
    const shown = shownStats(cls('Fortress Knight'), { ...bernie.bases, def: bernie.caps.def })
    expect(shown.def).toBe(bernie.caps.def + 10)
  })

  it('locks the Lord to the house leaders and keeps every gender lock (0x651160)', () => {
    expect(FE16_DATA.units.filter((u) => canTake(cls('Lord'), u)).map((u) => u.name)).toEqual(['Edelgard', 'Dimitri', 'Claude'])
    expect(canTake(cls('Dark Mage'), unit('Hapi'))).toBe(false)
    expect(canTake(cls('Gremory'), unit('Yuri'))).toBe(false)
    expect(canTake(cls('Pegasus Knight'), unit('Ingrid'))).toBe(true)
  })
})

describe('Three Houses: joining partway (0x3d0dc0, 0x3d4260)', () => {
  it('gives a recruit their chapter\'s level, 2k − 1 in Part I', () => {
    expect([1, 2, 8, 11].map((ch) => joinOf(FE16_DATA, unit('Felix'), { house: 'be' }, ch).level)).toEqual([1, 3, 15, 21])
  })

  it("matches Fire Emblem Wiki's Hanneman recruited in Chapter 8", () => {
    const j = joinOf(FE16_DATA, unit('Hanneman'), { house: 'bl' }, 8)
    expect(FE16_DATA.classes[j.classId].name).toBe('Mage')
    expect(j.level).toBe(15)
    expect(FE16_STATS.map((s) => j.own[s])).toEqual([32, 10, 19, 12, 9, 9, 7, 15, 11])
  })

  it('joins Gilbert at Lv 26 on Azure Moon, and a student of the house taught at Lv 1', () => {
    expect(joinOf(FE16_DATA, unit('Gilbert'), { house: 'bl' }, 13).level).toBe(26)
    expect(joinOptions(unit('Dimitri'), { house: 'bl' })).toEqual([])
    expect(joinOptions(unit('Felix'), { house: 'be' })).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })
})
