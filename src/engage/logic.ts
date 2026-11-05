import { FE17_STATS, type Fe17BondRingSet, type Fe17Booster, type Fe17Chapter, type Fe17Class, type Fe17Emblem, type Fe17Stat, type Fe17Stats, type Fe17StatsMov, type Fe17Support, type Fe17Unit } from './types'

// Fire Emblem Engage's units, as the program works them out (methods and addresses in data-raw/fe17/README.md).

export interface Fe17Data {
  gameId: string
  chapters: Fe17Chapter[]
  units: Fe17Unit[]
  classes: Record<string, Fe17Class>
  emblems: Fe17Emblem[]
  bondRings: Fe17BondRingSet[]
  supports: Fe17Support[]
  skills: Record<string, string>
  boosters: Fe17Booster[]
  /** The skills that come in levels, each chain lowest first. */
  chains: string[][]
}

const MOV_KEYS = [...FE17_STATS, 'mov'] as (Fe17Stat | 'mov')[]

/** A unit's caps in a class: the class's plus the unit's modifiers (GetCapabilityLimit 0x1a30a90). */
export function capsOf(cls: Fe17Class, unit: Fe17Unit): Fe17StatsMov {
  const out = {} as Fe17StatsMov
  for (const s of MOV_KEYS) out[s] = Math.max(0, cls.caps[s] + (unit.capMods[s] ?? 0))
  return out
}

/** What the game shows before anything worn or synced (GetNoEnhanceCapability 0x1a30d10): the class's base plus the unit's own, held
 * at 0 and the caps. A class change keeps the unit's own, so the shown stats move by the classes' bases. */
export function shownStats(cls: Fe17Class, unit: Fe17Unit, own: Fe17StatsMov): Fe17StatsMov {
  const caps = capsOf(cls, unit)
  const out = {} as Fe17StatsMov
  for (const s of MOV_KEYS) out[s] = Math.min(caps[s], Math.max(0, own[s] + cls.bases[s]))
  return out
}

export interface Fe17GrowthOptions {
  /** Jean's Expertise: the class's growths count twice (JobGrowChange). */
  expertise?: boolean
  /** Tiki's Starsphere: +15 to every growth (TotalGrowChange). */
  starsphere?: boolean
}

/** A unit's growths in a class (GetCapabilityGrow 0x1a2ff20): their own plus the class's, held at 0 to 255. */
export function growthsIn(unit: Fe17Unit, cls: Fe17Class, opts: Fe17GrowthOptions = {}): Fe17Stats {
  const out = {} as Fe17Stats
  for (const s of FE17_STATS) {
    const g = unit.growths[s] + cls.growths[s] * (opts.expertise ? 2 : 1) + (opts.starsphere ? 15 : 0)
    out[s] = Math.min(255, Math.max(0, g))
  }
  return out
}

/**
 * A level's average gain in random mode (Unit.LevelUp 0x1a3a040): each stat gets a point per full 100 of its growth, then rolls the
 * rest; a stat at its cap gains nothing. A level with fewer than 2 points is rolled again, up to 4 tries, and the try with the most
 * points is kept. `capped`: the stats at their caps already.
 */
export function levelGain(growths: Fe17Stats, capped: Set<Fe17Stat> = new Set()): Fe17Stats {
  const sure = {} as Fe17Stats
  const p = {} as Fe17Stats
  for (const s of FE17_STATS) {
    const g = capped.has(s) ? 0 : growths[s]
    sure[s] = Math.floor(g / 100)
    p[s] = (g % 100) / 100
  }
  const S = FE17_STATS.reduce((sum, s) => sum + sure[s], 0)
  const out = {} as Fe17Stats
  if (S >= 2) {
    for (const s of FE17_STATS) out[s] = sure[s] + p[s]
    return out
  }
  const none = FE17_STATS.reduce((prod, s) => prod * (1 - p[s]), 1)
  const geo = (r: number) => (r >= 1 ? 4 : (1 - r ** 4) / (1 - r))
  if (S === 1) {
    // Another try only while no roll succeeds.
    for (const s of FE17_STATS) out[s] = sure[s] + p[s] * geo(none)
    return out
  }
  const onlyOf = (k: Fe17Stat) => FE17_STATS.reduce((prod, s) => prod * (s === k ? p[s] : 1 - p[s]), 1)
  const one = FE17_STATS.reduce((sum, s) => sum + onlyOf(s), 0)
  const r = none + one
  for (const s of FE17_STATS) {
    const alone = onlyOf(s)
    out[s] = (p[s] - alone) * geo(r) + (one > 0 ? ((r ** 4 - none ** 4) * alone) / one : 0)
  }
  return out
}

