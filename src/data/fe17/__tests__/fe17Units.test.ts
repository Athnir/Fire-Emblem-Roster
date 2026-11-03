import { describe, expect, it } from 'vitest'
import { FE17_CLASSES, FE17_UNITS } from '../fe17Units'

// Serenes Forest's Engage tables (fetched 2026-11-03), to check the data built from the user's own dump against.
// Bases: class, Lv, HP, Str, Mag, Dex, Spd, Def, Res, Lck, Bld.
const SF_BASES: Record<string, (string | number)[]> = {"Alear": ["Dragon Child", 1, 22, 6, 0, 5, 7, 5, 3, 5, 4], "Vander": ["Paladin", 1, 40, 11, 5, 10, 8, 10, 8, 6, 8], "Clanne": ["Mage", 1, 19, 1, 8, 11, 9, 4, 7, 4, 4], "Framme": ["Martial Monk", 1, 18, 3, 5, 8, 7, 4, 8, 5, 3], "Alfred": ["Noble", 5, 27, 9, 2, 10, 6, 8, 5, 8, 6], "Etie": ["Archer", 4, 21, 10, 0, 11, 6, 3, 2, 8, 4], "Boucheron": ["Axe Fighter", 4, 29, 10, 0, 8, 7, 6, 3, 5, 9], "Céline": ["Noble", 5, 22, 7, 9, 9, 10, 5, 7, 11, 4], "Chloé": ["Lance Flier", 6, 26, 8, 4, 13, 13, 5, 9, 10, 5], "Louis": ["Lance Armor", 6, 30, 13, 0, 11, 3, 16, 1, 4, 8], "Yunaka": ["Thief", 6, 25, 8, 5, 14, 12, 9, 7, 8, 5], "Alcryst": ["Lord", 10, 28, 11, 2, 17, 12, 8, 5, 8, 6], "Citrinne": ["Mage", 10, 24, 2, 15, 13, 10, 3, 12, 10, 4], "Lapis": ["Sword Fighter", 10, 26, 11, 2, 12, 14, 7, 6, 7, 5], "Diamant": ["Lord", 11, 32, 13, 3, 13, 13, 10, 6, 10, 9], "Amber": ["Lance Cavalier", 11, 31, 15, 2, 13, 11, 9, 3, 9, 8], "Jade": ["Axe Armor", 12, 33, 14, 4, 14, 5, 18, 6, 5, 8], "Ivy": ["Wing Tamer", 17, 32, 7, 17, 15, 13, 12, 15, 4, 7], "Kagetsu": ["Swordmaster", 1, 35, 17, 5, 22, 22, 14, 10, 17, 9], "Zelkov": ["Thief", 17, 35, 15, 3, 19, 19, 14, 5, 7, 9], "Fogado": ["Sentinel", 17, 33, 12, 7, 17, 18, 10, 11, 8, 8], "Pandreo": ["High Priest", 1, 34, 7, 16, 18, 17, 8, 22, 14, 8], "Bunet": ["Great Knight", 1, 41, 15, 5, 15, 9, 20, 8, 13, 11], "Timerra": ["Sentinel", 18, 35, 14, 6, 17, 18, 16, 8, 10, 5], "Panette": ["Berserker", 1, 46, 25, 3, 19, 13, 11, 7, 11, 11], "Merrin": ["Wolf Knight", 1, 36, 15, 10, 21, 21, 12, 12, 14, 9], "Hortensia": ["Wing Tamer", 19, 27, 5, 12, 21, 19, 6, 23, 17, 5], "Seadall": ["Dancer", 15, 33, 12, 4, 15, 16, 10, 10, 11, 8], "Rosado": ["Wyvern Knight", 3, 44, 16, 7, 19, 21, 15, 11, 8, 8], "Goldmary": ["Hero", 3, 40, 17, 2, 18, 20, 20, 12, 13, 9], "Lindon": ["Sage", 5, 38, 8, 19, 21, 19, 12, 21, 8, 10], "Saphir": ["Warrior", 7, 51, 24, 2, 23, 19, 19, 9, 15, 15], "Veyle": ["Fell Child", 35, 35, 20, 26, 24, 23, 17, 29, 18, 7], "Mauvier": ["Royal Knight", 12, 51, 21, 23, 25, 22, 26, 24, 16, 12], "Anna": ["Axe Fighter", 5, 29, 10, 2, 9, 7, 4, 5, 3, 7], "Jean": ["Martial Monk", 1, 19, 4, 5, 10, 7, 4, 8, 3, 3], "Nel": ["Fell Child", 20, 35, 14, 12, 17, 19, 14, 15, 16, 8], "Rafal": ["Fell Child", 20, 39, 19, 7, 17, 16, 20, 11, 12, 9], "Zelestia": ["Melusine", 20, 38, 17, 18, 16, 20, 15, 19, 7, 9], "Gregory": ["Sage", 1, 35, 10, 25, 13, 13, 13, 25, 9, 8], "Madeline": ["General", 1, 46, 24, 6, 12, 7, 27, 9, 9, 13]}
// Growths: HP, Str, Mag, Dex, Spd, Def, Res, Lck, Bld.
const SF_GROWTHS: Record<string, number[]> = {"Alear": [60, 35, 20, 45, 50, 40, 25, 25, 5], "Vander": [60, 25, 10, 25, 35, 35, 20, 10, 5], "Clanne": [40, 35, 10, 40, 50, 30, 25, 20, 5], "Framme": [55, 30, 25, 35, 55, 25, 30, 25, 0], "Alfred": [65, 40, 5, 35, 40, 40, 20, 40, 10], "Etie": [45, 40, 0, 25, 35, 25, 30, 25, 5], "Boucheron": [85, 20, 0, 50, 45, 35, 20, 15, 20], "Céline": [50, 35, 25, 30, 45, 30, 40, 50, 5], "Chloé": [75, 25, 35, 40, 55, 30, 25, 25, 5], "Louis": [75, 40, 0, 25, 25, 50, 20, 25, 15], "Yunaka": [50, 35, 25, 40, 45, 15, 45, 25, 5], "Alcryst": [65, 30, 10, 40, 45, 30, 20, 15, 10], "Citrinne": [45, 10, 40, 25, 30, 20, 40, 25, 5], "Lapis": [55, 25, 20, 35, 55, 35, 30, 25, 5], "Diamant": [75, 30, 15, 20, 40, 40, 25, 20, 15], "Amber": [65, 45, 0, 25, 30, 35, 5, 35, 15], "Jade": [55, 35, 25, 35, 30, 40, 30, 20, 10], "Ivy": [55, 25, 30, 25, 40, 30, 35, 15, 10], "Kagetsu": [60, 30, 15, 50, 50, 40, 25, 40, 10], "Zelkov": [65, 35, 15, 40, 35, 35, 15, 25, 10], "Fogado": [60, 30, 25, 30, 55, 30, 35, 25, 10], "Pandreo": [60, 5, 30, 45, 45, 15, 55, 30, 15], "Bunet": [65, 30, 10, 40, 35, 45, 25, 40, 10], "Timerra": [55, 25, 25, 45, 45, 30, 30, 30, 10], "Panette": [75, 45, 10, 40, 25, 30, 15, 20, 15], "Merrin": [55, 25, 25, 40, 50, 30, 30, 25, 10], "Hortensia": [40, 20, 20, 35, 50, 25, 55, 50, 0], "Seadall": [55, 25, 15, 25, 50, 25, 25, 35, 10], "Rosado": [75, 45, 25, 40, 45, 30, 30, 20, 5], "Goldmary": [65, 30, 5, 25, 25, 55, 25, 25, 5], "Lindon": [65, 25, 25, 25, 40, 25, 40, 15, 10], "Saphir": [80, 35, 0, 25, 30, 30, 5, 20, 10], "Veyle": [40, 25, 45, 35, 30, 25, 35, 20, 0], "Mauvier": [70, 35, 40, 40, 35, 50, 45, 15, 15], "Anna": [55, 15, 50, 50, 50, 20, 35, 45, 5], "Jean": [50, 20, 20, 35, 40, 25, 20, 25, 5], "Nel": [55, 30, 25, 40, 45, 30, 35, 30, 10], "Rafal": [70, 40, 10, 40, 35, 45, 20, 10, 10], "Zelestia": [60, 35, 35, 35, 50, 30, 35, 20, 5], "Gregory": [55, 30, 50, 20, 25, 35, 50, 25, 5], "Madeline": [75, 50, 20, 15, 15, 55, 25, 25, 10]}
// Cap modifiers: Str, Mag, Dex, Spd, Def, Res, Lck.
const SF_CAPS: Record<string, number[]> = {"Alear": [1, 0, 1, 1, 0, 0, 0], "Vander": [1, -1, 1, -2, 3, -2, 0], "Clanne": [1, -1, 2, 2, -2, -1, 0], "Framme": [0, 1, -1, 2, -1, -1, 1], "Alfred": [2, -1, 1, 0, 2, -2, -1], "Etie": [2, -2, 2, 0, 0, -1, -1], "Boucheron": [1, 0, 2, 2, -2, 0, -2], "Céline": [-2, 2, -2, 1, -3, 1, 3], "Chloé": [-2, 1, 0, 3, -1, 0, 0], "Louis": [1, 0, -1, -2, 3, -2, 1], "Yunaka": [-1, 0, 1, 2, -2, 2, -1], "Alcryst": [1, -1, 3, 0, 1, -2, -1], "Citrinne": [-1, 3, 0, -1, -2, 2, 0], "Lapis": [-2, -2, 2, 3, 0, 0, 0], "Diamant": [2, -1, -1, 0, 2, -1, 0], "Amber": [2, -1, -1, -1, 1, -1, 1], "Jade": [1, -1, 0, 0, 2, 0, -1], "Ivy": [0, 2, -2, 0, 2, 2, -3], "Kagetsu": [-1, -1, 2, 2, 0, -2, 1], "Zelkov": [0, -1, 2, 0, 0, -1, 1], "Fogado": [-1, -1, 0, 3, -1, 1, 0], "Pandreo": [-3, 2, 0, -1, -2, 3, 2], "Bunet": [1, -3, 1, 0, 2, -1, 1], "Timerra": [-1, -1, 3, 0, 2, -3, 1], "Panette": [3, -1, 0, 0, 0, -1, 0], "Merrin": [-1, -1, 1, 2, -1, 0, 1], "Hortensia": [-2, 0, 0, 1, -3, 3, 2], "Seadall": [0, -2, -1, 2, 0, 0, 2], "Rosado": [3, -2, 1, 0, 1, -2, 0], "Goldmary": [1, -3, 0, 0, 2, -1, 2], "Lindon": [0, 2, -1, 0, -2, 2, 0], "Saphir": [2, -2, 0, 1, 1, -2, 0], "Veyle": [0, 3, 0, -1, 0, 3, -2], "Mauvier": [1, 2, 1, -2, 1, 1, -2], "Anna": [0, 1, 1, 1, -2, -1, 1], "Jean": [0, 2, -1, -1, 0, 0, 1], "Nel": [0, 0, 0, 0, 0, 0, 0], "Rafal": [0, 0, 0, 0, 0, 0, 0], "Zelestia": [0, 1, 0, 2, 1, 1, -3], "Gregory": [-2, 3, -2, -2, 0, 3, 2], "Madeline": [3, 0, -2, -2, 3, -1, 0]}

