import { describe, expect, it } from 'vitest'
import fe12, { FE12_DATA } from '../../../games/fe12'
import { avatarUnit } from '../../../gba/screens'
import type { GbaStat } from '../../../gba/types'
import { assetKeys } from '../../assetStorage'
import { FE12_AVATAR, FE12_CLASSES, FE12_SUPPORTS, FE12_UNITS } from '../fe12Units'

// Serenes Forest's New Mystery tables ("light-and-shadow", default base stats and growth rates; fetched 2026-11-05), for a sample of the
// units: class, Lv, HP, Str, Mag, Skl, Spd, Lck, Def, Res, Mov; and growths with the class (HP to Res). Its names differ where Shadow
// Dragon has official ones (Shiida is Caeda, Nabarl Navarre, the Chameleon class the Freelancer); "My Unit" is Kris as the data keeps
// them, a Cavalier before the creation's picks. Merric's growths are its "Merric (Mage)" row (it lists his Sage's too).
const SF_BASES: Record<string, (string | number)[]> = {"Marth": ["Lord", 6, 26, 8, 0, 10, 10, 9, 8, 0, 7], "My Unit": ["Cavalier", 1, 20, 7, 0, 5, 7, 3, 7, 0, 9], "Luke": ["Cavalier", 1, 20, 7, 0, 5, 7, 4, 7, 0, 9], "Rody": ["Cavalier", 1, 20, 6, 0, 5, 6, 5, 6, 0, 9], "Cecil": ["Cavalier", 3, 19, 6, 0, 8, 9, 6, 5, 0, 9], "Gordin": ["Archer", 5, 21, 9, 0, 7, 6, 5, 8, 0, 5], "Ryan": ["Archer", 1, 18, 7, 0, 4, 4, 3, 7, 0, 5], "Draug": ["Knight", 6, 22, 10, 0, 5, 5, 3, 11, 0, 5], "Ogma": ["Mercenary", 7, 27, 8, 0, 14, 13, 5, 8, 0, 7], "Shiida": ["Pegasus Knight", 4, 19, 6, 2, 7, 15, 13, 7, 6, 8], "Frey": ["Cavalier", 8, 26, 11, 0, 8, 10, 6, 10, 0, 9], "Norne": ["Archer", 5, 20, 8, 0, 6, 9, 6, 7, 0, 5], "Nabarl": ["Myrmidon", 8, 23, 9, 0, 16, 16, 7, 8, 0, 7], "Feena": ["Dancer", 1, 16, 2, 0, 2, 13, 8, 5, 0, 6], "Cain": ["Cavalier", 9, 27, 11, 0, 9, 10, 4, 11, 0, 9], "Jeorge": ["Sniper", 5, 32, 12, 1, 14, 14, 5, 13, 3, 7], "Minerva": ["Dracoknight", 4, 32, 13, 1, 12, 15, 11, 16, 3, 10], "Merric": ["Mage", 10, 24, 0, 7, 6, 10, 6, 7, 5, 6], "Athena": ["Myrmidon", 10, 25, 9, 0, 12, 13, 6, 7, 0, 7], "Xane": ["Chameleon", 5, 20, 3, 0, 3, 11, 10, 6, 10, 6], "Tiki": ["Manakete", 6, 18, 6, 0, 6, 6, 13, 5, 10, 6], "Est": ["Pegasus Knight", 5, 20, 6, 2, 7, 13, 11, 8, 6, 8], "Katarina": ["Sage", 7, 34, 3, 12, 15, 15, 6, 9, 7, 6], "Wolf": ["Horseman", 12, 36, 15, 1, 17, 16, 11, 14, 3, 9], "Michalis": ["Dracoknight", 12, 42, 19, 1, 22, 22, 2, 20, 5, 10], "Nagi": ["Manakete", 15, 32, 8, 2, 12, 14, 10, 6, 10, 6]}
const SF_GROWTHS: Record<string, number[]> = {"Marth": [90, 60, 0, 65, 65, 80, 30, 5], "My Unit": [70, 40, 5, 55, 40, 60, 35, 5], "Luke": [90, 60, 0, 50, 50, 40, 40, 5], "Rody": [80, 50, 0, 60, 65, 60, 40, 5], "Cecil": [70, 45, 10, 70, 75, 50, 30, 5], "Gordin": [70, 40, 0, 40, 40, 50, 30, 0], "Ryan": [80, 50, 0, 80, 50, 40, 35, 0], "Draug": [80, 40, 0, 50, 50, 40, 55, 0], "Ogma": [100, 60, 0, 55, 50, 60, 25, 5], "Shiida": [60, 30, 0, 80, 95, 80, 25, 10], "Frey": [90, 45, 0, 65, 65, 55, 40, 5], "Norne": [70, 35, 0, 50, 65, 50, 30, 0], "Nabarl": [90, 45, 0, 50, 70, 70, 20, 5], "Feena": [60, 60, 0, 80, 90, 80, 15, 5], "Cain": [90, 40, 0, 70, 70, 70, 35, 5], "Jeorge": [80, 40, 0, 35, 45, 50, 40, 0], "Minerva": [80, 50, 0, 60, 50, 60, 30, 5], "Merric": [70, 0, 40, 65, 65, 70, 15, 15], "Athena": [75, 40, 0, 60, 70, 65, 25, 10], "Xane": [60, 40, 0, 20, 50, 40, 30, 5], "Tiki": [90, 50, 20, 80, 80, 90, 20, 5], "Est": [60, 80, 0, 80, 80, 70, 30, 10], "Katarina": [80, 0, 40, 70, 75, 70, 20, 40], "Wolf": [90, 70, 0, 55, 70, 60, 35, 0], "Michalis": [90, 60, 0, 60, 55, 20, 40, 10], "Nagi": [90, 50, 20, 80, 80, 90, 20, 5]}
const NAME: Record<string, string> = { Shiida: 'Caeda', Nabarl: 'Navarre', 'My Unit': 'Kris (M)' }
const CLASS: Record<string, string> = { Chameleon: 'Freelancer', 'Pegasus Knight': 'Peg. Knight' }
const STATS: GbaStat[] = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res']

