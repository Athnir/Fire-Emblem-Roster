import { describe, expect, it } from 'vitest'
import { FE4_STATS } from '../../../genealogy/types'
import { FE4_BLOODS, FE4_CLASSES, FE4_UNITS } from '../fe4Units'

// Serenes Forest's Genealogy of the Holy War tables, copied here to check the data built from the ROM against them.
// Base stats: Lv, HP, Str, Mag, Skl, Spd, Lck, Def, Res, Gold (characters/base-stats), by the patch's names.
const SF_BASES: Record<string, number[]> = {"Sigurd": [5, 35, 14, 0, 11, 12, 7, 9, 3, 5000], "Naoise": [3, 33, 11, 0, 7, 8, 4, 8, 0, 2000], "Alec": [2, 32, 9, 0, 9, 10, 4, 7, 0, 2000], "Arden": [3, 36, 13, 0, 5, 4, 3, 13, 0, 2000], "Quan": [4, 34, 16, 0, 10, 10, 5, 10, 3, 5000], "Ethlyn": [1, 28, 5, 8, 11, 12, 8, 4, 6, 4000], "Finn": [1, 32, 9, 0, 8, 10, 8, 7, 0, 2000], "Lex": [4, 33, 10, 0, 10, 11, 8, 9, 0, 5000], "Azelle": [1, 30, 0, 10, 7, 9, 2, 2, 6, 5000], "Midir": [2, 32, 9, 0, 7, 9, 3, 7, 0, 2000], "Edain": [3, 28, 0, 13, 8, 9, 11, 1, 10, 5000], "Dew": [1, 28, 3, 0, 6, 15, 12, 1, 0, 15000], "Ayra": [4, 32, 11, 0, 16, 17, 3, 7, 1, 3000], "Deirdre": [3, 26, 0, 14, 9, 12, 6, 3, 16, 1000], "Jamke": [6, 36, 11, 0, 14, 14, 4, 9, 0, 5000], "Chulainn": [12, 40, 14, 0, 17, 17, 1, 11, 1, 10000], "Lachesis": [2, 26, 6, 8, 9, 13, 5, 7, 9, 10000], "Lewyn": [6, 34, 1, 12, 12, 16, 7, 5, 9, 8000], "Silvia": [1, 28, 3, 0, 4, 12, 6, 1, 5, 5000], "Erinys": [6, 32, 11, 1, 12, 18, 7, 9, 9, 8000], "Beowolf": [9, 38, 14, 0, 11, 11, 3, 10, 0, 2000], "Brigid": [12, 40, 20, 0, 22, 21, 7, 14, 9, 10000], "Claud": [20, 34, 0, 21, 14, 15, 9, 5, 20, 10000], "Tailtiu": [3, 28, 0, 10, 15, 10, 9, 1, 9, 5000], "Muirne": [1, 24, 0, 10, 7, 10, 5, 1, 10, 2000], "Creidne": [1, 28, 9, 0, 13, 15, 3, 7, 1, 2000], "Dalvin": [1, 30, 10, 0, 13, 13, 4, 8, 0, 2000], "Oifey": [15, 40, 16, 9, 17, 16, 8, 17, 8, 5000], "Tristan": [3, 30, 11, 0, 10, 10, 5, 10, 0, 5000], "Deimne": [1, 30, 9, 0, 7, 9, 3, 8, 0, 2000], "Julia": [1, 24, 0, 11, 8, 11, 5, 3, 14, 2000], "Hermina": [2, 28, 10, 1, 9, 16, 3, 7, 9, 3000], "Amid": [2, 29, 1, 11, 10, 14, 6, 4, 9, 3000], "Iuchar": [12, 40, 15, 0, 10, 12, 5, 12, 1, 5000], "Iucharba": [12, 42, 16, 0, 7, 16, 5, 14, 1, 5000], "Shannan": [12, 38, 18, 0, 22, 23, 10, 13, 4, 5000], "Daisy": [1, 24, 3, 1, 4, 13, 6, 2, 3, 5000], "Charlot": [1, 24, 0, 11, 8, 9, 3, 3, 9, 5000], "Hawk": [14, 38, 3, 22, 18, 23, 4, 9, 17, 5000], "Laylea": [3, 24, 4, 0, 1, 13, 4, 1, 4, 3000], "Linda": [3, 26, 0, 11, 12, 9, 2, 2, 7, 5000], "Jeanne": [3, 30, 6, 7, 9, 11, 4, 5, 6, 2000], "Asaello": [9, 36, 12, 1, 15, 15, 3, 10, 1, 2000], "Hannibal": [20, 60, 20, 0, 16, 11, 7, 22, 6, 5000]}
// Growth rates without holy blood: HP, Str, Mag, Skl, Spd, Lck, Def, Res.
const SF_GROWTHS: Record<string, number[]> = {"Sigurd": [70, 30, 5, 30, 30, 20, 40, 5], "Naoise": [80, 40, 5, 30, 20, 20, 40, 5], "Alec": [70, 30, 5, 40, 30, 30, 30, 5], "Arden": [90, 50, 5, 10, 20, 10, 40, 5], "Quan": [70, 30, 5, 30, 20, 10, 30, 5], "Ethlyn": [40, 20, 5, 20, 30, 10, 20, 10], "Finn": [70, 30, 5, 40, 30, 50, 30, 5], "Lex": [70, 40, 5, 20, 20, 20, 20, 5], "Azelle": [50, 10, 10, 20, 50, 20, 20, 10], "Midir": [60, 30, 5, 30, 40, 10, 30, 5], "Edain": [50, 20, 30, 20, 30, 30, 20, 5], "Dew": [50, 40, 10, 40, 40, 40, 40, 10], "Ayra": [50, 30, 5, 30, 30, 20, 20, 5], "Deirdre": [40, 10, 10, 20, 10, 10, 10, 10], "Jamke": [90, 50, 0, 10, 30, 40, 30, 5], "Chulainn": [90, 30, 5, 50, 30, 20, 30, 5], "Lachesis": [40, 20, 5, 10, 20, 40, 20, 10], "Lewyn": [50, 10, 30, 40, 30, 20, 20, 10], "Silvia": [40, 10, 20, 10, 10, 20, 10, 20], "Erinys": [50, 20, 10, 20, 30, 20, 30, 10], "Beowolf": [80, 40, 0, 40, 30, 20, 30, 5], "Brigid": [50, 30, 20, 30, 20, 10, 20, 5], "Claud": [50, 10, 20, 20, 30, 30, 20, 10], "Tailtiu": [40, 10, 20, 30, 40, 50, 10, 10]}

