import {
  FE16_RANKS,
  FE16_SKILLS,
  type Fe16Class,
  type Fe16Learn,
  type Fe16Route,
  type Fe16Skill,
  type Fe16Support,
  type Fe16Unit,
} from './types'

export interface Fe16Data {
  gameId: string
  units: Fe16Unit[]
  classes: Record<string, Fe16Class>
  supports: Fe16Support[]
  /** What every unit learns at each skill rank. */
  rankRewards: Fe16Learn[]
  abilities: Record<string, string>
  arts: Record<string, string>
  spells: Record<string, string>
  crests: Record<string, string>
}

// The Roster's two picks: Byleth's gender, and the house and route. Each leaves the units it rules out out of every tab.

export interface Fe16Choice {
  id: string
  question: string
  options: { label: string; value: string }[]
}

export const BYLETH_CHOICE: Fe16Choice = {
  id: 'byleth',
  question: 'Byleth: a man or a woman?',
  options: [
    { label: 'Male', value: 'm' },
    { label: 'Female', value: 'f' },
  ],
}

export const ROUTE_CHOICE: Fe16Choice = {
  id: 'route',
  question: 'The house you teach, and its route in Part II',
  options: [
    { label: 'Crimson Flower (Black Eagles)', value: 'cf' },
    { label: 'Silver Snow (Black Eagles)', value: 'ss' },
    { label: 'Azure Moon (Blue Lions)', value: 'am' },
    { label: 'Verdant Wind (Golden Deer)', value: 'vw' },
  ],
}

export const ROUTE_NAMES: Record<Fe16Route, string> = {
  cf: 'Crimson Flower',
  ss: 'Silver Snow',
  am: 'Azure Moon',
  vw: 'Verdant Wind',
}

/** The house each route is taught in. */
export const ROUTE_HOUSE: Record<Fe16Route, string> = { cf: 'Black Eagles', ss: 'Black Eagles', am: 'Blue Lions', vw: 'Golden Deer' }

export type Fe16Picks = { byleth?: string; route?: Fe16Route }

/** Whether a unit can be in your army under the picks. */
export function inArmy(unit: Fe16Unit, picks: Fe16Picks): boolean {
  if (unit.id.startsWith('fe16-byleth-') && picks.byleth && !unit.id.endsWith(`-${picks.byleth}`)) return false
  return !picks.route || unit.routes.includes(picks.route)
}

export const isByleth = (u: Fe16Unit) => u.id.startsWith('fe16-byleth')

/** How a unit joins, in a line, under the route picked. */
export function joinText(unit: Fe16Unit, route?: Fe16Route): string {
  const { how, house } = unit.join
  if (how === 'lord') return 'The professor: yours from the start.'
  if (how === 'auto') return unit.join.note ?? 'Joins on their own.'
  const own = route && house === ROUTE_HOUSE[route]
  if (how === 'house') return own || !route ? `A student of the ${house}: yours from the start when you teach them; no one else can recruit them.` : `A student of the ${house}.`
  if (how === 'student') {
    if (own) return `A student of the ${house}: yours from the start.`
    return `A student of the ${house}: yours from the start when you teach them; another house recruits them (${recruitText(unit)}).`
  }
  return `Recruited: ${recruitText(unit)}.`
}

const STAT_WORDS: Record<string, string> = { str: 'Str', mag: 'Mag', dex: 'Dex', spd: 'Spd', lck: 'Lck', def: 'Def', res: 'Res', cha: 'Cha' }
const SKILL_WORDS: Record<Fe16Skill, string> = {
  sword: 'Sword',
  lance: 'Lance',
  axe: 'Axe',
  bow: 'Bow',
  brawl: 'Brawling',
  reason: 'Reason',
  faith: 'Faith',
  authority: 'Authority',
  armor: 'Heavy Armor',
  riding: 'Riding',
  flying: 'Flying',
}

/** What recruiting a unit asks for, in words. */
export function recruitText(unit: Fe16Unit): string {
  const r = unit.recruit
  if (!r) return 'no requirement in the files'
  const parts: string[] = []
  if (r.stat) parts.push(`${STAT_WORDS[r.stat.stat]} ${r.stat.value}`)
  if (r.skill) parts.push(`${SKILL_WORDS[r.skill.skill]} ${r.skill.rank}`)
  if (r.bylethLevel) parts.push(`Byleth at Lv ${r.bylethLevel}`)
  let out = parts.length ? `Byleth's ${parts.join(' and ')}` : 'no requirement'
  if (r.bylethLevel && !r.stat && !r.skill) out = `Byleth at Lv ${r.bylethLevel}`
  if (r.window) out += `; ${r.window}`
  return out
}

