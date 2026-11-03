import { describe, expect, it } from 'vitest'
import { FE1_CHAPTERS, FE1_CLASSES, FE1_UNITS } from '../fe1Units'

// Serenes Forest's FE1 tables (fetched 2026-11-03), to check the data built from the user's own dump against.
// Bases: class, Lv, HP, Str, Skl, Wlv, Spd, Lck (null where Serenes gives none), Def, Res, Mov.
const SF_BASES: Record<string, (string | number | null)[]> = {"Marth": ["Lord", 1, 18, 5, 3, 5, 7, 7, 7, 0, 7], "Caeda": ["Pegasus Knight", 1, 16, 3, 6, 7, 12, 9, 7, 0, 8], "Jagen": ["Paladin", 1, 20, 7, 10, 10, 8, 1, 9, 0, 10], "Cain": ["Cavalier", 1, 18, 7, 5, 5, 6, 3, 7, 0, 9], "Abel": ["Cavalier", 1, 18, 6, 7, 6, 7, 2, 7, 0, 9], "Draug": ["Knight", 1, 18, 7, 3, 4, 3, 1, 11, 0, 5], "Gordin": ["Archer", 1, 16, 5, 1, 5, 4, 4, 6, 0, 5], "Wrys": ["Curate", 1, 16, 1, 5, 3, 7, 1, 3, 0, 5], "Ogma": ["Mercenary", 2, 20, 6, 11, 6, 12, 3, 6, 0, 7], "Barst": ["Fighter", 5, 24, 10, 6, 6, 9, 5, 6, 0, 6], "Bord": ["Fighter", 3, 20, 8, 4, 5, 7, 1, 5, 0, 6], "Cord": ["Fighter", 3, 20, 7, 5, 3, 9, 5, 5, 0, 6], "Castor": ["Hunter", 3, 21, 7, 2, 6, 6, null, 4, 0, 6], "Darros": ["Pirate", 3, 21, 6, 2, 6, 7, null, 5, 0, 6], "Julian": ["Thief", 3, 17, 4, 6, 2, 12, 7, 4, 0, 7], "Lena": ["Curate", 3, 16, 1, 7, 7, 8, 8, 3, 0, 5], "Navarre": ["Mercenary", 3, 19, 5, 9, 9, 11, null, 6, 0, 7], "Merric": ["Mage", 1, 20, 1, 3, 5, 6, 3, 4, 0, 6], "Matthis": ["Cavalier", 2, 16, 5, 2, 8, 6, null, 7, 0, 9], "Hardin": ["Cavalier", 6, 20, 9, 7, 9, 8, 3, 8, 0, 9], "Wolf": ["Horseman", 3, 18, 5, 5, 6, 9, 5, 4, 0, 9], "Sedgar": ["Horseman", 1, 16, 4, 3, 3, 7, 2, 4, 0, 9], "Roshea": ["Cavalier", 3, 18, 6, 5, 7, 7, 4, 7, 0, 8], "Vyland": ["Cavalier", 1, 16, 5, 3, 4, 6, 2, 7, 0, 9], "Wendell": ["Bishop", 1, 22, 3, 1, 10, 14, null, 8, 0, 6], "Rickard": ["Thief", 1, 16, 3, 1, 2, 9, null, 2, 0, 7], "Bantu": ["Manakete", 1, 18, 2, 3, 2, 4, 1, 3, 0, 6], "Caesar": ["Mercenary", 3, 17, 5, 8, 6, 12, 6, 7, 0, 7], "Radd": ["Mercenary", 1, 16, 4, 8, 6, 10, 1, 6, 0, 7], "Roger": ["Knight", 5, 22, 7, 3, 9, 5, null, 13, 0, 5], "Jeorge": ["Sniper", 1, 24, 7, 10, 10, 12, 4, 8, 0, 7], "Maria": ["Curate", 3, 19, 2, 2, 8, 2, null, 4, 0, 5], "Minerva": ["Wyvern Knight", 1, 22, 9, 3, 10, 6, null, 14, 0, 10], "Linde": ["Mage", 1, 20, 1, 4, 7, 7, 7, 3, 0, 6], "Jake": ["Ballistician", 1, 20, 5, 1, 8, 3, null, 14, 0, 4], "Midia": ["Paladin", 1, 20, 7, 11, 10, 9, 7, 9, 0, 10], "Dolph": ["Knight", 4, 20, 8, 6, 7, 5, 3, 12, 0, 5], "Macellan": ["Knight", 3, 18, 8, 5, 5, 3, 4, 11, 0, 5], "Tomas": ["Archer", 8, 20, 7, 6, 9, 5, 4, 6, 0, 5], "Boah": ["Bishop", 1, 22, 4, 7, 10, 15, 4, 6, 0, 6], "Beck": ["Ballistician", 1, 20, 6, 4, 8, 3, 5, 14, 0, 4], "Astram": ["Hero", 1, 24, 8, 14, 10, 14, 3, 8, 0, 7], "Palla": ["Pegasus Knight", 8, 25, 7, 8, 12, 14, null, 9, 0, 8], "Catria": ["Pegasus Knight", 3, 19, 5, 6, 10, 12, null, 7, 0, 8], "Arran": ["Paladin", 1, 24, 8, 8, 10, 11, 4, 10, 0, 10], "Samson": ["Hero", 1, 24, 10, 14, 10, 15, 7, 9, 0, 7], "Xane": ["Freelancer", 1, 16, 1, 1, 2, 10, null, 4, 0, 6], "Est": ["Pegasus Knight", 5, 22, 6, 7, 11, 13, null, 8, 0, 8], "Tiki": ["Manakete", 5, 24, 3, 3, 9, 3, null, 5, 0, 6], "Lorenz": ["General", 5, 34, 11, 3, 15, 6, null, 16, 0, 5], "Elice": ["Curate", 4, 16, 1, 5, 7, 7, 1, 3, 0, 5], "Gotoh": ["Bishop", 18, 38, 10, 20, 20, 20, 16, 15, 7, 6]}
// Growths: HP, Str, Skl, Wlv, Spd, Lck, Def (Res never grows).
const SF_GROWTHS: Record<string, number[]> = {"Marth": [90, 50, 40, 30, 50, 70, 20], "Caeda": [50, 20, 70, 80, 90, 70, 20], "Jagen": [10, 10, 10, 0, 10, 0, 0], "Cain": [90, 30, 60, 60, 60, 50, 20], "Abel": [70, 40, 50, 70, 50, 40, 20], "Draug": [60, 20, 40, 20, 40, 20, 10], "Gordin": [40, 30, 30, 50, 30, 40, 10], "Wrys": [20, 0, 0, 20, 10, 10, 0], "Ogma": [80, 40, 20, 70, 30, 40, 20], "Barst": [60, 50, 50, 30, 50, 70, 50], "Bord": [90, 50, 50, 20, 10, 30, 50], "Cord": [100, 30, 20, 50, 40, 40, 40], "Castor": [70, 60, 40, 20, 40, 20, 20], "Darros": [90, 50, 0, 20, 10, 10, 40], "Julian": [80, 70, 50, 0, 50, 80, 30], "Lena": [0, 0, 0, 30, 20, 40, 0], "Navarre": [90, 50, 40, 30, 50, 40, 10], "Merric": [80, 0, 30, 80, 50, 50, 20], "Matthis": [50, 40, 30, 70, 20, 20, 20], "Hardin": [50, 30, 50, 70, 60, 30, 20], "Wolf": [70, 50, 10, 60, 20, 70, 20], "Sedgar": [90, 30, 20, 30, 10, 10, 20], "Roshea": [80, 40, 50, 30, 10, 10, 10], "Vyland": [50, 30, 10, 70, 20, 10, 10], "Wendell": [60, 10, 30, 70, 20, 40, 10], "Rickard": [50, 50, 20, 0, 60, 40, 20], "Bantu": [10, 0, 10, 0, 0, 10, 0], "Caesar": [80, 30, 30, 30, 20, 10, 20], "Radd": [90, 50, 40, 50, 70, 40, 10], "Roger": [70, 50, 10, 40, 20, 80, 10], "Jeorge": [60, 20, 10, 50, 20, 10, 10], "Maria": [0, 0, 0, 70, 20, 30, 0], "Minerva": [40, 30, 50, 70, 40, 40, 20], "Linde": [70, 0, 70, 70, 60, 80, 20], "Jake": [50, 30, 50, 50, 20, 50, 10], "Midia": [80, 30, 50, 50, 50, 10, 20], "Dolph": [70, 30, 40, 70, 30, 10, 20], "Macellan": [50, 30, 10, 40, 20, 10, 10], "Tomas": [50, 20, 20, 50, 30, 10, 10], "Boah": [10, 0, 10, 0, 20, 10, 10], "Beck": [10, 20, 40, 70, 50, 30, 0], "Astram": [90, 50, 40, 40, 20, 50, 10], "Palla": [70, 50, 80, 30, 20, 10, 30], "Catria": [70, 40, 80, 70, 80, 40, 30], "Arran": [50, 50, 30, 50, 40, 40, 10], "Samson": [70, 30, 10, 70, 20, 50, 20], "Xane": [50, 30, 10, 0, 20, 20, 20], "Est": [50, 70, 70, 70, 70, 60, 20], "Tiki": [80, 50, 90, 70, 90, 90, 0], "Lorenz": [70, 50, 70, 50, 20, 50, 20], "Elice": [80, 0, 50, 90, 60, 80, 30], "Gotoh": [80, 0, 50, 90, 60, 80, 30]}

