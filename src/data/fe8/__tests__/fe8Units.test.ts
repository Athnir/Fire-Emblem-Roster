import { describe, expect, it } from 'vitest'
import { GBA_GROWING, GBA_STATS } from '../../../gba/types'
import { FE8_CHAPTERS, FE8_CLASSES, FE8_STORIES, FE8_SUPPORT_LEVELS, FE8_SUPPORTS, FE8_UNITS } from '../fe8Units'

// Serenes Forest's Sacred Stones tables, copied here to check the data built from the ROM against them.
// Base stats: Lv, HP, S/M, Skl, Spd, Lck, Def, Res, Con, Mov (characters/base-stats; its Orson in Chapter 5x, a guest who turns on you,
// left out: the postgame's is checked).
const SF_BASES: Record<string, number[]> = {"Eirika": [1, 16, 4, 8, 9, 5, 3, 1, 5, 5], "Seth": [1, 30, 14, 13, 12, 13, 11, 8, 11, 8], "Franz": [1, 20, 7, 5, 7, 2, 6, 1, 9, 7], "Gilliam": [4, 25, 9, 6, 3, 3, 9, 3, 14, 4], "Vanessa": [1, 17, 5, 7, 11, 4, 6, 5, 5, 7], "Moulder": [3, 20, 4, 6, 9, 1, 2, 5, 9, 5], "Ross": [1, 15, 5, 2, 3, 8, 3, 0, 8, 4], "Garcia": [4, 28, 8, 7, 7, 3, 5, 1, 14, 5], "Neimi": [1, 17, 4, 5, 6, 4, 3, 2, 5, 5], "Colm": [2, 18, 4, 4, 10, 8, 3, 1, 6, 6], "Artur": [2, 19, 6, 6, 8, 2, 2, 6, 6, 5], "Lute": [1, 17, 6, 6, 7, 8, 3, 5, 3, 5], "Natasha": [1, 18, 2, 4, 8, 6, 2, 6, 4, 5], "Joshua": [5, 24, 8, 13, 14, 7, 5, 2, 8, 5], "Ephraim": [4, 23, 8, 9, 11, 8, 7, 2, 8, 5], "Forde": [6, 24, 7, 8, 8, 7, 8, 2, 9, 7], "Kyle": [5, 25, 9, 6, 7, 6, 9, 1, 10, 7], "Tana": [4, 20, 7, 9, 13, 8, 6, 7, 5, 7], "Amelia": [1, 16, 4, 3, 4, 6, 2, 3, 6, 4], "Innes": [1, 31, 14, 13, 15, 14, 10, 9, 9, 6], "Gerik": [10, 32, 14, 13, 13, 8, 10, 4, 13, 5], "Tethys": [1, 18, 1, 2, 12, 10, 5, 4, 5, 5], "Marisa": [5, 23, 7, 12, 13, 9, 4, 3, 5, 5], "L'Arachel": [3, 18, 6, 6, 10, 12, 5, 8, 5, 6], "Dozla": [1, 43, 16, 11, 9, 4, 11, 6, 16, 6], "Saleh": [1, 30, 16, 18, 14, 11, 8, 13, 8, 6], "Ewan": [1, 15, 3, 2, 5, 5, 0, 3, 5, 4], "Cormag": [9, 30, 14, 9, 10, 4, 12, 2, 11, 7], "Rennac": [1, 28, 10, 16, 17, 5, 9, 11, 7, 6], "Duessel": [8, 41, 17, 12, 12, 8, 17, 9, 15, 6], "Knoll": [10, 22, 13, 9, 8, 0, 2, 10, 7, 5], "Myrrh": [1, 15, 3, 1, 5, 3, 2, 7, 5, 6], "Syrene": [1, 27, 12, 13, 15, 12, 10, 12, 7, 8], "Caellach": [12, 47, 19, 14, 13, 14, 15, 13, 13, 6], "Orson": [13, 48, 18, 15, 14, 6, 14, 11, 12, 8], "Riev": [16, 49, 14, 21, 19, 9, 16, 18, 7, 6], "Ismaire": [9, 33, 16, 20, 23, 12, 8, 15, 7, 6], "Selena": [11, 38, 13, 13, 16, 10, 11, 17, 6, 7], "Glen": [12, 46, 20, 17, 13, 7, 18, 5, 12, 8], "Hayden": [10, 37, 17, 14, 15, 17, 12, 12, 10, 7], "Valter": [13, 45, 19, 17, 17, 3, 13, 12, 11, 8], "Fado": [11, 46, 20, 14, 12, 5, 18, 11, 18, 5], "Lyon": [14, 44, 22, 13, 11, 4, 17, 19, 7, 6]}
// Growth rates: HP, S/M, Skl, Spd, Lck, Def, Res.
const SF_GROWTHS: Record<string, number[]> = {"Eirika": [70, 40, 60, 60, 60, 30, 30], "Seth": [90, 50, 45, 45, 25, 40, 30], "Franz": [80, 40, 40, 50, 40, 25, 20], "Gilliam": [90, 45, 35, 30, 30, 55, 20], "Moulder": [70, 40, 50, 40, 20, 25, 25], "Vanessa": [50, 35, 55, 60, 50, 20, 30], "Ross": [70, 50, 35, 30, 40, 25, 20], "Garcia": [80, 65, 40, 20, 40, 25, 15], "Neimi": [55, 45, 50, 60, 50, 15, 35], "Colm": [75, 40, 40, 65, 45, 25, 20], "Artur": [55, 50, 50, 40, 25, 15, 55], "Lute": [45, 65, 30, 45, 45, 15, 40], "Natasha": [50, 60, 25, 40, 60, 15, 55], "Joshua": [80, 35, 55, 55, 30, 20, 20], "Ephraim": [80, 55, 55, 45, 50, 35, 25], "Forde": [85, 40, 50, 45, 35, 20, 25], "Kyle": [90, 50, 40, 40, 20, 25, 20], "Tana": [65, 45, 40, 65, 60, 20, 25], "Amelia": [60, 35, 40, 40, 50, 30, 15], "Innes": [75, 40, 40, 45, 45, 20, 25], "Gerik": [90, 45, 40, 30, 30, 35, 25], "Tethys": [85, 5, 10, 70, 80, 30, 75], "Marisa": [75, 30, 55, 60, 50, 15, 25], "L'Arachel": [45, 50, 45, 45, 65, 15, 50], "Dozla": [85, 50, 35, 40, 30, 30, 25], "Saleh": [50, 30, 25, 40, 40, 30, 35], "Ewan": [50, 45, 40, 35, 50, 15, 40], "Cormag": [85, 55, 40, 45, 35, 25, 15], "Rennac": [65, 25, 45, 60, 25, 25, 30], "Duessel": [85, 55, 40, 30, 20, 45, 30], "Knoll": [70, 50, 40, 35, 20, 10, 45], "Myrrh": [130, 90, 85, 65, 30, 150, 30], "Syrene": [70, 40, 50, 60, 30, 20, 50], "Caellach": [85, 50, 45, 45, 20, 30, 20], "Orson": [80, 55, 45, 40, 25, 45, 30], "Riev": [75, 45, 50, 40, 15, 20, 45], "Ismaire": [75, 30, 60, 55, 30, 20, 25], "Selena": [85, 40, 55, 40, 25, 20, 30], "Glen": [85, 45, 50, 45, 20, 35, 40], "Hayden": [70, 40, 45, 45, 40, 25, 25], "Valter": [80, 40, 55, 50, 15, 20, 20], "Fado": [85, 55, 40, 30, 25, 45, 25], "Lyon": [85, 50, 55, 55, 30, 45, 55]}

