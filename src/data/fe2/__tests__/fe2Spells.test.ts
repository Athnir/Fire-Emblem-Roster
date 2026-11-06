import { describe, expect, it } from 'vitest'
import { FE2_CLASS_SPELLS, FE2_SPELL_STATS } from '../fe2Units'

// Serenes Forest's Gaiden magic tables (fetched 2026-11-06), to check the ROM's item tables against. Black magic: Mt, Hit, Crit,
// range, HP cost (Serenes' Rainarok is the translation's Ragnarok).
const SF_BLACK: Record<string, [number, number, number, string, number]> = {
  Fire: [3, 80, 0, '1-2', 1],
  Thunder: [4, 70, 0, '1-3', 2],
  Excaliber: [5, 100, 20, '1-2', 3],
  Angel: [8, 90, 0, '1-2', 4],
  Aura: [13, 80, 0, '1-2', 6],
  Arrow: [16, 70, 0, '1-2', 8],
  Ragnarok: [24, 100, 0, '1-2', 10],
}
// White magic: HP cost (Serenes' Resire and Reblow are the translation's Drain and Libro).
const SF_WHITE: Record<string, number> = { Recover: 1, Libro: 3, Drain: 0, Warp: 8, Reserve: 12, Illusion: 12, Dear: 14 }

describe('Gaiden spells', () => {
  it("matches Serenes Forest's magic tables", () => {
    for (const [name, [mt, hit, crit, range, hp]] of Object.entries(SF_BLACK))
      expect(FE2_SPELL_STATS[name], name).toMatchObject({ kind: 'Black magic', mt, hit, crit, range, hp })
    for (const [name, hp] of Object.entries(SF_WHITE)) expect(FE2_SPELL_STATS[name], name).toMatchObject({ kind: 'White magic', hp })
    // Drain rolls to hit (Serenes: 50); the rest of the white magic doesn't.
    expect(FE2_SPELL_STATS['Drain'].hit).toBe(50)
    expect(FE2_SPELL_STATS['Recover'].hit).toBeUndefined()
  })

  it('has a card for every spell a class can teach, and Angel effective against the monsters', () => {
    for (const spells of Object.values(FE2_CLASS_SPELLS)) for (const s of spells) expect(FE2_SPELL_STATS[s], s).toBeDefined()
    expect(FE2_SPELL_STATS['Angel'].notes?.[0]).toMatch(/^Mt x3 against .*Gargoyles.*Bigls/)
  })
})
