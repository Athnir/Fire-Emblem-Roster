import { TELLIUS_STATS, type TelliusClass, type TelliusData, type TelliusStats, type TelliusSupport, type TelliusUnit } from './types'

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
 * Levels a unit up. Random mode adds each growth rate as a fraction (the average). Fixed mode (Path of Radiance, from
 * Serenes Forest's description: unconfirmed in the game's code) keeps growth points per stat, starting from the unit's
 * own: a level's worth of EXP (100) adds the growth rate, held at 255, and each 100 points becomes +1 at the level-up,
 * the rest carrying over. Weapons, items and the class of what was defeated shift the points too; they aren't counted.
 */
function makeGrower(unit: TelliusUnit, mode: GrowthMode | undefined) {
  const points = mode === 'fixed' && unit.fixedStart ? { ...unit.fixedStart } : undefined
  return {
    points: () => (points ? { ...points } : undefined),
    grow(stats: TelliusStats, levels: number, caps: TelliusStats): TelliusStats {
      const out = { ...stats }
      if (!points) {
        for (const s of TELLIUS_STATS) out[s] = stats[s] + (unit.growths[s] * Math.max(0, levels)) / 100
        return capped(out, caps)
      }
      for (let i = 0; i < levels; i++) {
        for (const s of TELLIUS_STATS) {
          points[s] = Math.min(FIXED_MAX_POINTS, points[s] + unit.growths[s])
          const rise = Math.floor(points[s] / 100)
          points[s] -= rise * 100
          out[s] += rise
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
  const grower = makeGrower(unit, plan.mode)
  const stages: ProjectionStage[] = [
    { classId: start.id, level: unit.level, stats: { ...unit.bases }, caps: start.caps, mov: start.mov, con: unit.con, points: grower.points() },
  ]
  if (promoted && plan.promoteAt !== null) {
    const at = Math.max(unit.level, Math.min(plan.promoteAt, data.maxLevel))
    const before = grower.grow(unit.bases, at - unit.level, start.caps)
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
        classId: promoted.id, level: target, stats: grower.grow(afterCapped, target - 1, promoted.caps),
        caps: promoted.caps, mov: promoted.mov, con, points: grower.points(),
      })
    }
    return stages
  }
  const target = Math.max(unit.level, Math.min(plan.targetLevel, data.maxLevel))
  if (target > unit.level) {
    stages.push({
      classId: start.id, level: target, stats: grower.grow(unit.bases, target - unit.level, start.caps),
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
