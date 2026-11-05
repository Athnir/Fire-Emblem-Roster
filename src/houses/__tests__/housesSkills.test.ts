import { describe, expect, it } from 'vitest'
import { FE16_DATA } from '../../games/fe16'
import { canTake, learnable, personalNow } from '../logic'
import { pathTo } from '../plan'

const unit = (id: string) => FE16_DATA.units.find((u) => u.id === id)!
const dancer = Object.values(FE16_DATA.classes).find((c) => c.name === 'Dancer')!
const pool = (id: string) => learnable(FE16_DATA, unit(id)).map((s) => s.name)

describe('Three Houses skills', () => {
  it("offers the Dancer, and its dances, only to who can be the White Heron Cup's representative: the students and Flayn", () => {
    const can = FE16_DATA.units.filter((u) => canTake(dancer, u)).map((u) => u.id)
    expect(can).toHaveLength(25)
    expect(can).toContain('fe16-flayn')
    for (const id of ['fe16-byleth-m', 'fe16-byleth-f', 'fe16-seteth', 'fe16-manuela', 'fe16-jeritza', 'fe16-yuri', 'fe16-anna'])
      expect(can, id).not.toContain(id)
    // Winning the Cup also teaches Sword Avo +20 and Sword Dance (0x1ffaf0).
    expect(pool('fe16-edelgard')).toEqual(expect.arrayContaining(['Special Dance', 'Sword Avo +20', 'Sword Dance']))
    expect(pool('fe16-byleth-m')).not.toContain('Special Dance')
    expect(pool('fe16-byleth-m')).not.toContain('Sword Dance')
  })

  it("shows only the personal ability the chapter has with the spoiler block on: Byleth's + from Chapter 11, the lords' from 13", () => {
    const names = (id: string, chapter?: number) => personalNow(unit(id), chapter).map((p) => p.name)
    expect(names('fe16-byleth-f', 10)).toEqual(["Professor's Guidance"])
    expect(names('fe16-byleth-f', 11)).toEqual(["Professor's Guidance+"])
    expect(names('fe16-edelgard', 12)).toEqual(['Imperial Lineage'])
    expect(names('fe16-edelgard', 13)).toEqual(['Imperial Lineage+'])
    // With the block off, both, the second marked with its chapter.
    expect(personalNow(unit('fe16-dimitri'))).toEqual([{ name: 'Royal Lineage' }, { name: 'Royal Lineage+', part: 'from Chapter 13' }])
    expect(names('fe16-hubert', 13)).toEqual(names('fe16-hubert', 1))
  })
})

describe('Three Houses classes', () => {
  it('gives each unit the Noble or the Commoner class they join in, never the other', () => {
    const noble = FE16_DATA.classes['0']
    const commoner = FE16_DATA.classes['1']
    expect([canTake(noble, unit('fe16-edelgard')), canTake(commoner, unit('fe16-edelgard'))]).toEqual([true, false])
    expect([canTake(noble, unit('fe16-byleth-m')), canTake(commoner, unit('fe16-byleth-m'))]).toEqual([false, true])
    // The staff hold one too, as they join certified in it (Manuela a Commoner, Seteth a Noble).
    expect([canTake(commoner, unit('fe16-manuela')), canTake(noble, unit('fe16-seteth'))]).toEqual([true, true])
  })

  it('estimates by the shortest way: the Dark Bishop after the Dark Mage, each at its exam level', () => {
    const start = { classId: '1', level: 1 }
    expect(pathTo(FE16_DATA, unit('fe16-byleth-m'), start, '29')).toEqual([
      { at: 10, to: '15' },
      { at: 20, to: '29' },
    ])
  })
})
