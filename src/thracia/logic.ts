import {
  FE5_STATS,
  FE5_WEAPONS,
  type Fe5Chapter,
  type Fe5Choice,
  type Fe5Class,
  type Fe5Join,
  type Fe5Manual,
  type Fe5Ring,
  type Fe5Scroll,
  type Fe5Stat,
  type Fe5Stats,
  type Fe5Support,
  type Fe5Unit,
  type Fe5Weapon,
} from './types'

/** Everything Thracia 776's screens need, passed in so the screens don't import the game's data. */
export interface Fe5Data {
  gameId: string
  chapters: Fe5Chapter[]
  units: Fe5Unit[]
  classes: Record<string, Fe5Class>
  supports: Fe5Support[]
  scrolls: Fe5Scroll[]
  rings: Fe5Ring[]
  manuals: Fe5Manual[]
  skills: Record<string, string>
  choices: Fe5Choice[]
}

/** Lv 20 in both tiers ($83:DD3D); a Master Seal works from Lv 10 ($87:C09E). */
export const MAX_LEVEL = 20
export const SEAL_LEVEL = 10
/** HP is held at 80; every other stat at 20, both what the unit keeps and what's shown ($83:DFC4, $83:90BE). */
export const HP_CAP = 80
export const CAP = 20

export function capOf(stat: Fe5Stat): number {
  return stat === 'hp' ? HP_CAP : CAP
}

/** What's shown: HP as kept; every other stat the class's base plus the unit's own, held at 20 ($83:90BE). */
export function shownStats(cls: Fe5Class, own: Fe5Stats): Fe5Stats {
  return Object.fromEntries(FE5_STATS.map((s) => [s, s === 'hp' ? own.hp : Math.min(CAP, cls.bases[s] + own[s])])) as Fe5Stats
}

/** The class a stage is shown in: its dismounted form on foot (indoors), when it has one. */
export function classShown(data: Fe5Data, classId: string, onFoot: boolean): Fe5Class {
  const cls = data.classes[classId]
  return onFoot && cls.dismounted ? data.classes[cls.dismounted] : cls
}

export interface ScrollStretch {
  scrollIds: string[]
  levels: number
}

export interface Fe5Plan {
  /** Whether the unit takes their promotion: a Master Seal's class, or the story's for Leif and Linoan. */
  promote: boolean
  /** The level they promote at (a Master Seal needs 10 in the class they're in). */
  promoteAt: number
  /** Lara: the level she becomes a Dancer at in 12x, or null to stay a Thief. */
  stepAt?: number | null
  /** The level the plan ends at, in the last class. */
  targetLevel: number
  /** Stretches of level-ups from when the unit joins, with the holy scrolls carried through each. */
  scrolls?: ScrollStretch[]
  /** Rings used: {ring item id: how many}. */
  rings?: Record<string, number>
  /** Skill manuals used (item ids). */
  manuals?: string[]
  /** Mareeta's Astra from talking to Shannam. */
  storySkill?: boolean
}

