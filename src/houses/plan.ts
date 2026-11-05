import {
  canTake,
  HOUSE_NAMES,
  isByleth,
  joinChapter,
  rankIndex,
  routeOf,
  type Fe16Data,
  type Fe16Picks,
} from './logic'
import { FE16_STATS, type Fe16Class, type Fe16Route, type Fe16Skill, type Fe16Stat, type Fe16Stats, type Fe16StatsMov, type Fe16Unit } from './types'

// The Unit Planner, as the program does it (scripts and addresses in data-raw/fe16/README.md).

export const MAX_LEVEL = 99
/** The last month recruiting is offered in: Part I's (what ends it after Part I isn't traced). */
export const LAST_RECRUIT_CHAPTER = 11

/** A step of a plan: certify into `to` and change into it at level `at` (the level doesn't restart). */
export interface Fe16Step {
  at: number
  to: string
}

export interface Fe16Plan {
  /** For a unit who joins partway: the chapter whose month they join in (the earliest they can, unless set). */
  joinChapter?: number
  steps: Fe16Step[]
  targetLevel: number
  /** The Saint Statues raised to level 9 ('0' to '3'): each adds 5 to two maximums. */
  statues?: string[]
  /** The abilities equipped (up to five; the personal ability and the class's come on their own). */
  abilities?: string[]
  /** The combat arts equipped (up to three). */
  arts?: string[]
}

export const defaultPlan = (u: Fe16Unit): Fe16Plan => ({ steps: [], targetLevel: u.level })

/** Aptitude, Cyril's personal ability, adds 20 to every growth but Mov (ability property 58, 0x3d3020). */
const aptitudeOf = (unit: Fe16Unit) => (unit.personal.includes('Aptitude') ? 20 : 0)

/** A unit's growths in a class: their own plus the class's (signed), plus Aptitude. */
export function growthsIn(unit: Fe16Unit, cls: Fe16Class): Fe16Stats {
  const apt = aptitudeOf(unit)
  const out = {} as Fe16Stats
  for (const s of FE16_STATS) out[s] = unit.growths[s] + cls.growths[s] + apt
  return out
}

/** The odds a stat's margin (roll − growth, given a miss) is above `m`, ties counted half: the margin is even over 0..99 − growth. */
const above = (n: number, m: number) => (m >= n ? 0 : (n - 1 - m + 0.5) / n)

/**
 * A level's average gain in each stat (0x3d3020). Each stat rolls 0-99 against its growth (one sure point per full 100 above 100);
 * with `minimum` (the two-point minimum, for most units), a level that gained 0 or 1 points gets the rest up to 2, one each to the
 * stats that missed (with a growth of 1 or more) by the least. Mov never grows. Exact ties in the margins are counted half.
 */
export function levelGain(growths: Fe16Stats, minimum: boolean): Fe16Stats {
  const sure = {} as Fe16Stats
  const p = {} as Fe16Stats
  const r = {} as Fe16Stats
  for (const s of FE16_STATS) {
    const g = growths[s]
    sure[s] = g >= 101 ? Math.floor((g - 1) / 100) : 0
    r[s] = g - 100 * sure[s]
    p[s] = Math.min(100, Math.max(0, r[s])) / 100
  }
  const out = {} as Fe16Stats
  for (const s of FE16_STATS) out[s] = sure[s] + p[s]
  const S = FE16_STATS.reduce((sum, s) => sum + sure[s], 0)
  if (!minimum || S >= 2) return out
  // Stats that can miss and be picked: a growth of 1 to 99 after the sure points.
  const cand = FE16_STATS.filter((s) => r[s] >= 1 && r[s] < 100)
  const n = (s: Fe16Stat) => 100 - r[s]
  const none = FE16_STATS.reduce((prod, s) => prod * (1 - p[s]), 1)
  /** The odds `k` has the least margin among `set`. */
  const least = (k: Fe16Stat, set: Fe16Stat[]) => {
    let sum = 0
    for (let m = 0; m < n(k); m++) sum += set.filter((j) => j !== k).reduce((prod, j) => prod * above(n(j), m), 1)
    return sum / n(k)
  }
  /** The odds `k` is among the two least margins in `set`. */
  const twoLeast = (k: Fe16Stat, set: Fe16Stat[]) => {
    const others = set.filter((j) => j !== k)
    let sum = 0
    for (let m = 0; m < n(k); m++) {
      const all = others.reduce((prod, j) => prod * above(n(j), m), 1)
      let one = 0
      for (const i of others) one += (1 - above(n(i), m)) * others.filter((j) => j !== i).reduce((prod, j) => prod * above(n(j), m), 1)
      sum += all + one
    }
    return sum / n(k)
  }
  for (const k of cand) {
    let bonus = S === 1 ? none * least(k, cand) : none * twoLeast(k, cand)
    if (S === 0) {
      for (const j of FE16_STATS) {
        if (j === k || p[j] <= 0) continue
        const onlyJ = FE16_STATS.reduce((prod, i) => prod * (i === j ? p[i] : 1 - p[i]), 1)
        bonus += onlyJ * least(k, cand.filter((x) => x !== j))
      }
    }
    out[k] += bonus
  }
  return out
}

