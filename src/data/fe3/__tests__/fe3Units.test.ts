import { describe, expect, it } from 'vitest'
import { FE3_CHAPTERS, FE3_CLASSES, FE3_STORIES, FE3_SUPPORT_BONUSES, FE3_UNITS } from '../fe3Units'

// Serenes Forest's Mystery of the Emblem tables, copied here to check the data built from the ROM against them, under the
// translation patch's names (Serenes Forest's own are the older fan names: Sheeda is Caeda, Saji is Bord, Maji is Cord...).
// Base stats: Lv, HP, Str, Skl, Spd, Lck, Wlv, Def, Res, Mov (characters/base-stats), Book 1 then Book 2.
const SF_BASES: Record<string, number[]>[] = [{"Marth": [1, 18, 5, 6, 7, 7, 6, 7, 0, 7], "Caeda": [1, 16, 5, 6, 12, 9, 7, 7, 6, 8], "Jagen": [1, 22, 7, 10, 8, 1, 10, 9, 6, 10], "Cain": [1, 20, 7, 5, 6, 3, 5, 7, 0, 9], "Abel": [1, 20, 6, 7, 7, 2, 6, 7, 0, 9], "Draug": [1, 20, 7, 3, 3, 1, 4, 11, 0, 5], "Gordin": [1, 18, 5, 5, 4, 4, 5, 6, 0, 5], "Ogma": [2, 22, 6, 11, 12, 3, 6, 6, 0, 7], "Barst": [5, 24, 10, 6, 9, 5, 6, 6, 0, 6], "Bord": [3, 22, 8, 4, 7, 1, 5, 5, 0, 6], "Cord": [3, 22, 7, 5, 9, 5, 3, 5, 0, 6], "Castor": [3, 21, 7, 4, 6, 3, 6, 4, 0, 6], "Julian": [3, 17, 4, 6, 12, 7, 2, 4, 0, 7], "Lena": [3, 16, 1, 7, 8, 8, 7, 3, 5, 5], "Navarre": [3, 19, 5, 9, 11, 8, 9, 6, 0, 7], "Hardin": [6, 25, 9, 7, 8, 3, 9, 8, 0, 9], "Wolf": [3, 22, 6, 6, 7, 5, 6, 6, 0, 9], "Sedgar": [1, 20, 6, 6, 6, 2, 3, 6, 0, 9], "Roshea": [3, 22, 6, 5, 7, 4, 7, 7, 0, 9], "Vyland": [1, 20, 5, 3, 6, 2, 4, 7, 0, 9], "Matthis": [2, 20, 5, 2, 6, 0, 8, 7, 0, 9], "Merric": [1, 20, 1, 3, 6, 3, 5, 4, 3, 6], "Rickard": [1, 16, 5, 2, 9, 0, 2, 3, 0, 7], "Wendell": [1, 22, 3, 2, 12, 1, 10, 5, 6, 6], "Bantu": [1, 18, 2, 3, 4, 1, 2, 3, 1, 5], "Caesar": [3, 20, 5, 8, 12, 6, 6, 7, 0, 7], "Radd": [1, 18, 4, 8, 10, 1, 6, 6, 0, 7], "Maria": [3, 17, 2, 2, 3, 5, 8, 4, 5, 5], "Minerva": [1, 22, 9, 6, 12, 6, 10, 12, 0, 10], "Linde": [1, 18, 1, 4, 7, 7, 7, 2, 4, 6], "Jeorge": [1, 24, 7, 10, 12, 4, 10, 8, 3, 7], "Midia": [1, 20, 7, 11, 9, 7, 10, 9, 6, 10], "Dolph": [4, 21, 8, 6, 5, 3, 7, 13, 0, 5], "Macelan": [3, 20, 8, 5, 3, 4, 5, 12, 0, 5], "Tomas": [8, 20, 7, 6, 5, 4, 9, 6, 0, 5], "Boah": [1, 22, 4, 7, 10, 4, 12, 5, 6, 6], "Palla": [8, 22, 7, 8, 13, 5, 12, 8, 6, 8], "Catria": [3, 19, 5, 6, 12, 7, 10, 7, 6, 8], "Astram": [1, 24, 8, 14, 14, 3, 10, 8, 3, 7], "Arran": [1, 24, 8, 8, 11, 4, 10, 10, 6, 10], "Samson": [1, 24, 10, 14, 17, 7, 10, 9, 3, 7], "Xane": [1, 18, 2, 2, 8, 9, 2, 4, 10, 6], "Tiki": [5, 16, 3, 3, 4, 12, 9, 3, 10, 5], "Est": [5, 20, 6, 7, 13, 11, 11, 8, 6, 8], "Lorenz": [5, 34, 11, 3, 6, 2, 15, 19, 3, 5], "Elice": [4, 18, 1, 5, 5, 3, 7, 4, 5, 5]}, {"Marth": [3, 22, 6, 8, 9, 8, 7, 7, 0, 7], "Cecil": [3, 19, 7, 7, 8, 6, 7, 7, 0, 9], "Luke": [2, 20, 7, 5, 7, 4, 5, 7, 0, 9], "Rodrick": [1, 20, 5, 5, 6, 5, 5, 6, 0, 9], "Ryan": [1, 18, 5, 4, 4, 3, 5, 6, 0, 5], "Gordin": [5, 21, 7, 7, 6, 5, 7, 8, 0, 5], "Draug": [6, 22, 8, 4, 4, 2, 6, 11, 0, 5], "Arran": [3, 22, 8, 8, 11, 4, 10, 10, 6, 10], "Marisha": [1, 16, 1, 1, 4, 12, 5, 1, 5, 5], "Catria": [6, 22, 7, 8, 14, 9, 10, 8, 6, 8], "Warren": [2, 22, 7, 5, 6, 1, 5, 4, 0, 6], "Linde": [4, 20, 2, 5, 8, 8, 9, 2, 4, 6], "Palla": [10, 24, 10, 11, 16, 9, 12, 9, 6, 8], "Julian": [6, 20, 7, 8, 14, 7, 6, 6, 0, 7], "Matthis": [4, 21, 7, 3, 7, 1, 8, 9, 0, 9], "Ogma": [7, 25, 8, 14, 14, 5, 9, 8, 0, 7], "Yuliya": [2, 16, 2, 1, 7, 9, 6, 2, 5, 5], "Jubelo": [1, 18, 1, 1, 6, 5, 6, 3, 3, 6], "Sirius": [4, 26, 11, 10, 13, 1, 13, 11, 6, 10], "Castor": [7, 24, 10, 7, 8, 4, 8, 6, 0, 6], "Caeda": [4, 19, 6, 7, 15, 13, 9, 7, 6, 8], "Rickard": [3, 18, 6, 3, 9, 1, 6, 3, 0, 7], "Samuel": [5, 22, 6, 10, 11, 3, 7, 7, 0, 7], "Wendell": [7, 26, 5, 5, 13, 4, 10, 5, 6, 6], "Navarre": [8, 23, 9, 16, 16, 7, 11, 8, 0, 7], "Phina": [1, 16, 1, 2, 10, 8, 1, 2, 0, 6], "Cain": [9, 26, 10, 8, 9, 4, 8, 10, 0, 9], "Bantu": [3, 18, 2, 3, 4, 1, 2, 3, 1, 5], "Jeorge": [5, 27, 10, 11, 13, 4, 15, 10, 3, 7], "Minerva": [8, 25, 13, 9, 15, 7, 14, 16, 0, 10], "Merric": [10, 22, 5, 6, 10, 6, 10, 7, 3, 6], "Arlen": [10, 22, 5, 6, 10, 6, 12, 7, 3, 6], "Xane": [5, 20, 3, 3, 11, 10, 12, 6, 10, 6], "Tiki": [6, 18, 6, 6, 6, 13, 10, 5, 10, 5], "Abel": [1, 28, 13, 14, 15, 5, 11, 14, 6, 10], "Est": [5, 20, 6, 7, 13, 11, 11, 8, 6, 8], "Astram": [5, 28, 11, 16, 17, 5, 16, 11, 3, 7], "Sheena": [1, 26, 8, 3, 5, 4, 12, 17, 3, 5], "Samson": [5, 28, 12, 16, 19, 7, 12, 11, 3, 7], "Roshea": [8, 36, 12, 8, 10, 3, 8, 11, 6, 10], "Midia": [16, 28, 14, 17, 17, 7, 16, 16, 6, 10], "Lena": [7, 18, 6, 6, 13, 10, 18, 6, 7, 6], "Maria": [1, 17, 3, 3, 5, 8, 12, 3, 7, 6], "Nyna": [3, 18, 4, 4, 10, 18, 14, 4, 7, 6], "Elice": [5, 18, 5, 5, 7, 7, 16, 5, 7, 6]}]
// Growth rates: HP, Str, Skl, Spd, Lck, Wlv, Def, Res.
const SF_GROWTHS: Record<string, number[]>[] = [{"Marth": [90, 50, 40, 50, 70, 40, 20, 3], "Caeda": [50, 20, 70, 90, 70, 80, 20, 3], "Jagen": [10, 10, 10, 10, 0, 0, 0, 3], "Cain": [60, 30, 60, 60, 50, 90, 20, 3], "Abel": [70, 40, 50, 50, 40, 70, 20, 3], "Draug": [60, 20, 40, 40, 20, 20, 10, 3], "Gordin": [40, 30, 30, 30, 40, 50, 10, 3], "Ogma": [80, 40, 20, 30, 40, 70, 30, 3], "Barst": [60, 50, 50, 50, 70, 30, 50, 3], "Bord": [90, 50, 50, 10, 30, 20, 50, 3], "Cord": [10, 30, 20, 40, 40, 50, 40, 3], "Castor": [70, 60, 40, 40, 20, 20, 20, 3], "Julian": [80, 70, 50, 50, 80, 40, 30, 3], "Lena": [10, 20, 40, 20, 70, 40, 10, 3], "Navarre": [90, 50, 40, 50, 60, 30, 20, 3], "Hardin": [50, 30, 50, 60, 30, 70, 20, 3], "Wolf": [70, 40, 10, 20, 50, 60, 20, 3], "Sedgar": [90, 30, 20, 10, 10, 30, 20, 3], "Roshea": [80, 40, 50, 40, 50, 30, 30, 3], "Vyland": [50, 30, 10, 20, 10, 70, 10, 3], "Matthis": [50, 40, 30, 20, 20, 70, 20, 3], "Merric": [80, 20, 30, 50, 50, 80, 20, 3], "Rickard": [50, 50, 20, 60, 40, 30, 20, 3], "Wendell": [60, 10, 30, 20, 40, 70, 10, 3], "Bantu": [10, 0, 0, 0, 10, 0, 0, 3], "Caesar": [80, 30, 30, 20, 10, 30, 10, 3], "Radd": [90, 50, 40, 70, 40, 50, 20, 3], "Maria": [10, 10, 10, 30, 30, 70, 0, 3], "Minerva": [40, 30, 50, 40, 40, 70, 20, 3], "Linde": [40, 20, 70, 60, 80, 70, 10, 3], "Jeorge": [60, 20, 10, 20, 10, 50, 10, 3], "Midia": [80, 30, 50, 50, 10, 50, 20, 3], "Dolph": [70, 30, 40, 30, 10, 70, 20, 3], "Macelan": [50, 30, 10, 20, 10, 40, 10, 3], "Tomas": [50, 20, 20, 30, 10, 50, 10, 3], "Boah": [10, 10, 10, 10, 10, 10, 10, 3], "Palla": [70, 50, 80, 20, 10, 30, 30, 3], "Catria": [70, 40, 80, 80, 40, 70, 30, 3], "Astram": [90, 50, 40, 20, 50, 40, 10, 3], "Arran": [50, 50, 30, 40, 40, 50, 10, 3], "Samson": [70, 30, 10, 20, 50, 70, 20, 3], "Xane": [50, 30, 10, 40, 30, 30, 20, 3], "Tiki": [80, 50, 90, 90, 90, 0, 0, 3], "Est": [50, 70, 70, 70, 60, 70, 20, 3], "Lorenz": [70, 50, 70, 20, 50, 50, 20, 3], "Elice": [50, 10, 50, 60, 80, 90, 10, 3]}, {"Marth": [90, 50, 40, 50, 70, 40, 20, 3], "Cecil": [50, 30, 60, 60, 30, 70, 10, 3], "Luke": [90, 30, 30, 40, 10, 40, 20, 3], "Rodrick": [70, 40, 50, 50, 40, 60, 20, 3], "Ryan": [60, 40, 70, 40, 30, 40, 20, 3], "Gordin": [40, 30, 30, 30, 40, 60, 10, 3], "Draug": [60, 20, 40, 40, 20, 40, 10, 3], "Arran": [10, 10, 10, 10, 0, 10, 10, 3], "Marisha": [40, 30, 20, 50, 30, 70, 10, 3], "Catria": [70, 40, 80, 80, 40, 70, 20, 3], "Warren": [70, 50, 50, 10, 20, 20, 20, 3], "Linde": [40, 20, 70, 60, 80, 70, 10, 3], "Palla": [70, 50, 80, 20, 10, 30, 20, 3], "Julian": [80, 70, 50, 50, 80, 40, 30, 3], "Matthis": [50, 40, 30, 20, 20, 70, 20, 3], "Ogma": [80, 40, 30, 30, 40, 70, 30, 3], "Yuliya": [30, 20, 30, 40, 40, 60, 10, 3], "Jubelo": [50, 50, 30, 40, 40, 60, 10, 3], "Sirius": [80, 50, 50, 40, 30, 40, 30, 3], "Castor": [70, 60, 40, 40, 20, 20, 20, 3], "Caeda": [50, 20, 70, 90, 70, 80, 20, 3], "Rickard": [50, 50, 20, 60, 40, 30, 20, 3], "Samuel": [70, 20, 20, 60, 10, 40, 10, 3], "Wendell": [60, 10, 30, 20, 40, 70, 10, 3], "Navarre": [90, 50, 40, 50, 60, 30, 20, 3], "Phina": [40, 60, 70, 80, 70, 80, 20, 3], "Cain": [90, 30, 60, 60, 50, 60, 20, 3], "Bantu": [10, 0, 0, 0, 10, 0, 0, 3], "Jeorge": [60, 20, 10, 20, 10, 50, 10, 3], "Minerva": [40, 30, 50, 40, 40, 70, 20, 3], "Merric": [80, 20, 50, 50, 50, 80, 20, 3], "Arlen": [90, 10, 30, 40, 10, 70, 30, 3], "Xane": [50, 30, 10, 40, 30, 30, 20, 3], "Tiki": [80, 40, 30, 60, 60, 0, 0, 3], "Abel": [70, 40, 50, 50, 40, 70, 20, 3], "Est": [50, 70, 70, 70, 60, 70, 20, 3], "Astram": [90, 50, 40, 20, 50, 40, 10, 3], "Sheena": [60, 60, 70, 50, 60, 60, 20, 3], "Samson": [70, 30, 10, 20, 50, 70, 20, 3], "Roshea": [80, 40, 50, 40, 50, 30, 30, 3], "Midia": [80, 30, 50, 50, 10, 50, 20, 3], "Lena": [10, 10, 10, 20, 40, 30, 10, 3], "Maria": [10, 10, 10, 20, 30, 70, 10, 3], "Nyna": [10, 10, 10, 10, 10, 30, 10, 3], "Elice": [10, 10, 50, 60, 80, 90, 10, 3]}]

