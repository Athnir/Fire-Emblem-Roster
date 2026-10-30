import { describe, expect, it } from 'vitest'
import { GBA_GROWING, GBA_STATS } from '../../../gba/types'
import { FE7_CHAPTERS, FE7_CLASSES, FE7_STORIES, FE7_SUPPORTS, FE7_UNITS } from '../fe7Units'

// Serenes Forest's Blazing Blade tables, copied here to check the data built from the ROM against them.
// Base stats: Lv, HP, S/M, Skl, Spd, Lck, Def, Res, Con, Mov (characters/base-stats, Normal mode): Lyn's story, then Eliwood's and
// Hector's. Its Nils row in the main story reads "same as Ninian" (Con 3, Mov 5), so he's checked against Lyn's.
const SF_LYN_BASES: Record<string, number[]> = {"Lyn": [1, 16, 4, 7, 9, 5, 2, 0, 5, 5], "Sain": [1, 19, 8, 4, 6, 4, 6, 0, 9, 7], "Kent": [1, 20, 6, 6, 7, 2, 5, 1, 9, 7], "Florina": [1, 17, 5, 7, 9, 7, 4, 4, 4, 7], "Wil": [2, 20, 6, 5, 5, 6, 5, 0, 6, 5], "Dorcas": [3, 30, 7, 7, 6, 3, 3, 0, 14, 5], "Serra": [1, 17, 2, 5, 8, 6, 2, 5, 4, 5], "Erk": [1, 17, 5, 6, 7, 3, 2, 4, 5, 5], "Rath": [7, 25, 8, 9, 10, 5, 7, 2, 8, 7], "Matthew": [2, 18, 4, 4, 11, 2, 3, 0, 7, 6], "Nils": [1, 14, 0, 0, 12, 10, 5, 4, 3, 5], "Lucius": [3, 18, 7, 6, 10, 2, 1, 6, 6, 5], "Wallace": [12, 30, 13, 7, 5, 10, 15, 2, 13, 4]}
const SF_BASES: Record<string, number[]> = {"Eliwood": [1, 18, 5, 5, 7, 7, 5, 0, 7, 5], "Lowen": [2, 23, 7, 5, 7, 3, 7, 0, 10, 7], "Marcus": [1, 31, 15, 15, 11, 8, 10, 8, 11, 8], "Rebecca": [1, 17, 4, 5, 6, 4, 3, 1, 5, 5], "Dorcas": [3, 30, 7, 7, 6, 3, 3, 0, 14, 5], "Bartre": [2, 29, 9, 5, 3, 4, 4, 0, 13, 5], "Hector": [1, 19, 7, 4, 5, 3, 8, 0, 13, 5], "Oswin": [9, 28, 13, 9, 5, 3, 13, 3, 14, 4], "Serra": [1, 17, 2, 5, 8, 6, 2, 5, 4, 5], "Matthew": [2, 18, 4, 4, 11, 2, 3, 0, 7, 6], "Guy": [3, 21, 6, 11, 11, 5, 5, 0, 5, 5], "Merlinus": [5, 18, 0, 4, 5, 12, 5, 2, 25, 0], "Erk": [1, 17, 5, 6, 7, 3, 2, 4, 5, 5], "Priscilla": [3, 16, 6, 6, 8, 7, 3, 6, 4, 7], "Lyn": [4, 18, 5, 10, 11, 5, 2, 0, 5, 5], "Wil": [4, 21, 6, 5, 6, 7, 5, 1, 6, 5], "Kent": [5, 23, 8, 7, 8, 4, 6, 1, 9, 7], "Sain": [4, 22, 9, 5, 7, 5, 7, 0, 9, 7], "Florina": [3, 18, 6, 8, 9, 8, 4, 5, 4, 7], "Raven": [5, 25, 8, 11, 13, 2, 5, 1, 8, 5], "Lucius": [3, 18, 7, 6, 10, 2, 1, 6, 6, 5], "Canas": [8, 21, 10, 9, 8, 7, 5, 8, 7, 5], "Dart": [8, 34, 12, 8, 8, 3, 6, 1, 10, 5], "Fiora": [7, 21, 8, 11, 13, 6, 6, 7, 5, 7], "Legault": [12, 26, 8, 11, 15, 10, 8, 3, 9, 6], "Ninian": [1, 14, 0, 0, 12, 10, 5, 4, 4, 5], "Isadora": [1, 28, 13, 12, 16, 10, 8, 6, 6, 8], "Heath": [7, 28, 11, 8, 7, 7, 10, 1, 9, 7], "Rath": [9, 27, 9, 10, 11, 5, 8, 2, 7, 7], "Hawkeye": [4, 50, 18, 14, 11, 13, 14, 10, 16, 6], "Geitz": [3, 40, 17, 12, 13, 10, 11, 3, 13, 6], "Wallace": [1, 34, 16, 9, 8, 10, 19, 5, 15, 5], "Farina": [12, 24, 10, 13, 14, 10, 10, 12, 5, 7], "Pent": [6, 33, 18, 21, 17, 14, 11, 16, 8, 6], "Louise": [4, 28, 12, 14, 17, 16, 9, 12, 6, 6], "Karel": [8, 31, 16, 23, 20, 15, 13, 12, 9, 6], "Harken": [8, 38, 21, 20, 17, 12, 15, 10, 11, 6], "Nino": [5, 19, 7, 8, 11, 10, 4, 7, 3, 5], "Jaffar": [13, 34, 19, 25, 24, 10, 15, 11, 8, 6], "Vaida": [9, 43, 20, 19, 13, 11, 21, 6, 12, 8], "Karla": [5, 29, 14, 21, 18, 16, 11, 12, 7, 6], "Renault": [16, 43, 12, 22, 20, 10, 15, 18, 9, 6], "Athos": [20, 40, 30, 24, 20, 25, 20, 28, 9, 6]}
// Growth rates: HP, S/M, Skl, Spd, Lck, Def, Res.
const SF_GROWTHS: Record<string, number[]> = {"Eliwood": [80, 45, 50, 40, 45, 30, 35], "Lyn": [70, 40, 60, 60, 55, 20, 30], "Hector": [90, 60, 45, 35, 30, 50, 25], "Sain": [80, 60, 35, 40, 35, 20, 20], "Kent": [85, 40, 50, 45, 20, 25, 25], "Florina": [60, 40, 50, 55, 50, 15, 35], "Wil": [75, 50, 50, 40, 40, 20, 25], "Dorcas": [80, 60, 40, 20, 45, 25, 15], "Serra": [50, 50, 30, 40, 60, 15, 55], "Erk": [65, 40, 40, 50, 30, 20, 40], "Rath": [80, 50, 40, 50, 30, 10, 25], "Matthew": [75, 30, 40, 70, 50, 25, 20], "Wallace": [70, 45, 40, 20, 30, 35, 35], "Lowen": [90, 30, 30, 30, 50, 40, 30], "Rebecca": [60, 40, 50, 60, 50, 15, 30], "Marcus": [65, 30, 50, 25, 30, 15, 35], "Bartre": [85, 50, 35, 40, 30, 30, 25], "Oswin": [90, 40, 30, 30, 35, 55, 30], "Guy": [75, 30, 50, 70, 45, 15, 25], "Merlinus": [120, 0, 90, 90, 100, 30, 15], "Priscilla": [45, 40, 50, 40, 65, 15, 50], "Raven": [85, 55, 40, 45, 35, 25, 15], "Lucius": [55, 60, 50, 40, 20, 10, 60], "Canas": [70, 45, 40, 35, 25, 25, 45], "Dart": [70, 65, 20, 60, 35, 20, 15], "Fiora": [70, 35, 60, 50, 30, 20, 50], "Legault": [60, 25, 45, 60, 60, 25, 25], "Nils/Ninian": [85, 5, 5, 70, 80, 30, 70], "Isadora": [75, 30, 35, 50, 45, 20, 25], "Heath": [80, 50, 50, 45, 20, 30, 20], "Hawkeye": [50, 40, 30, 25, 40, 20, 35], "Geitz": [85, 50, 30, 40, 40, 20, 20], "Farina": [75, 50, 40, 45, 45, 25, 30], "Pent": [50, 30, 20, 40, 40, 30, 35], "Louise": [60, 40, 40, 40, 30, 20, 30], "Karel": [70, 30, 50, 50, 30, 10, 15], "Harken": [80, 35, 30, 40, 20, 30, 25], "Nino": [55, 50, 55, 60, 45, 15, 50], "Jaffar": [65, 15, 40, 35, 20, 30, 30], "Vaida": [60, 45, 25, 40, 30, 25, 15], "Karla": [60, 25, 45, 55, 40, 10, 20], "Renault": [60, 40, 30, 35, 15, 20, 40], "Athos": [0, 0, 0, 0, 0, 0, 0]}
// Promotion gains (classes/promotion-gains): HP, S/M, Skl, Spd, Def, Res, Mov, Con.
const SF_PROMOTION: Record<string, number[]> = {"Blade Lord": [3, 2, 2, 0, 3, 5, 1, 1], "Knight Lord": [4, 2, 0, 1, 1, 3, 2, 2], "Great Lord": [3, 0, 2, 3, 1, 5, 0, 2], "Paladin (M)": [2, 1, 1, 1, 2, 1, 1, 2], "General (M)": [4, 2, 2, 3, 2, 3, 1, 2], "Hero (M)": [4, 0, 2, 2, 2, 2, 1, 1], "Swordmaster (M)": [5, 2, 0, 0, 2, 1, 1, 1], "Assassin": [3, 1, 0, 0, 2, 2, 0, 0], "Sniper (M)": [3, 1, 2, 2, 2, 3, 1, 1], "Sniper (F)": [4, 3, 1, 1, 2, 2, 1, 1], "Nmd Trooper (M)": [3, 2, 1, 1, 3, 3, 1, 1], "Wyvern Lord (M)": [4, 0, 2, 2, 0, 2, 1, 1], "Sage (M)": [4, 1, 0, 0, 3, 3, 1, 1], "Sage (F)": [3, 1, 1, 0, 3, 3, 1, 1], "Bishop (M)": [3, 2, 1, 0, 3, 2, 1, 1], "Bishop (F)": [3, 1, 2, 1, 2, 2, 1, 1], "Druid (M)": [4, 0, 0, 3, 2, 2, 1, 1], "Warrior": [3, 1, 2, 0, 3, 3, 1, 2], "Berserker": [4, 1, 1, 1, 2, 2, 1, 3], "Falcoknight": [5, 2, 0, 0, 2, 2, 1, 1], "Valkyrie": [3, 2, 1, 0, 2, 3, 1, 1]}