// Promotion gains (classes/promotion-gains): from, to, HP, S/M, Skl, Spd, Def, Res, Con, Mov. Its trainee rows for "Recruit (2)" and
// the like aren't in the game's promotion table (0x95DFA4), so they're not checked.
const SF_PROMOTION: [string, string, ...number[]][] = [["Lord (Eirika)", "Great Lord (Eirika)", 4, 2, 2, 1, 3, 5, 2, 2], ["Lord (Ephraim)", "Great Lord (Ephraim)", 4, 2, 3, 2, 2, 5, 2, 2], ["Recruit", "Cavalier (F)", 1, 0, 2, 2, 0, 2, 3, 3], ["Recruit", "Knight (F)", 2, 1, 1, 1, 2, 0, 4, 0], ["Recruit", "Recruit (2)", 2, 1, 1, 1, 2, 1, 0, 1], ["Cavalier (M)", "Paladin (M)", 2, 1, 1, 1, 2, 1, 2, 1], ["Cavalier (F)", "Paladin (F)", 1, 1, 1, 2, 1, 2, 0, 1], ["Cavalier (M)", "Great Knight (M)", 3, 2, 1, 2, 2, 1, 4, -1], ["Cavalier (F)", "Great Knight (F)", 3, 1, 1, 2, 2, 2, 1, -1], ["Knight (M)", "General (M)", 4, 2, 2, 3, 2, 3, 2, 1], ["Knight (F)", "General (F)", 3, 2, 3, 2, 3, 3, 1, 1], ["Knight (M)", "Great Knight (M)", 3, 2, 1, 2, 2, 1, 0, 2], ["Knight (F)", "Great Knight (F)", 3, 1, 1, 2, 2, 2, 0, 2], ["Recruit (2)", "Paladin (F)", 1, 1, 1, 2, 1, 2, 3, 3], ["Recruit (2)", "Recruit (3)", 2, 2, 1, 1, 2, 1, 0, 1], ["Thief", "Assassin", 3, 1, 0, 0, 2, 2, 2, 0], ["Thief", "Rogue", 2, 1, 1, 0, 2, 2, 1, 0], ["Mercenary", "Hero", 4, 1, 2, 2, 2, 2, 2, 1], ["Mercenary", "Ranger (M)", 3, 2, 1, 1, 3, 3, 0, 2], ["Myrmidon (M)", "Swordmaster (M)", 5, 2, 0, 0, 2, 1, 1, 1], ["Myrmidon (F)", "Swordmaster (F)", 4, 2, 1, 0, 2, 1, 2, 1], ["Myrmidon (M)", "Assassin (M)", 3, 1, 0, 0, 2, 2, 0, 1], ["Myrmidon (F)", "Assassin (F)", 2, 1, 1, 1, 2, 1, 1, 1], ["Archer (M)", "Sniper (M)", 3, 1, 2, 2, 2, 3, 1, 1], ["Archer (F)", "Sniper (F)", 4, 3, 1, 1, 2, 2, 1, 1], ["Archer (M)", "Ranger (M)", 3, 2, 1, 1, 3, 3, 2, 2], ["Archer (F)", "Ranger (F)", 2, 2, 2, 1, 3, 3, 3, 2], ["Wyvern Rider", "Wyvern Lord", 4, 2, 2, 0, 2, 0, 1, 1], ["Wyvern Rider", "Wyvern Knight (M)", 3, 1, 2, 3, 0, 1, 0, 1], ["Pupil", "Mage (M)", 1, 0, 1, 2, 1, 2, 1, 1], ["Pupil", "Shaman (M)", 1, 2, 0, 1, 1, 2, 2, 1], ["Pupil", "Pupil (2)", 2, 1, 1, 0, 2, 2, 0, 1], ["Mage (M)", "Sage (M)", 4, 1, 0, 0, 3, 3, 1, 1], ["Mage (F)", "Sage (F)", 3, 1, 1, 0, 3, 3, 1, 1], ["Mage (M)", "Mage Knight (M)", 4, 2, 0, 0, 2, 2, 2, 2], ["Mage (F)", "Mage Knight (F)", 3, 2, 1, 0, 2, 2, 3, 2], ["Shaman", "Druid", 4, 0, 0, 3, 2, 2, 1, 1], ["Shaman", "Summoner", 3, 0, 1, 3, 1, 3, 1, 1], ["Pupil (2)", "Sage (M)", 4, 1, 0, 0, 3, 3, 2, 1], ["Pupil (2)", "Pupil (3)", 4, 2, 0, 1, 3, 3, 0, 1], ["Priest", "Bishop (M)", 3, 2, 1, 0, 3, 2, 2, 1], ["Priest", "Sage (M)", 4, 1, 0, 0, 3, 3, 2, 1], ["Monk", "Bishop (M)", 3, 2, 1, 0, 3, 2, 1, 1], ["Monk", "Sage (M)", 4, 1, 0, 0, 3, 3, 1, 1], ["Cleric", "Bishop (F)", 3, 1, 2, 1, 2, 2, 1, 1], ["Cleric", "Valkyrie", 3, 2, 1, 0, 2, 3, 2, 2], ["Journeyman", "Fighter", 2, 2, 1, 0, 0, 1, 3, 1], ["Journeyman", "Pirate", 2, 2, 0, 1, 1, 0, 2, 1], ["Journeyman", "Journeyman (2)", 2, 0, 2, 0, 2, 2, 0, 1], ["Fighter", "Warrior", 3, 1, 2, 0, 3, 3, 2, 1], ["Fighter", "Hero", 4, 1, 2, 2, 2, 2, 0, 1], ["Pirate", "Berserker", 4, 1, 1, 1, 2, 2, 3, 1], ["Pirate", "Warrior", 3, 1, 2, 0, 3, 3, 3, 1], ["Journeyman (2)", "Hero", 4, 1, 2, 2, 2, 2, 3, 1], ["Journeyman (2)", "Journeyman (3)", 4, 1, 2, 2, 2, 2, 0, 1], ["Pegasus Knight", "Falcoknight", 5, 2, 0, 2, 2, 2, 1, 1], ["Pegasus Knight", "Wyvern Knight (F)", 3, 2, 1, 2, 1, 1, 4, 1], ["Troubadour", "Valkyrie", 3, 2, 1, 0, 2, 3, 1, 1], ["Troubadour", "Mage Knight (F)", 3, 2, 1, 0, 2, 2, 1, 1]]

