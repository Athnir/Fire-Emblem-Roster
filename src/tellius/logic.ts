import {
  TELLIUS_STATS,
  type TelliusBand,
  type TelliusBond,
  type TelliusClass,
  type TelliusData,
  type TelliusStats,
  type TelliusSupport,
  type TelliusUnit,
} from './types'

/** The lowest level a class can promote at with a Master Seal (or, in Radiant Dawn, a Master Crown). */
export const MASTER_SEAL_LEVEL = 10

export type GrowthMode = 'random' | 'fixed'

export interface ProjectionStage {
  classId: string
  level: number
  /** Random mode: average stats, each level adding the growth rate as a fraction. Fixed mode: the stats themselves.
   * Both held at the class's caps. */
  stats: TelliusStats
  caps: TelliusStats
  mov: number
  con: number
  /** Fixed mode: the growth points left over. */
  points?: TelliusStats
}

export interface ProjectionPlan {
  /** The level to promote at in the starting class; null never promotes. */
  promoteAt: number | null
  /** Radiant Dawn: the level to promote at again, in the class the first promotion leads to; null or absent never does. */
  promoteAt2?: number | null
  /** The level to reach in the final class. */
  targetLevel: number
  /** Random growths (the default) or Path of Radiance's Fixed mode. */
  mode?: GrowthMode
  /** Bands worn, in order from when the unit joins: each for this many level-ups. Later levels wear none. */
  bands?: BandSegment[]
}

export interface BandSegment {
  bandId: string
  levels: number
}

/** The highest level in a class: its own (Radiant Dawn's laguz, 40), or the game's. */
export function maxLevelOf(data: TelliusData, classId: string): number {
  return data.classes[classId]?.maxLevel ?? data.maxLevel
}

/** The classes a unit can promote into from its starting class, in order (one in Path of Radiance, up to two in Radiant
 * Dawn). Laguz don't promote. */
export function promotionsOf(data: TelliusData, unit: TelliusUnit): TelliusClass[] {
  const out: TelliusClass[] = []
  let cls = data.classes[unit.classId]
  while (cls && !cls.laguz && cls.promotesTo && data.classes[cls.promotesTo] && out.length < 2) {
    cls = data.classes[cls.promotesTo]
    out.push(cls)
  }
  return out
}

/** A stretch of levels in one class: level-ups take the unit from `from` to `to`. */
export interface PlanSegment {
  classId: string
  from: number
  to: number
}

/** The plan's classes and the levels gained in each: to each promotion, then to the target in the last class. */
export function planSegments(data: TelliusData, unit: TelliusUnit, plan: ProjectionPlan): PlanSegment[] {
  const chain = promotionsOf(data, unit)
  const at = [plan.promoteAt, plan.promoteAt2 ?? null]
  const out: PlanSegment[] = []
  let classId = unit.classId
  let from = unit.level
  for (let i = 0; i < chain.length; i++) {
    const level = at[i]
    if (level === null || level === undefined) break
    const to = Math.max(from, Math.min(level, maxLevelOf(data, classId)))
    out.push({ classId, from, to })
    classId = chain[i].id
    from = 1
  }
  out.push({ classId, from, to: Math.max(from, Math.min(plan.targetLevel, maxLevelOf(data, classId))) })
  return out
}

/** How many level-ups the plan covers, over every class it passes through. */
export function levelUpsIn(data: TelliusData, unit: TelliusUnit, plan: ProjectionPlan): number {
  return planSegments(data, unit, plan).reduce((sum, seg) => sum + seg.to - seg.from, 0)
}

/** Whether a unit in this class can wear the band (the Knight Ward is for knights, soldiers and their promotions). */
export function canWear(band: TelliusBand, classId: string): boolean {
  return !band.onlyClasses || band.onlyClasses.includes(classId)
}

/** The bands to offer: those the unit can wear in a class the plan passes through (no Knight Ward for Ike). */
export function wearableBands(data: TelliusData, unit: TelliusUnit, plan: ProjectionPlan): TelliusBand[] {
  const classIds = planSegments(data, unit, plan).map((seg) => seg.classId)
  return (data.bands ?? []).filter((b) => classIds.some((c) => canWear(b, c)))
}

/** Fixed mode holds at most this many growth points per stat (Serenes Forest). */
export const FIXED_MAX_POINTS = 255

function capped(stats: TelliusStats, caps: TelliusStats): TelliusStats {
  const out = { ...stats }
  for (const s of TELLIUS_STATS) out[s] = Math.min(out[s], caps[s])
  return out
}

/** What promoting from one class into the next adds: the new class's own gains (Radiant Dawn), or the difference
 * between the two classes' bases (Path of Radiance, checked against Serenes Forest's promotion gains). */
