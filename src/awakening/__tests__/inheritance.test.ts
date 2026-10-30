import { describe, expect, it } from 'vitest'
import { FE13_ASSETS, FE13_CHAPTERS, FE13_CLASSES, FE13_UNITS } from '../../data/fe13/fe13Units'
import { childOf, isFamilyBlocked, withAvatar, type Fe13Data } from '../logic'
import { FE13_STATS } from '../types'

const data: Fe13Data = { chapters: FE13_CHAPTERS, units: FE13_UNITS, classes: FE13_CLASSES }
const marry = (...pairs: [string, string][]) => Object.fromEntries(pairs.flatMap(([a, b]) => [[`fe13-${a}`, `fe13-${b}`], [`fe13-${b}`, `fe13-${a}`]]))
const unit = (id: string) => FE13_UNITS.find((u) => u.id === `fe13-${id}`)!
const classNames = (ids: string[]) => ids.map((id) => FE13_CLASSES[id].name)

describe('Awakening inheritance', () => {
  it("matches Serenes Forest's worked example of growths: Nah with Donnel as her father (rounded down)", () => {
    const r = childOf(data, unit('nah'), marry(['nowi', 'donnel']))!
    expect(FE13_STATS.map((s) => r.growths[s])).toEqual([63, 41, 28, 38, 36, 71, 43, 30])
  })

  it("matches Serenes Forest's worked example of modifiers: Severa with Henry as her father", () => {
    const r = childOf(data, unit('severa'), marry(['cordelia', 'henry']))!
    expect(FE13_STATS.slice(1).map((s) => r.modifiers[s as Exclude<typeof s, 'hp'>])).toEqual([3, 1, 5, 3, -2, 2, -1])
  })

  it("gives a child as they join: both parents' stats less their class's bases, plus the child's own, a third, plus the class's", () => {
    const r = childOf(data, unit('nah'), marry(['nowi', 'donnel']))!
    const nah = unit('nah')
    const nowi = unit('nowi')
    const donnel = unit('donnel')
    for (const s of FE13_STATS) {
      expect(r.bases[s]).toBe(Math.floor((nowi.personal[s] + donnel.personal[s] + nah.personal[s]) / 3) + FE13_CLASSES[nah.classId].bases[s])
    }
  })

  it('passes no Lord but to Lucina, no Dancer, and Taguel and Manakete only to Morgan', () => {
    const cynthia = childOf(data, unit('cynthia'), marry(['sumia', 'chrom']))!
    expect(classNames(cynthia.classes)).not.toContain('Lord')
    expect(classNames(cynthia.classes)).toContain('Cavalier')
    const lucina = childOf(data, unit('lucina'), marry(['chrom', 'olivia']))!
    expect(classNames(lucina.classes)).toContain('Lord')
    expect(classNames(lucina.classes)).not.toContain('Dancer')
    // Olivia's son takes the game's swaps for her Dancer and Pegasus Knight.
    const inigo = childOf(data, unit('inigo'), marry(['olivia', 'chrom']))!
    expect(classNames(inigo.classes)).toEqual(expect.arrayContaining(['Mercenary', 'Barbarian']))
    expect(classNames(inigo.classes)).not.toContain('Dancer')
    const morgan = childOf(data, unit('morgan-f'), marry(['avatar-m', 'panne']))!
    expect(classNames(morgan.classes)).toContain('Taguel')
    // The Avatar's children take almost every class (Serenes Forest), Tactician too.
    const kjelle = childOf(data, unit('kjelle'), marry(['sully', 'avatar-m']))!
    expect(classNames(kjelle.classes)).toContain('Tactician')
  })

  it("starts Morgan in the other parent's first class, or as a Tactician after a Lord", () => {
    expect(FE13_CLASSES[childOf(data, unit('morgan-f'), marry(['avatar-m', 'sumia']))!.startClass].name).toBe('Pegasus Knight')
    expect(FE13_CLASSES[childOf(data, unit('morgan-f'), marry(['avatar-m', 'lucina']))!.startClass].name).toBe('Tactician')
  })

  it("gives a Morgan whose other parent is a child that child's inheritance, and no +1", () => {
    const spouses = marry(['chrom', 'sumia'], ['avatar-m', 'lucina'])
    const lucina = childOf(data, unit('lucina'), spouses)!
    const morgan = childOf(data, unit('morgan-f'), spouses)!
    expect(morgan.other.via?.other.unit.name).toBe('Sumia')
    const avatar = unit('avatar-m')
    expect(morgan.modifiers.str).toBe(avatar.modifiers.str + lucina.modifiers.str)
    expect(morgan.growths.spd).toBe(Math.floor((unit('morgan-f').growths.spd + avatar.growths.spd + lucina.growths.spd) / 3))
    // Without Lucina's parents, her own numbers.
    const alone = childOf(data, unit('morgan-f'), marry(['avatar-m', 'lucina']))!
    expect(alone.other.via).toBeNull()
    expect(alone.modifiers.str).toBe(avatar.modifiers.str + unit('lucina').modifiers.str)
  })

  it('blocks marrying a sibling or a parent in the plan', () => {
    const spouses = marry(['avatar-m', 'olivia'])
    // Inigo and Morgan (F) are both Olivia's and the Avatar's.
    expect(isFamilyBlocked(data, 'fe13-inigo', 'fe13-morgan-f', spouses)).toBe(true)
    expect(isFamilyBlocked(data, 'fe13-inigo', 'fe13-morgan-f', {})).toBe(false)
    expect(isFamilyBlocked(data, 'fe13-avatar-f', 'fe13-inigo', spouses)).toBe(true)
  })
})

describe("The Avatar's asset and flaw", () => {
  const full: Fe13Data = { ...data, assets: FE13_ASSETS }
  it("matches Serenes Forest's tables: bases, and its worked examples of growths and modifiers (Speed asset, Luck flaw)", () => {
    const base = withAvatar(full, { asset: 'str', flaw: 'res' }).units.find((u) => u.id === 'fe13-avatar-m')!
    // Strength asset and Resistance flaw: Str 8 and Res 3.
    expect([base.bases.str, base.bases.res]).toEqual([8, 3])
    const hp = withAvatar(full, { asset: 'hp', flaw: 'lck' }).units.find((u) => u.id === 'fe13-avatar-f')!
    expect([hp.bases.hp, hp.bases.lck]).toEqual([19 + 5, 4 - 2])
    const before = unit('avatar-m')
    const after = withAvatar(full, { asset: 'spd', flaw: 'lck' }).units.find((u) => u.id === 'fe13-avatar-m')!
    expect(FE13_STATS.map((s) => after.growths[s] - before.growths[s])).toEqual([0, -5, -5, 5, 15, -5, 0, 0])
    expect(FE13_STATS.slice(1).map((s) => after.modifiers[s as 'str'] - before.modifiers[s as 'str'])).toEqual([-1, -1, 2, 4, -1, 0, 0])
  })

  it("passes through to Morgan's inheritance", () => {
    const built = withAvatar(full, { asset: 'spd', flaw: 'lck' })
    const morgan = childOf(built, unit('morgan-f'), marry(['avatar-m', 'sumia']))!
    expect(morgan.modifiers.spd).toBe(4 + unit('sumia').modifiers.spd + 1)
  })
})
