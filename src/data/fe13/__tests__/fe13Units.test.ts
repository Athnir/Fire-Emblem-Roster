import { describe, expect, it } from 'vitest'
import { FE13_CHAPTERS, FE13_CLASSES, FE13_UNITS } from '../fe13Units'

// Serenes Forest's Awakening tables, copied here to check the data built from the game's files against them.
// Base stats (characters/base-stats/main-story): Lv, HP, Str, Mag, Skl, Spd, Lck, Def, Res, Mov, the first figure of each (it adds
// what equipment and Taguel or Manakete forms give after a +). For a child it's their own part (their real bases take after the
// parents), and Morgan's Mov is blank (his class varies).
const SF_BASES: Record<string, (number | null)[]> = {"Avatar": [1, 19, 6, 5, 5, 6, 4, 6, 4, 5], "Chrom": [1, 20, 7, 1, 8, 8, 5, 7, 1, 6], "Lissa": [1, 17, 1, 5, 4, 4, 8, 3, 4, 5], "Frederick": [1, 28, 13, 2, 12, 10, 6, 14, 3, 7], "Sully": [2, 20, 7, 1, 8, 8, 6, 7, 2, 7], "Virion": [2, 19, 6, 0, 9, 5, 7, 6, 1, 5], "Stahl": [2, 22, 8, 0, 7, 6, 5, 8, 1, 7], "Vaike": [3, 24, 9, 0, 8, 6, 4, 5, 0, 5], "Miriel": [1, 18, 0, 6, 5, 7, 6, 3, 4, 5], "Sumia": [1, 18, 6, 3, 11, 11, 8, 5, 7, 7], "Kellam": [5, 21, 10, 0, 7, 5, 3, 12, 2, 4], "Donnel": [1, 16, 4, 0, 2, 3, 11, 3, 0, 5], "Lon'qu": [4, 20, 6, 1, 12, 13, 7, 7, 2, 5], "Ricken": [3, 20, 3, 8, 6, 5, 10, 6, 3, 5], "Maribelle": [3, 18, 0, 5, 4, 6, 5, 3, 6, 7], "Panne": [6, 28, 8, 1, 9, 10, 8, 7, 3, 6], "Gaius": [5, 22, 7, 0, 13, 15, 6, 5, 2, 5], "Cordelia": [7, 25, 9, 3, 13, 12, 9, 8, 8, 7], "Gregor": [10, 30, 12, 0, 13, 11, 8, 10, 2, 5], "Nowi": [3, 18, 4, 0, 2, 3, 8, 2, 2, 6], "Libra": [1, 38, 14, 15, 13, 13, 10, 11, 16, 6], "Tharja": [10, 25, 4, 11, 5, 12, 3, 10, 7, 5], "Anna": [1, 35, 12, 17, 22, 21, 25, 8, 10, 6], "Olivia": [1, 18, 3, 1, 8, 9, 5, 3, 2, 5], "Cherche": [12, 30, 14, 1, 12, 11, 8, 15, 2, 7], "Henry": [12, 28, 6, 13, 14, 8, 10, 12, 5, 5], "Say'ri": [1, 39, 17, 7, 23, 26, 20, 12, 10, 6], "Tiki": [20, 39, 18, 10, 14, 16, 18, 15, 12, 6], "Basilio": [10, 56, 30, 3, 25, 21, 18, 20, 8, 6], "Flavia": [10, 48, 25, 5, 28, 26, 21, 23, 11, 6], "Lucina": [10, 12, 5, 1, 8, 4, 13, 3, 3, 5], "Owain": [10, 10, 4, 4, 5, 6, 9, 6, 5, 5], "Inigo": [10, 11, 5, 2, 4, 9, 12, 4, 4, 5], "Brady": [10, 9, 6, 5, 4, 2, 10, 7, 4, 5], "Kjelle": [10, 10, 6, 2, 6, 5, 11, 3, 3, 4], "Cynthia": [10, 7, 5, 2, 4, 10, 17, 6, 6, 8], "Severa": [10, 8, 6, 1, 7, 6, 6, 6, 5, 5], "Gerome": [10, 13, 8, 0, 4, 8, 5, 5, 1, 8], "Morgan": [10, 9, 6, 8, 7, 6, 7, 3, 7, null], "Yarne": [10, 16, 9, 1, 4, 4, 13, 6, 1, 6], "Laurent": [10, 10, 3, 7, 7, 4, 11, 4, 5, 5], "Noire": [10, 8, 5, 3, 4, 7, 10, 4, 6, 5], "Nah": [10, 5, 3, 3, 5, 6, 8, 3, 3, 6], "Gangrel": [15, 49, 21, 20, 29, 33, 15, 18, 17, 6], "Walhart": [30, 71, 39, 15, 33, 32, 30, 35, 19, 8], "Emmeryn": [10, 42, 5, 26, 23, 25, 13, 12, 20, 6], "Yen'fay": [20, 60, 30, 5, 39, 40, 28, 21, 18, 6], "Aversa": [20, 55, 24, 31, 29, 32, 26, 21, 28, 8], "Priam": [20, 74, 40, 3, 44, 38, 35, 39, 25, 6]}

