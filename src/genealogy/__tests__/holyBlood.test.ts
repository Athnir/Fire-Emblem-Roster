import { describe, expect, it } from 'vitest'
import { FE4_BLOODS } from '../../data/fe4/fe4Units'
import { BLOOD_LOOK } from '../HolyBlood'

describe('the holy blood window', () => {
  it('has a colour and an icon for each of the 13 lines', () => {
    expect(FE4_BLOODS).toHaveLength(13)
    for (const b of FE4_BLOODS) expect(BLOOD_LOOK[b.id], b.id).toBeDefined()
  })

  it('gives every line its own colour (user, 2026-11-05: by element, all different)', () => {
    const colours = FE4_BLOODS.map((b) => BLOOD_LOOK[b.id].color.toLowerCase())
    expect(new Set(colours).size).toBe(colours.length)
  })

  it('colours the magic lines by element', () => {
    expect(BLOOD_LOOK['Fjalar'].icon).toBe('flame')
    expect(BLOOD_LOOK['Thrud'].icon).toBe('bolt')
    expect(BLOOD_LOOK['Forseti'].icon).toBe('wind')
  })
})
