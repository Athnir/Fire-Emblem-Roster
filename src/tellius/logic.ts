import {
  TELLIUS_STATS,
  type TelliusBand,
  type TelliusClass,
  type TelliusData,
  type TelliusStats,
  type TelliusSupport,
  type TelliusUnit,
} from './types'

/** The lowest level a base class can promote at with a Master Seal. */
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
  /** The level to promote at in the base class; null never promotes. */
  promoteAt: number | null
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

/** How many level-ups the plan covers: to the promotion and from there to the target, or straight to the target. */
export function levelUpsIn(data: TelliusData, unit: TelliusUnit, plan: ProjectionPlan): number {
  if (promotionOf(data, unit) && plan.promoteAt !== null) {
    const at = Math.max(unit.level, Math.min(plan.promoteAt, data.maxLevel))
    return at - unit.level + Math.max(0, Math.min(plan.targetLevel, data.maxLevel) - 1)
  }
  return Math.max(0, Math.min(plan.targetLevel, data.maxLevel) - unit.level)
}

/** Whether a unit in this class can wear the band (the Knight Ward is for knights, soldiers and their promotions). */
export function canWear(band: TelliusBand, classId: string): boolean {
  return !band.onlyClasses || band.onlyClasses.includes(classId)
}

/** The bands to offer: those the unit can wear in its class or the one the plan promotes it to (no Knight Ward for Ike). */
export function wearableBands(data: TelliusData, unit: TelliusUnit, plan: ProjectionPlan): TelliusBand[] {
  const promoted = promotionOf(data, unit)
  const classIds = [unit.classId, ...(promoted && plan.promoteAt !== null ? [promoted.id] : [])]
  return (data.bands ?? []).filter((b) => classIds.some((c) => canWear(b, c)))
}

/** Fixed mode holds at most this many growth points per stat (Serenes Forest). */
export const FIXED_MAX_POINTS = 255

function capped(stats: TelliusStats, caps: TelliusStats): TelliusStats {
  const out = { ...stats }
  for (const s of TELLIUS_STATS) out[s] = Math.min(out[s], caps[s])
  return out
}

/** Whether the unit's starting class can promote (laguz and promoted classes can't). */
export function promotionOf(data: TelliusData, unit: TelliusUnit): TelliusClass | undefined {
  const cls = data.classes[unit.classId]
  if (!cls || cls.tier !== 'base' || cls.laguz || !cls.promotesTo) return undefined
  return data.classes[cls.promotesTo]
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
 * The unit's stats where they join, at the promotion (if any) and at the target level. Promotion adds the promoted
 * class's bases minus the base class's (checked against Serenes Forest's promotion gains) and starts the new class
 * at level 1.
 */
export function project(data: TelliusData, unit: TelliusUnit, plan: ProjectionPlan): ProjectionStage[] {
  const start = data.classes[unit.classId]
  const promoted = promotionOf(data, unit)
  const grower = makeGrower(data, unit, plan)
  const stages: ProjectionStage[] = [
    { classId: start.id, level: unit.level, stats: { ...unit.bases }, caps: start.caps, mov: start.mov, con: unit.con, points: grower.points() },
  ]
  if (promoted && plan.promoteAt !== null) {
    const at = Math.max(unit.level, Math.min(plan.promoteAt, data.maxLevel))
    const before = grower.grow(unit.bases, at - unit.level, start.caps, start.id)
    if (at > unit.level) {
      stages.push({ classId: start.id, level: at, stats: before, caps: start.caps, mov: start.mov, con: unit.con, points: grower.points() })
    }
    const after = { ...before }
    for (const s of TELLIUS_STATS) after[s] = before[s] + promoted.bases[s] - start.bases[s]
    const con = unit.con + promoted.con - start.con
    const afterCapped = capped(after, promoted.caps)
    stages.push({ classId: promoted.id, level: 1, stats: afterCapped, caps: promoted.caps, mov: promoted.mov, con, points: grower.points() })
    const target = Math.max(1, Math.min(plan.targetLevel, data.maxLevel))
    if (target > 1) {
      stages.push({
        classId: promoted.id, level: target, stats: grower.grow(afterCapped, target - 1, promoted.caps, promoted.id),
        caps: promoted.caps, mov: promoted.mov, con, points: grower.points(),
      })
    }
    return stages
  }
  const target = Math.max(unit.level, Math.min(plan.targetLevel, data.maxLevel))
  if (target > unit.level) {
    stages.push({
      classId: start.id, level: target, stats: grower.grow(unit.bases, target - unit.level, start.caps, start.id),
      caps: start.caps, mov: start.mov, con: unit.con, points: grower.points(),
    })
  }
  return stages
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

/** Skills this unit could learn in this class: those with a scroll, within any class or unit limit. */
export function learnableSkills(data: TelliusData, unit: TelliusUnit, classId: string): string[] {
  return Object.values(data.skills)
    .filter((s) => s.removable && s.scroll)
    .filter((s) => !s.onlyClasses || s.onlyClasses.includes(classId))
    .filter((s) => !s.onlyUnits || s.onlyUnits.includes(unit.id))
    .map((s) => s.id)
}

/** The capacity the unit's skills use (class skills cost nothing). */
export function capacityUsed(data: TelliusData, skillIds: string[]): number {
  return skillIds.reduce((sum, id) => sum + (data.skills[id]?.removable ? data.skills[id].capacity : 0), 0)
}

/** Ids for art the user uploads (Edit Mode, Bulk Upload): 'fe9/ike', 'fe9/sol'. */
export function artId(gameId: string, name: string): string {
  return `${gameId}/${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
}

export function formatStat(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