/** A unit's maximums: their own (classes have none), and 5 more on two stats for each Saint Statue at level 9 (0x3f32b0). HP's
 * stays its own. */
export function capsOf(data: Fe16Data, unit: Fe16Unit, statues: string[] = []): Fe16Stats {
  const out = { ...unit.caps }
  for (const id of statues) {
    for (const [s, v] of Object.entries(data.statues[id]?.['9'] ?? {})) if (s in out) out[s as Fe16Stat] += v ?? 0
  }
  for (const s of FE16_STATS) out[s] = Math.min(s === 'hp' ? 199 : 99, out[s])
  return out
}

/** The class's bases lift a unit's own stats for good, on passing its exam and on changing into it (0x412fa0); nothing lowers them. */
function lift(own: Fe16StatsMov, cls: Fe16Class): Fe16StatsMov {
  const out = { ...own }
  for (const s of Object.keys(cls.bases) as (keyof Fe16Class['bases'])[]) out[s] = Math.max(out[s], cls.bases[s])
  return out
}

/** What the game shows in a class (0xb0240): the unit's own stats plus the class's boosts, and the mount's while mounted; held to 0-99
 * (Mov 1-19). A boost can take a stat past its maximum. */
export function shownStats(cls: Fe16Class, own: Fe16StatsMov, mounted = true): Fe16StatsMov {
  const out = {} as Fe16StatsMov
  for (const s of [...FE16_STATS, 'mov'] as (Fe16Stat | 'mov')[]) {
    const v = own[s] + (cls.boosts[s] ?? 0) + (mounted ? (cls.mount?.[s] ?? 0) : 0)
    out[s] = s === 'mov' ? Math.min(19, Math.max(1, v)) : Math.min(99, Math.max(0, v))
  }
  return out
}

export const isMounted = (cls: Fe16Class) => !!cls.mount

// Joining partway (0x3d0dc0, 0x3d4260): a unit recruited, or joining by the story, in a chapter's month gets that chapter's level
// (fixed_flow, fixed_scenario), the class their recruitment record gives for it, and stats averaged over the levels.

/** The chapters a unit's join can be planned in under the picks: one for a story join, the recruiting months for the rest. Empty
 * for Byleth and a student of the house taught (or of any house, with none picked): they're yours at Lv 1 from Chapter 1. */
export function joinOptions(unit: Fe16Unit, picks: Fe16Picks): number[] {
  if (isByleth(unit)) return []
  const theirs = unit.join.house
  if (theirs && theirs !== 'Ashen Wolves' && (!picks.house || theirs === HOUSE_NAMES[picks.house])) return []
  const story = storyJoin(unit, picks)
  if (story !== undefined) return [story]
  const from = picks.house ? joinChapter(unit, picks.house) : 1
  return Array.from({ length: Math.max(1, LAST_RECRUIT_CHAPTER - from + 1) }, (_, i) => from + i)
}

/** The month a story join's level comes from (0x3d7720 at the chapter changes, 0x3d91b0 at the time skip): Flayn after Chapter 6;
 * Seteth at the time skip (Serenes Forest's Chapter 12); Gilbert, Azure Moon (his level is Chapter 13's, then a time-skip level-up);
 * Jeritza, Crimson Flower's time skip; Catherine and Cyril on the Black Eagles' path, Silver Snow at the Chapter 11 change. */
