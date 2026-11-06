import { describe, expect, it } from 'vitest'
import { FE15_SPELL_BOOK, FE15_SPELL_STATS, FE15_UNITS } from '../fe15Units'

// Serenes Forest's Shadows of Valentia magic tables (fetched 2026-11-06): HP cost, Mt, range and Hit, to check Item.bin against.
const SF_BLACK: Record<string, [number, number, string, number]> = {
  Fire: [1, 3, '1-2', 80],
  Thunder: [2, 4, '1-3', 70],
  Excalibur: [3, 5, '1-2', 95],
  Seraphim: [4, 7, '1-2', 90],
  Aura: [6, 12, '1-2', 80],
  Sagittae: [8, 16, '1-3', 70],
  Ragnarok: [10, 20, '1-2', 95],
  Nosferatu: [0, 0, '1-2', 60],
}
// White magic: HP cost and range (Serenes Forest's "1~Atk/2" written "1-Atk/2").
const SF_WHITE: Record<string, [number, string]> = {
  Recover: [1, '1'],
  Physic: [3, '1-Atk'],
  Fortify: [12, '1-Atk/2'],
  Warp: [8, '1'],
  Rewarp: [5, ''],
  Rescue: [6, '1-Atk/2'],
  Anew: [24, '1'],
  Entrap: [12, '1-Atk/4'],
  Freeze: [11, '1-Atk/4'],
  Silence: [10, '1-Atk/4'],
  Expel: [14, '1-Atk/2'],
  'Invoke (Dread Fighters)': [12, '2-3'],
  'Invoke (Pegasus Knights)': [12, '3-4'],
  'Invoke (Soldiers)': [12, '4-6'],
}

const book = (name: string) => FE15_SPELL_BOOK[FE15_UNITS.find((u) => u.name === name)!.id]

describe('Shadows of Valentia spells', () => {
  it("matches Serenes Forest's magic tables", () => {
    for (const [name, [hp, mt, range, hit]] of Object.entries(SF_BLACK)) expect(FE15_SPELL_STATS[name], name).toMatchObject({ hp, mt, range, hit })
    for (const [name, [hp, range]] of Object.entries(SF_WHITE)) expect(FE15_SPELL_STATS[name], name).toMatchObject({ hp, range })
    expect(FE15_SPELL_STATS['Excalibur'].crit).toBe(20)
    expect(Object.keys(FE15_SPELL_STATS)).toHaveLength(22)
  })

  it('gives the 19 units who can reach a casting class their lists, every spell with its numbers', () => {
    expect(Object.keys(FE15_SPELL_BOOK)).toHaveLength(19)
    for (const lists of Object.values(FE15_SPELL_BOOK))
      for (const l of lists) for (const e of l.entries) expect(FE15_SPELL_STATS[e.spell], e.spell).toBeDefined()
    // Celica: all on her first list, by level (Person.bin's MSID_セリカ).
    expect(book('Celica')).toEqual([
      {
        kind: 'Black magic',
        classes: ['Priestess', 'Princess'],
        entries: [
          { spell: 'Fire', rank: 0, level: 0 },
          { spell: 'Seraphim', rank: 0, level: 5 },
          { spell: 'Thunder', rank: 0, level: 8 },
          { spell: 'Recover', rank: 0, level: 9 },
          { spell: 'Excalibur', rank: 0, level: 15 },
          { spell: 'Ragnarok', rank: 0, level: 20 },
        ],
      },
    ])
    // Faye can be a Mage or a Cleric: both lists.
    expect(book('Faye').map((l) => l.kind)).toEqual(['Black magic', 'White magic'])
    // A Mercenary or Myrmidon reaches a Mage only through the Dread Fighter's change back to Villager.
    for (const name of ['Saber', 'Kamui', 'Jesse', 'Deen']) expect(book(name)[0].via, name).toMatch(/Dread Fighter/)
    expect(book('Gray')[0].via).toBeUndefined()
    // Tatiana joins as a Saint: her first list's spells come by level there.
    expect(book('Tatiana')[0].classes).toEqual(['', 'Saint'])
  })
})