const STATS = ['hp', 'str', 'skl', 'spd', 'lck', 'wlv', 'def', 'res', 'mov'] as const
const inBook = (book: 1 | 2) => FE3_UNITS.filter((u) => u.story === `book${book}`)
const unitIn = (book: 1 | 2, name: string) => inBook(book).find((u) => u.name === name)!
const join = (book: 1 | 2, name: string) => {
  const u = unitIn(book, name)
  return `${FE3_CHAPTERS.find((c) => c.id === u.joinChapter)!.label} ${u.join.how}`
}

describe('Mystery of the Emblem units', () => {
  it('has two books, each its own army', () => {
    expect(FE3_STORIES.map((s) => s.id)).toEqual(['book1', 'book2'])
  })

  it("matches Serenes Forest's levels and bases, and every unit it lists joins", () => {
    for (const book of [1, 2] as const) {
      const units = inBook(book)
      expect([book, units.map((u) => u.name).sort()]).toEqual([book, Object.keys(SF_BASES[book - 1]).sort()])
      for (const u of units) {
        const sf = [...SF_BASES[book - 1][u.name]]
        // Navarre: his own record has 20 HP; a talk recruit joins with the HP its enemy unit had ($87:87A9), 19 for his foe record,
        // which is Serenes Forest's figure.
        if (book === 1 && u.name === 'Navarre') sf[1] = 20
        expect([book, u.name, u.level, ...STATS.map((s) => u.bases[s])]).toEqual([book, u.name, ...sf])
      }
    }
  })

  it("matches Serenes Forest's growth rates", () => {
    for (const book of [1, 2] as const) {
      for (const u of inBook(book)) {
        expect([book, u.name, ...STATS.slice(0, 8).map((s) => u.growths[s])]).toEqual([book, u.name, ...SF_GROWTHS[book - 1][u.name]])
      }
    }
  })

  it('promotes as the game does: its table, HP 52 and every other stat 20 at most', () => {
    const named = (id: string) => FE3_CLASSES[id].name
    const promotes = Object.values(FE3_CLASSES)
      .filter((c) => c.promotesTo)
      .map((c) => `${c.name} > ${named(c.promotesTo!)}`)
    expect(promotes).toContain('Cavalier > Paladin')
    expect(promotes).toContain('Cleric > Bishop (F)')
    expect(promotes).toContain('Archer > Sniper')
    for (const c of Object.values(FE3_CLASSES)) expect([c.name, c.caps.hp, c.caps.str, c.caps.wlv]).toEqual([c.name, 52, 20, 20])
  })

  it("joins where Serenes Forest's recruitment page says", () => {
    expect(join(1, 'Marth')).toBe('Ch.1 start')
    expect(join(1, 'Castor')).toBe('Ch.2 talk')
    expect(unitIn(1, 'Castor').join.with).toEqual(['Caeda'])
    expect(join(1, 'Merric')).toBe('Ch.4 visit')
    expect(unitIn(1, 'Rickard').join.with).toEqual(['Marth', 'Julian'])
    expect(join(1, 'Minerva')).toBe('Ch.8 talk')
    expect(join(1, 'Palla')).toBe('Ch.11 talk')
    expect(unitIn(1, 'Palla').join.note).toMatch(/starts the talk/)
    expect(join(1, 'Est')).toBe('Ch.16 visit')
    // Serenes Forest: from the start of Chapter 19. Chapter 18's seize script brings her in.
    expect(join(1, 'Elice')).toBe('Ch.19 start')
    expect(join(2, 'Marth')).toBe('Ch.1 start')
    expect(join(2, 'Warren')).toBe('Ch.2 talk')
    expect(join(2, 'Abel')).toBe('Ch.15 talk')
    expect(unitIn(2, 'Abel').join.with).toEqual(['Est', 'Marth'])
    expect(join(2, 'Sheena')).toBe('Ch.17 talk')
    expect(join(2, 'Nyna')).toBe('Final 2 pt 3 talk')
    expect(unitIn(2, 'Midia').join.note).toMatch(/on foot/)
  })

  it('gives each support bonus between units of one book', () => {
    for (const b of FE3_SUPPORT_BONUSES) expect(b.giver.split('-')[1]).toBe(b.receiver.split('-')[1])
    expect(FE3_SUPPORT_BONUSES.length).toBeGreaterThan(20)
  })
})
