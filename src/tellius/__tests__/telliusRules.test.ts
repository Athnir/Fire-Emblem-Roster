import { describe, expect, it } from 'vitest'
import { FE10_DATA } from '../../games/fe10'
import { FE9_DATA } from '../../games/fe9'
import { excludedUnits } from '../choiceStore'
import {
  bexpCost,
  bexpGains,
  bondsOf,
  cannotAdd,
  capacityOf,
  capacityUsed,
  growthGain,
  joinStats,
  learnableSkills,
  project,
  promotionsOf,
  skillCount,
  transformedStats,
  weaponsText,
} from '../logic'
import { TELLIUS_STATS, type TelliusStat, type TelliusStats } from '../types'

// The rules the Tellius screens follow, each traced in the game's program (main.dol; see data-raw/fe9 and fe10's READMEs).

const fe9 = (name: string) => FE9_DATA.units.find((u) => u.name === name)!
const fe10 = (name: string) => FE10_DATA.units.find((u) => u.name === name)!
const stats = (values: number[]): TelliusStats => Object.fromEntries(TELLIUS_STATS.map((s, i) => [s, values[i]])) as TelliusStats
const list = (s: TelliusStats) => TELLIUS_STATS.map((k) => s[k])

describe('growth rolls (both games)', () => {
  it('gives a sure point per 100 and rolls the rest; Blossom rolls a failed roll again', () => {
    expect(growthGain(40)).toBeCloseTo(0.4)
    expect(growthGain(130)).toBeCloseTo(1.3)
    expect(growthGain(40, true)).toBeCloseTo(0.64)
    expect(growthGain(50, true)).toBeCloseTo(0.75)
    expect(growthGain(150, true)).toBeCloseTo(1.75)
  })
})

describe('Path of Radiance rules', () => {
  it("transforms a laguz into the other form's bases, not double (0x8003bbd4)", () => {
    // Lethe, a Cat: the transformed form's bases are Str +6, Skl +4, Spd +3, Def +5, Res +3 on the other's.
    const lethe = fe9('Lethe')
    const t = transformedStats(FE9_DATA, lethe.classId, lethe.bases)!
    expect(list(t.stats)).toEqual([34, 18, 4, 14, 15, 15, 14, 10])
  })

  it("keeps the Ranger and the Thief to the story's promotions: Ike at Ch.18, Volke at Ch.19's end, Sothe never", () => {
    expect(promotionsOf(FE9_DATA, fe9('Ike')).map((c) => c.name)).toEqual(['Lord'])
    expect(promotionsOf(FE9_DATA, fe9('Volke')).map((c) => c.name)).toEqual(['Assassin'])
    expect(promotionsOf(FE9_DATA, fe9('Sothe'))).toEqual([])
    expect(fe9('Ike').storyPromotions).toEqual([{ chapter: 'fe9-18', when: 'start' }])
    expect(fe9('Volke').storyPromotions?.[0]).toMatchObject({ chapter: 'fe9-19', when: 'end' })
    expect([FE9_DATA.classes.JID_RANGER.storyPromotion, FE9_DATA.classes.JID_THIEF.storyPromotion]).toEqual([true, true])
  })

  it('halves Fixed mode growth points at promotion, rounding down (0x8003d464)', () => {
    const stages = project(FE9_DATA, fe9('Ike'), { promoteAt: 20, targetLevel: 5, mode: 'fixed', skills: [] })
    const before = stages[1].points!
    const after = stages[2].points!
    for (const s of TELLIUS_STATS) expect([s, after[s]]).toEqual([s, Math.floor(before[s] / 2)])
  })

  it("counts Sothe's Blossom while he carries it, as he does from the start", () => {
    const sothe = fe9('Sothe')
    const plan = { promoteAt: null, targetLevel: 11 }
    const without = project(FE9_DATA, sothe, { ...plan, skills: [] }).at(-1)!
    const withIt = project(FE9_DATA, sothe, { ...plan, skills: ['SID_FRAC90'] }).at(-1)!
    // 10 level-ups: Str 55% becomes 1 - 0.45^2 = 79.75%.
    expect(withIt.stats.str - without.stats.str).toBeCloseTo(10 * (0.7975 - 0.55))
    // Fixed mode: 90 points a stat. Str starts at 0 points and gains 55 a level: 55, 110 -> +1 (20 left), 75, 130 -> +1...
    const fixed = project(FE9_DATA, sothe, { ...plan, mode: 'fixed', skills: ['SID_FRAC90'] }).at(-1)!
    const plainFixed = project(FE9_DATA, sothe, { ...plan, mode: 'fixed', skills: [] }).at(-1)!
    expect(fixed.stats.str - plainFixed.stats.str).toBeGreaterThanOrEqual(1)
  })

  it("counts every skill but the class's against capacity, five at most, and Smite needs Shove (no Canto)", () => {
    const sothe = fe9('Sothe')
    expect(capacityUsed(FE9_DATA, sothe, sothe.classId, sothe.skills)).toBe(15)
    expect(skillCount(FE9_DATA, sothe.classId, sothe.skills)).toBe(1)
    // A foot class has Shove; a mounted one (Canto) doesn't, so no Smite.
    expect(learnableSkills(FE9_DATA, fe9('Ike'), 'JID_RANGER')).toContain('SID_TACKLE2')
    expect(learnableSkills(FE9_DATA, fe9('Oscar'), fe9('Oscar').classId)).not.toContain('SID_TACKLE2')
    const five = Object.values(FE9_DATA.skills)
      .filter((s) => s.scroll && s.capacity === 0 && !s.onlyClasses)
      .map((s) => s.id)
    const carried = [...five, ...Object.values(FE9_DATA.skills).filter((s) => s.scroll && !s.onlyClasses && !five.includes(s.id)).map((s) => s.id)].slice(0, 5)
    expect(carried).toHaveLength(5)
    const sixth = Object.values(FE9_DATA.skills).find((s) => s.scroll && !carried.includes(s.id))!.id
    expect(cannotAdd(FE9_DATA, fe9('Ike'), 'JID_HERO', 20, carried, sixth)).toMatch(/at most 5 skills besides/)
  })

  it("lets you pick who joins: Nasir or Ena, and Tibarn, Naesala, Giffca or no one", () => {
    const [knight, royal] = FE9_DATA.choices!
    expect(knight.options.map((o) => o.units)).toEqual([['PID_NASIR'], ['PID_ENA']])
    expect(royal.options.map((o) => o.units)).toEqual([['PID_TIBARN'], ['PID_NAESALA'], ['PID_GIFFCA'], []])
    expect([...excludedUnits(FE9_DATA, { [knight.id]: 0 })]).toEqual(['PID_ENA'])
    expect([...excludedUnits(FE9_DATA, { [royal.id]: 3 })].sort()).toEqual(['PID_GIFFCA', 'PID_NAESALA', 'PID_TIBARN'])
    expect(excludedUnits(FE9_DATA, {}).size).toBe(0)
    for (const name of ['Nasir', 'Ena', 'Tibarn', 'Naesala', 'Giffca']) expect([name, fe9(name).unconfirmed]).toEqual([name, undefined])
  })
})

