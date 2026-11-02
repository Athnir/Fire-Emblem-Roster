import { describe, expect, it } from 'vitest'
import { ranksOf } from '../../../thracia/logic'
import { FE5_STATS } from '../../../thracia/types'
import { FE5_CHAPTERS, FE5_CHOICES, FE5_CLASSES, FE5_MANUALS, FE5_RINGS, FE5_SCROLLS, FE5_SUPPORTS, FE5_UNITS } from '../fe5Units'

// Serenes Forest's Thracia 776 tables, copied here to check the data built from the ROM against them.
// Base stats: Lv, HP, Str, Mag, Skl, Spd, Lck, Def, Con, Mov (characters/base-stats), under the patch's names.
const SF_BASES: Record<string, number[]> = {"Leif": [1, 22, 4, 0, 2, 5, 6, 3, 5, 6], "Finn": [7, 28, 8, 1, 8, 11, 5, 7, 9, 8], "Eyvel": [12, 28, 9, 4, 18, 20, 10, 7, 8, 8], "Halvan": [2, 28, 7, 0, 7, 7, 2, 5, 12, 6], "Osian": [1, 27, 6, 0, 7, 9, 3, 4, 11, 6], "Dagdar": [6, 43, 14, 1, 11, 9, 2, 10, 15, 7], "Tanya": [1, 20, 3, 1, 6, 10, 6, 2, 4, 6], "Marty": [1, 32, 9, 0, 0, 0, 6, 6, 15, 6], "Ronan": [1, 20, 4, 0, 3, 7, 3, 2, 7, 7], "Lifis": [4, 20, 3, 0, 4, 10, 1, 2, 6, 7], "Safy": [3, 14, 0, 6, 6, 7, 9, 0, 3, 5], "Brighton": [5, 28, 6, 0, 6, 6, 2, 6, 11, 8], "Macha": [2, 24, 4, 1, 10, 11, 6, 4, 6, 6], "Lara": [2, 14, 0, 0, 1, 10, 6, 0, 3, 7], "Fergus": [3, 26, 6, 0, 7, 7, 6, 5, 8, 8], "Karin": [1, 18, 4, 7, 4, 14, 12, 4, 4, 8], "Dalsin": [5, 29, 9, 0, 3, 2, 0, 11, 15, 5], "Asbel": [1, 22, 0, 4, 3, 7, 5, 0, 4, 6], "Nanna": [1, 18, 3, 5, 6, 7, 9, 3, 4, 8], "Hicks": [6, 30, 7, 0, 6, 5, 6, 8, 15, 8], "Shiva": [4, 24, 6, 0, 9, 12, 5, 4, 7, 6], "Callion": [1, 24, 5, 1, 5, 8, 6, 5, 6, 8], "Selphina": [8, 22, 5, 3, 7, 10, 7, 6, 5, 8], "Kane": [2, 26, 7, 0, 4, 7, 3, 6, 10, 8], "Alba": [2, 24, 6, 0, 5, 9, 4, 5, 9, 8], "Robert": [1, 23, 5, 0, 4, 8, 6, 4, 7, 8], "Fred": [2, 33, 10, 4, 11, 10, 4, 9, 11, 9], "Olwen": [2, 24, 5, 10, 8, 10, 5, 4, 5, 8], "Mareeta": [2, 22, 3, 1, 7, 13, 7, 3, 5, 6], "Salem": [5, 22, 0, 8, 6, 7, 2, 2, 4, 6], "Perne": [3, 24, 7, 3, 8, 14, 11, 5, 8, 7], "Tina": [1, 14, 0, 3, 1, 5, 15, 0, 3, 5], "Trude": [8, 30, 8, 0, 11, 12, 3, 5, 9, 6], "Glade": [2, 34, 11, 2, 12, 11, 4, 10, 12, 9], "Dean": [3, 36, 12, 2, 13, 12, 5, 13, 12, 9], "Eda": [5, 22, 7, 3, 6, 9, 12, 9, 5, 8], "Homer": [5, 24, 0, 5, 3, 10, 12, 2, 5, 6], "Linoan": [3, 16, 0, 7, 4, 9, 8, 0, 3, 5], "Ralph": [3, 38, 12, 1, 12, 14, 6, 9, 14, 6], "Ilios": [8, 40, 11, 9, 13, 14, 14, 10, 6, 8], "Schroff": [6, 18, 0, 11, 12, 4, 9, 1, 4, 5], "Sara": [7, 14, 0, 11, 12, 9, 10, 0, 3, 5], "Miranda": [5, 19, 0, 7, 2, 8, 7, 1, 3, 6], "Shannam": [1, 24, 5, 1, 8, 9, 1, 4, 6, 7], "Misha": [4, 28, 8, 13, 11, 16, 6, 6, 6, 9], "Xavier": [6, 38, 13, 3, 9, 6, 3, 17, 15, 6], "Amalda": [6, 34, 8, 13, 11, 15, 11, 9, 8, 10], "Conomor": [13, 39, 13, 3, 18, 11, 4, 12, 13, 10], "Dermott": [3, 36, 11, 5, 12, 12, 7, 9, 11, 10], "Ced": [14, 32, 3, 17, 16, 16, 10, 9, 8, 8], "Galzus": [20, 54, 20, 9, 20, 20, 17, 14, 18, 7]}
// Growth rates: HP, Str, Mag, Skl, Spd, Lck, Def, Con, Mov.
const SF_GROWTHS: Record<string, number[]> = {"Leif": [70, 35, 10, 35, 40, 40, 25, 15, 3], "Finn": [60, 35, 5, 30, 35, 45, 30, 10, 1], "Osian": [85, 30, 5, 25, 35, 55, 25, 25, 2], "Halvan": [80, 40, 5, 20, 30, 30, 30, 30, 2], "Eyvel": [30, 15, 10, 15, 10, 25, 5, 5, 1], "Dagdar": [15, 10, 5, 10, 10, 30, 10, 5, 1], "Ralph": [60, 35, 5, 30, 20, 15, 35, 35, 1], "Marty": [90, 15, 5, 10, 15, 50, 40, 75, 2], "Ronan": [40, 15, 55, 45, 55, 20, 5, 2, 3], "Miranda": [60, 5, 70, 55, 70, 35, 15, 5, 2], "Safy": [35, 30, 60, 45, 40, 5, 3, 2, 0], "Lara": [45, 10, 10, 50, 70, 60, 20, 5, 3], "Brighton": [70, 30, 5, 25, 30, 15, 35, 20, 1], "Fergus": [65, 35, 10, 45, 35, 40, 25, 20, 1], "Eda": [60, 40, 20, 35, 60, 30, 20, 5, 1], "Asbel": [55, 10, 35, 55, 75, 35, 10, 10, 2], "Macha": [60, 30, 10, 55, 60, 35, 25, 10, 2], "Hicks": [80, 35, 5, 40, 30, 55, 30, 30, 1], "Nanna": [50, 25, 10, 40, 35, 55, 15, 10, 1], "Selphina": [50, 25, 10, 40, 35, 55, 15, 10, 1], "Dalsin": [60, 50, 5, 40, 25, 25, 20, 25, 2], "Callion": [75, 40, 10, 65, 45, 55, 25, 25, 1], "Shiva": [70, 45, 5, 50, 35, 60, 30, 20, 2], "Perne": [65, 40, 10, 45, 65, 70, 25, 10, 2], "Glade": [60, 45, 5, 35, 35, 35, 30, 15, 1], "Kane": [75, 55, 5, 40, 35, 50, 35, 30, 1], "Alba": [70, 40, 10, 45, 50, 65, 30, 25, 1], "Robert": [65, 45, 10, 50, 60, 70, 25, 20, 1], "Fred": [75, 60, 15, 40, 35, 25, 35, 25, 1], "Olwen": [50, 40, 45, 55, 50, 70, 15, 10, 1], "Ced": [75, 10, 75, 75, 80, 65, 20, 15, 1], "Lifis": [65, 35, 10, 25, 45, 5, 15, 10, 2], "Karin": [55, 30, 15, 35, 70, 70, 15, 5, 2], "Dean": [75, 55, 5, 50, 30, 40, 30, 30, 1], "Shannam": [50, 50, 5, 5, 50, 50, 5, 5, 2], "Trude": [90, 35, 5, 45, 35, 60, 30, 20, 2], "Tanya": [60, 35, 15, 55, 70, 60, 15, 5, 2], "Linoan": [50, 3, 45, 60, 55, 55, 10, 5, 2], "Misha": [65, 55, 15, 65, 80, 40, 20, 5, 1], "Salem": [60, 5, 30, 45, 40, 10, 15, 15, 2], "Schroff": [35, 3, 40, 75, 45, 25, 10, 10, 2], "Mareeta": [65, 60, 15, 75, 80, 60, 20, 10, 3], "Tina": [40, 3, 50, 25, 65, 90, 5, 5, 5], "Amalda": [70, 55, 15, 50, 45, 60, 25, 15, 1], "Conomor": [70, 60, 5, 35, 50, 20, 20, 20, 1], "Homer": [65, 0, 40, 70, 70, 55, 15, 10, 3], "Dermott": [70, 40, 15, 65, 45, 65, 30, 15, 2], "Sara": [40, 0, 80, 80, 80, 40, 10, 5, 3], "Saias": [50, 0, 35, 40, 40, 55, 15, 10, 2], "Galzus": [50, 40, 45, 55, 50, 70, 15, 10, 1], "Ilios": [50, 40, 45, 55, 50, 70, 15, 10, 1], "Xavier": [50, 40, 45, 55, 50, 70, 15, 10, 1]}