const byStory = (story?: string) => FE8_UNITS.filter((u) => !u.story || u.story === story)
const unitIn = (story: string | undefined, name: string) => byStory(story).find((u) => u.name === name)!
const join = (story: string | undefined, name: string) => {
  const u = unitIn(story, name)
  return `${FE8_CHAPTERS.find((c) => c.id === u.joinChapter)!.label} ${u.join.how}`
}
const plain = (name: string) => name.replace(/ \(.*\)$/, '').replace('Kn.', 'Knight')

// Where the game and Serenes Forest differ, each explained. Serenes Forest gives one row per character; a placement record with the
// auto-level bit (0x08017C28 -> 0x08018160) sets the unit to the character's own level and rolls one real level-up for each level the
// record is above it, so on these routes the unit joins higher, its extra levels shown as the average:
//  - Duessel on Eirika's route: Lv 10 (2 level-ups); Knoll on Eirika's: Lv 10 (1; Serenes Forest's Lv 10 row adds HP and Str +1
//    to his Lv 9 bases); Innes and Saleh on Ephraim's: Lv 3 and Lv 4 (2 each).
//  - Knoll on Ephraim's route: his record (in Chapter 14's ending) says Lv 10 without the auto-level bit, so he's Lv 10 with his Lv 9
//    bases.
const EXCEPTIONS: Record<string, number> = { 'Duessel/eirika': 10, 'Knoll/eirika': 10, 'Innes/ephraim': 3, 'Saleh/ephraim': 4, 'Knoll/ephraim': 10 }

