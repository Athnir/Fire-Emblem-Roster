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

export interface Fe13Child {
  child: Fe13Unit
  fixed: Fe13Unit
  other: Fe13Unit
  /** Their own growths, their parents' and theirs averaged (the Fire Emblem Wiki's inheritance page). */
  growths: Fe13Stats
  /** Both parents' modifiers summed, plus 1 (the same). */
  modifiers: Omit<Fe13Stats, 'hp'>
  /** Their own class set, then what each parent's set for the child's gender adds. */
  classes: string[]
}

export function childOf(data: Fe13Data, child: Fe13Unit, spouses: Record<string, string>): Fe13Child | null {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const fixed = child.parent ? byId.get(child.parent) : undefined
  const otherId = fixed ? spouses[fixed.id] : undefined
  const other = otherId ? byId.get(otherId) : undefined
  if (!fixed || !other) return null
  const growths = {} as Fe13Stats
  for (const s of FE13_STATS) growths[s] = (child.growths[s] + fixed.growths[s] + other.growths[s]) / 3
  const modifiers = {} as Omit<Fe13Stats, 'hp'>
  for (const s of FE13_STATS.slice(1) as Exclude<Fe13Stat, 'hp'>[]) modifiers[s] = fixed.modifiers[s] + other.modifiers[s] + 1
  const classes = [...new Set([...classSetOf(child), ...classSetOf(fixed, child.female), ...classSetOf(other, child.female)])]
  return { child, fixed, other, growths, modifiers, classes }
}