const unitByName = new Map(FE5_UNITS.map((u) => [u.name, u]))
const labelOf = (id: string) => FE5_CHAPTERS.find((c) => c.id === id)!.label
const className = (id?: string) => (id ? FE5_CLASSES[id].name : undefined)

describe('Thracia 776 units', () => {
  it("matches Serenes Forest's levels and bases", () => {
    // What's shown: the class's base plus the unit's own, held at 20 ($83:90BE). Galzus's own Spd 13 and the Hero's 8 make 21,
    // shown as 20, as Serenes lists it.
    for (const [name, sf] of Object.entries(SF_BASES)) {
      const u = unitByName.get(name)!
      expect([name, u.level, ...FE5_STATS.map((s) => u.bases[s])]).toEqual([name, ...sf])
    }
    const galzus = unitByName.get('Galzus')!
    expect(galzus.own.spd + FE5_CLASSES[galzus.classId].bases.spd).toBe(21)
  })

  it("matches Serenes Forest's growth rates", () => {
    for (const [name, sf] of Object.entries(SF_GROWTHS)) {
      const u = unitByName.get(name)!
      expect([name, ...FE5_STATS.map((s) => u.growths[s])]).toEqual([name, ...sf])
    }
  })

  it('joins where the scripts put them (Serenes Forest agrees, with fewer conditions)', () => {
    const join = (name: string) => `${labelOf(unitByName.get(name)!.joinChapter)} ${unitByName.get(name)!.join.how}`
    expect(join('Leif')).toBe('Ch.1 start')
    expect(join('Dagdar')).toBe('Ch.1 event')
    expect(join('Ronan')).toBe('Ch.2 visit')
    expect(join('Safy')).toBe('Ch.2x end')
    expect(join('Lifis')).toBe('Ch.2x end')
    expect(join('Asbel')).toBe('Ch.4x talk')
    expect(join('Shiva')).toBe('Ch.7 talk')
    expect(join('Olwen')).toBe('Ch.11x talk')
    expect(join('Salem')).toBe('Ch.12x start')
    expect(join('Homer')).toBe('Ch.14 visit')
    expect(join('Linoan')).toBe('Ch.14x start')
    expect(join('Schroff')).toBe('Ch.16A visit')
    expect(join('Misha')).toBe('Ch.17A end')
    expect(join('Sara')).toBe('Ch.17A visit')
    expect(join('Miranda')).toBe('Ch.16B event')
    expect(join('Galzus')).toBe('Ch.24 talk')
    expect(unitByName.get('Dalsin')!.join.with).toEqual(['Leif', 'Lifis'])
    expect(unitByName.get('Perne')!.join.with).toEqual(['Salem', 'Lifis', 'Lara'])
    expect(unitByName.get('Homer')!.join.with).toEqual(['Nanna'])
    // Sara's route B join, once the route pick says so.
    expect(unitByName.get('Sara')!.altJoin).toMatchObject({ choice: 'fe5-route', option: 2, joinChapter: 'fe5-16b', join: { how: 'talk', with: ['Leif'] } })
    expect(unitByName.get('Misha')!.level).toBe(4)
  })

  it("promotes as the Master Seal's table and the story say (the Fire Emblem Wiki agrees)", () => {
    const promo = (name: string) => {
      const p = unitByName.get(name)!.promotion
      return p ? `${className(p.classId)} ${p.by}` : 'none'
    }
    expect(promo('Leif')).toBe('Prince story')
    expect(promo('Linoan')).toBe('Sage story')
    expect(promo('Finn')).toBe('Duke Knight seal')
    expect(promo('Osian')).toBe('Hero seal')
    expect(promo('Halvan')).toBe('Hero seal')
    expect(promo('Macha')).toBe('Hero seal')
    expect(promo('Shiva')).toBe('Swordmaster seal')
    expect(promo('Mareeta')).toBe('Swordmaster seal')
    expect(promo('Dalsin')).toBe('General seal')
    expect(promo('Asbel')).toBe('Sage seal')
    expect(promo('Homer')).toBe('Sage seal')
    expect(promo('Sara')).toBe('Sage seal')
    expect(promo('Nanna')).toBe('Paladin seal')
    expect(promo('Miranda')).toBe('Mage Knight seal')
    expect(promo('Lara')).toBe('Rogue seal')
    // Ralph's entry is the Hero class he already is.
    expect(promo('Ralph')).toBe('none')
    expect(className(unitByName.get('Lara')!.storyStep!.classId)).toBe('Dancer')
    expect(FE5_UNITS.filter((u) => u.promotion?.by === 'seal')).toHaveLength(32)
  })

  it("shows weapon ranks as the Fire Emblem Wiki lists them: the class's points plus the unit's own", () => {
    const ranks = (name: string) => {
      const u = unitByName.get(name)!
      return ranksOf(FE5_CLASSES[u.classId], u).map((r) => `${r.weapon} ${r.letter}`)
    }
    expect(ranks('Leif')).toEqual(['sword C'])
    expect(ranks('Finn')).toEqual(['lance B'])
    expect(ranks('Osian')).toEqual(['axe E'])
    expect(ranks('Asbel')).toEqual(['fire E', 'thunder E', 'wind C'])
    expect(ranks('Ced')).toEqual(['staff A', 'fire A', 'thunder B', 'wind A', 'light A'])
    // Osian "Axes E (+40)", Macha "Swords D (+30)": the wiki's points over the class's.
    const points = (name: string) => ranksOf(FE5_CLASSES[unitByName.get(name)!.classId], unitByName.get(name)!)[0].points
    expect(points('Osian')).toBe(90)
    expect(points('Macha')).toBe(130)
  })

  it("has the skills Serenes Forest's skills page lists", () => {
    const skills = (name: string) => unitByName.get(name)!.skills
    expect(skills('Leif')).toEqual(['Adept'])
    expect(skills('Finn')).toEqual(['Miracle'])
    expect(skills('Perne')).toEqual(['Steal', 'Sol'])
    expect(skills('Sara')).toEqual(['Miracle', 'Wrath', 'Paragon'])
    expect(skills('Xavier')).toEqual(['Accost', 'Pavise', 'Wrath'])
    expect(skills('Galzus')).toEqual(['Astra', 'Luna'])
    expect(skills('Shannam')).toEqual(['Bargain'])
    expect(FE5_UNITS.filter((u) => u.skills.length).length).toBe(28)
    expect(FE5_CLASSES[unitByName.get('Lifis')!.classId].skills).toEqual(['Steal'])
    expect(FE5_CLASSES[unitByName.get('Finn')!.classId].skills).toEqual(['Canto'])
    expect(unitByName.get('Mareeta')!.storySkill?.skill).toBe('Astra')
  })

  it('has the leadership the scripts set (Serenes Forest agrees)', () => {
    const stars = Object.fromEntries(FE5_UNITS.filter((u) => u.leadership).map((u) => [u.name, u.leadership]))
    expect(stars).toEqual({ Finn: 1, Eyvel: 1, Glade: 1, Xavier: 1, Amalda: 1, Conomor: 1, Ced: 1, Saias: 3 })
    expect(unitByName.get('Leif')!.leadershipNote).toContain('2 from the end of Ch.9')
  })

  it('reads the holy scrolls, the rings and the manuals', () => {
    const bonus = (name: string) => FE5_STATS.map((s) => FE5_SCROLLS.find((x) => x.name === name)!.growths[s])
    expect(bonus("Od's Scroll")).toEqual([0, 0, 0, 30, 0, 0, 0, 0, 0])
    expect(Object.fromEntries(FE5_RINGS.map((r) => [r.name, `${r.stat} +${r.amount}`]))).toEqual({
      'Luck Ring': 'lck +3', 'Life Ring': 'hp +7', 'Speed Ring': 'spd +3', 'Magic Ring': 'mag +2', 'Strength Ring': 'str +3',
      'Body Ring': 'con +3', 'Shield Ring': 'def +2', 'Skill Ring': 'skl +3', 'Leg Ring': 'mov +2',
    })
    expect(FE5_MANUALS.map((m) => m.skill).sort()).toEqual(['Accost', 'Adept', 'Luna', 'Nihil', 'Paragon', 'Sol', 'Vantage', 'Wrath'])
  })

  it('reads every support, the givers who are not playable too', () => {
    expect(FE5_SUPPORTS).toHaveLength(68)
    const name = (id: string) => FE5_UNITS.find((u) => u.id === id)?.name
    expect(FE5_SUPPORTS.filter((s) => s.bonus === 20).map((s) => `${name(s.gets)} from ${name(s.gives)}`)).toEqual([
      'Glade from Selphina', 'Dean from Linoan', 'Conomor from Miranda', 'Galzus from Mareeta',
    ])
    expect(FE5_SUPPORTS.filter((s) => s.giverNote).map((s) => name(s.gets)).sort()).toEqual(['Asbel', 'Karin', 'Macha', 'Olwen', 'Olwen'])
    for (const s of FE5_SUPPORTS) expect(FE5_UNITS.some((u) => u.id === s.gets)).toBe(true)
  })

  it("has the story's picks: the route, Olwen or Ilios, Ced or Saias", () => {
    expect(FE5_CHOICES.map((c) => c.id)).toEqual(['fe5-route', 'fe5-olwen-ilios', 'fe5-ced-saias'])
    expect(FE5_CHOICES[0].options.map((o) => o.route)).toEqual(['A', 'A', 'B'])
  })
})
