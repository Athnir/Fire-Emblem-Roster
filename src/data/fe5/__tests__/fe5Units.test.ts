import { describe, expect, it } from 'vitest'
import { FE5_STATS } from '../../../thracia/types'
import { FE5_CHAPTERS, FE5_SCROLLS, FE5_SUPPORTS, FE5_UNITS } from '../fe5Units'

// Serenes Forest's Thracia 776 tables, copied here to check the data built from the ROM against them.
// Base stats: Lv, HP, Str, Mag, Skl, Spd, Lck, Def, Con, Mov (characters/base-stats), under the patch's names.
const SF_BASES: Record<string, number[]> = {"Leif": [1, 22, 4, 0, 2, 5, 6, 3, 5, 6], "Finn": [7, 28, 8, 1, 8, 11, 5, 7, 9, 8], "Eyvel": [12, 28, 9, 4, 18, 20, 10, 7, 8, 8], "Halvan": [2, 28, 7, 0, 7, 7, 2, 5, 12, 6], "Osian": [1, 27, 6, 0, 7, 9, 3, 4, 11, 6], "Dagdar": [6, 43, 14, 1, 11, 9, 2, 10, 15, 7], "Tanya": [1, 20, 3, 1, 6, 10, 6, 2, 4, 6], "Marty": [1, 32, 9, 0, 0, 0, 6, 6, 15, 6], "Ronan": [1, 20, 4, 0, 3, 7, 3, 2, 7, 7], "Lifis": [4, 20, 3, 0, 4, 10, 1, 2, 6, 7], "Safy": [3, 14, 0, 6, 6, 7, 9, 0, 3, 5], "Brighton": [5, 28, 6, 0, 6, 6, 2, 6, 11, 8], "Macha": [2, 24, 4, 1, 10, 11, 6, 4, 6, 6], "Lara": [2, 14, 0, 0, 1, 10, 6, 0, 3, 7], "Fergus": [3, 26, 6, 0, 7, 7, 6, 5, 8, 8], "Karin": [1, 18, 4, 7, 4, 14, 12, 4, 4, 8], "Dalsin": [5, 29, 9, 0, 3, 2, 0, 11, 15, 5], "Asbel": [1, 22, 0, 4, 3, 7, 5, 0, 4, 6], "Nanna": [1, 18, 3, 5, 6, 7, 9, 3, 4, 8], "Hicks": [6, 30, 7, 0, 6, 5, 6, 8, 15, 8], "Shiva": [4, 24, 6, 0, 9, 12, 5, 4, 7, 6], "Callion": [1, 24, 5, 1, 5, 8, 6, 5, 6, 8], "Selphina": [8, 22, 5, 3, 7, 10, 7, 6, 5, 8], "Kane": [2, 26, 7, 0, 4, 7, 3, 6, 10, 8], "Alba": [2, 24, 6, 0, 5, 9, 4, 5, 9, 8], "Robert": [1, 23, 5, 0, 4, 8, 6, 4, 7, 8], "Fred": [2, 33, 10, 4, 11, 10, 4, 9, 11, 9], "Olwen": [2, 24, 5, 10, 8, 10, 5, 4, 5, 8], "Mareeta": [2, 22, 3, 1, 7, 13, 7, 3, 5, 6], "Salem": [5, 22, 0, 8, 6, 7, 2, 2, 4, 6], "Perne": [3, 24, 7, 3, 8, 14, 11, 5, 8, 7], "Tina": [1, 14, 0, 3, 1, 5, 15, 0, 3, 5], "Trude": [8, 30, 8, 0, 11, 12, 3, 5, 9, 6], "Glade": [2, 34, 11, 2, 12, 11, 4, 10, 12, 9], "Dean": [3, 36, 12, 2, 13, 12, 5, 13, 12, 9], "Eda": [5, 22, 7, 3, 6, 9, 12, 9, 5, 8], "Homer": [5, 24, 0, 5, 3, 10, 12, 2, 5, 6], "Linoan": [3, 16, 0, 7, 4, 9, 8, 0, 3, 5], "Ralph": [3, 38, 12, 1, 12, 14, 6, 9, 14, 6], "Ilios": [8, 40, 11, 9, 13, 14, 14, 10, 6, 8], "Schroff": [6, 18, 0, 11, 12, 4, 9, 1, 4, 5], "Sara": [7, 14, 0, 11, 12, 9, 10, 0, 3, 5], "Miranda": [5, 19, 0, 7, 2, 8, 7, 1, 3, 6], "Shannam": [1, 24, 5, 1, 8, 9, 1, 4, 6, 7], "Misha": [4, 28, 8, 13, 11, 16, 6, 6, 6, 9], "Xavier": [6, 38, 13, 3, 9, 6, 3, 17, 15, 6], "Amalda": [6, 34, 8, 13, 11, 15, 11, 9, 8, 10], "Conomor": [13, 39, 13, 3, 18, 11, 4, 12, 13, 10], "Dermott": [3, 36, 11, 5, 12, 12, 7, 9, 11, 10], "Ced": [14, 32, 3, 17, 16, 16, 10, 9, 8, 8], "Galzus": [20, 54, 20, 9, 20, 20, 17, 14, 18, 7]}
// Growth rates: HP, Str, Mag, Skl, Spd, Lck, Def, Con, Mov.
const SF_GROWTHS: Record<string, number[]> = {"Leif": [70, 35, 10, 35, 40, 40, 25, 15, 3], "Finn": [60, 35, 5, 30, 35, 45, 30, 10, 1], "Osian": [85, 30, 5, 25, 35, 55, 25, 25, 2], "Halvan": [80, 40, 5, 20, 30, 30, 30, 30, 2], "Eyvel": [30, 15, 10, 15, 10, 25, 5, 5, 1], "Dagdar": [15, 10, 5, 10, 10, 30, 10, 5, 1], "Ralph": [60, 35, 5, 30, 20, 15, 35, 35, 1], "Marty": [90, 15, 5, 10, 15, 50, 40, 75, 2], "Ronan": [40, 15, 55, 45, 55, 20, 5, 2, 3], "Miranda": [60, 5, 70, 55, 70, 35, 15, 5, 2], "Safy": [35, 30, 60, 45, 40, 5, 3, 2, 0], "Lara": [45, 10, 10, 50, 70, 60, 20, 5, 3], "Brighton": [70, 30, 5, 25, 30, 15, 35, 20, 1], "Fergus": [65, 35, 10, 45, 35, 40, 25, 20, 1], "Eda": [60, 40, 20, 35, 60, 30, 20, 5, 1], "Asbel": [55, 10, 35, 55, 75, 35, 10, 10, 2], "Macha": [60, 30, 10, 55, 60, 35, 25, 10, 2], "Hicks": [80, 35, 5, 40, 30, 55, 30, 30, 1], "Nanna": [50, 25, 10, 40, 35, 55, 15, 10, 1], "Selphina": [50, 25, 10, 40, 35, 55, 15, 10, 1], "Dalsin": [60, 50, 5, 40, 25, 25, 20, 25, 2], "Callion": [75, 40, 10, 65, 45, 55, 25, 25, 1], "Shiva": [70, 45, 5, 50, 35, 60, 30, 20, 2], "Perne": [65, 40, 10, 45, 65, 70, 25, 10, 2], "Glade": [60, 45, 5, 35, 35, 35, 30, 15, 1], "Kane": [75, 55, 5, 40, 35, 50, 35, 30, 1], "Alba": [70, 40, 10, 45, 50, 65, 30, 25, 1], "Robert": [65, 45, 10, 50, 60, 70, 25, 20, 1], "Fred": [75, 60, 15, 40, 35, 25, 35, 25, 1], "Olwen": [50, 40, 45, 55, 50, 70, 15, 10, 1], "Ced": [75, 10, 75, 75, 80, 65, 20, 15, 1], "Lifis": [65, 35, 10, 25, 45, 5, 15, 10, 2], "Karin": [55, 30, 15, 35, 70, 70, 15, 5, 2], "Dean": [75, 55, 5, 50, 30, 40, 30, 30, 1], "Shannam": [50, 50, 5, 5, 50, 50, 5, 5, 2], "Trude": [90, 35, 5, 45, 35, 60, 30, 20, 2], "Tanya": [60, 35, 15, 55, 70, 60, 15, 5, 2], "Linoan": [50, 3, 45, 60, 55, 55, 10, 5, 2], "Misha": [65, 55, 15, 65, 80, 40, 20, 5, 1], "Salem": [60, 5, 30, 45, 40, 10, 15, 15, 2], "Schroff": [35, 3, 40, 75, 45, 25, 10, 10, 2], "Mareeta": [65, 60, 15, 75, 80, 60, 20, 10, 3], "Tina": [40, 3, 50, 25, 65, 90, 5, 5, 5], "Amalda": [70, 55, 15, 50, 45, 60, 25, 15, 1], "Conomor": [70, 60, 5, 35, 50, 20, 20, 20, 1], "Homer": [65, 0, 40, 70, 70, 55, 15, 10, 3], "Dermott": [70, 40, 15, 65, 45, 65, 30, 15, 2], "Sara": [40, 0, 80, 80, 80, 40, 10, 5, 3], "Saias": [50, 0, 35, 40, 40, 55, 15, 10, 2], "Galzus": [50, 40, 45, 55, 50, 70, 15, 10, 1], "Ilios": [50, 40, 45, 55, 50, 70, 15, 10, 1], "Xavier": [50, 40, 45, 55, 50, 70, 15, 10, 1]}

