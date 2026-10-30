import { describe, expect, it } from 'vitest'
import { FE9_DATA } from '../../../games/fe9'
import { chaptersNeeded, learnableSkills, project, supportsOf } from '../../../tellius/logic'
import { TELLIUS_STATS } from '../../../tellius/types'

// Serenes Forest's Path of Radiance tables (characters/base-stats, growth-rates, supports; miscellaneous/skills),
// copied here to check the data built from the game's files against them.
// Base stats: Lv, HP, Str, Mag, Skl, Spd, Lck, Def, Res, Mov, Con, Wt.
const SF_BASES: Record<string, number[]> = {"Ike": [1, 19, 5, 1, 6, 7, 6, 5, 0, 6, 9, 9], "Titania": [1, 33, 12, 4, 13, 14, 11, 11, 7, 9, 8, 31], "Oscar": [3, 26, 6, 1, 6, 7, 5, 8, 0, 8, 10, 33], "Boyd": [2, 30, 7, 0, 4, 6, 4, 5, 0, 6, 10, 10], "Rhys": [4, 22, 0, 10, 8, 5, 8, 0, 14, 5, 8, 8], "Shinon": [1, 32, 9, 6, 15, 13, 9, 9, 6, 7, 9, 10], "Gatrie": [9, 31, 12, 0, 6, 5, 5, 14, 0, 5, 12, 16], "Soren": [1, 18, 0, 6, 8, 8, 5, 2, 7, 5, 6, 6], "Mia": [6, 21, 7, 0, 10, 13, 6, 7, 2, 6, 6, 6], "Ilyana": [6, 20, 1, 8, 10, 9, 6, 3, 10, 5, 5, 5], "Marcia": [5, 20, 8, 0, 7, 11, 4, 8, 6, 8, 6, 22], "Mist": [1, 16, 1, 4, 4, 7, 6, 2, 7, 5, 5, 5], "Rolf": [1, 18, 5, 0, 8, 6, 4, 6, 2, 6, 4, 4], "Lethe": [3, 34, 12, 4, 10, 12, 15, 9, 7, 7, 6, 21], "Mordecai": [2, 41, 15, 2, 8, 8, 10, 13, 4, 7, 18, 33], "Volke": [10, 25, 12, 0, 13, 13, 7, 7, 3, 7, 11, 11], "Kieran": [12, 30, 11, 1, 10, 12, 8, 10, 1, 8, 10, 33], "Brom": [8, 28, 10, 1, 9, 7, 4, 13, 2, 5, 13, 17], "Nephenee": [7, 22, 8, 2, 10, 11, 6, 9, 3, 6, 8, 10], "Zihark": [10, 25, 10, 1, 13, 15, 6, 7, 0, 6, 9, 10], "Jill": [8, 24, 11, 0, 10, 9, 6, 11, 2, 8, 7, 35], "Sothe": [1, 20, 5, 1, 7, 11, 5, 4, 0, 7, 6, 6], "Astrid": [1, 20, 6, 2, 6, 7, 3, 5, 4, 8, 7, 29], "Makalov": [10, 30, 9, 2, 7, 10, 8, 10, 2, 8, 10, 33], "Stefan": [8, 38, 19, 8, 27, 25, 5, 12, 9, 7, 13, 13], "Muarim": [9, 45, 16, 4, 13, 15, 11, 12, 5, 7, 14, 29], "Tormod": [7, 20, 2, 10, 9, 9, 8, 4, 9, 5, 6, 6], "Devdan": [4, 36, 14, 7, 15, 13, 16, 11, 10, 7, 12, 16], "Tanith": [10, 32, 16, 10, 18, 24, 18, 15, 13, 9, 8, 25], "Reyson": [3, 22, 1, 10, 11, 14, 15, 2, 20, 5, 8, 5], "Janaff": [8, 39, 13, 5, 15, 17, 16, 11, 10, 6, 6, 6], "Ulki": [7, 41, 15, 4, 14, 12, 10, 14, 9, 6, 10, 10], "Calill": [6, 32, 8, 19, 18, 18, 16, 8, 17, 6, 7, 7], "Tauroneo": [14, 48, 22, 11, 18, 13, 14, 22, 14, 6, 10, 15], "Ranulf": [9, 46, 19, 4, 17, 17, 13, 17, 6, 7, 9, 24], "Haar": [11, 47, 21, 8, 19, 17, 12, 20, 10, 9, 13, 42], "Lucia": [12, 36, 15, 12, 21, 23, 16, 10, 8, 7, 8, 8], "Bastian": [13, 35, 12, 19, 21, 16, 15, 12, 20, 6, 10, 10], "Geoffrey": [11, 43, 18, 9, 17, 19, 12, 21, 9, 9, 11, 35], "Largo": [7, 52, 21, 4, 21, 20, 12, 10, 3, 7, 15, 17], "Elincia": [1, 27, 9, 12, 16, 18, 15, 11, 15, 9, 6, 23], "Ena": [10, 52, 20, 9, 17, 15, 14, 23, 21, 5, 6, 11], "Nasir": [18, 56, 20, 11, 23, 22, 17, 24, 27, 5, 12, 17], "Tibarn": [18, 63, 30, 11, 31, 24, 24, 26, 19, 6, 14, 14], "Naesala": [17, 57, 25, 15, 26, 31, 19, 21, 16, 6, 11, 10], "Giffca": [20, 68, 32, 10, 28, 25, 22, 25, 16, 7, 17, 37], "Leanne": [1, 20, 0, 12, 13, 13, 7, 1, 23, 5, 5, 2]}
const SF_GROWTHS: Record<string, number[]> = {"Ike": [75, 50, 20, 50, 55, 35, 40, 40], "Titania": [80, 45, 25, 60, 50, 45, 40, 45], "Oscar": [55, 45, 20, 50, 45, 30, 35, 30], "Boyd": [75, 60, 5, 50, 45, 35, 25, 25], "Rhys": [40, 5, 60, 50, 40, 50, 25, 55], "Shinon": [75, 65, 20, 70, 65, 35, 50, 40], "Gatrie": [80, 55, 5, 55, 25, 25, 60, 30], "Soren": [45, 5, 60, 55, 40, 30, 15, 55], "Mia": [50, 40, 30, 45, 60, 45, 20, 25], "Ilyana": [45, 25, 50, 45, 30, 45, 15, 50], "Marcia": [55, 40, 20, 50, 55, 40, 25, 30], "Mist": [50, 35, 50, 25, 40, 60, 15, 40], "Rolf": [60, 40, 20, 45, 50, 40, 30, 25], "Lethe": [130, 50, 5, 65, 70, 50, 40, 25], "Mordecai": [150, 65, 0, 55, 50, 40, 40, 20], "Volke": [65, 50, 5, 55, 65, 35, 20, 10], "Kieran": [60, 50, 15, 50, 40, 25, 40, 30], "Brom": [75, 45, 10, 50, 25, 20, 55, 25], "Nephenee": [55, 40, 20, 55, 55, 25, 35, 25], "Zihark": [55, 45, 15, 50, 60, 40, 30, 20], "Sothe": [60, 55, 10, 70, 65, 55, 35, 30], "Jill": [60, 40, 30, 45, 45, 25, 35, 30], "Astrid": [45, 40, 20, 55, 50, 40, 30, 25], "Makalov": [60, 55, 5, 45, 50, 25, 45, 20], "Stefan": [70, 50, 20, 40, 55, 25, 35, 30], "Tormod": [50, 20, 45, 40, 45, 35, 25, 45], "Muarim": [145, 70, 5, 70, 55, 35, 60, 45], "Devdan": [75, 60, 30, 40, 35, 40, 45, 25], "Reyson": [65, 5, 40, 50, 50, 60, 15, 50], "Ulki": [140, 60, 10, 65, 60, 35, 35, 25], "Janaff": [130, 55, 10, 70, 65, 40, 30, 25], "Tanith": [60, 40, 35, 70, 40, 30, 25, 30], "Calill": [50, 25, 45, 45, 45, 30, 40, 35], "Tauroneo": [60, 55, 5, 50, 30, 15, 60, 40], "Ranulf": [130, 50, 0, 55, 55, 35, 35, 20], "Haar": [65, 60, 5, 60, 35, 15, 45, 20], "Lucia": [70, 50, 30, 70, 65, 50, 40, 40], "Bastian": [55, 40, 65, 65, 55, 30, 35, 50], "Geoffrey": [65, 50, 25, 55, 55, 20, 45, 45], "Largo": [80, 70, 5, 45, 45, 30, 25, 20], "Elincia": [60, 30, 80, 45, 40, 60, 25, 35], "Ena": [145, 35, 5, 50, 60, 40, 40, 30], "Nasir": [150, 50, 10, 55, 45, 35, 60, 25], "Tibarn": [145, 70, 5, 70, 65, 50, 60, 25], "Naesala": [135, 60, 40, 70, 75, 20, 55, 35], "Giffca": [160, 75, 5, 70, 60, 40, 50, 30]}
// Chapters together for C / B / A, each pair listed under both units.
const SF_SUPPORTS: Record<string, Record<string, number[]>> = {"Ike": {"Titania": [8, 11, 26], "Oscar": [5, 8, 11], "Soren": [5, 12, 19], "Lethe": [4, 9, 14], "Reyson": [5, 8, 11], "Ranulf": [1, 2, 3], "Elincia": [1, 1, 2]}, "Titania": {"Ike": [8, 11, 26], "Boyd": [7, 15, 20], "Rhys": [5, 8, 11], "Mist": [3, 6, 9]}, "Oscar": {"Ike": [5, 8, 11], "Kieran": [2, 5, 8], "Janaff": [3, 6, 8], "Tanith": [3, 6, 9]}, "Boyd": {"Titania": [7, 15, 20], "Mist": [6, 10, 17], "Brom": [4, 8, 11], "Ulki": [2, 5, 8]}, "Rhys": {"Titania": [5, 8, 11], "Mia": [4, 8, 12], "Rolf": [3, 6, 9], "Kieran": [3, 6, 9], "Ulki": [4, 7, 10]}, "Shinon": {"Gatrie": [3, 8, 10], "Rolf": [0, 2, 4], "Janaff": [1, 4, 8]}, "Gatrie": {"Shinon": [3, 8, 10], "Ilyana": [4, 8, 12], "Marcia": [3, 7, 10], "Astrid": [3, 6, 11]}, "Soren": {"Ike": [5, 12, 19], "Stefan": [4, 9, 12]}, "Mia": {"Rhys": [4, 8, 12], "Ilyana": [4, 8, 12], "Largo": [1, 2, 3]}, "Ilyana": {"Gatrie": [4, 8, 12], "Mia": [4, 8, 12], "Mordecai": [2, 5, 8], "Zihark": [4, 9, 14], "Lucia": [1, 2, 3]}, "Marcia": {"Gatrie": [3, 7, 10], "Rolf": [2, 5, 8], "Kieran": [3, 7, 11], "Tanith": [1, 5, 9]}, "Mist": {"Titania": [3, 6, 9], "Boyd": [6, 10, 17], "Rolf": [1, 3, 7], "Mordecai": [3, 6, 9], "Jill": [1, 3, 5]}, "Rolf": {"Rhys": [3, 6, 9], "Shinon": [0, 2, 4], "Marcia": [2, 5, 8], "Mist": [1, 3, 7], "Tauroneo": [1, 3, 5]}, "Lethe": {"Ike": [4, 9, 14], "Jill": [2, 4, 10], "Muarim": [3, 6, 9], "Ranulf": [1, 2, 3]}, "Mordecai": {"Ilyana": [2, 5, 8], "Mist": [3, 6, 9], "Stefan": [2, 4, 11], "Ulki": [3, 5, 7], "Ranulf": [1, 2, 3]}, "Volke": {"Bastian": [0, 1, 2]}, "Kieran": {"Oscar": [2, 5, 8], "Rhys": [3, 6, 9], "Marcia": [3, 7, 11]}, "Brom": {"Boyd": [4, 8, 11], "Nephenee": [4, 8, 11], "Zihark": [3, 6, 9]}, "Nephenee": {"Brom": [4, 8, 11], "Devdan": [2, 5, 8], "Calill": [1, 3, 5]}, "Zihark": {"Ilyana": [4, 9, 14], "Brom": [3, 6, 9], "Muarim": [3, 6, 9]}, "Sothe": {"Astrid": [3, 7, 11], "Tormod": [3, 6, 9]}, "Jill": {"Mist": [1, 3, 5], "Lethe": [2, 4, 10], "Haar": [1, 2, 4]}, "Astrid": {"Gatrie": [3, 6, 11], "Sothe": [3, 7, 11], "Makalov": [3, 6, 10]}, "Makalov": {"Astrid": [3, 6, 10], "Haar": [1, 3, 5], "Bastian": [1, 3, 4]}, "Stefan": {"Soren": [4, 9, 12], "Mordecai": [2, 4, 11]}, "Tormod": {"Sothe": [3, 6, 9], "Devdan": [1, 4, 7], "Reyson": [1, 3, 5], "Calill": [2, 4, 6]}, "Muarim": {"Lethe": [3, 6, 9], "Zihark": [3, 6, 9], "Largo": [1, 2, 3]}, "Devdan": {"Nephenee": [2, 5, 8], "Tormod": [1, 4, 7], "Largo": [1, 2, 3]}, "Reyson": {"Ike": [5, 8, 11], "Tormod": [1, 3, 5], "Tanith": [2, 6, 11]}, "Ulki": {"Boyd": [2, 5, 8], "Rhys": [4, 7, 10], "Mordecai": [3, 5, 7]}, "Janaff": {"Oscar": [3, 6, 8], "Shinon": [1, 4, 8], "Lucia": [1, 2, 3]}, "Tanith": {"Oscar": [3, 6, 9], "Marcia": [1, 5, 9], "Reyson": [2, 6, 11]}, "Calill": {"Nephenee": [1, 3, 5], "Tormod": [2, 4, 6], "Geoffrey": [1, 2, 3]}, "Tauroneo": {"Rolf": [1, 3, 5], "Largo": [1, 2, 3]}, "Ranulf": {"Ike": [1, 2, 3], "Lethe": [1, 2, 3], "Mordecai": [1, 2, 3]}, "Haar": {"Jill": [1, 2, 4], "Makalov": [1, 3, 5]}, "Lucia": {"Ilyana": [1, 2, 3], "Janaff": [1, 2, 3], "Bastian": [0, 2, 3]}, "Bastian": {"Volke": [0, 1, 2], "Makalov": [1, 3, 4], "Lucia": [0, 2, 3]}, "Geoffrey": {"Calill": [1, 2, 3], "Elincia": [1, 2, 2]}, "Largo": {"Mia": [1, 2, 3], "Muarim": [1, 2, 3], "Devdan": [1, 2, 3], "Tauroneo": [1, 2, 3]}, "Elincia": {"Ike": [1, 1, 2], "Geoffrey": [1, 2, 2]}}
// Recruitment: the chapter each unit joins in ('Final' is the Endgame).
const SF_RECRUITMENT: Record<string, string> = {"Ike": "Prologue", "Titania": "1", "Oscar": "1", "Boyd": "1", "Rhys": "2", "Shinon": "3", "Gatrie": "3", "Soren": "4", "Mia": "7", "Ilyana": "8", "Mist": "9", "Rolf": "9", "Marcia": "9", "Lethe": "10", "Mordecai": "10", "Volke": "10", "Kieran": "11", "Brom": "11", "Nephenee": "11", "Zihark": "11", "Sothe": "12", "Jill": "12", "Astrid": "13", "Makalov": "14", "Tormod": "15", "Muarim": "15", "Stefan": "15", "Devdan": "16", "Tanith": "18", "Reyson": "18", "Janaff": "18", "Ulki": "18", "Calill": "20", "Tauroneo": "21", "Haar": "23", "Ranulf": "23", "Bastian": "24", "Lucia": "24", "Geoffrey": "25", "Largo": "25", "Elincia": "26", "Nasir": "28", "Ena": "28", "Tibarn": "Final", "Naesala": "Final", "Giffca": "Final"}
// Affinities (characters/other-data, from its icons' file names).
const SF_AFFINITY: Record<string, string> = {"Ike": "Earth", "Titania": "Light", "Oscar": "Earth", "Boyd": "Fire", "Rhys": "Fire", "Shinon": "Thunder", "Gatrie": "Light", "Soren": "Dark", "Mia": "Fire", "Ilyana": "Light", "Marcia": "Fire", "Mist": "Water", "Rolf": "Wind", "Lethe": "Sky", "Mordecai": "Water", "Volke": "Wind", "Kieran": "Wind", "Brom": "Water", "Nephenee": "Wind", "Zihark": "Earth", "Jill": "Thunder", "Sothe": "Wind", "Astrid": "Wind", "Makalov": "Thunder", "Stefan": "Sky", "Muarim": "Thunder", "Tormod": "Fire", "Devdan": "Fire", "Tanith": "Earth", "Reyson": "Fire", "Janaff": "Thunder", "Ulki": "Water", "Calill": "Dark", "Tauroneo": "Thunder", "Ranulf": "Wind", "Haar": "Wind", "Lucia": "Earth", "Bastian": "Wind", "Geoffrey": "Fire", "Largo": "Wind", "Elincia": "Sky", "Ena": "Earth", "Nasir": "Light", "Tibarn": "Sky", "Naesala": "Dark", "Giffca": "Dark"}
const SF_SKILL_CAPACITY: Record<string, number> = {"Nihil": 15, "Vantage": 10, "Adept": 10, "Wrath": 10, "Miracle": 5, "Resolve": 10, "Counter": 10, "Guard": 10, "Corrode": 10, "Parity": 5, "Gamble": 10, "Smite": 10, "Celerity": 15, "Tempest": 5, "Serenity": 5, "Provoke": 5, "Shade": 5, "Renewal": 15, "Saviour": 10, "Paragon": 15, "Reinforce": 15, "Blossom": 15, "Canto": 20, "Insight": 0, "Vigilance": 0, "Daunt": 10, "Mantle": 0, "Discipline": 0, "Iron Wall": 5, "Lumina": 0, "Knife": 0, "Steal": 0, "Aether": 20, "Stun": 20, "Flare": 20, "Sol": 20, "Astra": 20, "Luna": 20, "Colossus": 20, "Deadeye": 20, "Lethality": 20, "Roar": 20, "Cancel": 20, "Vortex": 20, "Blessing": 20, "Boon": 20}

