import { describe, expect, it } from 'vitest'
import { GBA_GROWING, GBA_STATS } from '../../../gba/types'
import { FE6_CHAPTERS, FE6_SUPPORTS, FE6_UNITS } from '../fe6Units'

// Serenes Forest's Binding Blade tables, copied here to check the data built from the ROM against them.
// Its trial-map units aren't read yet (the game's code adds them once it has been cleared), so they're left out here.
// Base stats: Lv, HP, S/M, Skl, Spd, Lck, Def, Res, Con, Mov (characters/base-stats, Normal mode), under the patch's names.
const SF_BASES: Record<string, number[]> = {"Perceval": [5, 43, 17, 13, 18, 12, 14, 11, 12, 8], "Roy": [1, 18, 5, 5, 7, 7, 5, 0, 6, 5], "Marcus": [1, 32, 9, 14, 11, 10, 9, 8, 11, 8], "Alen": [1, 21, 7, 4, 6, 3, 6, 0, 9, 7], "Lance": [1, 20, 5, 6, 8, 2, 6, 0, 9, 7], "Wolt": [1, 18, 4, 4, 5, 2, 4, 0, 7, 5], "Bors": [1, 20, 7, 4, 3, 4, 11, 0, 14, 4], "Merlinus": [1, 15, 0, 3, 3, 10, 3, 0, 25, 5], "Elen": [2, 16, 1, 6, 8, 8, 0, 6, 4, 5], "Dieck": [5, 26, 9, 12, 10, 5, 6, 1, 13, 5], "Ward": [2, 28, 8, 3, 5, 4, 3, 0, 13, 5], "Lot": [3, 29, 7, 6, 7, 2, 4, 1, 12, 5], "Shanna": [1, 17, 4, 6, 12, 5, 6, 5, 4, 7], "Chad": [1, 16, 3, 3, 10, 4, 2, 0, 5, 6], "Lugh": [1, 16, 4, 5, 6, 5, 3, 5, 4, 5], "Clarine": [1, 15, 2, 5, 9, 8, 2, 5, 5, 7], "Rutger": [4, 22, 7, 12, 13, 2, 5, 0, 7, 5], "Saul": [5, 20, 4, 6, 10, 2, 2, 5, 6, 5], "Dorothy": [3, 19, 5, 6, 6, 3, 4, 2, 7, 5], "Sue": [1, 18, 5, 7, 8, 4, 5, 0, 5, 7], "Zelot": [1, 35, 10, 12, 13, 5, 11, 7, 11, 8], "Trec": [4, 25, 8, 6, 7, 5, 8, 0, 9, 7], "Noah": [7, 27, 8, 7, 9, 6, 7, 1, 10, 7], "Astolfo": [10, 25, 7, 8, 15, 11, 7, 3, 8, 6], "Lilina": [1, 16, 5, 5, 4, 4, 2, 7, 4, 5], "Gwendolyn": [1, 19, 4, 3, 3, 6, 8, 1, 10, 4], "Barthe": [9, 25, 10, 6, 5, 2, 14, 1, 16, 4], "Ogier": [3, 24, 7, 10, 9, 6, 4, 0, 8, 5], "Fir": [1, 19, 6, 9, 10, 3, 3, 1, 5, 5], "Sin": [5, 24, 7, 8, 10, 6, 7, 0, 7, 7], "Gonzalez": [5, 36, 12, 5, 9, 5, 6, 0, 15, 5], "Geese": [10, 33, 10, 9, 9, 9, 8, 0, 11, 5], "Klein": [1, 27, 13, 13, 11, 10, 8, 6, 7, 6], "Thea": [8, 22, 6, 8, 11, 3, 7, 6, 5, 7], "Larum": [1, 14, 1, 2, 11, 9, 2, 4, 4, 5], "Echidna": [1, 35, 13, 19, 18, 6, 8, 7, 9, 6], "Elffin": [1, 15, 1, 3, 10, 11, 4, 1, 6, 5], "Bartre": [2, 48, 22, 11, 10, 14, 10, 3, 14, 6], "Raigh": [12, 23, 12, 9, 9, 6, 5, 10, 4, 5], "Cath": [5, 16, 3, 7, 11, 8, 2, 1, 5, 6], "Melady": [10, 30, 12, 11, 10, 5, 13, 3, 9, 7], "Cecilia": [1, 30, 11, 7, 10, 10, 7, 13, 6, 8], "Sophia": [1, 15, 6, 2, 4, 3, 1, 8, 3, 5], "Igrene": [1, 32, 16, 18, 15, 9, 11, 10, 7, 6], "Garrett": [1, 49, 17, 13, 10, 12, 9, 4, 13, 6], "Fae": [1, 16, 2, 2, 3, 7, 2, 6, 1, 5], "Hugh": [15, 26, 13, 11, 12, 10, 9, 9, 7, 5], "Zeiss": [7, 28, 14, 9, 8, 6, 12, 2, 10, 7], "Douglas": [8, 46, 19, 13, 8, 11, 20, 5, 17, 5], "Niime": [18, 25, 21, 20, 16, 15, 5, 18, 4, 6], "Dayan": [12, 43, 14, 16, 20, 12, 10, 12, 9, 8], "Juno": [9, 33, 11, 14, 16, 14, 8, 12, 7, 8], "Yoder": [20, 35, 19, 18, 14, 11, 5, 30, 6, 6], "Karel": [19, 44, 20, 28, 23, 18, 15, 13, 9, 6]}
// Growth rates: HP, S/M, Skl, Spd, Lck, Def, Res.
const SF_GROWTHS: Record<string, number[]> = {"Perceval": [75, 30, 25, 35, 20, 20, 10], "Roy": [80, 40, 50, 40, 60, 25, 30], "Marcus": [60, 25, 20, 25, 20, 15, 20], "Alen": [85, 45, 40, 45, 40, 25, 10], "Lance": [80, 40, 45, 50, 35, 20, 15], "Wolt": [80, 40, 50, 40, 40, 20, 10], "Bors": [90, 30, 30, 40, 50, 35, 10], "Merlinus": [100, 0, 50, 50, 100, 20, 5], "Elen": [45, 50, 30, 20, 70, 5, 60], "Dieck": [90, 40, 40, 30, 35, 20, 15], "Ward": [75, 50, 45, 20, 45, 30, 5], "Lot": [80, 30, 30, 35, 30, 40, 15], "Shanna": [45, 30, 55, 60, 60, 10, 25], "Chad": [85, 50, 50, 80, 60, 25, 15], "Lugh": [50, 40, 50, 50, 35, 15, 30], "Clarine": [40, 30, 40, 50, 65, 10, 40], "Rutger": [80, 30, 60, 50, 30, 20, 20], "Saul": [60, 40, 45, 45, 15, 15, 50], "Dorothy": [85, 50, 45, 45, 35, 15, 15], "Sue": [55, 30, 55, 65, 50, 10, 15], "Zelot": [75, 25, 20, 20, 15, 30, 15], "Trec": [85, 40, 30, 35, 50, 30, 5], "Noah": [75, 30, 45, 30, 40, 30, 10], "Astolfo": [90, 35, 40, 50, 15, 20, 20], "Lilina": [45, 75, 20, 35, 50, 10, 35], "Gwendolyn": [85, 40, 40, 40, 45, 30, 10], "Barthe": [100, 60, 25, 20, 20, 40, 2], "Ogier": [85, 40, 30, 45, 55, 20, 15], "Fir": [75, 25, 50, 55, 50, 15, 20], "Sin": [75, 45, 50, 50, 25, 10, 15], "Gonzalez": [90, 60, 15, 50, 35, 25, 5], "Geese": [85, 50, 30, 40, 40, 20, 10], "Klein": [60, 35, 40, 45, 50, 15, 25], "Thea": [60, 40, 45, 55, 40, 15, 20], "Larum": [70, 10, 5, 70, 80, 20, 30], "Echidna": [75, 30, 25, 30, 20, 15, 15], "Elffin": [80, 5, 5, 65, 65, 25, 55], "Bartre": [70, 40, 20, 30, 20, 20, 5], "Raigh": [55, 45, 55, 40, 15, 15, 35], "Cath": [80, 40, 45, 85, 50, 15, 20], "Melady": [75, 50, 50, 45, 25, 20, 5], "Cecilia": [60, 35, 45, 25, 25, 20, 25], "Sophia": [60, 55, 40, 30, 20, 20, 55], "Igrene": [70, 35, 25, 35, 20, 10, 5], "Garrett": [70, 45, 25, 25, 15, 15, 5], "Fae": [130, 90, 85, 65, 150, 30, 50], "Hugh": [75, 30, 30, 45, 25, 20, 15], "Zeiss": [80, 60, 50, 35, 20, 25, 5], "Douglas": [60, 30, 30, 30, 20, 30, 5], "Niime": [25, 15, 15, 15, 5, 15, 20], "Dayan": [55, 20, 20, 15, 20, 10, 10], "Juno": [50, 20, 35, 30, 45, 10, 10], "Yoder": [20, 30, 15, 10, 20, 10, 20], "Karel": [210, 130, 140, 140, 120, 110, 100]}