const unitByName = new Map(FE1_UNITS.map((u) => [u.name, u]))
const labelOf = (id: string) => FE1_CHAPTERS.find((c) => c.id === id)!.label
const BASE_STATS = ['hp', 'str', 'skl', 'wlv', 'spd', 'lck', 'def', 'res', 'mov'] as const
const GROWING = ['hp', 'str', 'skl', 'wlv', 'spd', 'lck', 'def'] as const

describe('Shadow Dragon and the Blade of Light units', () => {
  it("matches Serenes Forest's classes, levels and bases", () => {
    // The exceptions are the game's: Roshea's record gives Mov 9 (Serenes: 8), and a recruited foe's Luck is a random 0-7 (3:$8E52),
    // shown as its average, 3.5. Serenes gives no Luck for them, except Astram's 3, which is his Mystery of the Emblem Luck.
    expect(FE1_UNITS).toHaveLength(52)
    for (const [name, [cls, level, ...stats]] of Object.entries(SF_BASES)) {
      const u = unitByName.get(name)!
      const want = BASE_STATS.map((s, i) => (s === 'lck' && (stats[i] === null || name === 'Astram') ? 3.5 : name === 'Roshea' && s === 'mov' ? 9 : stats[i]))
      expect([name, FE1_CLASSES[u.classId].name, u.level, ...BASE_STATS.map((s) => u.bases[s])]).toEqual([name, cls, level, ...want])
    }
  })

  it("matches Serenes Forest's growth rates", () => {
    for (const [name, sf] of Object.entries(SF_GROWTHS)) {
      const u = unitByName.get(name)!
      expect([name, ...GROWING.map((s) => u.growths[s])]).toEqual([name, ...sf])
    }
  })

  it('joins where the game puts them', () => {
    const join = (name: string) => {
      const u = unitByName.get(name)!
      return `${labelOf(u.joinChapter)} ${u.join.how}${u.join.with ? ` ${u.join.with.join('/')}` : ''}`
    }
    expect(join('Marth')).toBe('Ch.1 start')
    expect(join('Wrys')).toBe('Ch.1 visit Marth')
    expect(join('Navarre')).toBe('Ch.3 talk Caeda')
    expect(join('Merric')).toBe('Ch.4 visit Marth')
    expect(join('Minerva')).toBe('Ch.10 talk Marth')
    expect(join('Tiki')).toBe('Ch.19 talk Bantu')
    expect(join('Elice')).toBe('Ch.23 end Marth')
    expect(join('Gotoh')).toBe('Ch.25 start')
    expect(unitByName.get('Minerva')!.join.note).toContain('only with Maria')
    expect(unitByName.get('Arran')!.join.note).toContain('Arran or Samson, not both')
  })

  it('promotes with the items, holds stats at 20 and HP at 52', () => {
    const promo = (name: string) => {
      const cls = Object.values(FE1_CLASSES).find((c) => c.name === name)!
      return cls.promotesTo ? FE1_CLASSES[cls.promotesTo].name : undefined
    }
    expect(promo('Cavalier')).toBe('Paladin')
    expect(promo('Pegasus Knight')).toBe('Wyvern Knight')
    expect(promo('Mercenary')).toBe('Hero')
    expect(promo('Archer')).toBe('Sniper')
    expect(promo('Mage')).toBe('Bishop')
    expect(promo('Curate')).toBe('Bishop')
    expect(promo('Knight')).toBeUndefined()
    for (const c of Object.values(FE1_CLASSES)) expect(c.caps).toMatchObject({ hp: 52, str: 20, def: 20 })
  })
})
