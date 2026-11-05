import { describe, expect, it } from 'vitest'
import { FE16_ABILITY_CHAINS, FE16_RANK_REWARDS } from '../../data/fe16/fe16Units'
import { FE17_EMBLEMS, FE17_SKILL_CHAINS } from '../../data/fe17/fe17Units'
import { topLevels } from '../skillChains'

const names = (xs: string[], chains: string[][]) => topLevels(xs, (x) => x, chains)

describe('skills that come in levels', () => {
  it("keeps a chain's top level where a higher one is listed beside it, and a lower one where it's the highest there", () => {
    const chains = [['Sword Agility 1', 'Sword Agility 2', 'Sword Agility 3']]
    expect(names(['Sword Agility 1', 'Sword Agility 2', 'Speed +1'], chains)).toEqual(['Sword Agility 2', 'Speed +1'])
    expect(names(['Sword Agility 1'], chains)).toEqual(['Sword Agility 1'])
  })

  it('in Three Houses, gives each skill rank its Prowess Lv 5 alone (the game\'s upgrade groups)', () => {
    expect(FE16_ABILITY_CHAINS.map((c) => c[c.length - 1])).toEqual([
      'Sword Prowess Lv 5', 'Lance Prowess Lv 5', 'Axe Prowess Lv 5', 'Bow Prowess Lv 5', 'Brawling Prowess Lv 5', 'Reason Lv 5', 'Faith Lv 5',
      'Authority Lv 5', 'Bowrange +2', 'White Magic Heal +10', 'Weight -5', 'Alert Stance+',
    ])
    const sword = FE16_RANK_REWARDS.filter((r) => r.skill === 'sword').map((r) => r.name)
    expect(names(sword, FE16_ABILITY_CHAINS).filter((n) => n.startsWith('Sword Prowess'))).toEqual(['Sword Prowess Lv 5'])
  })

  it("in Engage, gives each Emblem's levels of a skill their top one (Marth: Sword Agility 5, not 2)", () => {
    const marth = FE17_EMBLEMS.find((e) => e.name === 'Marth')!.levels.flatMap((l) => l.inherit.map((s) => s.name))
    expect(marth.filter((n) => n.startsWith('Sword Agility')).length).toBeGreaterThan(1)
    expect(names(marth, FE17_SKILL_CHAINS).filter((n) => n.startsWith('Sword Agility'))).toEqual(['Sword Agility 5'])
    // The skills a group holds that aren't levels of one another stay apart (Lunar, Solar and Eclipse Brace).
    expect(FE17_SKILL_CHAINS).toContainEqual(['Lunar Brace', 'Lunar Brace+'])
  })
})
