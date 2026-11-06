import { describe, expect, it } from 'vitest'
import {
  FE2_CHAPTERS,
  FE2_CLASSES,
  FE2_CLASS_CHANGE_SPELLS,
  FE2_EXPECTED_GROWTHS,
  FE2_GROWTH_CHANCE,
  FE2_SOV_CLASS_NAMES,
  FE2_SOV_NAMES,
  FE2_SPELLS,
  FE2_UNITS,
  FE2_VILLAGER_CLASSES,
} from '../fe2Units'

// Serenes Forest's Gaiden tables (fetched 2026-11-05), under its own romanised names, to check the data built from the user's ROM against.
// Bases: army, Lv, HP, Str, Skl, Spd, Lck, Def, Res, Mov.
const SF_BASES: Record<string, (string | number)[]> = {"Arum": ["alm", 1, 28, 10, 7, 6, 7, 6, 4, 5], "Ruka": ["alm", 2, 22, 10, 4, 4, 2, 6, 2, 4], "Grey": ["alm", 5, 24, 9, 4, 4, 2, 4, 2, 4], "Robin": ["alm", 2, 22, 7, 2, 6, 4, 3, 4, 4], "Cliff": ["alm", 1, 20, 7, 1, 2, 10, 3, 8, 4], "Silk": ["alm", 1, 18, 8, 3, 4, 4, 1, 11, 4], "Clea": ["alm", 1, 20, 8, 4, 7, 11, 4, 8, 7], "Clerbe": ["alm", 6, 26, 12, 7, 7, 6, 7, 1, 7], "Fols": ["alm", 4, 28, 11, 4, 5, 3, 7, 5, 4], "Paison": ["alm", 3, 24, 10, 3, 4, 2, 5, 4, 4], "Ryuto": ["alm", 7, 28, 12, 9, 7, 2, 5, 8, 4], "Machilda": ["alm", 1, 26, 12, 14, 12, 13, 7, 10, 8], "Dute": ["alm", 3, 22, 11, 8, 10, 15, 3, 15, 4], "Teeta": ["alm", 1, 28, 14, 12, 10, 2, 3, 18, 5], "Zeke": ["alm", 3, 40, 20, 13, 14, 4, 14, 6, 9], "Maisen": ["alm", 7, 44, 22, 14, 11, 3, 18, 8, 9], "Cellica": ["celica", 1, 20, 8, 6, 6, 8, 4, 7, 4], "May": ["celica", 1, 20, 9, 1, 7, 5, 2, 10, 4], "Boowy": ["celica", 1, 22, 8, 2, 4, 9, 4, 7, 4], "Jenny": ["celica", 1, 18, 7, 2, 5, 7, 1, 13, 4], "Sevr": ["celica", 1, 22, 9, 9, 10, 6, 4, 6, 4], "Valbo": ["celica", 1, 30, 14, 4, 2, 1, 12, 0, 4], "Kamui": ["celica", 3, 24, 10, 5, 8, 2, 6, 2, 4], "Leo": ["celica", 4, 23, 11, 6, 4, 6, 4, 1, 4], "Paola": ["celica", 8, 28, 12, 9, 10, 4, 6, 5, 7], "Katua": ["celica", 5, 24, 11, 12, 12, 12, 5, 9, 7], "Atlas": ["celica", 10, 30, 14, 3, 3, 4, 5, 4, 4], "Jessey": ["celica", 6, 28, 11, 10, 12, 9, 5, 7, 4], "Sonia": ["celica", 5, 24, 13, 11, 12, 4, 5, 12, 4], "Deen": ["celica", 5, 32, 13, 17, 17, 6, 9, 4, 5], "Est": ["celica", 3, 20, 9, 5, 11, 5, 4, 12, 7], "Norma": ["celica", 7, 28, 12, 16, 8, 1, 6, 14, 4]}
// Growths: HP, Str, Skl, Spd, Lck, Def (Serenes gives Res 0 for everyone: Res never grows).
const SF_GROWTHS: Record<string, number[]> = {"Arum": [50, 35, 40, 30, 20, 30], "Ruka": [40, 15, 35, 15, 20, 20], "Grey": [40, 30, 20, 10, 10, 20], "Robin": [30, 10, 40, 15, 30, 10], "Cliff": [50, 20, 40, 50, 20, 40], "Silk": [20, 30, 30, 30, 30, 10], "Clea": [20, 30, 50, 40, 50, 10], "Clerbe": [40, 20, 20, 20, 20, 20], "Fols": [30, 40, 10, 20, 20, 10], "Paison": [40, 40, 15, 20, 10, 15], "Ryuto": [40, 20, 20, 15, 50, 15], "Machilda": [40, 30, 20, 40, 10, 30], "Dute": [30, 50, 30, 20, 30, 10], "Teeta": [40, 10, 15, 15, 20, 40], "Zeke": [40, 20, 35, 55, 30, 30], "Maisen": [20, 5, 5, 5, 0, 5], "Cellica": [30, 25, 40, 30, 40, 20], "May": [20, 40, 20, 10, 10, 20], "Boowy": [40, 30, 15, 10, 20, 40], "Jenny": [20, 40, 40, 15, 20, 20], "Sevr": [50, 20, 15, 15, 10, 40], "Valbo": [40, 20, 35, 25, 10, 20], "Kamui": [30, 25, 20, 40, 20, 20], "Leo": [50, 20, 20, 10, 10, 30], "Paola": [40, 40, 15, 10, 10, 30], "Katua": [30, 30, 30, 40, 20, 20], "Atlas": [30, 30, 20, 10, 15, 20], "Jessey": [40, 25, 40, 40, 20, 25], "Sonia": [30, 30, 30, 30, 30, 30], "Deen": [40, 20, 15, 15, 10, 10], "Est": [30, 40, 50, 30, 50, 50], "Norma": [10, 10, 15, 15, 10, 10]}
// The chapter each is recruited in.
const SF_CHAPTER: Record<string, number> = {"Arum": 1, "Ruka": 1, "Grey": 1, "Robin": 1, "Cliff": 1, "Silk": 1, "Clea": 1, "Clerbe": 1, "Fols": 1, "Paison": 1, "Ryuto": 3, "Machilda": 3, "Dute": 3, "Teeta": 4, "Zeke": 4, "Maisen": 4, "Cellica": 2, "May": 2, "Boowy": 2, "Jenny": 2, "Sevr": 2, "Valbo": 2, "Kamui": 2, "Leo": 2, "Paola": 3, "Katua": 3, "Atlas": 3, "Jessey": 3, "Sonia": 3, "Deen": 3, "Est": 3, "Norma": 4}
// Serenes Forest's names -> the app's ids (Shadows of Valentia's names).
const ID: Record<string, string> = {"Arum": "fe2-alm", "Ruka": "fe2-lukas", "Grey": "fe2-gray", "Robin": "fe2-tobin", "Cliff": "fe2-kliff", "Silk": "fe2-silque", "Clea": "fe2-clair", "Clerbe": "fe2-clive", "Fols": "fe2-forsyth", "Paison": "fe2-python", "Ryuto": "fe2-luthier", "Machilda": "fe2-mathilda", "Dute": "fe2-delthea", "Teeta": "fe2-tatiana", "Zeke": "fe2-zeke", "Maisen": "fe2-mycen", "Cellica": "fe2-celica", "May": "fe2-mae", "Boowy": "fe2-boey", "Jenny": "fe2-genny", "Sevr": "fe2-saber", "Valbo": "fe2-valbar", "Kamui": "fe2-kamui", "Leo": "fe2-leon", "Paola": "fe2-palla", "Katua": "fe2-catria", "Atlas": "fe2-atlas", "Jessey": "fe2-jesse", "Sonia": "fe2-sonya", "Deen": "fe2-deen", "Est": "fe2-est", "Norma": "fe2-nomah"}
// Magic levels: a number, Auto (known on joining) or the class whose class change gives it.
const SF_MAGIC: Record<string, Record<string, number | string>> = {
  Grey: { Fire: 'Mage', Thunder: 10, Arrow: 9, Recover: 'Sage' },
  Robin: { Fire: 'Mage', Excalibur: 6, Recover: 'Sage' },
  Cliff: { Fire: 'Mage', Thunder: 4, Excalibur: 7, Arrow: 11, Aura: 20, Recover: 'Sage' },
  Ryuto: { Fire: 'Auto', Thunder: 10, Excalibur: 'Auto', Arrow: 15, Recover: 'Sage' },
  Dute: { Fire: 'Auto', Rainarok: 16, Angel: 11, Aura: 'Auto', Recover: 'Priest' },
  Cellica: { Fire: 'Auto', Thunder: 8, Rainarok: 20, Angel: 5, Excalibur: 15, Recover: 9 },
  Boowy: { Fire: 'Auto', Thunder: 3, Excalibur: 18, Arrow: 12, Recover: 'Sage' },
  May: { Fire: 'Auto', Thunder: 'Auto', Angel: 14, Aura: 9, Recover: 'Priest' },
  Sevr: { Fire: 'Mage', Angel: 5, Recover: 'Sage' },
  Kamui: { Fire: 'Mage', Excalibur: 7, Recover: 'Sage' },
  Atlas: { Fire: 'Mage', Arrow: 16, Recover: 'Sage' },
  Jessey: { Fire: 'Mage', Thunder: 9, Excalibur: 2, Recover: 'Sage' },
  Sonia: { Fire: 'Auto', Thunder: 'Auto', Angel: 14, Excalibur: 'Auto', Arrow: 18, Recover: 'Priest' },
  Deen: { Fire: 'Mage', Arrow: 3, Recover: 'Sage' },
  Norma: { Fire: 'Auto', Excalibur: 'Auto', Arrow: 'Auto', Recover: 'Auto' },
  Silk: { Recover: 'Auto', Resire: 'Auto', Warp: 7, Illusion: 18, Dear: 14, Angel: 'Saint' },
  Teeta: { Reblow: 'Auto', Resire: 'Auto', Warp: 8, Reserve: 4, Illusion: 7, Angel: 'Auto' },
  Jenny: { Recover: 'Auto', Reblow: 8, Resire: 'Auto', Illusion: 4, Dear: 12, Angel: 'Saint' },
}
// Serenes' spell names -> the translation's.
const SPELL: Record<string, string> = { Rainarok: 'Ragnarok', Excalibur: 'Excaliber', Reblow: 'Libro', Resire: 'Drain' }
const CHANGE_CLASS: Record<string, string> = { Mage: '15', Sage: '19', Priest: '11', Saint: '17' }