const unitByName = new Map(FE9_DATA.units.map((u) => [u.name, u]))
// Serenes lists Leanne's stats, but no placement file or script puts her on your side: she's only ever a
// green unit (side 2), carried or watching.
const NOT_PLAYABLE = new Set(['Leanne'])

describe('Path of Radiance units', () => {
  it('has every playable unit Serenes Forest lists, and no others', () => {
    expect(FE9_DATA.units.map((u) => u.name).sort()).toEqual(Object.keys(SF_BASES).filter((n) => !NOT_PLAYABLE.has(n)).sort())
  })

  it("matches Serenes Forest's levels, bases, Mov, Con and Wt", () => {
    // The one exception: Serenes lists Rhys at 22/0/10/8/5/8/0/14; the game's files give 20/0/8/7/4/6/0/12
    // (PersonData + JobData, like every other unit). It's under Rhys's `unconfirmed` for an in-game check.
    for (const [name, sf] of Object.entries(SF_BASES)) {
      if (NOT_PLAYABLE.has(name)) continue
      const unit = unitByName.get(name)!
      const cls = FE9_DATA.classes[unit.classId]
      const ours = [unit.level, ...TELLIUS_STATS.map((s) => unit.bases[s]), cls.mov, unit.con, unit.wt]
      if (name === 'Rhys') {
        expect(ours).toEqual([4, 20, 0, 8, 7, 4, 6, 0, 12, 5, 8, 8])
        expect(unit.unconfirmed).toBeDefined()
        continue
      }
      expect([name, ...ours]).toEqual([name, ...sf])
    }
  })

  it("matches Serenes Forest's growth rates", () => {
    for (const [name, sf] of Object.entries(SF_GROWTHS)) {
      if (NOT_PLAYABLE.has(name)) continue
      const unit = unitByName.get(name)!
      expect([name, ...TELLIUS_STATS.map((s) => unit.growths[s])]).toEqual([name, ...sf])
    }
  })

  it("matches Serenes Forest's affinities", () => {
    // Serenes' icon for Heaven is named "sky"; the game's own name (common.m, MDV_HV) is Heaven.
    for (const [name, affinity] of Object.entries(SF_AFFINITY)) {
      expect([name, unitByName.get(name)!.affinity]).toEqual([name, affinity === 'Sky' ? 'Heaven' : affinity])
    }
  })

  it("joins every unit in Serenes Forest's recruitment chapter", () => {
    // Serenes counts the first chapter they can be deployed in. Kieran, Brom and Nephenee are freed during Ch.10
    // (their handover is in C11.cmb); Tormod and Muarim join at the start of Ch.16, which Serenes lists as after Ch.15.
    const counted: Record<string, string> = { Kieran: '10', Brom: '10', Nephenee: '10', Tormod: '16', Muarim: '16' }
    for (const [name, chapter] of Object.entries(SF_RECRUITMENT)) {
      const unit = unitByName.get(name)!
      const label = FE9_DATA.chapters.find((c) => c.id === unit.joinChapter)!.label
      const expected = counted[name] ?? chapter
      const ours = label === 'Prologue' ? 'Prologue' : label === 'Endgame' ? 'Final' : label.replace('Ch.', '')
      expect([name, ours]).toEqual([name, expected])
    }
  })

  it('says how every talk recruit joins and who talks to them', () => {
    for (const unit of FE9_DATA.units.filter((u) => u.join.how === 'talk')) expect(unit.join.with?.length).toBeGreaterThan(0)
  })

  it('joins every unit in a chapter of the story', () => {
    const ids = new Set(FE9_DATA.chapters.map((c) => c.id))
    for (const unit of FE9_DATA.units) expect(ids.has(unit.joinChapter)).toBe(true)
  })
})