export type Fe17Difficulty = 'normal' | 'hard' | 'maddening'
/** The internal level's cap by difficulty (calculator.xml 内部レベル計算). */
export const INTERNAL_CAP: Record<Fe17Difficulty, number> = { normal: 30, hard: 40, maddening: 50 }

export interface Fe17Step {
  /** The level in the class held when changing. */
  at: number
  to: string
}

export interface Fe17Plan {
  steps: Fe17Step[]
  targetLevel: number
  /** Fixed growths (a setting at the start): each level adds the growth to a running total, a point at every 100. */
  fixed?: boolean
  difficulty?: Fe17Difficulty
  /** The emblem synced, and the bond level with each emblem (for the proficiencies they grant and the skills to inherit). */
  emblem?: string
  bonds?: Record<string, number>
  /** Skills inherited from the emblems (two slots). */
  inherited?: string[]
  /** How many of each stat booster used. */
  boosters?: Record<string, number>
  expertise?: boolean
  starsphere?: boolean
}

export const defaultPlan = (u: Fe17Unit): Fe17Plan => ({ steps: [], targetLevel: u.level })

/** The two Alears (as Fates' two Corrins): the player's Alear is a man or a woman, so both are listed. */
export const ALEAR_FEMALE = 'fe17-alear-female'
export const isAlear = (u: Fe17Unit) => u.id === 'fe17-alear' || u.id === ALEAR_FEMALE

/** A unit's name where both Alears show: "Alear (male)", "Alear (female)". */
export const labelOf = (u: Fe17Unit) => (isAlear(u) ? `${u.name} (${u.female ? 'female' : 'male'})` : u.name)

/** The weapons a unit is proficient in under a plan: what they join with, and what their planned emblem bonds grant (each bond
 * level-up adds its proficiency: Unit.InheritAptitude 0x1a3dd90). */
export function proficienciesOf(data: Fe17Data, unit: Fe17Unit, plan: Fe17Plan): string[] {
  const out = new Set(unit.proficiencies)
  for (const [id, level] of Object.entries(plan.bonds ?? {})) {
    const e = data.emblems.find((x) => x.id === id)
    for (const lv of e?.levels ?? []) if (lv.level <= level) lv.proficiency.forEach((w) => out.add(w))
  }
  return [...out]
}

/** Whether a unit may be in a class at all: a unique class only for its own units, a flier only for women. */
export function canBe(cls: Fe17Class, unit: Fe17Unit): boolean {
  if (cls.uniqueTo && !cls.uniqueTo.includes(unit.id)) return false
  if (cls.femaleOnly && !unit.female) return false
  return true
}

/** The proficiencies a class asks for, met (CCCheckAptitude 0x1a3c5f0): every "always" weapon, and enough of its choices. The Mage
 * Cannoneer asks for none (only the Mage Cannon). */
export function meetsNeeds(cls: Fe17Class, have: string[]): boolean {
  if (!cls.needs.all.every((w) => have.includes(w))) return false
  return cls.needs.from.filter((w) => have.includes(w)).length >= cls.needs.choose
}

export interface Fe17Change {
  to: string
  /** The lowest level of the class held to change at. */
  minLevel: number
  seal: 'master' | 'second' | 'item'
}

/**
 * Where a class can change to (CCCheck 0x19c6700): a base class's promotions with a Master Seal from Lv 10; with a Second Seal any
 * other class the unit may be in (a base or special class to an advanced one only by promotion, a special class's from Lv 21), its own
 * class at its top level; the Enchanter and Mage Cannoneer with their items, from Lv 10 out of a base or special class.
 */