// Growth rates (characters/growth-rates/base, classes/growth-rates): HP, Str, Mag, Skl, Spd, Lck, Def, Res. The game's are decoded from
// the files (scripts/fe13_growths.py: CipherData and a key from the record's place and the stat).
const SF_PERSONAL_GROWTHS: Record<string, number[]> = {"Avatar": [40, 40, 35, 35, 35, 55, 30, 20], "Chrom": [45, 40, 10, 40, 40, 70, 35, 20], "Lissa": [35, 25, 35, 30, 35, 65, 15, 35], "Frederick": [60, 40, 10, 40, 35, 40, 40, 20], "Sully": [40, 35, 20, 40, 40, 60, 35, 20], "Virion": [35, 40, 30, 40, 45, 40, 25, 25], "Stahl": [50, 45, 10, 35, 30, 50, 50, 10], "Vaike": [60, 50, 10, 45, 35, 45, 40, 5], "Miriel": [35, 15, 40, 40, 40, 50, 20, 30], "Sumia": [35, 30, 20, 45, 45, 60, 25, 30], "Kellam": [50, 40, 15, 40, 35, 35, 55, 30], "Donnel": [50, 45, 15, 40, 45, 80, 35, 15], "Lon'qu": [40, 35, 20, 50, 50, 55, 25, 20], "Ricken": [50, 20, 35, 30, 30, 65, 30, 25], "Maribelle": [30, 20, 40, 40, 30, 80, 10, 40], "Panne": [60, 45, 15, 50, 55, 40, 40, 15], "Gaius": [50, 45, 15, 45, 45, 35, 25, 15], "Cordelia": [50, 45, 15, 35, 35, 45, 40, 25], "Gregor": [60, 40, 10, 40, 30, 45, 40, 10], "Nowi": [70, 45, 35, 30, 30, 65, 50, 35], "Libra": [45, 25, 35, 45, 35, 45, 25, 30], "Tharja": [40, 25, 45, 25, 45, 40, 35, 20], "Anna": [45, 30, 30, 35, 35, 80, 30, 30], "Olivia": [40, 35, 25, 45, 45, 60, 20, 20], "Cherche": [55, 40, 20, 40, 35, 50, 45, 10], "Henry": [45, 35, 35, 45, 40, 40, 40, 20], "Say'ri": [50, 35, 20, 40, 40, 45, 35, 30], "Tiki": [80, 40, 40, 35, 30, 80, 45, 45], "Basilio": [65, 45, 10, 40, 35, 45, 40, 15], "Flavia": [50, 35, 20, 45, 45, 55, 30, 25], "Gangrel": [40, 40, 30, 50, 50, 30, 30, 30], "Walhart": [75, 60, 10, 30, 30, 45, 45, 25], "Emmeryn": [45, 10, 55, 40, 40, 70, 25, 35], "Yen'fay": [60, 45, 10, 45, 50, 60, 30, 20], "Aversa": [45, 25, 45, 35, 40, 65, 30, 30], "Priam": [80, 60, 10, 40, 30, 50, 40, 10], "Lucina": [45, 35, 20, 45, 45, 80, 25, 25], "Owain": [45, 40, 30, 45, 35, 50, 30, 30], "Inigo": [50, 35, 15, 35, 45, 65, 30, 20], "Brady": [55, 30, 40, 25, 30, 60, 30, 30], "Kjelle": [40, 35, 25, 40, 45, 55, 40, 20], "Cynthia": [45, 35, 20, 25, 45, 70, 30, 30], "Severa": [45, 40, 10, 45, 35, 35, 40, 30], "Gerome": [65, 50, 15, 40, 40, 30, 40, 10], "Morgan": [35, 35, 40, 40, 40, 50, 25, 25], "Yarne": [70, 50, 10, 45, 40, 60, 45, 10], "Laurent": [45, 20, 40, 40, 30, 50, 25, 35], "Noire": [30, 45, 40, 35, 50, 40, 30, 40], "Nah": [70, 35, 35, 45, 35, 70, 45, 40]}
// "A/B" names both classes; Taguel (M) and (F) are the two Taguel classes.
const SF_CLASS_GROWTHS: Record<string, number[]> = {"Lord": [40, 20, 0, 20, 20, 0, 10, 5], "Great Lord": [40, 20, 0, 20, 20, 0, 10, 5], "Tactician": [40, 15, 15, 15, 15, 0, 10, 10], "Grandmaster": [40, 15, 15, 15, 15, 0, 10, 10], "Cavalier": [45, 20, 0, 20, 20, 0, 10, 5], "Paladin": [45, 20, 0, 20, 20, 0, 10, 10], "Great Knight": [50, 25, 0, 15, 15, 0, 15, 5], "Knight": [50, 25, 0, 15, 10, 0, 15, 5], "General": [50, 25, 0, 15, 10, 0, 15, 10], "Myrmidon": [40, 20, 0, 25, 25, 0, 5, 5], "Swordmaster": [40, 20, 0, 25, 25, 0, 5, 10], "Mercenary": [45, 20, 0, 25, 20, 0, 10, 5], "Hero": [45, 20, 0, 25, 20, 0, 10, 5], "Fighter": [45, 25, 0, 20, 15, 0, 10, 5], "Warrior": [45, 25, 0, 20, 15, 0, 10, 5], "Barbarian": [50, 25, 0, 15, 20, 0, 5, 5], "Berserker": [50, 25, 0, 15, 20, 0, 5, 5], "Archer": [45, 15, 0, 30, 15, 0, 10, 5], "Sniper": [45, 15, 0, 30, 15, 0, 15, 5], "Bow Knight": [50, 20, 0, 25, 20, 0, 5, 5], "Thief": [35, 15, 5, 25, 25, 0, 5, 5], "Assassin": [40, 20, 0, 30, 25, 0, 5, 5], "Trickster": [35, 10, 15, 25, 20, 0, 5, 10], "Pegasus Knight": [40, 15, 5, 25, 25, 0, 5, 10], "Falcon Knight": [40, 15, 10, 25, 25, 0, 5, 10], "Dark Flier": [40, 10, 15, 20, 20, 0, 5, 10], "Wyvern Rider/Lord": [45, 30, 0, 15, 15, 0, 10, 5], "Griffon Rider": [45, 25, 0, 20, 20, 0, 5, 5], "Mage": [35, 0, 20, 20, 20, 0, 5, 10], "Sage": [35, 0, 20, 20, 20, 0, 5, 10], "Dark Mage": [50, 5, 15, 15, 15, 0, 10, 10], "Sorcerer": [45, 0, 20, 15, 15, 0, 10, 10], "Dark Knight": [50, 15, 15, 15, 15, 0, 10, 5], "Priest": [35, 5, 15, 15, 15, 0, 5, 15], "Cleric": [35, 5, 15, 15, 15, 0, 5, 15], "War Monk/Cleric": [45, 15, 15, 10, 15, 0, 10, 10], "Troubadour": [35, 0, 20, 10, 20, 0, 5, 15], "Valkyrie": [35, 0, 20, 10, 20, 0, 5, 15], "Villager": [35, 10, 0, 5, 5, 0, 10, 5], "Dancer": [35, 5, 0, 25, 25, 0, 5, 5], "Taguel (M)": [45, 20, 0, 15, 15, 0, 15, 5], "Taguel (F)": [40, 15, 0, 20, 20, 0, 10, 5], "Manakete": [50, 20, 5, 20, 20, 0, 15, 15], "Lodestar": [40, 20, 0, 20, 20, 0, 10, 5], "Conqueror": [50, 20, 5, 15, 15, 0, 10, 10], "Dread Fighter": [40, 20, 10, 20, 20, 0, 10, 10], "Bride": [40, 20, 10, 20, 20, 0, 10, 10], "Soldier": [40, 10, 0, 10, 10, 0, 5, 5]}

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

  it("decodes every unit's and class's growths to Serenes Forest's", () => {
    let units = 0
    for (const u of FE13_UNITS) {
      const sf = SF_PERSONAL_GROWTHS[u.name] ?? SF_PERSONAL_GROWTHS[u.name.replace(/ \([MF]\)$/, '')]
      expect([u.name, !!sf]).toEqual([u.name, true])
      expect([u.name, ...STATS.map((s) => u.growths[s])]).toEqual([u.name, ...sf])
      units++
    }
    expect(units).toBe(51)
    const names = (k: string) => (k.includes('/') ? [k.split('/')[0], `${k.split(' ')[0]} ${k.split('/')[1]}`] : [k])
    let classes = 0
    for (const c of Object.values(FE13_CLASSES)) {
      const key = Object.keys(SF_CLASS_GROWTHS).find((k) =>
        c.name === 'Taguel' ? k === `Taguel (${c.female ? 'F' : 'M'})` : names(k).includes(c.name),
      )
      expect([c.name, !!key]).toEqual([c.name, true])
      expect([c.name, ...STATS.map((s) => c.growths![s])]).toEqual([c.name, ...SF_CLASS_GROWTHS[key!]])
      classes++
    }
    expect(classes).toBe(Object.keys(FE13_CLASSES).length)
  })
})
