import { describe, expect, it } from 'vitest'
import { FE5_DATA } from '../../games/fe5'
import {
  excludedUnits,
  growthsWith,
  joinOf,
  manualClashes,
  normalizePlan,
  pathOf,
  project,
  ranksOf,
  shownStats,
  skillsAt,
  type Fe5Plan,
} from '../logic'

// The rules the planner follows, each from the game's code (data-raw/fe5/README.md).
const data = FE5_DATA
const unit = (name: string) => data.units.find((u) => u.name === name)!
const cls = (name: string) => Object.values(data.classes).find((c) => c.name === name)!
const plan = (p: Partial<Fe5Plan>): Fe5Plan => ({ promote: false, promoteAt: 20, stepAt: null, targetLevel: 20, ...p })
const scroll = (name: string) => data.scrolls.find((s) => s.name === name)!

describe('Thracia 776 rules', () => {
  it("shows the class's base plus the unit's own, held at 20; HP as kept ($83:90BE)", () => {
    const galzus = unit('Galzus')
    expect(shownStats(data.classes[galzus.classId], galzus.own).spd).toBe(20)
    expect(shownStats(data.classes[galzus.classId], galzus.own).hp).toBe(galzus.own.hp)
  })

  it('averages each level-up at the growth, held at 20 on the unit\'s own number ($83:E2B0, $83:DFC4)', () => {
    const leif = unit('Leif')
    const stages = project(data, leif, plan({ targetLevel: 11 }))
    const end = stages[stages.length - 1]
    expect(end.level).toBe(11)
    expect(end.own.str).toBeCloseTo(leif.own.str + 10 * 0.35)
    expect(end.own.hp).toBeCloseTo(leif.own.hp + 10 * 0.7)
  })

  it('adds up every scroll carried and holds a growth at 0 or more ($83:DDCC, $83:DEE0)', () => {
    const tina = unit('Tina')
    expect(growthsWith(tina, [scroll("Od's Scroll"), scroll("Fjalar's Scroll")]).skl).toBe(tina.growths.skl + 40)
    // Tina's 3% Str with Bragi's -10%: 0, not below.
    expect(growthsWith(tina, [scroll("Bragi's Scroll")]).str).toBe(0)
    const stages = project(data, tina, plan({ targetLevel: 11, scrolls: [{ scrollIds: [scroll("Bragi's Scroll").id], levels: 10 }] }))
    expect(stages[stages.length - 1].own.str).toBe(tina.own.str)
  })

  it('promotes with a Master Seal from Lv 10 to Lv 1, keeping HP and the own stats ($87:C09E, $87:C113)', () => {
    const osian = unit('Osian')
    const stages = project(data, osian, plan({ promote: true, promoteAt: 4, targetLevel: 1 }))
    const [before, promoted] = stages.slice(-2)
    expect(before.level).toBe(10)
    expect(promoted).toMatchObject({ classId: osian.promotion!.classId, level: 1, how: 'seal' })
    expect(promoted.own).toEqual(before.own)
    const fighter = data.classes[osian.classId]
    const hero = data.classes[osian.promotion!.classId]
    expect(shownStats(hero, promoted.own).hp).toBe(shownStats(fighter, before.own).hp)
    expect(shownStats(hero, promoted.own).str - shownStats(fighter, before.own).str).toBe(hero.bases.str - fighter.bases.str)
  })

  it('makes the story class changes at any level: Leif at the end of Ch.18, Lara a Dancer before her Master Seal', () => {
    expect(pathOf(unit('Leif'), plan({ promote: true, promoteAt: 7 })).map((s) => [data.classes[s.classId].name, s.from, s.to])).toEqual([
      ['Lord', 1, 7],
      ['Prince', 1, 20],
    ])
    const lara = pathOf(unit('Lara'), plan({ stepAt: 5, promote: true, promoteAt: 3 }))
    expect(lara.map((s) => [data.classes[s.classId].name, s.from, s.to, s.how])).toEqual([
      ['Thief', 2, 5, 'joins'],
      ['Dancer', 1, 10, 'story'],
      ['Rogue', 1, 20, 'seal'],
    ])
  })

  it("shows a mounted unit on foot in the dismounted class's bases", () => {
    const finn = unit('Finn')
    const mounted = data.classes[finn.classId]
    const onFoot = data.classes[mounted.dismounted!]
    expect(shownStats(mounted, finn.own).spd - shownStats(onFoot, finn.own).spd).toBe(2)
    expect(shownStats(mounted, finn.own).mov - shownStats(onFoot, finn.own).mov).toBe(3)
    expect(ranksOf(onFoot, finn).map((r) => `${r.weapon} ${r.letter}`)).toEqual(['sword D'])
  })

  it("gives a new weapon type the class's rank on promotion (Osian as a Hero: Sword D)", () => {
    const osian = unit('Osian')
    expect(ranksOf(data.classes[osian.promotion!.classId], osian).map((r) => `${r.weapon} ${r.letter}`)).toEqual(['sword D', 'axe E'])
  })

  it("lists skills by the class: the unit's own, the class's and what the plan teaches", () => {
    const lara = unit('Lara')
    expect(skillsAt(data, lara, lara.storyStep!.classId)).toEqual(['Steal', 'Dance'])
    expect(skillsAt(data, unit('Asbel'), cls('Sage').id)).toEqual(['Adept'])
    const mareeta = unit('Mareeta')
    const sol = data.manuals.find((m) => m.skill === 'Sol')!
    expect(skillsAt(data, mareeta, mareeta.classId, plan({ manuals: [sol.id], storySkill: true }))).toEqual(['Luna', 'Sol', 'Astra'])
  })

  it("adds the rings at the end, held at the caps ($87:BCBF)", () => {
    const leif = unit('Leif')
    const life = data.rings.find((r) => r.name === 'Life Ring')!
    const stages = project(data, leif, plan({ targetLevel: 1, rings: { [life.id]: 2 } }))
    expect(stages[stages.length - 1]).toMatchObject({ how: 'rings' })
    expect(stages[stages.length - 1].own.hp).toBe(leif.own.hp + 14)
  })

  it('drops the units of the picks not taken, and moves Sara to 16B on route B', () => {
    const names = (picks: Record<string, number>) => [...excludedUnits(data, picks)].map((id) => data.units.find((u) => u.id === id)!.name).sort()
    expect(names({ 'fe5-route': 0 })).toEqual(['Amalda', 'Conomor', 'Miranda', 'Schroff', 'Shannam'])
    expect(names({ 'fe5-route': 1 })).toEqual(['Conomor', 'Miranda', 'Shannam'])
    expect(names({ 'fe5-route': 2 })).toEqual(['Amalda', 'Ilios', 'Misha', 'Schroff'])
    expect(names({ 'fe5-ced-saias': 1, 'fe5-olwen-ilios': 0 })).toEqual(['Ced', 'Ilios'])
    expect(joinOf(unit('Sara'), { 'fe5-route': 2 }).joinChapter).toBe('fe5-16b')
    expect(joinOf(unit('Sara'), { 'fe5-route': 1 }).joinChapter).toBe('fe5-17a')
  })

  it('flags a manual two plans use (the game has one copy)', () => {
    const sol = data.manuals.find((m) => m.skill === 'Sol')!.id
    const plans: Record<string, Fe5Plan> = { [unit('Leif').id]: plan({ manuals: [sol] }), [unit('Finn').id]: plan({ manuals: [sol] }) }
    const clashes = manualClashes(data.units, (u) => plans[u.id] ?? plan({}))
    expect(clashes.get(sol)?.map((u) => u.name)).toEqual(['Leif', 'Finn'])
  })

  it('reads plans saved before the review', () => {
    const finn = unit('Finn')
    expect(normalizePlan(finn, { promoteTo: '8', promoteAt: 15, targetLevel: 20, scrolls: [{ scrollId: '146', levels: 3 }] })).toMatchObject({
      promote: true,
      promoteAt: 15,
      targetLevel: 20,
      scrolls: [{ scrollIds: ['146'], levels: 3 }],
    })
    expect(normalizePlan(finn, { promoteTo: null, promoteAt: 20, targetLevel: 12 }).promote).toBe(false)
  })
})
