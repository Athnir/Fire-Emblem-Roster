import { describe, expect, it } from 'vitest'
import { artFolder, gameLabel, GAMES, pickerList } from '..'

describe('the game picker', () => {
  it('lists the games in the series order, numbered, with the missing mainline games in their place', () => {
    const list = pickerList().map((e) => (e.game ? gameLabel(e.game) : `(${gameLabel(e.missing)})`))
    expect(list.slice(0, 3)).toEqual(['1. Fire Emblem: Shadow Dragon & the Blade of Light', '(2. Fire Emblem Gaiden)', '3. Fire Emblem: Mystery of the Emblem'])
    expect(list).toContain('14. Fire Emblem Fates')
    expect(list.indexOf('(12. Fire Emblem: New Mystery of the Emblem)')).toBe(list.indexOf('11. Fire Emblem: Shadow Dragon') + 1)
    expect(list[list.length - 1]).toBe("(Fire Emblem: Fortune's Weave)")
    // Numbers 1 to 17, each once.
    const numbers = pickerList().map((e) => (e.game ? e.game.number : e.missing.number)).filter((n) => n !== undefined)
    expect(numbers).toEqual(Array.from({ length: 17 }, (_, i) => i + 1))
  })

  it('names each game\'s art folder by its number, Fates\' too', () => {
    expect(GAMES.map(artFolder)).toEqual(GAMES.map((g) => (g.id === 'fates' ? 'fe14' : g.id)))
  })
})