describe('Path of Radiance supports', () => {
  it("matches every pair's chapters on Serenes Forest (the game's totals less the levels already reached)", () => {
    let pairs = 0
    for (const [name, partners] of Object.entries(SF_SUPPORTS)) {
      const unit = unitByName.get(name)!
      const ours = Object.fromEntries(supportsOf(FE9_DATA, unit.id).map(({ partner, support }) => [partner.name, chaptersNeeded(support)]))
      expect([name, ours]).toEqual([name, partners])
      pairs += Object.keys(partners).length
    }
    expect(pairs).toBe(FE9_DATA.supports.length * 2)
  })
})

describe('Path of Radiance skills', () => {
  it("matches Serenes Forest's capacities", () => {
    const byName = new Map(Object.values(FE9_DATA.skills).map((s) => [s.name, s]))
    // Serenes' spellings. Not listed here, since no playable unit or class has them and they can't be learned:
    // Iron Wall (unused), Mantle (Sephiran's) and Discipline.
    const alias: Record<string, string> = { Saviour: 'Savior', Corrode: 'Corrosion' }
    const notListed = new Set(['Iron Wall', 'Mantle', 'Discipline'])
    for (const [name, cap] of Object.entries(SF_SKILL_CAPACITY)) {
      if (notListed.has(name)) {
        expect(byName.has(name)).toBe(false)
        continue
      }
      const skill = byName.get(alias[name] ?? name)
      expect([name, skill?.capacity]).toEqual([name, cap])
    }
  })

  it('teaches only skills with a scroll the game names', () => {
    const ike = unitByName.get('Ike')!
    const names = learnableSkills(FE9_DATA, ike, 'JID_HERO').map((id) => FE9_DATA.skills[id].name)
    expect(names).toContain('Vantage')
    expect(names).toContain('Aether')
    // Daunt's and Celerity's scroll items (IID_HORROR, IID_SWIFT) have no name, and Sol is a Paladin's.
    expect(names).not.toContain('Daunt')
    expect(names).not.toContain('Celerity')
    expect(names).not.toContain('Sol')
  })

  it('limits the mastery skills to their classes', () => {
    const sol = Object.values(FE9_DATA.skills).find((s) => s.name === 'Sol')!
    expect(sol.onlyClasses?.map((id) => FE9_DATA.classes[id]?.name).filter(Boolean)).toContain('Paladin')
  })
})

describe('Path of Radiance level projection', () => {
  it("adds Serenes Forest's promotion gains (Ranger to Lord: HP +4, Str +3, Mag +2, Skl +2, Spd +2, Def +3, Res +2)", () => {
    const ike = unitByName.get('Ike')!
    const stages = project(FE9_DATA, ike, { promoteAt: 1, targetLevel: 1 })
    const before = stages[0].stats
    const after = stages[stages.length - 1].stats
    expect(TELLIUS_STATS.map((s) => after[s] - before[s])).toEqual([4, 3, 2, 2, 2, 0, 3, 2])
    expect(stages[stages.length - 1].mov).toBe(7)
  })

  it('holds stats at the class caps', () => {
    const ike = unitByName.get('Ike')!
    const final = project(FE9_DATA, ike, { promoteAt: 20, targetLevel: 20 }).at(-1)!
    for (const s of TELLIUS_STATS) expect(final.stats[s]).toBeLessThanOrEqual(final.caps[s])
  })
})