const unitByName = new Map(FE4_UNITS.filter((u) => u.role !== 'child').map((u) => [u.name, u]))

describe('Genealogy of the Holy War units', () => {
  it("matches Serenes Forest's levels, bases and gold", () => {
    for (const [name, sf] of Object.entries(SF_BASES)) {
      const u = unitByName.get(name)!
      expect([name, u.level, ...FE4_STATS.map((s) => u.bases![s]), u.gold]).toEqual([name, ...sf])
    }
  })

  it("matches Serenes Forest's growth rates (holy blood left out)", () => {
    for (const [name, sf] of Object.entries(SF_GROWTHS)) {
      const u = unitByName.get(name)!
      expect([name, ...FE4_STATS.map((s) => u.growths![s])]).toEqual([name, ...sf])
    }
  })

  it("matches Serenes Forest's holy blood growth bonuses", () => {
    const bonus = (name: string) => FE4_STATS.map((s) => FE4_BLOODS.find((b) => b.name === name)!.growths[s])
    expect(bonus('Baldr')).toEqual([20, 10, 0, 10, 0, 10, 0, 0])
    expect(bonus('Njörun')).toEqual([20, 10, 0, 0, 10, 0, 10, 0])
    expect(bonus('Bragi')).toEqual([10, 0, 10, 0, 0, 10, 0, 20])
    expect(bonus('Loptous')).toEqual([10, 0, 20, 0, 0, 0, 0, 20])
  })

  it('reads holy blood as Serenes Forest lists it', () => {
    const blood = (name: string) => unitByName.get(name)!.blood!.map((b) => `${b.level} ${b.blood}`)
    expect(blood('Sigurd')).toEqual(['major Baldr'])
    expect(blood('Quan')).toEqual(['major Njörun'])
    expect(blood('Lewyn')).toEqual(['major Forseti'])
    expect(blood('Lachesis')).toEqual(['minor Hezul'])
    expect(blood('Deirdre')).toEqual(['major Naga', 'minor Loptous'])
    expect(blood('Brigid')).toEqual(['major Ullr'])
    expect(blood('Edain')).toEqual(['minor Ullr'])
  })

  it('has the classes Serenes Forest lists bases for', () => {
    const lordKnight = Object.values(FE4_CLASSES).find((c) => c.name === 'Lord Knight' || c.name === 'Knight Lord')!
    expect(FE4_STATS.filter((s) => s !== 'lck').map((s) => lordKnight.bases[s])).toEqual([40, 10, 0, 7, 7, 7, 3])
  })

  it('pairs each child with a mother and a substitute', () => {
    const children = FE4_UNITS.filter((u) => u.role === 'child')
    expect(children).toHaveLength(17)
    for (const child of children) expect([child.name, Boolean(child.mother)]).toEqual([child.name, true])
    const subs = FE4_UNITS.filter((u) => u.role === 'substitute')
    expect(subs).toHaveLength(14)
  })
})