export function promotionGains(from: TelliusClass, to: TelliusClass): TelliusStats {
  if (to.gains) return { ...to.gains }
  const out = { ...to.bases }
  for (const s of TELLIUS_STATS) out[s] = to.bases[s] - from.bases[s]
  return out
}

/**
 * Levels a unit up, one level at a time. Random mode adds each growth rate as a fraction (the average). Fixed mode (Path
 * of Radiance, from Serenes Forest's description: unconfirmed in the game's code) keeps growth points per stat, starting
 * from the unit's own: a level's worth of EXP (100) adds the growth rate, held at 255, and each 100 points becomes +1 at
 * the level-up, the rest carrying over. A worn band adds its growth changes to the rate (Serenes Forest's accessories
 * page) in either mode, while the class can wear it. Weapons and the class of what was defeated also shift Fixed mode's
 * points; they aren't counted.
 */
function makeGrower(data: TelliusData, unit: TelliusUnit, plan: ProjectionPlan) {
  const points = plan.mode === 'fixed' && unit.fixedStart ? { ...unit.fixedStart } : undefined
  const bands = new Map((data.bands ?? []).map((b) => [b.id, b]))
  // The band worn for each level-up, in order.
  const worn: (TelliusBand | undefined)[] = []
  for (const seg of plan.bands ?? []) for (let i = 0; i < seg.levels; i++) worn.push(bands.get(seg.bandId))
  let levelUps = 0
  return {
    points: () => (points ? { ...points } : undefined),
    grow(stats: TelliusStats, levels: number, caps: TelliusStats, classId: string): TelliusStats {
      const out = { ...stats }
      for (let i = 0; i < levels; i++) {
        const band = worn[levelUps++]
        for (const s of TELLIUS_STATS) {
          const rate = unit.growths[s] + (band && canWear(band, classId) ? band.growths[s] : 0)
          if (points) {
            points[s] = Math.min(FIXED_MAX_POINTS, points[s] + rate)
            const rise = Math.floor(points[s] / 100)
            points[s] -= rise * 100
            out[s] += rise
          } else {
            out[s] += rate / 100
          }
        }
      }
      return capped(out, caps)
    },
  }
}

/**
 * The unit's stats where they join, at each promotion and at the target level. A promotion adds the new class's gains
 * (promotionGains) and starts the new class at level 1; Con changes by the difference in the classes' Con.
 */
export function project(data: TelliusData, unit: TelliusUnit, plan: ProjectionPlan): ProjectionStage[] {
  const segments = planSegments(data, unit, plan)
  const grower = makeGrower(data, unit, plan)
  const start = data.classes[unit.classId]
  const stages: ProjectionStage[] = [
    { classId: start.id, level: unit.level, stats: { ...unit.bases }, caps: start.caps, mov: start.mov, con: unit.con, points: grower.points() },
  ]
  let stats = { ...unit.bases }
  let con = unit.con
  segments.forEach((seg, i) => {
    const cls = data.classes[seg.classId]
    if (i > 0) {
      const prev = data.classes[segments[i - 1].classId]
      const gains = promotionGains(prev, cls)
      for (const s of TELLIUS_STATS) stats[s] += gains[s]
      stats = capped(stats, cls.caps)
      con += cls.con - prev.con
      stages.push({ classId: cls.id, level: 1, stats: { ...stats }, caps: cls.caps, mov: cls.mov, con, points: grower.points() })
    }
    if (seg.to > seg.from) {
      stats = grower.grow(stats, seg.to - seg.from, cls.caps, cls.id)
      stages.push({ classId: cls.id, level: seg.to, stats: { ...stats }, caps: cls.caps, mov: cls.mov, con, points: grower.points() })
    }
  })
  return stages
}

/** A laguz's stats transformed: everything but HP and Luck doubled, held at the transformed class's caps. The doubling
 * is the usual account of Radiant Dawn's laguz; it isn't checked in the game's code. Undefined for a class that doesn't
 * transform, or that is the transformed form. */
export function transformedStats(
  data: TelliusData,
  classId: string,
  stats: TelliusStats,
): { classId: string; stats: TelliusStats } | undefined {
  const cls = data.classes[classId]
  if (!cls?.laguz || cls.transformed || !cls.transformsTo) return undefined
  const form = data.classes[cls.transformsTo]
  if (!form) return undefined
  const out = { ...stats }
  for (const s of TELLIUS_STATS) if (s !== 'hp' && s !== 'lck') out[s] = stats[s] * 2
  return { classId: form.id, stats: capped(out, form.caps) }
}

