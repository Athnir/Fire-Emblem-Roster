import { describe, expect, it } from 'vitest'
import { FE13_CHAPTERS, FE13_CLASSES, FE13_UNITS } from '../fe13Units'

// Serenes Forest's Awakening tables, copied here to check the data built from the game's files against them.
// Base stats (characters/base-stats/main-story): Lv, HP, Str, Mag, Skl, Spd, Lck, Def, Res, Mov, the first figure of each (it adds
// what equipment and Taguel or Manakete forms give after a +). For a child it's their own part (their real bases take after the
// parents), and Morgan's Mov is blank (his class varies).
const SF_BASES: Record<string, (number | null)[]> = {"Avatar": [1, 19, 6, 5, 5, 6, 4, 6, 4, 5], "Chrom": [1, 20, 7, 1, 8, 8, 5, 7, 1, 6], "Lissa": [1, 17, 1, 5, 4, 4, 8, 3, 4, 5], "Frederick": [1, 28, 13, 2, 12, 10, 6, 14, 3, 7], "Sully": [2, 20, 7, 1, 8, 8, 6, 7, 2, 7], "Virion": [2, 19, 6, 0, 9, 5, 7, 6, 1, 5], "Stahl": [2, 22, 8, 0, 7, 6, 5, 8, 1, 7], "Vaike": [3, 24, 9, 0, 8, 6, 4, 5, 0, 5], "Miriel": [1, 18, 0, 6, 5, 7, 6, 3, 4, 5], "Sumia": [1, 18, 6, 3, 11, 11, 8, 5, 7, 7], "Kellam": [5, 21, 10, 0, 7, 5, 3, 12, 2, 4], "Donnel": [1, 16, 4, 0, 2, 3, 11, 3, 0, 5], "Lon'qu": [4, 20, 6, 1, 12, 13, 7, 7, 2, 5], "Ricken": [3, 20, 3, 8, 6, 5, 10, 6, 3, 5], "Maribelle": [3, 18, 0, 5, 4, 6, 5, 3, 6, 7], "Panne": [6, 28, 8, 1, 9, 10, 8, 7, 3, 6], "Gaius": [5, 22, 7, 0, 13, 15, 6, 5, 2, 5], "Cordelia": [7, 25, 9, 3, 13, 12, 9, 8, 8, 7], "Gregor": [10, 30, 12, 0, 13, 11, 8, 10, 2, 5], "Nowi": [3, 18, 4, 0, 2, 3, 8, 2, 2, 6], "Libra": [1, 38, 14, 15, 13, 13, 10, 11, 16, 6], "Tharja": [10, 25, 4, 11, 5, 12, 3, 10, 7, 5], "Anna": [1, 35, 12, 17, 22, 21, 25, 8, 10, 6], "Olivia": [1, 18, 3, 1, 8, 9, 5, 3, 2, 5], "Cherche": [12, 30, 14, 1, 12, 11, 8, 15, 2, 7], "Henry": [12, 28, 6, 13, 14, 8, 10, 12, 5, 5], "Say'ri": [1, 39, 17, 7, 23, 26, 20, 12, 10, 6], "Tiki": [20, 39, 18, 10, 14, 16, 18, 15, 12, 6], "Basilio": [10, 56, 30, 3, 25, 21, 18, 20, 8, 6], "Flavia": [10, 48, 25, 5, 28, 26, 21, 23, 11, 6], "Lucina": [10, 12, 5, 1, 8, 4, 13, 3, 3, 5], "Owain": [10, 10, 4, 4, 5, 6, 9, 6, 5, 5], "Inigo": [10, 11, 5, 2, 4, 9, 12, 4, 4, 5], "Brady": [10, 9, 6, 5, 4, 2, 10, 7, 4, 5], "Kjelle": [10, 10, 6, 2, 6, 5, 11, 3, 3, 4], "Cynthia": [10, 7, 5, 2, 4, 10, 17, 6, 6, 8], "Severa": [10, 8, 6, 1, 7, 6, 6, 6, 5, 5], "Gerome": [10, 13, 8, 0, 4, 8, 5, 5, 1, 8], "Morgan": [10, 9, 6, 8, 7, 6, 7, 3, 7, null], "Yarne": [10, 16, 9, 1, 4, 4, 13, 6, 1, 6], "Laurent": [10, 10, 3, 7, 7, 4, 11, 4, 5, 5], "Noire": [10, 8, 5, 3, 4, 7, 10, 4, 6, 5], "Nah": [10, 5, 3, 3, 5, 6, 8, 3, 3, 6], "Gangrel": [15, 49, 21, 20, 29, 33, 15, 18, 17, 6], "Walhart": [30, 71, 39, 15, 33, 32, 30, 35, 19, 8], "Emmeryn": [10, 42, 5, 26, 23, 25, 13, 12, 20, 6], "Yen'fay": [20, 60, 30, 5, 39, 40, 28, 21, 18, 6], "Aversa": [20, 55, 24, 31, 29, 32, 26, 21, 28, 8], "Priam": [20, 74, 40, 3, 44, 38, 35, 39, 25, 6]}