const STATS = ['hp', 'str', 'mag', 'dex', 'spd', 'def', 'res', 'lck', 'bld'] as const
const byName = new Map(FE17_UNITS.map((u) => [u.name, u]))

describe('Engage units', () => {
  it('has the 41 playable units, the Expansion Pass\'s five among them', () => {
    expect(FE17_UNITS).toHaveLength(41)
    expect(FE17_UNITS.filter((u) => u.expansionPass).map((u) => u.name)).toEqual(['Nel', 'Rafal', 'Zelestia', 'Gregory', 'Madeline'])
  })

  it("matches Serenes Forest's classes, levels and join stats", () => {
    let n = 0
    for (const [name, [cls, level, ...stats]] of Object.entries(SF_BASES)) {
      const u = byName.get(name)
      if (!u) continue
      n++
      expect([name, FE17_CLASSES[u.classId].name, u.level, ...STATS.map((s) => u.joinStats[s])]).toEqual([name, cls, level, ...stats])
    }
    expect(n).toBe(41)
  })

  it("matches Serenes Forest's growths and cap modifiers", () => {
    for (const [name, sf] of Object.entries(SF_GROWTHS)) {
      const u = byName.get(name)!
      expect([name, ...STATS.map((s) => u.growths[s])]).toEqual([name, ...sf])
    }
    for (const [name, sf] of Object.entries(SF_CAPS)) {
      const u = byName.get(name)!
      expect([name, ...(['str', 'mag', 'dex', 'spd', 'def', 'res', 'lck'] as const).map((s) => u.capMods[s])]).toEqual([name, ...sf])
    }
  })
})