const unit = (name: string) => FE12_UNITS.find((u) => u.name === name)!

describe('New Mystery of the Emblem, from the cartridge', () => {
  it('has every playable unit Serenes Forest lists, Kris as two (a man and a woman)', () => {
    // Serenes Forest's table lists 77 people, "My Unit" once.
    expect(FE12_UNITS).toHaveLength(78)
    expect(FE12_UNITS.filter((u) => u.name.startsWith('Kris')).map((u) => u.id)).toEqual(['fe12-kris-m', 'fe12-kris-f'])
  })

  it("matches Serenes Forest's bases and growths", () => {
    for (const [sf, row] of Object.entries(SF_BASES)) {
      const u = unit(NAME[sf] ?? sf)
      expect(u, sf).toBeDefined()
      const cls = FE12_CLASSES[u.classId]
      expect([cls.name, u.level, ...STATS.map((s) => u.bases[s]), u.bases.mov], sf).toEqual([CLASS[row[0] as string] ?? row[0], ...row.slice(1)])
      // Serenes Forest gives the growth with the class, below 0 as 0.
      expect(STATS.map((s) => Math.max(0, (u.growths[s] ?? 0) + (cls.growths?.[s] ?? 0))), sf).toEqual(SF_GROWTHS[sf])
    }
  })

  it("adds Kris's creation answers to their own bases and growths, in the class picked (arm9 0x2028b04, 0x2028b60)", () => {
    const kris = unit('Kris (M)')
    // A Mercenary (the first class), Noble's Child, Beauty and Honorable: Skl and Spd +2 and +1, their growths +5, +10 and +15.
    const made = avatarUnit(FE12_DATA, kris, { avatarClass: 0, answers: [0, 0, 0] })
    const merc = FE12_CLASSES[made.classId]
    expect(merc.name).toBe('Mercenary')
    const own = FE12_AVATAR.own
    expect(STATS.map((s) => made.bases[s])).toEqual(STATS.map((s) => (merc.bases[s] ?? 0) + (own.bases[s] ?? 0) + (s === 'skl' || s === 'spd' ? 3 : 0)))
    expect(STATS.map((s) => made.growths[s])).toEqual(STATS.map((s) => (own.growths[s] ?? 0) + (s === 'skl' || s === 'spd' ? 30 : 0)))
    expect(made.bases.mov).toBe(merc.bases.mov)
    // The starting weapon's kind at D (0x204ce24); a man's Mercenary is in the Knight's and Fighter's set.
    expect(made.ranks).toEqual({ sword: 'D' })
    expect(made.reclass?.map((id) => FE12_CLASSES[id].name)).toEqual(expect.arrayContaining(['Knight', 'Fighter', 'Hero']))
    // A woman's list has no Mercenary; her first class is the Myrmidon.
    expect(FE12_CLASSES[avatarUnit(FE12_DATA, unit('Kris (F)'), { avatarClass: 0 }).classId].name).toBe('Myrmidon')
  })

  it("moves the prologue's units by the answer picked, without losing anyone", () => {
    const p4 = FE12_DATA.choices!.find((c) => c.after === 'fe12-p3')!
    const athena = p4.options.find((o) => o.label.startsWith('Athena'))!
    const gordin = p4.options.find((o) => o.label.startsWith('Gordin'))!
    expect(athena.joins['fe12-athena'].joinChapter).toBe('fe12-p4')
    expect(athena.joins['fe12-gordin'].joinChapter).toBe('fe12-1')
    expect(gordin.joins['fe12-gordin'].joinChapter).toBe('fe12-p4')
    expect(gordin.joins['fe12-athena'].joinChapter).toBe('fe12-13x')
    // Joining in the prologue, she leaves after it and comes back in 13x; joining in 13x, she doesn't leave.
    expect(athena.joins['fe12-athena'].away).toHaveLength(1)
    expect(gordin.joins['fe12-athena'].away).toBeUndefined()
  })

  it("gives both of Kris's units the same supports, and names only units who join", () => {
    const ids = new Set(FE12_UNITS.map((u) => u.id))
    for (const s of FE12_SUPPORTS) expect(ids.has(s.unit) && ids.has(s.partner), `${s.unit} ${s.partner}`).toBe(true)
    const slots = (id: string) => FE12_SUPPORTS.filter((s) => s.unit === id).map((s) => [s.partner, s.start, s.levels])
    expect(slots('fe12-kris-f')).toEqual(slots('fe12-kris-m'))
    const toKris = (id: string) => FE12_SUPPORTS.filter((s) => s.partner === id).map((s) => [s.unit, s.start, s.levels])
    expect(toKris('fe12-kris-f')).toEqual(toKris('fe12-kris-m'))
  })
})