const unitByName = new Map(FE6_UNITS.map((u) => [u.name, u]))
const join = (name: string) => {
  const u = unitByName.get(name)!
  return `${FE6_CHAPTERS.find((c) => c.id === u.joinChapter)!.label} ${u.join.how}`
}

describe('Binding Blade units', () => {
  it("matches Serenes Forest's levels and bases", () => {
    for (const [name, sf] of Object.entries(SF_BASES)) {
      const u = unitByName.get(name)!
      expect([name, u.level, ...GBA_STATS.map((s) => u.bases[s])]).toEqual([name, ...sf])
    }
  })

  it("matches Serenes Forest's growth rates", () => {
    for (const [name, sf] of Object.entries(SF_GROWTHS)) {
      const u = unitByName.get(name)!
      expect([name, ...GBA_GROWING.map((s) => u.growths[s])]).toEqual([name, ...sf])
    }
  })

  it("joins where Serenes Forest's recruitment page says", () => {
    expect(join('Roy')).toBe('Ch.1 start')
    expect(join('Dieck')).toBe('Ch.2 event')
    expect(join('Lugh')).toBe('Ch.3 visit')
    expect(join('Clarine')).toBe('Ch.4 talk')
    expect(join('Rutger')).toBe('Ch.4 talk')
    expect(join('Cath')).toBe('Ch.12 talk')
    expect(join('Karel')).toBe('Ch.23 visit')
    expect(unitByName.get('Karel')!.join.with).toEqual(['Fir', 'Bartre'])
    expect(unitByName.get('Zelot')!.join.with).toEqual(['Roy', 'Noah', 'Trec'])
    expect(join('Fae')).toBe('Ch.15 end')
  })

  it('pairs every support both ways once', () => {
    const keys = FE6_SUPPORTS.map((s) => [s.a, s.b].sort().join('|'))
    expect(new Set(keys).size).toBe(keys.length)
    expect(FE6_SUPPORTS.length).toBeGreaterThan(100)
  })
})
