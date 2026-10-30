import { FE13_STATS, type Fe13Class, type Fe13Stat, type Fe13Stats, type Fe13Unit } from './types'

export interface Fe13Data {
  chapters: { id: string; label: string }[]
  units: Fe13Unit[]
  classes: Record<string, Fe13Class>
}

export const MAX_LEVEL = 20
/** A Master Seal promotes, and a Second Seal changes class, from Lv 10 (Serenes Forest). */
export const SEAL_LEVEL = 10

/** A step of a plan: change into `to` at level `at` of the class the unit is in. */
export interface Fe13Step {
  at: number
  to: string
}

export interface Fe13Plan {
  steps: Fe13Step[]
  targetLevel: number
}

export interface Fe13Stage {
  classId: string
  level: number
  stats: Fe13Stats
}

/** The classes a unit can change into from a class: its promotions, and with a Second Seal any class of the unit's set (the base
 * classes and what they promote to). */
export function classOptions(data: Fe13Data, unit: Fe13Unit, from: string, set = classSetOf(unit)): string[] {
  const cls = data.classes[from]
  const reachable = new Set<string>()
  for (const id of set) {
    reachable.add(id)
    for (const p of data.classes[id]?.promotesTo ?? []) reachable.add(p)
  }
  return [...new Set([...cls.promotesTo, ...reachable])].filter((id) => id !== from && data.classes[id])
}

export function classSetOf(unit: Fe13Unit, female = unit.female): string[] {
  return female ? unit.classSets.female : unit.classSets.male
}

/** A class's maximums for a unit: the class's plus the unit's modifiers. */
export function capsOf(cls: Fe13Class, modifiers: Partial<Fe13Stats>): Fe13Stats {
  const out = { ...cls.caps }
  for (const s of FE13_STATS) out[s] += modifiers[s] ?? 0
  return out
}

/** Average stats: each level adds the personal growth and the class's, held at the class's maximums plus the modifiers. Changing class
 * adds the difference between the two classes' bases and starts the new class at Lv 1 (Serenes Forest; not traced in the code). */
export function project(
  data: Fe13Data,
  unit: Fe13Unit,
  plan: Fe13Plan,
  start: Fe13Stats = unit.bases,
  growths: Fe13Stats = unit.growths,
  modifiers: Partial<Fe13Stats> = unit.modifiers,
): Fe13Stage[] {
  let cls = data.classes[unit.classId]
  let level = unit.level
  let stats: Fe13Stats = { ...start }
  const stages: Fe13Stage[] = [{ classId: cls.id, level, stats }]
  const grow = (from: Fe13Stats, levels: number, c: Fe13Class) => {
    const caps = capsOf(c, modifiers)
    const out = { ...from }
    for (const s of FE13_STATS) out[s] = Math.min(caps[s], out[s] + (((growths[s] ?? 0) + (c.growths?.[s] ?? 0)) / 100) * Math.max(0, levels))
    return out
  }
  for (const step of plan.steps) {
    const next = data.classes[step.to]
    if (!next) break
    const at = Math.max(level, Math.min(MAX_LEVEL, step.at))
    if (at > level) {
      stats = grow(stats, at - level, cls)
      stages.push({ classId: cls.id, level: at, stats })
    }
    const caps = capsOf(next, modifiers)
    stats = { ...stats }
    for (const s of FE13_STATS) stats[s] = Math.min(caps[s], stats[s] + next.bases[s] - cls.bases[s])
    cls = next
    level = 1
    stages.push({ classId: cls.id, level, stats })
  }
  const target = Math.max(level, Math.min(MAX_LEVEL, plan.targetLevel))
  if (target > level) stages.push({ classId: cls.id, level: target, stats: grow(stats, target - level, cls) })
  return stages
}