export function changesFrom(data: Fe17Data, unit: Fe17Unit, fromId: string, have: string[]): Fe17Change[] {
  const from = data.classes[fromId]
  const out: Fe17Change[] = []
  for (const cls of Object.values(data.classes)) {
    if (!canBe(cls, unit)) continue
    if (cls.items?.length) {
      if (cls.id !== from.id) out.push({ to: cls.id, minLevel: from.tier === 'advanced' ? 1 : 10, seal: 'item' })
      continue
    }
    if (!meetsNeeds(cls, have)) continue
    if (cls.id === from.id) {
      out.push({ to: cls.id, minLevel: from.maxLevel, seal: 'second' })
      continue
    }
    if (from.tier === 'base' && cls.tier === 'advanced') {
      if (from.promotesTo.includes(cls.id)) out.push({ to: cls.id, minLevel: 10, seal: 'master' })
      continue
    }
    if (from.tier === 'special' && cls.tier === 'advanced') {
      out.push({ to: cls.id, minLevel: 21, seal: 'second' })
      continue
    }
    out.push({ to: cls.id, minLevel: 1, seal: 'second' })
  }
  return out
}

/** The level after a class change (Unit.ClassChange 0x1a3c7b0): 1; into a class that goes to Lv 40, 21 when coming from an advanced
 * class or from such a class at Lv 21 or more. */
export function levelAfter(from: Fe17Class, at: number, to: Fe17Class): number {
  if (to.maxLevel > 20 && (from.tier === 'advanced' || (from.maxLevel > 20 && at >= 21))) return 21
  return 1
}

/** The internal level after a class change: the levels so far are added (held at the difficulty's cap); into Lv 21, 20 fewer. */
export function internalAfter(internal: number, at: number, newLevel: number, cap: number): number {
  const v = Math.min(cap, Math.max(0, internal + at - 1))
  return newLevel === 21 ? Math.max(v - 20, 0) : v
}

export interface Fe17Stage {
  classId: string
  level: number
  internal: number
  own: Fe17StatsMov
  how: 'joins' | 'level' | 'change' | 'target' | 'boosters'
}

/** A plan's steps, up to the first the game doesn't allow. */
export function legalSteps(data: Fe17Data, unit: Fe17Unit, plan: Fe17Plan): Fe17Step[] {
  const have = proficienciesOf(data, unit, plan)
  const out: Fe17Step[] = []
  let cls = data.classes[unit.classId]
  let level = unit.level
  for (const step of plan.steps) {
    const change = changesFrom(data, unit, cls.id, have).find((c) => c.to === step.to)
    const at = Math.max(level, Math.min(cls.maxLevel, step.at))
    if (!change || at < change.minLevel) break
    out.push({ at, to: step.to })
    const next = data.classes[step.to]
    level = levelAfter(cls, at, next)
    cls = next
  }
  return out
}

/** Stats along a plan: averages in random mode, the game's own running totals in fixed mode. Level-ups add to the unit's own stats
 * while the shown stat is below its cap; a class change keeps them and swaps the class's bases and caps. Boosters count at the end. */
export function project(data: Fe17Data, unit: Fe17Unit, plan: Fe17Plan): Fe17Stage[] {
  const steps = legalSteps(data, unit, plan)
  const cap = INTERNAL_CAP[plan.difficulty ?? 'normal']
  let cls = data.classes[unit.classId]
  let level = unit.level
  let internal = unit.internalLevel || cls.internalLevel
  let own = { ...unit.own }
  // Fixed mode's running totals start at the unit's growth rates (CreateImpl1).
  const acc = { ...unit.growths }
  const grow = (from: Fe17StatsMov, levels: number, c: Fe17Class) => {
    const out = { ...from }
    const growths = growthsIn(unit, c, plan)
    const caps = capsOf(c, unit)
    for (let i = 0; i < levels; i++) {
      const capped = new Set(FE17_STATS.filter((s) => out[s] + c.bases[s] >= caps[s]))
      if (plan.fixed) {
        for (const s of FE17_STATS) {
          if (capped.has(s)) continue
          acc[s] += growths[s]
          while (acc[s] >= 100 && out[s] + c.bases[s] < caps[s]) {
            out[s] += 1
            acc[s] -= 100
          }
        }
      } else {
        const gain = levelGain(growths, capped)
        // A stat over its cap (from a class with higher caps) keeps what it has.
        for (const s of FE17_STATS) if (!capped.has(s)) out[s] = Math.min(caps[s] - c.bases[s], out[s] + gain[s])
      }
    }
    return out
  }
  const stages: Fe17Stage[] = [{ classId: cls.id, level, internal, own, how: 'joins' }]
  for (const step of steps) {
    if (step.at > level) {
      own = grow(own, step.at - level, cls)
      level = step.at
      stages.push({ classId: cls.id, level, internal, own, how: 'level' })
    }
    const next = data.classes[step.to]
    const newLevel = levelAfter(cls, level, next)
    internal = internalAfter(internal, level, newLevel, cap)
    cls = next
    level = newLevel
    stages.push({ classId: cls.id, level, internal, own, how: 'change' })
  }
  const target = Math.max(level, Math.min(cls.maxLevel, plan.targetLevel))
  if (target > level) {
    own = grow(own, target - level, cls)
    stages.push({ classId: cls.id, level: target, internal, own, how: 'target' })
  }
  if (Object.values(plan.boosters ?? {}).some((n) => n > 0)) stages.push({ classId: cls.id, level: target, internal, own: boost(data, unit, cls, own, plan), how: 'boosters' })
  return stages
}