/** Every rank at or below `rank`. */
export const rankIndex = (rank: string) => FE16_RANKS.indexOf(rank)

/** Whether a unit can be in a class at all: the unique classes' own units, the gender locks, Byleth's Enlightened One. */
export function canTake(cls: Fe16Class, unit: Fe16Unit): boolean {
  if (cls.who) return cls.who.includes(unit.id)
  if (cls.gender === 'male' && unit.female) return false
  if (cls.gender === 'female' && !unit.female) return false
  return true
}

/** The classes a unit can be in, in the game's order. */
export function classesFor(data: Fe16Data, unit: Fe16Unit): Fe16Class[] {
  return Object.values(data.classes).filter((c) => c.id === unit.classId || canTake(c, unit))
}

/** Everything a unit learns at its skill ranks: every unit's rewards and its own, by skill and rank. */
export function learnsOf(data: Fe16Data, unit: Fe16Unit): Fe16Learn[] {
  const all = [...data.rankRewards, ...unit.learns]
  return all.sort((a, b) => FE16_SKILLS.indexOf(a.skill) - FE16_SKILLS.indexOf(b.skill) || rankIndex(a.rank) - rankIndex(b.rank))
}

/** A unit's supports, each with the partner and the conversations. */
export function supportsOf(data: Fe16Data, unitId: string): { partner: string; npc?: string; talks: string[]; pairedEnding: boolean }[] {
  return data.supports
    .filter((s) => s.a === unitId || s.b === unitId)
    .map((s) => ({ partner: s.a === unitId ? s.b : s.a, npc: s.npc, talks: s.talks, pairedEnding: !!s.pairedEnding }))
}

/** The highest support conversation. */
export const topTalk = (talks: string[]) => talks[talks.length - 1] ?? ''

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

/** A unit's name where both Byleths can show: "Byleth (male)", "Byleth (female)". Portraits are matched by it. */
export const labelOf = (u: Fe16Unit) => (isByleth(u) ? `${u.name} (${u.female ? 'female' : 'male'})` : u.name)

/** The Roster's groups, in order: Byleth, the houses (the one taught first), the church's staff and knights, the DLC's units. */
export function groupOf(u: Fe16Unit): string {
  if (isByleth(u)) return 'Byleth'
  if (u.house === 'Ashen Wolves') return 'Ashen Wolves (Cindered Shadows)'
  if (u.house) return u.house
  return u.dlc ? 'Expansion Pass' : 'Church of Seiros'
}

export function groupsFor(route?: Fe16Route): string[] {
  const houses = ['Black Eagles', 'Blue Lions', 'Golden Deer']
  const first = route ? ROUTE_HOUSE[route] : undefined
  return ['Byleth', ...(first ? [first, ...houses.filter((h) => h !== first)] : houses), 'Church of Seiros', 'Ashen Wolves (Cindered Shadows)', 'Expansion Pass']
}

// The Unit Planner.

export const MAX_LEVEL = 99

/** A step of a plan: certify into `to` at level `at` (the level doesn't restart). */
export interface Fe16Step {
  at: number
  to: string
}

export interface Fe16Plan {
  steps: Fe16Step[]
  targetLevel: number
}

export const defaultPlan = (u: Fe16Unit): Fe16Plan => ({ steps: [], targetLevel: u.level })

/** The classes a unit can certify into at a level: every class they can be in whose exam's level they've reached. */
export function classChoices(data: Fe16Data, unit: Fe16Unit, level: number): { cls: Fe16Class; ok: boolean }[] {
  return classesFor(data, unit).map((cls) => ({ cls, ok: level >= cls.level }))
}

/** A plan's steps, up to the first the game doesn't allow (a class the unit can't be in, or below its exam's level). */
export function legalSteps(data: Fe16Data, unit: Fe16Unit, plan: Fe16Plan): Fe16Step[] {
  const out: Fe16Step[] = []
  let level = unit.level
  for (const step of plan.steps) {
    const cls = data.classes[step.to]
    const at = Math.max(level, Math.min(MAX_LEVEL, step.at))
    if (!cls || !canTake(cls, unit) || at < cls.level) break
    out.push({ at, to: step.to })
    level = at
  }
  return out
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

/** The help text of an ability, combat art or spell. */
export function helpOf(data: Fe16Data, l: Pick<Fe16Learn, 'kind' | 'name'>): string | undefined {
  return l.kind === 'art' ? data.arts[l.name] : l.kind === 'spell' ? data.spells[l.name] : data.abilities[l.name]
}