/** Chapters fought together for C, B and A, as Serenes Forest counts them (see TelliusSupport.points). */
export function chaptersNeeded(support: TelliusSupport): [number, number, number] {
  const [c, b, a] = support.points
  return [c, b - 1, a - 2]
}

export function supportsOf(data: TelliusData, unitId: string): { partner: TelliusUnit; support: TelliusSupport }[] {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  return data.supports
    .filter((s) => s.a === unitId || s.b === unitId)
    .map((s) => ({ partner: byId.get(s.a === unitId ? s.b : s.a)!, support: s }))
    .filter((x) => x.partner)
}

/** Whether a unit in this class, with these skills, matches one of a skill rule's ids (SID_, PID_, JID_ or SFXC_). */
function matchesRule(data: TelliusData, unit: TelliusUnit, classId: string, have: string[], id: string): boolean {
  if (id.startsWith('SID_')) return have.includes(id) || (data.classes[classId]?.skills.includes(id) ?? false)
  if (id.startsWith('PID_')) return unit.id === id
  if (id.startsWith('JID_')) return classId === id
  if (id.startsWith('SFXC_')) {
    // A laguz's tags are split between its two forms (a dragon is SFXC_DRAGON only transformed): either counts.
    const cls = data.classes[classId]
    const form = cls?.transformsTo ? data.classes[cls.transformsTo] : undefined
    return Boolean(cls?.attributes?.includes(id) || form?.attributes?.includes(id))
  }
  return false
}

/** Skills this unit could learn in this class: those with a scroll, within any class or unit limit (Path of Radiance)
 * or the skill's rules (Radiant Dawn: see TelliusSkill.deny). `have` is what the unit already carries. */
export function learnableSkills(data: TelliusData, unit: TelliusUnit, classId: string, have: string[] = unit.skills): string[] {
  const match = (id: string) => matchesRule(data, unit, classId, have, id)
  return Object.values(data.skills)
    .filter((s) => s.removable && s.scroll)
    .filter((s) => !s.onlyClasses || s.onlyClasses.includes(classId))
    .filter((s) => !s.onlyUnits || s.onlyUnits.includes(unit.id))
    .filter((s) => !(s.deny ?? []).some(match))
    .filter((s) => (s.need ?? []).every(match))
    .filter((s) => {
      if (s.allow) return s.allow.some(match)
      // A Radiant Dawn skill with no `allow` list and nothing needed is for beorc only.
      if (s.need || !data.openSupports) return true
      return match('SFXC_HUMAN')
    })
    .map((s) => s.id)
}

/** Radiant Dawn: who a unit can support (everyone else in the pool), with the pair's kind and what it adds per gain. */
export function openSupportsOf(
  data: TelliusData,
  unitId: string,
): { partner: TelliusUnit; kind: number; bonus: number; flag?: number }[] {
  const open = data.openSupports
  if (!open || !open.pool.includes(unitId)) return []
  const byPair = new Map(open.pairs.map((p) => [`${p.a}|${p.b}`, p]))
  const byId = new Map(data.units.map((u) => [u.id, u]))
  return open.pool
    .filter((id) => id !== unitId && byId.has(id))
    .map((id) => {
      const pair = byPair.get(unitId < id ? `${unitId}|${id}` : `${id}|${unitId}`)
      const kind = pair?.kind ?? 2
      return { partner: byId.get(id)!, kind, bonus: open.kindBonus[kind] ?? 0, flag: pair?.flag }
    })
}

/** A unit's bonds (Radiant Dawn), with the other unit. */
export function bondsOf(data: TelliusData, unitId: string): { partner: TelliusUnit; bond: TelliusBond }[] {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  return (data.bonds ?? [])
    .filter((b) => b.a === unitId || b.b === unitId)
    .map((b) => ({ partner: byId.get(b.a === unitId ? b.b : b.a)!, bond: b }))
    .filter((x) => x.partner)
}

/** The capacity the unit's skills use (class skills cost nothing; a mastery skill does). */
export function capacityUsed(data: TelliusData, skillIds: string[]): number {
  const mastery = masterySkills(data)
  return skillIds.reduce((sum, id) => sum + (data.skills[id]?.removable || mastery.has(id) ? data.skills[id].capacity : 0), 0)
}

/** Every class's mastery skill (Radiant Dawn's, learned with a Satori Sign; they take capacity like a scroll's). */
export function masterySkills(data: TelliusData): Set<string> {
  return new Set(Object.values(data.classes).flatMap((c) => (c.mastery ? [c.mastery] : [])))
}

/** Ids for art the user uploads (Edit Mode, Bulk Upload): 'fe9/ike', 'fe9/sol'. */
export function artId(gameId: string, name: string): string {
  return `${gameId}/${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
}

export function formatStat(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
