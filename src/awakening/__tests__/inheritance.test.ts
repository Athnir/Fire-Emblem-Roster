import { describe, expect, it } from 'vitest'
import { FE13_ASSETS, FE13_CHAPTERS, FE13_CLASSES, FE13_MAIDEN, FE13_SKILLS, FE13_UNITS } from '../../data/fe13/fe13Units'
import { capsOf, childOf, classChanges, classSetOf, dlcClassesFor, fixedShare, isFamilyBlocked, legalSteps, levelGain, project, reachableSkills, spousesOf, withAvatar, type Fe13Data } from '../logic'
import { FE13_STATS } from '../types'

const data: Fe13Data = { chapters: FE13_CHAPTERS, units: FE13_UNITS, classes: FE13_CLASSES, maiden: FE13_MAIDEN, skills: FE13_SKILLS }
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

  it("joins a child at their own stats plus a third of how far each parent is above them (0x3a44d0)", () => {
    const r = childOf(data, unit('nah'), marry(['nowi', 'donnel']))!
    const nah = unit('nah')
    const nowi = unit('nowi')
    const donnel = unit('donnel')
    const above = (p: number, own: number) => Math.max(0, p - own)
    for (const s of FE13_STATS) {
      const own = nah.personal[s]
      expect(r.raw[s]).toBe(own + Math.floor((above(nowi.personal[s], own) + above(donnel.personal[s], own)) / 3) + FE13_CLASSES[nah.classId].bases[s])
      // Never below their own.
      expect(r.bases[s]).toBeGreaterThanOrEqual(nah.bases[s])
    }
    // Lucina with Chrom and Sumia as they join: the old average gave HP 21, Str 7 and Skl 11.
    const lucina = childOf(data, unit('lucina'), marry(['chrom', 'sumia']))!
    expect(FE13_STATS.map((s) => lucina.bases[s])).toEqual([28, 10, 2, 14, 12, 13, 9, 4])
  })

  it("counts a parent's planned stats past a maximum, and holds the child at their own", () => {
    const plans = { 'fe13-sumia': { steps: [], targetLevel: 20 } }
    const r = childOf(data, unit('lucina'), marry(['chrom', 'sumia']), plans)!
    expect(r.other.from).toMatchObject({ level: 20, planned: true })
    const caps = capsOf(FE13_CLASSES[r.startClass], r.modifiers)
    for (const s of FE13_STATS) expect(r.bases[s]).toBe(Math.min(caps[s], r.raw[s]))
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

  it("gives Lucina only Chrom's side when he marries the village maiden (PID_ダミー, all zeros)", () => {
    expect(spousesOf(data, unit('chrom')).map((u) => u.id)).toContain('fe13-maiden')
    expect(FE13_STATS.every((s) => FE13_MAIDEN.personal[s] === 0 && FE13_MAIDEN.growths[s] === 0)).toBe(true)
    const r = childOf(data, unit('lucina'), marry(['chrom', 'maiden']))!
    expect(FE13_STATS.map((s) => r.growths[s])).toEqual([30, 25, 10, 28, 28, 50, 20, 15])
    expect(r.modifiers.str).toBe(unit('chrom').modifiers.str + 1)
    expect(classNames(r.classes)).toEqual(['Lord', 'Cavalier', 'Archer'])
    // She adds nothing to the join: Lucina's own stats plus a third of how far Chrom is above her.
    const lucina = unit('lucina')
    for (const s of FE13_STATS) {
      const own = lucina.personal[s]
      expect(r.raw[s]).toBe(own + Math.floor(Math.max(0, unit('chrom').personal[s] - own) / 3) + FE13_CLASSES[lucina.classId].bases[s])
    }
  })

  it("shows what a child always gets: their fixed parent's classes and modifiers, and the +1", () => {
    const share = fixedShare(data, unit('lucina'))!
    expect(classNames(share.classes)).toEqual(['Lord', 'Cavalier', 'Archer'])
    expect(share.modifiers.spd).toBe(unit('chrom').modifiers.spd + 1)
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

describe('Class changes (seals 0x2d4d3c, the Second Seal list 0x2cff38, the class change 0x2d0fb8)', () => {
  const id = (name: string, female = false) => Object.values(FE13_CLASSES).find((c) => c.name === name && c.female === female)!.id
  const changes = (unitId: string, from: string, female = false) => {
    const u = unit(unitId)
    return Object.fromEntries(classChanges(data, id(from, female), classSetOf(u)).map((c) => [FE13_CLASSES[c.to].name, c.minLevel]))
  }

  it('promotes with a Master Seal from Lv 10, and keeps a base class to base classes', () => {
    const lord = changes('chrom', 'Lord')
    expect(lord['Great Lord']).toBe(10)
    expect(lord).toMatchObject({ Cavalier: 10, Archer: 10 })
    expect(lord).not.toHaveProperty('Paladin')
    expect(lord).not.toHaveProperty('Sniper')
  })

  it('lets a promoted unit Second Seal to a base class at any level, and to a promoted one from Lv 10', () => {
    expect(changes('chrom', 'Great Lord')).toMatchObject({ Lord: 1, Cavalier: 1, Archer: 1, Paladin: 10, 'Great Knight': 10, Sniper: 10, 'Bow Knight': 10 })
  })

  it("adds the unit's own class at its top level", () => {
    expect(changes('chrom', 'Lord').Lord).toBe(20)
    expect(changes('chrom', 'Great Lord')['Great Lord']).toBe(20)
    expect(changes('donnel', 'Villager').Villager).toBe(30)
  })

  it('opens promoted classes to a special class at Lv 30', () => {
    expect(changes('donnel', 'Villager')).toEqual({ Fighter: 10, Mercenary: 10, Warrior: 30, Hero: 30, 'Bow Knight': 30, Villager: 30 })
  })

  it('leaves out a step the game never allows, and what comes after it', () => {
    const plan = { steps: [{ at: 20, to: id('Paladin') }, { at: 20, to: id('Cavalier') }], targetLevel: 20 }
    expect(legalSteps(data, id('Lord'), 1, plan, classSetOf(unit('chrom')))).toEqual({ steps: [], dropped: plan.steps[0] })
  })
})

describe('Average stats', () => {
  it('rolls a level that gains nothing once more, unless a growth is 100 or more (0x2cef88)', () => {
    const flat = { hp: 50, str: 50, mag: 50, skl: 50, spd: 50, lck: 50, def: 50, res: 50 }
    expect(levelGain(flat).str).toBeCloseTo(0.5 * (1 + 0.5 ** 8))
    const sure = { ...flat, hp: 120 }
    expect(levelGain(sure).hp).toBeCloseTo(1.2)
    expect(levelGain(sure).str).toBeCloseTo(0.5)
  })

  it('keeps every point gained through a class with lower maximums, and stops growing at one', () => {
    // Lissa: Cleric to War Cleric to Pegasus Knight (Lck maximum 32) to Falcon Knight.
    const id = (name: string) => Object.values(FE13_CLASSES).find((c) => c.name === name && c.female)!.id
    const lissa = unit('lissa')
    const plan = { steps: [{ at: 20, to: id('War Cleric') }, { at: 20, to: id('Pegasus Knight') }, { at: 20, to: id('Falcon Knight') }], targetLevel: 20 }
    const stages = project(data, lissa, plan, { set: classSetOf(lissa) })
    const pk = stages.filter((s) => s.classId === id('Pegasus Knight'))
    const warCleric = stages.find((s) => s.classId === id('War Cleric') && s.level === 20)!
    const cap = capsOf(FE13_CLASSES[id('Pegasus Knight')], lissa.modifiers).lck
    expect(warCleric.raw.lck).toBeGreaterThan(cap)
    // Held at the Pegasus Knight's maximum, the rest kept, and no growth while there.
    for (const s of pk) expect([s.stats.lck, s.raw.lck]).toEqual([cap, warCleric.raw.lck])
    // A Falcon Knight shows the kept points again.
    expect(stages.find((s) => s.classId === id('Falcon Knight') && s.level === 1)!.stats.lck).toBe(warCleric.raw.lck)
  })
})

describe('Skills a unit can have in some playthrough', () => {
  const has = (id: string, skill: string) => reachableSkills(data, unit(id)).has(skill)

  it("follows the game's inheritance: a child gets another gender's skills only from a parent who can have them", () => {
    // Panne can't be a Dark Flier; Chrom passes Lucina only Aether.
    expect(has('yarne', 'Galeforce')).toBe(false)
    expect(has('owain', 'Galeforce')).toBe(true)
    expect(has('lucina', 'Counter')).toBe(false)
    expect(has('lucina', 'Aether')).toBe(true)
    // The DLC's skills and the enemies' never pass, though a parent can have them.
    expect(has('owain', 'Rally Heart')).toBe(false)
    expect(has('owain', 'Luna+')).toBe(false)
  })

  it("opens Aptitude to Donnel and to a child who can have him as a parent or grandparent, not to Lucina", () => {
    expect(has('donnel', 'Aptitude')).toBe(true)
    expect(has('chrom', 'Aptitude')).toBe(false)
    expect(has('nah', 'Aptitude')).toBe(true)
    expect(has('lucina', 'Aptitude')).toBe(false)
    expect(has('morgan-m', 'Aptitude')).toBe(true)
  })
})

describe('Aptitude, Limit Breaker and the DLC classes', () => {
  const id = (name: string, female = false) => Object.values(FE13_CLASSES).find((c) => c.name === name && c.female === female)!.id

  it('adds 20 to every growth with Aptitude, and 10 to every maximum but HP with Limit Breaker', () => {
    const donnel = unit('donnel')
    const base = project(data, donnel, { steps: [], targetLevel: 2 })
    const apt = project(data, donnel, { steps: [], targetLevel: 2, aptitude: true })
    const total = (extra: number) => Object.fromEntries(FE13_STATS.map((s) => [s, donnel.growths[s] + FE13_CLASSES[donnel.classId].growths![s] + extra])) as typeof donnel.growths
    expect(apt[1].raw.str - apt[0].raw.str).toBeCloseTo(levelGain(total(20)).str)
    expect(base[1].raw.str - base[0].raw.str).toBeCloseTo(levelGain(total(0)).str)
    const caps = capsOf(FE13_CLASSES[donnel.classId], donnel.modifiers, true)
    const plain = capsOf(FE13_CLASSES[donnel.classId], donnel.modifiers)
    expect(caps.hp).toBe(plain.hp)
    expect(caps.str).toBe(plain.str + 10)
  })

  it("offers each DLC class to its own gender, by its seal once promoted or from Lv 10", () => {
    expect(dlcClassesFor(data, unit('chrom')).map((c) => FE13_CLASSES[c].name)).toEqual(['Dread Fighter'])
    expect(dlcClassesFor(data, unit('lissa')).map((c) => FE13_CLASSES[c].name)).toEqual(['Bride'])
    const df = id('Dread Fighter')
    expect(classChanges(data, id('Lord'), classSetOf(unit('chrom')), [df]).find((c) => c.to === df)?.minLevel).toBe(10)
    expect(classChanges(data, id('Great Lord'), classSetOf(unit('chrom')), [df]).find((c) => c.to === df)?.minLevel).toBe(1)
    expect(classChanges(data, id('Lord'), classSetOf(unit('chrom'))).some((c) => c.to === df)).toBe(false)
  })
})