describe('Sacred Stones units', () => {
  it('joins higher where a record auto-levels, as the game does', () => {
    for (const [key, level] of Object.entries(EXCEPTIONS)) {
      const [name, story] = key.split('/')
      const u = FE8_UNITS.find((v) => v.name === name && v.story === story)!
      const sf = SF_BASES[name]
      expect([key, u.level]).toEqual([key, level])
      // The characters' own levels (+0x0B): Duessel 8, Knoll 9, Innes 1, Saleh 2.
      const extra = key === 'Knoll/ephraim' ? 0 : level - ({ Duessel: 8, Knoll: 9, Innes: 1, Saleh: 2 } as Record<string, number>)[name]
      // Bases (Serenes Forest's, less Knoll's added level) plus the average of the extra level-ups.
      const lower = name === 'Knoll' ? { hp: 1, str: 1 } : {}
      for (const s of GBA_GROWING) {
        const base = sf[1 + GBA_STATS.indexOf(s)] - ((lower as Record<string, number>)[s] ?? 0)
        expect([key, s, u.bases[s]]).toEqual([key, s, Math.round(Math.min(base + (u.growths[s]! / 100) * extra, FE8_CLASSES[u.classId].caps[s]!) * 100) / 100])
      }
    }
  })

  it('has two routes', () => {
    expect(FE8_STORIES.map((s) => s.id)).toEqual(['eirika', 'ephraim'])
  })

  it("matches Serenes Forest's levels and bases", () => {
    for (const [name, sf] of Object.entries(SF_BASES)) {
      const units = FE8_UNITS.filter((u) => u.name === name)
      expect([name, units.length > 0]).toEqual([name, true])
      for (const u of units) {
        if (EXCEPTIONS[`${name}/${u.story}`]) continue
        expect([name, u.level, ...GBA_STATS.map((s) => u.bases[s])]).toEqual([name, ...sf])
      }
    }
    expect(new Set(FE8_UNITS.map((u) => u.name)).size).toBe(Object.keys(SF_BASES).length)
  })

  it("matches Serenes Forest's growth rates", () => {
    for (const [name, sf] of Object.entries(SF_GROWTHS)) {
      for (const u of FE8_UNITS.filter((v) => v.name === name)) expect([u.id, ...GBA_GROWING.map((s) => u.growths[s])]).toEqual([u.id, ...sf])
    }
  })

  it("adds Serenes Forest's promotion gains: the promotion table's classes, with the class data's gains", () => {
    let checked = 0
    for (const from of Object.values(FE8_CLASSES)) {
      for (const toId of from.promotions ?? []) {
        const to = FE8_CLASSES[toId]
        const ours = [...(['hp', 'str', 'skl', 'spd', 'def', 'res'] as const).map((s) => to.gains![s]), to.bases.con! - from.bases.con!, to.bases.mov! - from.bases.mov!]
        const rows = SF_PROMOTION.filter(([, t]) => plain(t) === plain(to.name))
        expect([from.name, to.name, rows.some(([, , ...sf]) => sf.join() === ours.join())]).toEqual([from.name, to.name, true])
        checked++
      }
    }
    expect(checked).toBeGreaterThan(30)
  })

  it('branches promotions as the game does; trainees promote at Lv 10', () => {
    const named = (id: string) => FE8_CLASSES[id].name
    const of = (unit: string) => FE8_CLASSES[unitIn(undefined, unit).classId]
    expect(of('Franz').promotions!.map(named)).toEqual(['Paladin', 'Great Knight'])
    expect(of('Ross').promotions!.map(named)).toEqual(['Fighter', 'Pirate'])
    expect(of('Ross').maxLevel).toBe(10)
    expect(of('Eirika').promotions!.map(named)).toEqual(['Great Lord'])
  })

  it("joins where Serenes Forest's recruitment page says", () => {
    expect(join(undefined, 'Seth')).toBe('Prologue start')
    expect(join(undefined, 'Franz')).toBe('Ch.1 event')
    // Serenes Forest: at the end of Chapter 1. Its end scene loads them on Castle Frelia's map; they're yours from Chapter 2.
    expect(join(undefined, 'Vanessa')).toBe('Ch.2 start')
    expect(join(undefined, 'Lute')).toBe('Ch.4 visit')
    expect(join(undefined, 'Ephraim')).toBe('Ch.5x start')
    expect(join('eirika', 'Innes')).toBe('Ch.10 talk')
    expect(join('ephraim', 'Innes')).toBe('Ch.15 start')
    expect(join('ephraim', 'Duessel')).toBe('Ch.10 talk')
    expect(unitIn('ephraim', 'Cormag').join.with).toEqual(['Duessel', 'Tana'])
    expect(join('eirika', 'Duessel')).toBe('Ch.15 event')
    expect(join('ephraim', 'Knoll')).toBe('Ch.14 end')
    expect(join('eirika', 'Myrrh')).toBe('Ch.16 start')
    expect(join('ephraim', 'Myrrh')).toBe('Ch.16 start')
    expect(unitIn('eirika', 'Rennac').join.with).toEqual(["L'Arachel", 'Eirika'])
    expect(unitIn('eirika', 'Rennac').join.note).toMatch(/9,980 gold/)
    expect(join('ephraim', 'Syrene')).toBe('Ch.17 talk')
    expect(join(undefined, 'Lyon')).toBe('Postgame unlock')
  })

  it('pairs every support both ways once, with C, B and A at over 80, 160 and 240 points', () => {
    const keys = FE8_SUPPORTS.map((s) => [s.a, s.b].sort().join('|'))
    expect(new Set(keys).size).toBe(keys.length)
    expect(FE8_SUPPORT_LEVELS).toEqual([81, 161, 241])
    expect(FE8_SUPPORTS.length).toBeGreaterThan(80)
  })
})