const STATS = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res'] as const
const unit = (name: string) => FE13_UNITS.find((u) => u.name === name)!
const cls = (id: string) => FE13_CLASSES[id].name
const join = (name: string) => {
  const u = unit(name)
  return `${FE13_CHAPTERS.find((c) => c.id === u.joinChapter)!.label} ${u.join.how}`
}
// Where the game's files and Serenes Forest differ, each explained:
//  - Chrom's Mov: 6 there; the Lord class's is 5 (JobData +81) and the person record holds no Mov.
//  - Cynthia's and Gerome's Mov: 8 there; their classes' (Pegasus Knight, Wyvern Rider) is 7.
//  - Libra's Skl: 13 there; War Monk 4 + his own 8 = 12 (static.bin +31).
//  - Brady's Skl: 4 there; his own is 3 (static.bin +31).
const EXCEPTIONS: Record<string, Partial<Record<string, number>>> = {
  Chrom: { mov: 5 },
  Cynthia: { mov: 7 },
  Gerome: { mov: 7 },
  Libra: { skl: 12 },
  Brady: { skl: 3 },
}

describe('Awakening units', () => {
  it("matches Serenes Forest's levels and bases", () => {
    for (const [name, sf] of Object.entries(SF_BASES)) {
      const units = FE13_UNITS.filter((u) => u.name === name || u.name.startsWith(`${name} (`))
      expect([name, units.length > 0]).toEqual([name, true])
      for (const u of units) {
        const own = u.parent ? u.personal : u.bases
        const ours = [u.level, ...STATS.map((s) => own[s]), u.bases.mov]
        const theirs = [...sf]
        STATS.forEach((s, i) => {
          if (EXCEPTIONS[name]?.[s] !== undefined) theirs[1 + i] = EXCEPTIONS[name]![s]!
        })
        theirs[9] = EXCEPTIONS[name]?.mov ?? theirs[9] ?? u.bases.mov
        expect([u.name, ...ours]).toEqual([u.name, ...theirs])
      }
    }
  })

  it("joins where Serenes Forest's recruitment page says", () => {
    expect(join('Chrom')).toBe('Prologue start')
    expect(join('Sully')).toBe('Ch.1 event')
    expect(unit('Sully').join.turn).toBe(2)
    expect(join('Kellam')).toBe('Ch.3 talk')
    expect(join("Lon'qu")).toBe('Ch.4 end')
    expect(join('Cordelia')).toBe('Ch.7 event')
    expect(join('Lucina')).toBe('Ch.13 end')
    expect(join('Owain')).toBe('Paralogue 5 talk')
    expect(unit('Owain').join.with).toEqual(['Chrom', 'Lissa'])
    expect(join('Severa')).toBe('Paralogue 10 talk')
    expect(join('Laurent')).toBe('Paralogue 14 visit')
    expect(unit('Laurent').join.with).toEqual(['Chrom', 'Miriel'])
    expect(join('Noire')).toBe('Paralogue 15 event')
    expect(join("Yen'fay")).toBe('Paralogue 21 talk')
    expect(join('Priam')).toBe('Paralogue 23 end')
  })

  it("reads the classes as the game keeps them: promotions, skills, the Avatar's set", () => {
    const cavalier = Object.values(FE13_CLASSES).find((c) => c.name === 'Cavalier' && !c.female)!
    expect(cavalier.promotesTo.map(cls)).toEqual(['Paladin', 'Great Knight'])
    const lord = Object.values(FE13_CLASSES).find((c) => c.name === 'Lord' && !c.female)!
    expect(lord.skills).toEqual([
      { skill: 'Dual Strike+', level: 1 },
      { skill: 'Charm', level: 10 },
    ])
    expect(unit('Chrom').classSets.male.map(cls)).toEqual(['Lord', 'Cavalier', 'Archer'])
    expect(unit('Avatar (F)').classSets.female.map(cls)).not.toContain('Lord')
    expect(unit('Avatar (F)').classSets.female.map(cls)).toContain('Pegasus Knight')
  })

  it('gives each child their fixed parent, and S supports only where the game has an S level', () => {
    expect(FE13_UNITS.find((u) => u.id === unit('Lucina').parent)!.name).toBe('Chrom')
    expect(FE13_UNITS.find((u) => u.id === unit('Owain').parent)!.name).toBe('Lissa')
    const chrom = unit('Chrom')
    const s = (name: string) => chrom.supports.find((x) => x.partner === unit(name).id)!.levels[3]
    expect(s('Sumia')).not.toBeNull()
    expect(s('Avatar (F)')).not.toBeNull()
    expect(s('Avatar (M)')).toBeNull()
  })
})