function storyJoin(unit: Fe16Unit, picks: Fe16Picks): number | undefined {
  const route = routeOf(picks)
  switch (unit.id) {
    case 'fe16-flayn':
      return 6
    case 'fe16-seteth':
      return 12
    case 'fe16-gilbert':
      return 13
    case 'fe16-jeritza':
      return route === 'cf' ? 12 : undefined
    case 'fe16-catherine':
    case 'fe16-cyril':
      return picks.house === 'be' ? 11 : undefined
    default:
      return undefined
  }
}

/** The route a join's level is read from: the one picked, else the house's first (Part I's levels are every route's). */
function levelRoute(picks: Fe16Picks): Fe16Route {
  return routeOf(picks) ?? (picks.house === 'bl' ? 'am' : picks.house === 'gd' ? 'vw' : 'ss')
}

export interface Fe16Join {
  chapter: number
  level: number
  classId: string
  own: Fe16StatsMov
}

/** A unit joining in a chapter's month: its level, the class for it (from Lv 5 the record's first, from Lv 10 its second), and its
 * own stats from the Lv 1 bases with each growth (theirs + the class's join growths + Aptitude; any other than 0 at least 5; Def and
 * Res at most 60) times the levels, rounded half up, held at the maximums, then lifted to the class's bases. Gilbert gets his
 * time-skip level-up on top. */
export function joinOf(data: Fe16Data, unit: Fe16Unit, picks: Fe16Picks, chapter: number): Fe16Join {
  const level = data.joinLevels[levelRoute(picks)][chapter] ?? data.joinLevels.am[chapter] ?? 1
  const [early, late] = unit.recruitClasses ?? [unit.classId, unit.classId]
  const classId = level >= 10 ? late : level >= 5 ? early : unit.classId
  const cls = data.classes[classId] ?? data.classes[unit.classId]
  const caps = unit.caps
  const apt = aptitudeOf(unit)
  const n = level - 1
  let own = { ...unit.bases }
  for (const s of [...FE16_STATS, 'mov'] as (Fe16Stat | 'mov')[]) {
    let g = (s === 'mov' ? 0 : unit.growths[s]) + (cls.joinGrowths[s] ?? 0) + (s === 'mov' ? 0 : apt)
    if (g !== 0) g = Math.max(g, 5)
    if (s === 'def' || s === 'res') g = Math.min(g, 60)
    if (s === 'mov') g = Math.max(g, 0)
    const gain = Math.floor((g * n) / 100) + ((g * n) % 100 >= 50 ? 1 : 0)
    own[s] = s === 'mov' ? own[s] + gain : Math.min(caps[s], own[s] + gain)
  }
  own = lift(own, cls)
  if (unit.id === 'fe16-gilbert') {
    const gain = levelGain(growthsIn(unit, cls), !!unit.minimumTwo)
    for (const s of FE16_STATS) own[s] = Math.min(caps[s], own[s] + gain[s])
    return { chapter, level: level + 1, classId: cls.id, own }
  }
  return { chapter, level, classId: cls.id, own }
}

export interface Fe16Stage {
  classId: string
  level: number
  /** The unit's own stats (shownStats adds the class's). */
  own: Fe16StatsMov
  how: 'joins' | 'level' | 'change' | 'target'
}

/** The classes a unit has certified by a point in the plan: those they join with, and each one the plan has changed into. */
export function certifiedBy(unit: Fe16Unit, start: string, steps: Fe16Step[]): Set<string> {
  return new Set([...unit.certified, start, ...steps.map((s) => s.to)])
}

/** Whether a unit can change into a class at a level, having certified `had`: their own class or one they hold any time; a new one
 * once they can be in it, at its exam's level, with what it needs first (the Dark Bishop, the Dark Mage). */
export function canChange(unit: Fe16Unit, cls: Fe16Class, level: number, had: Set<string>): boolean {
  if (had.has(cls.id)) return true
  if (!canTake(cls, unit)) return false
  if (cls.requires && !had.has(cls.requires)) return false
  return level >= cls.level
}

/** A plan's steps, up to the first the game doesn't allow. */
export function legalSteps(data: Fe16Data, unit: Fe16Unit, plan: Fe16Plan, start: { classId: string; level: number }): Fe16Step[] {
  const out: Fe16Step[] = []
  let level = start.level
  for (const step of plan.steps) {
    const cls = data.classes[step.to]
    const at = Math.max(level, Math.min(MAX_LEVEL, step.at))
    if (!cls || !canChange(unit, cls, at, certifiedBy(unit, start.classId, out))) break
    out.push({ at, to: step.to })
    level = at
  }
  return out
}

