import { describe, expect, it } from 'vitest'
import { characters } from '../characters'
import { supports } from '../supports'
import { FATES_GAME_CLASS_SETS } from './fatesGameClassSets'

describe("Fates class sets against the game's own data", () => {
  const adults = characters.filter((c) => !c.isChild && c.id !== 'corrin_m' && c.id !== 'corrin_f')

  it('has every first-generation unit the game has', () => {
    expect(adults.map((c) => c.name).sort()).toEqual(Object.keys(FATES_GAME_CLASS_SETS).sort())
  })

  it("gives each one the game's class set, the nine third classes included", () => {
    for (const c of adults) {
      const own = [c.startingClass, c.secondaryClass, c.tertiaryClass].filter((n): n is string => Boolean(n))
      expect([c.name, own]).toEqual([c.name, FATES_GAME_CLASS_SETS[c.name]])
    }
  })
})

describe('Gunter', () => {
  it("has no supports in Revelation, where he joins but can't support (Fire Emblem Wiki)", () => {
    const gunters = supports.filter((p) => p.characterA === 'gunter' || p.characterB === 'gunter')
    expect(gunters.length).toBe(3)
    for (const p of gunters) expect(p.route).toEqual(['Conquest'])
  })
})