/** Every skill the classes of a plan teach by the levels it reaches. */
export function skillsOf(data: Fe13Data, stages: Fe13Stage[]): string[] {
  const reached = new Map<string, number>()
  for (const st of stages) reached.set(st.classId, Math.max(reached.get(st.classId) ?? 0, st.level))
  const out: string[] = []
  for (const [id, lv] of reached) for (const s of data.classes[id]?.skills ?? []) if (s.level <= lv && !out.includes(s.skill)) out.push(s.skill)
  return out
}

/** The units a unit can marry: their S supports. */
export function spousesOf(data: Fe13Data, unit: Fe13Unit): Fe13Unit[] {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  return unit.supports.filter((s) => s.levels[3] !== null).map((s) => byId.get(s.partner)!).filter(Boolean)
}


// Inheritance (Serenes Forest's children, base-stat, growth and modifier pages, and the Fire Emblem Wiki's inheritance page; not
// traced in the game's code). The gender swaps (Olivia's son gets Mercenary and Barbarian) are the game's own class sets.

const LUCINA = 'fe13-lucina'
/** Classes a parent never passes on, and those only Morgan takes. Lord goes only to Lucina, who has it already. */
const NEVER_PASSED = ['Lord', 'Dancer', 'Conqueror']
const MORGAN_ONLY = ['Taguel', 'Manakete']
/** Morgan starts in Tactician when the other parent's first class is one of these (Serenes Forest). */
const NO_START = ['Lord', 'Dancer', 'Conqueror']

export const isMorgan = (u: Fe13Unit) => u.id.startsWith('fe13-morgan')
/** The two Avatars are one unit in a playthrough. */
export const sameUnit = (a: string, b: string) => a === b || (a.startsWith('fe13-avatar') && b.startsWith('fe13-avatar'))
const avatarIds = (id: string) => (id.startsWith('fe13-avatar') ? ['fe13-avatar-m', 'fe13-avatar-f'] : [id])

/** The classes a parent passes to a child: their set for the child's gender, less what can't be inherited. */
function passedOn(data: Fe13Data, set: string[], child: Fe13Unit): string[] {
  return set.filter((id) => {
    const name = data.classes[id]?.name ?? ''
    if (NEVER_PASSED.includes(name)) return child.id === LUCINA && name === 'Lord'
    return !MORGAN_ONLY.includes(name) || isMorgan(child)
  })
}

/** A parent as the child sees them: a child parent (Morgan's other parent can be one) with what they inherited themselves when their
 * own parents are in the plan; their current stats from their Unit Planner plan, else as they join. */
export interface Fe13Parent {
  unit: Fe13Unit
  growths: Fe13Stats
  modifiers: Omit<Fe13Stats, 'hp'>
  classes: string[]
  /** Their current stats less their class's bases. */
  personal: Fe13Stats
  /** Where the stats come from: their plan's last row, or as they join. */
  from: { classId: string; level: number; planned: boolean }
  /** For a child parent: their own inheritance, or null when their parents aren't in the plan. */
  via?: Fe13Child | null
}

export interface Fe13Child {
  child: Fe13Unit
  fixed: Fe13Parent
  other: Fe13Parent
  /** The class they join in: their own, except Morgan, who takes the other parent's first class. */
  startClass: string
  /** Their own growths and both parents' added, a third, rounded down. */
  growths: Fe13Stats
  /** Both parents' summed, plus 1 (no +1 for a Morgan whose other parent is a child). */
  modifiers: Omit<Fe13Stats, 'hp'>
  /** Their own class set, then what each parent passes on. */
  classes: string[]
  /** As they join: both parents' current stats less their class's bases, plus the child's own, a third (rounded down), plus the start
   * class's bases. */
  bases: Fe13Stats & { mov: number }
}