/** Where a plan starts: Lv 1 in their class, or as they join partway. */
export function startOf(data: Fe16Data, unit: Fe16Unit, plan: Fe16Plan, picks: Fe16Picks) {
  const options = joinOptions(unit, picks)
  if (options.length === 0) return { classId: unit.classId, level: unit.level, own: { ...unit.bases }, join: undefined }
  const chapter = plan.joinChapter !== undefined && options.includes(plan.joinChapter) ? plan.joinChapter : options[0]
  const join = joinOf(data, unit, picks, chapter)
  return { classId: join.classId, level: join.level, own: join.own, join }
}

/** Average stats along a plan: each level adds the average gain in the class held then, up to the maximums; each class change lifts
 * the stats to the new class's bases for good. */
export function project(data: Fe16Data, unit: Fe16Unit, plan: Fe16Plan, picks: Fe16Picks): Fe16Stage[] {
  const start = startOf(data, unit, plan, picks)
  const caps = capsOf(data, unit, plan.statues)
  const steps = legalSteps(data, unit, plan, start)
  let cls = data.classes[start.classId]
  let level = start.level
  let own = { ...start.own }
  const grow = (from: Fe16StatsMov, levels: number, c: Fe16Class) => {
    const gain = levelGain(growthsIn(unit, c), !!unit.minimumTwo)
    const out = { ...from }
    for (const s of FE16_STATS) if (out[s] < caps[s]) out[s] = Math.min(caps[s], out[s] + gain[s] * Math.max(0, levels))
    return out
  }
  const stages: Fe16Stage[] = [{ classId: cls.id, level, own, how: 'joins' }]
  for (const step of steps) {
    if (step.at > level) {
      own = grow(own, step.at - level, cls)
      level = step.at
      stages.push({ classId: cls.id, level, own, how: 'level' })
    }
    cls = data.classes[step.to]
    own = lift(own, cls)
    stages.push({ classId: cls.id, level, own, how: 'change' })
  }
  const target = Math.max(level, Math.min(MAX_LEVEL, plan.targetLevel))
  if (target > level) stages.push({ classId: cls.id, level: target, own: grow(own, target - level, cls), how: 'target' })
  return stages
}

/** The shortest way from where a unit starts to a class (as Fates' Projected Stats takes one): the class it needs first if any (the
 * Dark Bishop's Dark Mage), each change at its exam's level or the level they're at, whichever is higher. */
export function pathTo(data: Fe16Data, unit: Fe16Unit, start: { classId: string; level: number }, targetId: string): Fe16Step[] {
  if (targetId === start.classId) return []
  const cls = data.classes[targetId]
  const steps: Fe16Step[] = []
  let level = start.level
  const had = certifiedBy(unit, start.classId, [])
  if (cls.requires && !had.has(cls.requires)) {
    level = Math.max(level, data.classes[cls.requires].level)
    steps.push({ at: level, to: cls.requires })
  }
  steps.push({ at: Math.max(level, cls.level), to: targetId })
  return steps
}

/** The rough stats a unit can expect in a class at a level, the way there by pathTo: the stages, the last the estimate. */
export function estimate(data: Fe16Data, unit: Fe16Unit, plan: Fe16Plan, picks: Fe16Picks, targetId: string, level: number): Fe16Stage[] {
  const steps = pathTo(data, unit, startOf(data, unit, plan, picks), targetId)
  return project(data, unit, { ...plan, steps, targetLevel: level }, picks)
}

/** The highest rank each skill must reach for the plan's exams. */
export function ranksNeeded(data: Fe16Data, steps: Fe16Step[]): Partial<Record<Fe16Skill, string>> {
  const out: Partial<Record<Fe16Skill, string>> = {}
  for (const st of steps) {
    for (const [sk, rank] of Object.entries(data.classes[st.to]?.exam?.ranks ?? {}) as [Fe16Skill, string][]) {
      if (!out[sk] || rankIndex(rank) > rankIndex(out[sk]!)) out[sk] = rank
    }
  }
  return out
}