const unitById = new Map(FE2_UNITS.map((u) => [u.id, u]))
const sovClass = (id: string) => FE2_SOV_CLASS_NAMES[id] ?? id
const chapterOf = (id: string) => FE2_CHAPTERS.find((c) => c.id === id)!
const STATS = ['hp', 'str', 'skl', 'spd', 'lck', 'def', 'res', 'mov'] as const
const GROWING = ['hp', 'str', 'skl', 'spd', 'lck', 'def'] as const

describe('Gaiden units', () => {
  it("matches Serenes Forest's armies, levels and bases", () => {
    // The one exception is the ROM's: Valbar's record gives Skl 5 (8:$91B4; Shadows of Valentia's Valbar has 5 too), Serenes 4.
    expect(FE2_UNITS).toHaveLength(32)
    expect(FE2_UNITS.filter((u) => u.story === 'alm')).toHaveLength(16)
    for (const [name, [army, level, ...stats]] of Object.entries(SF_BASES)) {
      const u = unitById.get(ID[name])!
      const want = STATS.map((s, i) => (name === 'Valbo' && s === 'skl' ? 5 : stats[i]))
      expect([name, u.story, u.level, ...STATS.map((s) => u.bases[s])]).toEqual([name, army, level, ...want])
    }
  })

  it("matches Serenes Forest's growth rates", () => {
    for (const [name, sf] of Object.entries(SF_GROWTHS)) {
      const u = unitById.get(ID[name])!
      expect([name, ...GROWING.map((s) => u.growths[s])]).toEqual([name, ...sf])
    }
  })

  it("joins in Serenes Forest's chapters, by talking to the army's leader", () => {
    for (const [name, chapter] of Object.entries(SF_CHAPTER)) {
      const u = unitById.get(ID[name])!
      const c = chapterOf(u.joinChapter)
      expect([name, c.story, c.label]).toEqual([name, u.story, `Ch.${chapter}`])
      if (name === 'Arum' || name === 'Cellica') expect(u.join.how).toBe('start')
      else expect([name, u.join.how, u.join.with]).toEqual([name, 'talk', [u.story === 'alm' ? 'Alm' : 'Celica']])
    }
    expect(unitById.get('fe2-deen')!.join.note).toContain('Only one of Deen and Sonya joins')
    expect(unitById.get('fe2-jesse')!.join.note).toContain("Only Celica's army finds him")
    expect(unitById.get('fe2-mycen')!.join.note).toContain('who his father is')
  })

  it("changes class as Serenes Forest's promotion page has it", () => {
    const change = (id: string) => {
      const c = FE2_CLASSES[id]
      return [sovClass(id), c.promoteLevel, (c.promotions ?? []).map(sovClass)]
    }
    expect(change('14')).toEqual(['Villager', 3, ['Cavalier', 'Mercenary', 'Archer', 'Mage', 'Soldier']])
    expect(change('8')).toEqual(['Mercenary', 7, ['Myrmidon']])
    expect(change('9')).toEqual(['Myrmidon', 10, ['Dread Fighter']])
    expect(change('10')).toEqual(['Dread Fighter', 10, ['Villager']])
    expect(change('6')).toEqual(['Soldier', 7, ['Knight']])
    expect(change('2')).toEqual(['Knight', 10, ['Baron']])
    expect(change('12')).toEqual(['Archer', 7, ['Sniper']])
    expect(change('13')).toEqual(['Sniper', 10, ['Bow Knight']])
    expect(change('1')).toEqual(['Cavalier', 7, ['Paladin']])
    expect(change('4')).toEqual(['Paladin', 10, ['Gold Knight']])
    expect(change('15')).toEqual(['Mage', 12, ['Sage']])
    expect(change('16')).toEqual(['Mage', 20, ['Priestess']])
    expect(change('3')).toEqual(['Pegasus Knight', 12, ['Falcon Knight']])
    expect(change('18')).toEqual(['Cleric', 12, ['Saint']])
    expect(change('21')).toEqual(['Fighter', 1, ['Hero']])
    expect(change('11c')).toEqual(['Priestess', 1, ['Princess']])
    expect(change('11')).toEqual(['Priestess', undefined, []])
    expect(FE2_CLASSES['21'].storyPromotion).toContain('Hark')
    expect(FE2_CLASSES['11c'].storyPromotion).toContain('Fort Geeth')
    // A Villager's class is a random byte x 5 / 256: one value more for the first.
    expect(Object.values(FE2_VILLAGER_CLASSES).reduce((a, b) => a + b, 0)).toBeCloseTo(1)
    expect(FE2_VILLAGER_CLASSES['1']).toBe(52 / 256)
  })

  it('holds HP at 52 and the other stats at 40, Lv 20 in every class; Res is the unit\'s own, +15 as a Dread Fighter', () => {
    for (const c of Object.values(FE2_CLASSES)) {
      expect(c.caps).toEqual({ hp: 52, str: 40, skl: 40, spd: 40, lck: 40, def: 40 })
      expect(c.maxLevel).toBe(20)
      expect(c.bases.res).toBe(c.id === '10' ? 15 : 0)
    }
  })

  it("learns spells at Serenes Forest's levels", () => {
    // The one exception is the ROM's: Nomah ("Norma") knows Thunder on joining (8:$90E2 + 3 x 12 + 10 = $B3: Fire, Thunder, Excaliber,
    // Arrow, Recover); Serenes leaves Thunder out.
    for (const [name, spells] of Object.entries(SF_MAGIC)) {
      const plan = FE2_SPELLS[ID[name]]
      for (const [spell, when] of Object.entries(spells)) {
        const s = SPELL[spell] ?? spell
        if (when === 'Auto') expect([name, plan.known]).toEqual([name, expect.arrayContaining([s])])
        else if (typeof when === 'string') expect([name, s]).toEqual([name, FE2_CLASS_CHANGE_SPELLS[CHANGE_CLASS[when]]])
        else {
          const l = plan.learn.find((x) => x.spell === s)!
          expect([name, s, l.atLevel ?? l.level]).toEqual([name, s, when])
        }
      }
    }
    expect(FE2_SPELLS['fe2-nomah'].known).toContain('Thunder')
  })

  it('rolls a growth G at ceil(256 (G - 1) / 99) / 256, and a level-up with no stat adds 1 HP', () => {
    expect(FE2_GROWTH_CHANCE[0]).toBe(0)
    expect(FE2_GROWTH_CHANCE[1]).toBe(0)
    expect(FE2_GROWTH_CHANCE[50]).toBeCloseTo(127 / 256)
    expect(FE2_GROWTH_CHANCE[100]).toBe(1)
    for (const u of FE2_UNITS) {
      const e = FE2_EXPECTED_GROWTHS[u.id]
      for (const s of ['str', 'skl', 'spd', 'lck', 'def'] as const) expect(e[s]! / 100).toBeCloseTo(FE2_GROWTH_CHANCE[u.growths[s]!], 2)
      expect(e.hp! / 100).toBeGreaterThanOrEqual(FE2_GROWTH_CHANCE[u.growths.hp!] - 0.005)
    }
    // Mycen's 5% growths: most level-ups give only the 1 HP.
    expect(FE2_EXPECTED_GROWTHS['fe2-mycen'].hp).toBeGreaterThan(80)
  })

  it("names every unit Shadows of Valentia's way, with the translation's name beside it where it differs", () => {
    expect(Object.keys(FE2_SOV_NAMES).sort()).toEqual(FE2_UNITS.map((u) => u.id).sort())
    for (const u of FE2_UNITS) expect(u.name).toBe(FE2_SOV_NAMES[u.id])
    // The translation's menus fit four or five letters; its dialogue spells some out.
    expect(unitById.get('fe2-tobin')!.altName).toBe('Bird')
    expect(unitById.get('fe2-palla')!.altName).toBe('Pala')
    expect(unitById.get('fe2-clive')!.altName).toBe('Cleve')
    expect(unitById.get('fe2-alm')!.altName).toBeUndefined()
  })
})