/** Stat boosters (ItemUseImpl 0x1a4c690): each adds its amount to the unit's own stat, usable only while the stat is below its cap (a
 * +2 one point short stores one over); Boots while their bonus is under 2. */
function boost(data: Fe17Data, unit: Fe17Unit, cls: Fe17Class, own: Fe17StatsMov, plan: Fe17Plan): Fe17StatsMov {
  const out = { ...own }
  const caps = capsOf(cls, unit)
  for (const b of data.boosters) {
    for (let i = 0; i < (plan.boosters?.[b.name] ?? 0); i++) {
      for (const [s, v] of Object.entries(b.raises) as [Fe17Stat | 'mov', number][]) {
        if (s === 'mov' ? out.mov - unit.own.mov < 2 : out[s] + cls.bases[s] < caps[s]) out[s] += v
      }
    }
  }
  return out
}

/** The emblem's sync bonus at a bond level: the stat skills it gives then, which show on top of the caps. */
export function syncBonus(emblem: Fe17Emblem | undefined, level: number): Partial<Fe17StatsMov> {
  const lv = emblem?.levels.filter((l) => l.level <= level).pop()
  return lv?.stats ?? {}
}

/** The class skills a stage has learned: the class's at its level (5, or 25 in a class to Lv 40); changing class loses them. */
export function classSkill(cls: Fe17Class, level: number): string | undefined {
  return cls.learns && level >= cls.learns.level ? cls.learns.skill : undefined
}

/** Every skill a unit can inherit from the emblems, with the bond level and SP each needs. */
export function inheritable(data: Fe17Data): { name: string; emblem: string; level: number; sp: number }[] {
  const out: { name: string; emblem: string; level: number; sp: number }[] = []
  for (const e of data.emblems) for (const lv of e.levels) for (const s of lv.inherit) out.push({ name: s.name, emblem: e.name, level: lv.level, sp: s.sp })
  return out
}

/** The chapter that opens the Pact Ring: the end of Paralogue "The Connector" (S015, after Chapter 22) sets the permit
 * (UnitReliancePermitAPlus; data-raw/fe17/README.md 2.9). */
export const PACT_RING_CHAPTER = 'CID_S015'

/** Who an Alear can give the Pact Ring: one partner, from those with an A support (as the ring's text says; the code's check for it
 * wasn't found, data-raw/fe17/README.md, unconfirmed 3). */
export function pactPartners(data: Fe17Data, alearId: string): string[] {
  return supportsOf(data, alearId)
    .filter((s) => s.top === 'A')
    .map((s) => s.partner)
}

/** A unit's supports, with each partner and the highest rank. */
export function supportsOf(data: Fe17Data, unitId: string): { partner: string; top: string }[] {
  return data.supports.filter((s) => s.a === unitId || s.b === unitId).map((s) => ({ partner: s.a === unitId ? s.b : s.a, top: s.top }))
}

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export const chapterLabel = (data: Fe17Data, id: string) => data.chapters.find((c) => c.id === id)?.label ?? id