describe('Radiant Dawn rules', () => {
  it('gives exactly three stats on a bonus EXP level-up (0x8006d790)', () => {
    const room = Object.fromEntries(TELLIUS_STATS.map((s) => [s, true])) as Record<TelliusStat, boolean>
    const sum = (s: TelliusStats) => TELLIUS_STATS.reduce((n, k) => n + s[k], 0)
    expect(sum(bexpGains(fe10('Edward').growths, room))).toBeCloseTo(3)
    // Nothing rises: the three highest growths are added, the earlier first on a tie.
    expect(list(bexpGains(stats([0, 0, 0, 0, 0, 0, 0, 0]), room))).toEqual([1, 1, 1, 0, 0, 0, 0, 0])
    // Five sure rises at the same growth: the earlier ones are dropped.
    expect(list(bexpGains(stats([100, 100, 100, 100, 100, 0, 0, 0]), room))).toEqual([0, 0, 1, 1, 1, 0, 0, 0])
    // A stat at its cap isn't rolled or added.
    const capped = { ...room, hp: false }
    expect(bexpGains(stats([0, 0, 0, 0, 0, 0, 0, 0]), capped).hp).toBe(0)
  })

  it('costs 100 x (1 + f(L - 1)) bonus EXP a level (0x80120524)', () => {
    const myrmidon = FE10_DATA.classes[fe10('Edward').classId]
    expect([bexpCost(myrmidon, 4, 'easy'), bexpCost(myrmidon, 4, 'normal'), bexpCost(myrmidon, 4, 'hard')]).toEqual([200, 250, 400])
    // Normal is 50L + 50 (Serenes Forest's), L counting 20 more in a second tier.
    expect(bexpCost(FE10_DATA.classes.JID_SWORDMASTER, 1, 'normal')).toBe(50 * 21 + 50)
    expect(bexpCost(myrmidon, 1, 'hard')).toBe(100)
  })

  it("counts class skills against capacity, six skills all told, and laguz capacity grows with level", () => {
    // Leonardo, an Archer: Shove's 5 of 15; his own Cancel is free.
    const leo = fe10('Leonardo')
    expect(capacityUsed(FE10_DATA, leo, leo.classId, leo.skills)).toBe(5)
    expect(skillCount(FE10_DATA, leo.classId, leo.skills)).toBe(2)
    const lethe = fe10('Lethe')
    expect([14, 15, 29, 30].map((lv) => capacityOf(FE10_DATA, lethe.classId, lv))).toEqual([20, 35, 35, 70])
  })

  it("promotes Sothe at the end of Part 4's Prologue, Ike at its start", () => {
    expect(fe10('Sothe').storyPromotions).toEqual([{ chapter: 'fe10-4-prologue', when: 'end' }])
    expect(fe10('Ike').storyPromotions).toEqual([{ chapter: 'fe10-4-prologue', when: 'start' }])
  })

  it('matches 51 units to a Path of Radiance save, as the program\'s table does', () => {
    expect(FE10_DATA.units.filter((u) => u.porUnit)).toHaveLength(51)
    expect(fe10('Danved').porUnit).toBe('PID_DALAHOWE')
    // Largo's entry names Calill too, but hers comes first; the Black Knight's names DARKKNIGHT, not DARKKNIGHT_0.
    expect(fe10('Calill').porUnit).toBe('PID_CALILL')
    expect(fe10('Calill').porShadowed).toEqual(['Largo'])
    expect(FE10_DATA.units.filter((u) => u.porShadowed).map((u) => u.name)).toEqual(['Calill'])
    expect(fe10('Black Knight').porUnit).toBeUndefined()
  })

  it('adds +5 HP or +2 for each stat capped there, held at the caps; Sothe takes his stats there', () => {
    const ike = fe10('Ike')
    const raised = joinStats(FE10_DATA, ike, { capped: ['hp', 'str', 'spd'] })
    expect([raised.hp - ike.bases.hp, raised.str - ike.bases.str, raised.spd - ike.bases.spd, raised.def - ike.bases.def]).toEqual([5, 2, 2, 0])
    const sothe = fe10('Sothe')
    const copied = joinStats(FE10_DATA, sothe, { stats: { hp: 38, str: 99 } })
    expect([copied.hp, copied.str, copied.mag]).toEqual([38, FE10_DATA.classes[sothe.classId].caps.str, sothe.bases.mag])
  })

  it('makes a +5 bond of a Path of Radiance A support, unless the pair has one', () => {
    // Ike and Oscar: no bond in the game's data; Ike and Soren have one already.
    const plans = { PID_IKE: { transfer: { aSupports: ['PID_OSCAR', 'PID_SENERIO'] } } }
    const bonds = bondsOf(FE10_DATA, 'PID_IKE', plans)
    expect(bonds.find((b) => b.partner.name === 'Oscar')).toMatchObject({ fromPor: true, bond: { value: 5 } })
    expect(bonds.filter((b) => b.partner.name === 'Soren')).toHaveLength(1)
    expect(bondsOf(FE10_DATA, 'PID_OSCAR', plans).map((b) => b.partner.name)).toContain('Ike')
    expect(bondsOf(FE10_DATA, 'PID_IKE').map((b) => b.partner.name)).not.toContain('Oscar')
  })

  it('says which talks need a Path of Radiance A support', () => {
    expect(fe10('Jill').talkedBack?.[0]).toMatchObject({ with: ['Haar', 'Mist'], porA: ['Mist'] })
    expect(fe10('Zihark').talkedBack?.[0]).toMatchObject({ porA: ['Brom', 'Ilyana'] })
    expect(fe10('Soren').porNotes?.[0]).toMatch(/Ike/)
  })

  it('keeps Volug half-transformed in Part 1: x1.5, rounded down, HP and Luck aside', () => {
    const volug = fe10('Volug')
    expect(volug.halfTransformed?.every((id) => id.startsWith('fe10-1-'))).toBe(true)
    const half = transformedStats(FE10_DATA, volug.classId, volug.bases, true)!
    expect(list(half.stats)).toEqual([49, 16, 3, 18, 19, 13, 13, 7])
    expect(list(transformedStats(FE10_DATA, volug.classId, volug.bases)!.stats)).toEqual([49, 22, 4, 24, 26, 13, 18, 10])
  })

  it("shows each class's weapon ranks and the highest it reaches", () => {
    expect(weaponsText(FE10_DATA, 'JID_SWORDMASTER')).toMatch(/^Sword C \(up to SS?\)$/)
    expect(FE10_DATA.classes.JID_ARCHER.maxRanks).toBeDefined()
  })
})
