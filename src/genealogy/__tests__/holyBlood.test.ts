import { describe, expect, it } from 'vitest'
import { FE4_BLOODS, FE4_UNITS } from '../../data/fe4/fe4Units'
import { BLOOD_LOOK } from '../HolyBlood'
import { bloodSources, childBlood } from '../logic'

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

describe("a child's holy blood in Pairings", () => {
  const unit = (name: string) => FE4_UNITS.find((u) => u.name === name)!
  const ayra = unit('Ayra')
  const blood = (child: string, father: string) => {
    const c = unit(child)
    const f = unit(father)
    const [main, other] = c.mainParent === 'father' ? [f, ayra] : [ayra, f]
    return childBlood(main.blood ?? [], other.blood ?? [])
  }

  it('changes with the father: Chulainn (Holyn) and Ayra, both minor Od, give major Od; Finn, with none, minor', () => {
    expect(blood('Scáthach', 'Chulainn')).toEqual([{ blood: 'Od', level: 'major' }])
    expect(blood('Larcei', 'Chulainn')).toEqual([{ blood: 'Od', level: 'major' }])
    expect(blood('Scáthach', 'Finn')).toEqual([{ blood: 'Od', level: 'minor' }])
    expect(blood('Scáthach', 'Lex')).toEqual([
      { blood: 'Neir', level: 'minor' },
      { blood: 'Od', level: 'minor' },
    ])
  })

  it('names the parents each line comes from, the main parent first', () => {
    const sons = unit('Scáthach')
    expect(bloodSources(sons, blood('Scáthach', 'Chulainn'), unit('Chulainn'), ayra)).toEqual({ Od: 'Chulainn (minor) and Ayra (minor)' })
    expect(bloodSources(sons, blood('Scáthach', 'Lex'), unit('Lex'), ayra)).toEqual({ Neir: 'Lex (minor)', Od: 'Ayra (minor)' })
  })
})