export function defaultPlan(unit: Fe5Unit): Fe5Plan {
  return { promote: !!unit.promotion, promoteAt: MAX_LEVEL, stepAt: null, targetLevel: MAX_LEVEL }
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** A saved plan in today's shape. Plans saved before the review named the class to promote to and kept one scroll per stretch. */
export function normalizePlan(unit: Fe5Unit, raw: unknown): Fe5Plan {
  const plan = defaultPlan(unit)
  if (!raw || typeof raw !== 'object') return plan
  const p = raw as Record<string, unknown>
  if (typeof p.promote === 'boolean') plan.promote = p.promote && !!unit.promotion
  else if ('promoteTo' in p) plan.promote = p.promoteTo != null && !!unit.promotion
  if (isNumber(p.promoteAt)) plan.promoteAt = p.promoteAt
  if (isNumber(p.stepAt) && unit.storyStep) plan.stepAt = p.stepAt
  if (isNumber(p.targetLevel)) plan.targetLevel = p.targetLevel
  if (Array.isArray(p.scrolls)) {
    plan.scrolls = p.scrolls.flatMap((s) => {
      if (!s || typeof s !== 'object') return []
      const st = s as Record<string, unknown>
      const ids = Array.isArray(st.scrollIds) ? st.scrollIds.filter((x): x is string => typeof x === 'string') : typeof st.scrollId === 'string' ? [st.scrollId] : []
      return isNumber(st.levels) && st.levels > 0 ? [{ scrollIds: ids, levels: st.levels }] : []
    })
  }
  if (p.rings && typeof p.rings === 'object') {
    plan.rings = Object.fromEntries(Object.entries(p.rings as Record<string, unknown>).filter((e): e is [string, number] => isNumber(e[1]) && e[1] > 0))
  }
  if (Array.isArray(p.manuals)) plan.manuals = p.manuals.filter((x): x is string => typeof x === 'string')
  if (p.storySkill === true && unit.storySkill) plan.storySkill = true
  return plan
}

/** One class in a plan: the levels it's held from and to. */
export interface Segment {
  classId: string
  from: number
  to: number
  /** How the unit came into it: 'joins', a story step or a promotion. */
  how: 'joins' | 'story' | 'seal'
}

/** The classes a plan goes through. A class change sets Lv 1 ($87:C113); a Master Seal needs Lv 10, the story any level. */
export function pathOf(unit: Fe5Unit, plan: Fe5Plan): Segment[] {
  const path: Segment[] = [{ classId: unit.classId, from: unit.level, to: unit.level, how: 'joins' }]
  const change = (classId: string, at: number, how: Segment['how']) => {
    const last = path[path.length - 1]
    last.to = Math.max(last.from, Math.min(MAX_LEVEL, at))
    path.push({ classId, from: 1, to: 1, how })
  }
  if (unit.storyStep && plan.stepAt != null) change(unit.storyStep.classId, plan.stepAt, 'story')
  if (unit.promotion && plan.promote) {
    const by = unit.promotion.by
    change(unit.promotion.classId, Math.max(plan.promoteAt, by === 'seal' ? SEAL_LEVEL : 1), by)
  }
  const last = path[path.length - 1]
  last.to = Math.max(last.from, Math.min(MAX_LEVEL, plan.targetLevel))
  return path
}

export function levelUps(unit: Fe5Unit, plan: Fe5Plan): number {
  return pathOf(unit, plan).reduce((n, seg) => n + seg.to - seg.from, 0)
}

/** A level-up's growths: the unit's own plus every holy scroll carried, each held at 0 or more ($83:DDCC, $83:DEE0). The class adds
 * nothing. */
export function growthsWith(unit: Fe5Unit, carried: Fe5Scroll[]): Fe5Stats {
  return Object.fromEntries(
    FE5_STATS.map((s) => [s, Math.min(255, Math.max(0, unit.growths[s] + carried.reduce((sum, sc) => sum + sc.growths[s], 0)))]),
  ) as Fe5Stats
}

/** An average level-up: each stat gains its growth / 100 ($83:E2B0), held at the caps on the unit's own number ($83:DFC4). */
function levelUp(own: Fe5Stats, growths: Fe5Stats): Fe5Stats {
  return Object.fromEntries(FE5_STATS.map((s) => [s, Math.min(capOf(s), own[s] + growths[s] / 100)])) as Fe5Stats
}

export interface Fe5Stage {
  classId: string
  level: number
  /** What the unit keeps (HP whole, the rest their own). */
  own: Fe5Stats
  /** 'joins', 'story' or 'seal' where the unit comes into a class; 'rings' for the plan's rings. */
  how?: Segment['how'] | 'rings'
}

/** Average stats through a plan: the level-ups in each class, each class change (Lv 1, nothing else changes) and the rings at the
 * end, each a fixed gain held at the caps ($87:BCBF). */
export function project(data: Fe5Data, unit: Fe5Unit, plan: Fe5Plan): Fe5Stage[] {
  const scrolls = new Map(data.scrolls.map((s) => [s.id, s]))
  const carried: Fe5Scroll[][] = []
  for (const stretch of plan.scrolls ?? []) for (let i = 0; i < stretch.levels; i++) carried.push(stretch.scrollIds.flatMap((id) => scrolls.get(id) ?? []))
  let own = { ...unit.own }
  let k = 0
  const stages: Fe5Stage[] = []
  for (const seg of pathOf(unit, plan)) {
    stages.push({ classId: seg.classId, level: seg.from, own: { ...own }, how: seg.how })
    if (seg.to > seg.from) {
      for (let lv = seg.from; lv < seg.to; lv++) own = levelUp(own, growthsWith(unit, carried[k++] ?? []))
      stages.push({ classId: seg.classId, level: seg.to, own: { ...own } })
    }
  }
  const rings = Object.entries(plan.rings ?? {}).filter(([, n]) => n > 0)
  if (rings.length) {
    const last = stages[stages.length - 1]
    const withRings = { ...last.own }
    for (const [id, n] of rings) {
      const ring = data.rings.find((r) => r.id === id)
      if (ring) withRings[ring.stat] = Math.min(capOf(ring.stat), withRings[ring.stat] + ring.amount * n)
    }
    stages.push({ classId: last.classId, level: last.level, own: withRings, how: 'rings' })
  }
  return stages
}

export interface Fe5Rank {
  weapon: Fe5Weapon
  points: number
  letter: string
}

/** The ranks shown: for each type the class can use, its base points plus the unit's own, 250 past 255 ($83:91B4); a letter every
 * 50, E to A ($83:936D). The planner keeps the points the unit joins with: each attack adds one. */
export function ranksOf(cls: Fe5Class, unit: Fe5Unit): Fe5Rank[] {
  return FE5_WEAPONS.flatMap((w) => {
    const base = cls.ranks[w]
    if (!base) return []
    const v = base + (unit.weaponPoints[w] ?? 0)
    const points = v > 255 ? 250 : v
    return [{ weapon: w, points, letter: '–EDCBA'[Math.min(5, Math.floor(points / 50))] }]
  })
}

export function ranksText(ranks: Fe5Rank[]): string {
  return ranks.map((r) => `${r.weapon[0].toUpperCase()}${r.weapon.slice(1)} ${r.letter}`).join(', ') || 'No weapons'
}

/** A unit's skills in a class: their own, the class's, and what the plan teaches them (manuals, Mareeta's Astra). */
export function skillsAt(data: Fe5Data, unit: Fe5Unit, classId: string, plan?: Fe5Plan): string[] {
  const manuals = (plan?.manuals ?? []).flatMap((id) => data.manuals.find((m) => m.id === id)?.skill ?? [])
  const story = plan?.storySkill && unit.storySkill ? [unit.storySkill.skill] : []
  return [...new Set([...unit.skills, ...data.classes[classId].skills, ...manuals, ...story])]
}

/** The route the Roster's pick of Ch.15's exit chose, once picked. */
export function routeOf(data: Fe5Data, picks: Record<string, number>): 'A' | 'B' | undefined {
  for (const choice of data.choices) {
    const picked = picks[choice.id]
    if (picked !== undefined && choice.options[picked]?.route) return choice.options[picked].route
  }
  return undefined
}

/** The chapters the spoiler block walks with the picks so far: every chapter in order, the route picked's own, stopping where the
 * route is still to be picked (that split comes back). */
export function walkOf(data: Fe5Data, picks: Record<string, number>): { steps: Fe5Chapter[]; split?: Fe5Choice; routeChoice?: Fe5Choice } {
  const routeChoice = data.choices.find((c) => c.options.some((o) => o.route))
  const route = routeOf(data, picks)
  const steps: Fe5Chapter[] = []
  for (const ch of data.chapters) {
    if (ch.route) {
      if (!route) return { steps, split: routeChoice, routeChoice }
      if (ch.route !== route) continue
    }
    steps.push(ch)
  }
  return { steps, routeChoice }
}

/** The chapters reached with the spoiler block on, at `at` along the walk. */
export function reachedOf(data: Fe5Data, picks: Record<string, number>, at: number): Set<string> {
  const { steps } = walkOf(data, picks)
  return new Set(steps.slice(0, Math.min(at, Math.max(0, steps.length - 1)) + 1).map((c) => c.id))
}

/** Whether a chapter is played on the route picked (every chapter is, before the pick). */
export function onRoute(data: Fe5Data, chapterId: string, picks: Record<string, number>): boolean {
  const route = routeOf(data, picks)
  const ch = data.chapters.find((c) => c.id === chapterId)
  return !route || !ch?.route || ch.route === route
}

/** Units the story's picks leave out: those in an option other than the one picked. */
export function excludedUnits(data: Fe5Data, picks: Record<string, number>): Set<string> {
  const out = new Set<string>()
  for (const choice of data.choices) {
    const picked = picks[choice.id]
    if (picked === undefined || !choice.options[picked]) continue
    choice.options.forEach((opt, i) => {
      if (i !== picked) for (const id of opt.units) if (!choice.options[picked].units.includes(id)) out.add(id)
    })
  }
  return out
}

/** Where and how a unit joins under the picks (Sara's route B join once route B is picked). */
export function joinOf(unit: Fe5Unit, picks: Record<string, number>): { joinChapter: string; join: Fe5Join } {
  const alt = unit.altJoin
  if (alt && picks[alt.choice] === alt.option) return { joinChapter: alt.joinChapter, join: alt.join }
  return { joinChapter: unit.joinChapter, join: unit.join }
}

/** Manuals more than one plan uses: {manual id: the units using it}. The game has one copy of each. */
export function manualClashes(units: Fe5Unit[], planOf: (u: Fe5Unit) => Fe5Plan): Map<string, Fe5Unit[]> {
  const users = new Map<string, Fe5Unit[]>()
  for (const u of units) for (const id of planOf(u).manuals ?? []) users.set(id, [...(users.get(id) ?? []), u])
  return new Map([...users].filter(([, us]) => us.length > 1))
}

export function chapterLabel(data: Fe5Data, id: string): string {
  return data.chapters.find((c) => c.id === id)?.label ?? id
}

export function joinText(data: Fe5Data, joinChapter: string, j: Fe5Join): string {
  const where = chapterLabel(data, joinChapter)
  const who = j.with?.join(' or ')
  if (j.how === 'talk') return `${where}: talk to them with ${who ?? 'another unit'}`
  if (j.how === 'visit') return `${where}: ${who ? `${who} visits` : 'visit'} ${j.place ?? 'a place on the map'}`
  if (j.how === 'event') return `${where}: joins ${j.turn ? `on turn ${j.turn}` : 'during the chapter'}`
  if (j.how === 'end') return `${where}: joins at the end of the chapter`
  return `${where}: joins at the start`
}

export function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}