const inStory = (story: string) => FE7_UNITS.filter((u) => u.story === story)
const byName = (story: string) => new Map(inStory(story).map((u) => [u.name, u]))
const join = (story: string, name: string) => {
  const u = byName(story).get(name)!
  return `${FE7_CHAPTERS.find((c) => c.id === u.joinChapter)!.label} ${u.join.how}`
}
// Where the game and Serenes Forest differ, each explained:
//  - Nils: the opening scene of Lyn's Chapter 7 places him at Lv 3 (the group at 0x08CC69C0); the turn-1 group's Lv 1 record then
//    finds his unit already made, and the loader keeps it (0x0800A618). Eliwood's and Hector's stories bring him in at Lv 3 too.
//    Serenes Forest lists Lv 1.
const LEVEL_EXCEPTIONS: Record<string, number> = { Nils: 3 }

describe('Blazing Blade units', () => {
  it('has three stories, with supports in two', () => {
    expect(FE7_STORIES.map((s) => [s.id, !!s.noSupports])).toEqual([
      ['lyn', true],
      ['eliwood', false],
      ['hector', false],
    ])
  })

  it("matches Serenes Forest's levels and bases in Lyn's story", () => {
    const units = byName('lyn')
    expect(units.size).toBe(Object.keys(SF_LYN_BASES).length)
    for (const [name, sf] of Object.entries(SF_LYN_BASES)) {
      const u = units.get(name)!
      expect([name, ...GBA_STATS.map((s) => u.bases[s])]).toEqual([name, ...sf.slice(1)])
      expect([name, u.level]).toEqual([name, LEVEL_EXCEPTIONS[name] ?? sf[0]])
    }
  })

  it("matches Serenes Forest's levels and bases in Eliwood's and Hector's stories", () => {
    for (const story of ['eliwood', 'hector']) {
      const units = byName(story)
      for (const [name, sf] of Object.entries(SF_BASES)) {
        const u = units.get(name)
        if (!u) {
          // Farina and Karla join in Hector's story only.
          expect([story, name]).toEqual([story, ['Farina', 'Karla'].includes(name) ? name : 'missing'])
          continue
        }
        expect([name, u.level, ...GBA_STATS.map((s) => u.bases[s])]).toEqual([name, ...sf])
      }
      const nils = units.get('Nils')!
      expect([nils.level, ...GBA_STATS.map((s) => nils.bases[s])]).toEqual([3, ...SF_LYN_BASES.Nils.slice(1)])
      expect(units.size).toBe(Object.keys(SF_BASES).length + 1 - (story === 'eliwood' ? 2 : 0))
    }
  })

  it("matches Serenes Forest's growth rates", () => {
    for (const [name, sf] of Object.entries(SF_GROWTHS)) {
      const names = name === 'Nils/Ninian' ? ['Nils', 'Ninian'] : [name]
      for (const n of names) {
        const units = FE7_UNITS.filter((u) => u.name === n)
        expect([n, units.length > 0]).toEqual([n, true])
        for (const u of units) expect([u.id, ...GBA_GROWING.map((s) => u.growths[s])]).toEqual([u.id, ...sf])
      }
    }
  })

  it("adds Serenes Forest's promotion gains: the class data's, with Con and Mov from the class", () => {
    for (const from of Object.values(FE7_CLASSES)) {
      if (!from.promotesTo) continue
      const to = FE7_CLASSES[from.promotesTo]
      const rows = Object.entries(SF_PROMOTION).filter(([n]) => n.replace(/ \((M|F)\)$/, '') === to.name)
      const ours = [...(['hp', 'str', 'skl', 'spd', 'def', 'res'] as const).map((s) => to.gains![s]), to.bases.mov - from.bases.mov, to.bases.con - from.bases.con]
      expect([from.name, to.name, rows.some(([, sf]) => sf.join() === ours.join())]).toEqual([from.name, to.name, true])
    }
  })

  it("joins where Serenes Forest's recruitment page says", () => {
    expect(join('lyn', 'Lyn')).toBe('Prologue start')
    expect(join('lyn', 'Wil')).toBe('Ch.3 visit')
    expect(join('lyn', 'Wallace')).toBe('Ch.9 start')
    expect(join('eliwood', 'Dorcas')).toBe('Ch.11 event')
    expect(join('hector', 'Dorcas')).toBe('Ch.12 start')
    expect(join('eliwood', 'Serra')).toBe('Ch.13 start')
    expect(join('hector', 'Matthew')).toBe('Ch.11 start')
    expect(join('eliwood', 'Merlinus')).toBe('Ch.13x end')
    expect(join('eliwood', 'Lyn')).toBe('Ch.15 start')
    expect(join('hector', 'Lyn')).toBe('Ch.16 start')
    expect(join('hector', 'Farina')).toBe('Ch.25 talk')
    expect(join('eliwood', 'Jaffar')).toBe('Ch.26 end')
    expect(join('hector', 'Karla')).toBe('Ch.31x talk')
    expect(join('eliwood', 'Renault')).toBe('Ch.30 visit')
    expect(join('eliwood', 'Athos')).toBe('Final start')
    expect(byName('eliwood').get('Harken')!.join.with).toEqual(['Eliwood', 'Hector', 'Oswin', 'Lowen', 'Marcus', 'Isadora'])
    expect(byName('hector').get('Karla')!.join.with).toEqual(['Bartre'])
    expect(byName('eliwood').get('Geitz')!.join.note).toMatch(/Linus/)
    // Serenes Forest: Hector and Oswin arrive "during turn 3". The event's turn is 4, and the turn check (0x080782FC) runs it when
    // the turn counter equals it, on your phase.
    expect(byName('eliwood').get('Hector')!.join.turn).toBe(4)
  })

  it('pairs every support both ways once, between units of the main story', () => {
    const keys = FE7_SUPPORTS.map((s) => [s.a, s.b].sort().join('|'))
    expect(new Set(keys).size).toBe(keys.length)
    const ids = new Set(FE7_UNITS.filter((u) => u.story !== 'lyn').map((u) => u.id))
    for (const s of FE7_SUPPORTS) expect([s.a, s.b].every((id) => ids.has(id))).toBe(true)
    expect(FE7_SUPPORTS.length).toBeGreaterThan(100)
  })
})