/** A parent's stats, growths and the rest, as passed on. `depth` stops at Morgan's grandparents. */
function parentOf(data: Fe13Data, unit: Fe13Unit, female: boolean, spouses: Record<string, string>, plans: Record<string, Fe13Plan>, depth: number): Fe13Parent {
  const via = unit.parent && depth === 0 ? childOf(data, unit, spouses, plans, depth + 1) : unit.parent ? null : undefined
  const growths = via?.growths ?? unit.growths
  const modifiers = via?.modifiers ?? unit.modifiers
  const classes = via?.classes ?? classSetOf(unit, female)
  const start = via ? { ...unit, classId: via.startClass } : unit
  const plan = plans[unit.id]
  const stages = plan ? project(data, start, plan, via?.bases ?? unit.bases, growths, modifiers) : null
  const last = stages?.[stages.length - 1] ?? { classId: start.classId, level: unit.level, stats: via?.bases ?? unit.bases }
  const personal = {} as Fe13Stats
  for (const s of FE13_STATS) personal[s] = last.stats[s] - data.classes[last.classId].bases[s]
  return { unit, growths, modifiers, classes, personal, from: { classId: last.classId, level: last.level, planned: !!stages && stages.length > 1 }, via }
}

/** A child's inheritance once their fixed parent is married in `spouses` (both ways). */
export function childOf(data: Fe13Data, child: Fe13Unit, spouses: Record<string, string>, plans: Record<string, Fe13Plan> = {}, depth = 0): Fe13Child | null {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const fixedUnit = child.parent ? byId.get(child.parent) : undefined
  const otherId = fixedUnit ? spouses[fixedUnit.id] : undefined
  const otherUnit = otherId ? byId.get(otherId) : undefined
  if (!fixedUnit || !otherUnit) return null
  const fixed = parentOf(data, fixedUnit, child.female, spouses, plans, depth)
  const other = parentOf(data, otherUnit, child.female, spouses, plans, depth)
  const growths = {} as Fe13Stats
  for (const s of FE13_STATS) growths[s] = Math.floor((child.growths[s] + fixed.growths[s] + other.growths[s]) / 3)
  const bonus = isMorgan(child) && otherUnit.parent ? 0 : 1
  const modifiers = {} as Omit<Fe13Stats, 'hp'>
  for (const s of FE13_STATS.slice(1) as Exclude<Fe13Stat, 'hp'>[]) modifiers[s] = fixed.modifiers[s] + other.modifiers[s] + bonus
  const classes = [...new Set([...classSetOf(child), ...passedOn(data, fixed.classes, child), ...passedOn(data, other.classes, child)])]
  const first = classSetOf(otherUnit, child.female)[0]
  const startClass = isMorgan(child) && first && !NO_START.includes(data.classes[first]?.name ?? '') ? first : child.classId
  const cls = data.classes[startClass]
  const bases = { mov: cls.bases.mov } as Fe13Stats & { mov: number }
  for (const s of FE13_STATS) bases[s] = Math.floor((fixed.personal[s] + other.personal[s] + child.personal[s]) / 3) + cls.bases[s]
  return { child, fixed, other, startClass, growths, modifiers, classes, bases }
}

/** A child's parents in the plan: the fixed one, and their spouse if married. */
export function parentsOf(data: Fe13Data, unitId: string, spouses: Record<string, string>): string[] {
  const unit = data.units.find((u) => u.id === unitId)
  if (!unit?.parent) return []
  return [unit.parent, ...(spouses[unit.parent] ? [spouses[unit.parent]] : [])]
}

/** Whether the plan makes two units parent and child, or siblings: then they can't marry. */
export function isFamilyBlocked(data: Fe13Data, a: string, b: string, spouses: Record<string, string>): boolean {
  const pa = parentsOf(data, a, spouses).flatMap(avatarIds)
  const pb = parentsOf(data, b, spouses).flatMap(avatarIds)
  return pa.some((id) => sameUnit(id, b)) || pb.some((id) => sameUnit(id, a)) || pa.some((id) => pb.includes(id))
}

/** The children a marriage gives: each whose fixed parent is one of the two (Chrom and the Avatar can each have two). */
export function childrenOf(data: Fe13Data, a: string, b: string): Fe13Unit[] {
  return data.units.filter((u) => u.parent && (u.parent === a || u.parent === b))
}