/** A file as a picked folder, or an unzipped .zip, gives it: its name, and its path in webkitRelativePath. */
function file(path: string): File {
  const f = new File([''], path.split('/').pop() ?? path)
  Object.defineProperty(f, 'webkitRelativePath', { value: path })
  return f
}
const keyOf = (path: string) => fe12.art.match([file(path)]).matched[0]?.key

describe('New Mystery art', () => {
  it("keeps the portraits by name and Kris's parts by gender, where Kris's portrait looks them up", () => {
    expect(keyOf('fe12/marth.png')).toBe(assetKeys.portrait('fe12/marth'))
    expect(keyOf('fe12/kris_f.png')).toBe(assetKeys.portrait('fe12/kris_f'))
    expect(keyOf('fe12/avatar/m/body_A.png')).toBe(assetKeys.portrait('fe12/avatar/m/body_a'))
    expect(keyOf('fe12/avatar/f/hair_03.png')).toBe(assetKeys.portrait('fe12/avatar/f/hair_03'))
    expect(keyOf('fe12/avatar/f/eyes_K.png')).toBe(assetKeys.portrait('fe12/avatar/f/eyes_k'))
    expect(keyOf('fe12/avatar/x/body_A.png')).toBeUndefined()
    // 78 portraits; each gender's outfits (the woman has no fifth), 11 eyes and 18 hair styles.
    expect(fe12.art.expected.filter((p) => p.startsWith('avatar/'))).toHaveLength(5 + 4 + 2 * (11 + 18))
  })
})