const unitByName = new Map(FE5_UNITS.map((u) => [u.name, u]))
const labelOf = (id: string) => FE5_CHAPTERS.find((c) => c.id === id)!.label

describe('Thracia 776 units', () => {
  it("matches Serenes Forest's levels and bases", () => {
    // The one exception: Galzus's record gives Spd 21; Serenes lists 20 (the game holds stats at 20, $85:F0A9).
    for (const [name, sf] of Object.entries(SF_BASES)) {
      const u = unitByName.get(name)!
      const ours = [u.level, ...FE5_STATS.map((s) => u.bases[s])]
      if (name === 'Galzus') {
        expect(ours).toEqual([20, 54, 20, 9, 20, 21, 17, 14, 18, 7])
        continue
      }
      expect([name, ...ours]).toEqual([name, ...sf])
    }
  })

  it("matches Serenes Forest's growth rates", () => {
    for (const [name, sf] of Object.entries(SF_GROWTHS)) {
      const u = unitByName.get(name)!
      expect([name, ...FE5_STATS.map((s) => u.growths[s])]).toEqual([name, ...sf])
    }
  })

  it("joins where Serenes Forest's recruitment page says", () => {
    const join = (name: string) => `${labelOf(unitByName.get(name)!.joinChapter)} ${unitByName.get(name)!.join.how}`
    expect(join('Leif')).toBe('Ch.1 start')
    expect(join('Dagdar')).toBe('Ch.1 event')
    expect(join('Asbel')).toBe('Ch.4x talk')
    expect(join('Shiva')).toBe('Ch.7 talk')
    expect(join('Olwen')).toBe('Ch.11x talk')
    expect(join('Galzus')).toBe('Ch.24 talk')
    expect(join('Misha')).toBe('Ch.17A event')
    expect(unitByName.get('Dalsin')!.join.with).toEqual(['Leif', 'Lifis'])
    expect(unitByName.get('Perne')!.join.with).toEqual(['Salem', 'Lifis', 'Lara'])
  })

  it('reads the holy scrolls as Serenes Forest lists them', () => {
    const bonus = (name: string) => FE5_STATS.map((s) => FE5_SCROLLS.find((x) => x.name === name)!.growths[s])
    expect(bonus("Od's Scroll")).toEqual([0, 0, 0, 30, 0, 0, 0, 0, 0])
  })

  it('reads the supports table', () => {
    expect(FE5_SUPPORTS.length).toBeGreaterThan(50)
    for (const s of FE5_SUPPORTS) expect(FE5_UNITS.some((u) => u.id === s.gets) && FE5_UNITS.some((u) => u.id === s.gives)).toBe(true)
  })
})
