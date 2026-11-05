import {
  TELLIUS_RANK_LABELS,
  TELLIUS_STATS,
  type TelliusBand,
  type TelliusBond,
  type TelliusClass,
  type TelliusData,
  type TelliusRankType,
  type TelliusStat,
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
  /** Bonus EXP level-ups among the levels this stage reached. */
  bexp?: number
}

/** What a Path of Radiance save brings a Radiant Dawn unit (0x8011d580), as ticked in the Unit Planner. */
export interface TransferPlan {
  /** Stats at their cap at the end of Path of Radiance: +5 HP, +2 any other. Only counts for a unit that finished at Lv
   * 20 in a promoted class (laguz count). */
  capped?: TelliusStat[]
  /** Units (Radiant Dawn ids) they had an A support with there: each a +5 bond, unless the pair has one. */
  aSupports?: string[]
  /** Sothe: his stats at the end of Path of Radiance (Lv 20), which replace his own. */
  stats?: Partial<TelliusStats>
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
  /** The skills carried: Blossom changes the growths while it's here (the plan assumes it stays on). */
  skills?: string[]
  /** Radiant Dawn: bonus EXP level-ups in each class of the plan (by planSegments' order), taken as its first ones. */
  bexp?: number[]
  /** Radiant Dawn: a Path of Radiance save's bonuses. */
  transfer?: TransferPlan
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
 * Dawn). Laguz don't promote, and a class only the story promotes (no Seal or Crown) promotes only a unit the story
 * promotes: Path of Radiance's Sothe never does. */
export function promotionsOf(data: TelliusData, unit: TelliusUnit): TelliusClass[] {
  const out: TelliusClass[] = []
  let cls = data.classes[unit.classId]
  let story = unit.storyPromotions?.length ?? 0
  while (cls && !cls.laguz && cls.promotesTo && data.classes[cls.promotesTo] && out.length < 2) {
    if (cls.storyPromotion) {
      if (story === 0) break
      story--
    }
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

/** Fixed mode holds at most this many growth points per stat (0x80034ff0). */
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

/** The average gain a level-up gives a stat at this growth rate: a sure point per 100, then a roll on the rest; with
 * Blossom, a failed roll is rolled once more (both games' level-ups, 0x80034130 and 0x8006d2c8). */
export function growthGain(rate: number, blossom = false): number {
  if (rate <= 0) return 0
  const sure = Math.min(2, Math.floor(rate / 100))
  const p = sure === 2 ? 0 : (rate - 100 * sure) / 100
  return sure + (blossom ? 1 - (1 - p) * (1 - p) : p)
}

/** Whether the plan carries the game's Blossom. */
export function hasBlossom(data: TelliusData, plan: ProjectionPlan): boolean {
  return Boolean(plan.skills?.includes(data.rules.blossom))
}

/**
 * Bonus EXP's level-up (Radiant Dawn, 0x8006d790): the level is rolled as usual (no Blossom or Paragon), then the risen
 * stat with the lowest growth is dropped until three are left (the earlier stat first on a tie), or the highest growths
 * that didn't rise and have room are added until there are three (the earlier first on a tie). The average gain of each
 * stat, worked out over every way the rolls can go. `room`: the stats below their cap, the only ones rolled.
 */
export function bexpGains(growths: TelliusStats, room: Record<TelliusStat, boolean>): TelliusStats {
  const order = (s: TelliusStat) => TELLIUS_STATS.indexOf(s)
  const stats = TELLIUS_STATS.filter((s) => room[s])
  const p = stats.map((s) => Math.min(1, Math.max(0, growths[s] / 100)))
  const out = Object.fromEntries(TELLIUS_STATS.map((s) => [s, 0])) as TelliusStats
  for (let mask = 0; mask < 1 << stats.length; mask++) {
    let prob = 1
    for (let i = 0; i < stats.length; i++) prob *= mask & (1 << i) ? p[i] : 1 - p[i]
    if (prob === 0) continue
    let rose = stats.filter((_, i) => mask & (1 << i))
    if (rose.length > 3) {
      const dropped = [...rose].sort((a, b) => growths[a] - growths[b] || order(a) - order(b)).slice(0, rose.length - 3)
      rose = rose.filter((s) => !dropped.includes(s))
    } else if (rose.length < 3) {
      const rest = stats.filter((s) => !rose.includes(s)).sort((a, b) => growths[b] - growths[a] || order(a) - order(b))
      rose = [...rose, ...rest.slice(0, 3 - rose.length)]
    }
    for (const s of rose) out[s] += prob
  }
  return out
}

/** Bonus EXP for one level from this level (Radiant Dawn, 0x80120524): 100 EXP at 1 + f x (L x m - 1) each, where L is
 * the level plus 20 in a second tier or 40 in a third (none for laguz), m is 1.5 for laguz, and f is 1/3 on Easy, 1/2
 * on Normal and 1 on Hard. */
export function bexpCost(cls: TelliusClass, level: number, difficulty: 'easy' | 'normal' | 'hard'): number {
  const f = { easy: 1 / 3, normal: 1 / 2, hard: 1 }[difficulty]
  const l = cls.laguz ? level * 1.5 : level + (cls.tier === 'promoted' ? 20 : cls.tier === 'master' ? 40 : 0)
  return Math.round(100 * (1 + f * (l - 1)))
}

/** The bonus EXP the plan's bonus EXP level-ups take, on each difficulty. */
export function bexpTotal(data: TelliusData, unit: TelliusUnit, plan: ProjectionPlan): Record<'easy' | 'normal' | 'hard', number> {
  const out = { easy: 0, normal: 0, hard: 0 }
  planSegments(data, unit, plan).forEach((seg, i) => {
    const n = Math.min(plan.bexp?.[i] ?? 0, seg.to - seg.from)
    const cls = data.classes[seg.classId]
    for (let k = 0; k < n; k++) for (const d of ['easy', 'normal', 'hard'] as const) out[d] += bexpCost(cls, seg.from + k, d)
  })
  return out
}

/**
 * Levels a unit up, one level at a time. Random mode adds each stat's average gain (growthGain). Fixed mode (Path of
 * Radiance, 0x80034ba8 and 0x800351fc) keeps growth points per stat, starting from the unit's own: a level's 100 EXP adds
 * the growth rate (held between 0 and 255), and the level-up turns 100 points (90 with Blossom) into +1, twice at most.
 * A worn band adds its growth changes in either mode, while the class can wear it. The weapon used and the class
 * fought also shift Fixed mode's points, award by award; that's left out, as a level counts as one award of 100 EXP.
 */
function makeGrower(data: TelliusData, unit: TelliusUnit, plan: ProjectionPlan) {
  const points = plan.mode === 'fixed' && unit.fixedStart ? { ...unit.fixedStart } : undefined
  const blossom = hasBlossom(data, plan)
  const bands = new Map((data.bands ?? []).map((b) => [b.id, b]))
  // The band worn for each level-up, in order.
  const worn: (TelliusBand | undefined)[] = []
  for (const seg of plan.bands ?? []) for (let i = 0; i < seg.levels; i++) worn.push(bands.get(seg.bandId))
  let levelUps = 0
  return {
    points: () => (points ? { ...points } : undefined),
    /** Promotion halves every stat's points, rounding down (0x8003d464). */
    promote() {
      if (points) for (const s of TELLIUS_STATS) points[s] = Math.floor(points[s] / 2)
    },
    grow(stats: TelliusStats, levels: number, caps: TelliusStats, classId: string, bexp = 0): TelliusStats {
      let out = { ...stats }
      for (let i = 0; i < levels; i++) {
        const band = worn[levelUps++]
        if (i < bexp) {
          const room = Object.fromEntries(TELLIUS_STATS.map((s) => [s, out[s] < caps[s]])) as Record<TelliusStat, boolean>
          const gains = bexpGains(unit.growths, room)
          for (const s of TELLIUS_STATS) out[s] += gains[s]
          out = capped(out, caps)
          continue
        }
        for (const s of TELLIUS_STATS) {
          const rate = unit.growths[s] + (band && canWear(band, classId) ? band.growths[s] : 0)
          if (points) {
            points[s] = Math.max(0, Math.min(FIXED_MAX_POINTS, points[s] + rate))
            const step = blossom ? 90 : 100
            for (let pass = 0; pass < 2 && points[s] >= step; pass++) {
              points[s] -= step
              out[s] += 1
            }
          } else {
            out[s] += growthGain(rate, blossom)
          }
        }
        out = capped(out, caps)
      }
      return out
    },
  }
}

/** A unit's stats when they join, with what a Path of Radiance save adds (Radiant Dawn, 0x8011d580): +5 HP or +2 for each
 * stat that was at its cap there, or for Sothe his stats there, all held at the class's caps. */
export function joinStats(data: TelliusData, unit: TelliusUnit, transfer?: TransferPlan): TelliusStats {
  const cls = data.classes[unit.classId]
  const out = { ...unit.bases }
  if (!transfer || !unit.porUnit) return out
  if (unit.id === data.rules.transferCopies) {
    for (const s of TELLIUS_STATS) if (typeof transfer.stats?.[s] === 'number') out[s] = transfer.stats[s]!
  } else {
    for (const s of transfer.capped ?? []) out[s] += s === 'hp' ? 5 : 2
  }
  return capped(out, cls.caps)
}

/**
 * The unit's stats where they join, at each promotion and at the target level. A promotion adds the new class's gains
 * (promotionGains) and starts the new class at level 1; Con changes by the difference in the classes' Con.
 */
export function project(data: TelliusData, unit: TelliusUnit, plan: ProjectionPlan): ProjectionStage[] {
  const segments = planSegments(data, unit, plan)
  const grower = makeGrower(data, unit, plan)
  const start = data.classes[unit.classId]
  let stats = joinStats(data, unit, plan.transfer)
  const stages: ProjectionStage[] = [
    { classId: start.id, level: unit.level, stats: { ...stats }, caps: start.caps, mov: start.mov, con: unit.con, points: grower.points() },
  ]
  let con = unit.con
  segments.forEach((seg, i) => {
    const cls = data.classes[seg.classId]
    if (i > 0) {
      const prev = data.classes[segments[i - 1].classId]
      const gains = promotionGains(prev, cls)
      for (const s of TELLIUS_STATS) stats[s] += gains[s]
      stats = capped(stats, cls.caps)
      con += cls.con - prev.con
      grower.promote()
      stages.push({ classId: cls.id, level: 1, stats: { ...stats }, caps: cls.caps, mov: cls.mov, con, points: grower.points() })
    }
    if (seg.to > seg.from) {
      const bexp = data.rules.bexp ? Math.min(plan.bexp?.[i] ?? 0, seg.to - seg.from) : 0
      stats = grower.grow(stats, seg.to - seg.from, cls.caps, cls.id, bexp)
      stages.push({
        classId: cls.id,
        level: seg.to,
        stats: { ...stats },
        caps: cls.caps,
        mov: cls.mov,
        con,
        points: grower.points(),
        ...(bexp ? { bexp } : {}),
      })
    }
  })
  return stages
}

/**
 * A laguz's stats transformed, held at the transformed class's caps. Path of Radiance (0x8003bbd4) switches the unit to
 * the transformed class, so its bases replace the other form's; Radiant Dawn (0x80122770) doubles every stat but HP and
 * Luck, or multiplies them by 1.5 (rounded down) half-transformed. Undefined for a class that doesn't transform, or that
 * is the transformed form.
 */
export function transformedStats(
  data: TelliusData,
  classId: string,
  stats: TelliusStats,
  half = false,
): { classId: string; stats: TelliusStats } | undefined {
  const cls = data.classes[classId]
  if (!cls?.laguz || cls.transformed || !cls.transformsTo) return undefined
  const form = data.classes[cls.transformsTo]
  if (!form) return undefined
  const out = { ...stats }
  if (data.rules.transform === 'form') {
    for (const s of TELLIUS_STATS) out[s] = stats[s] - cls.bases[s] + form.bases[s]
  } else {
    for (const s of TELLIUS_STATS) if (s !== 'hp' && s !== 'lck') out[s] = half ? Math.floor(stats[s] * 1.5) : stats[s] * 2
  }
  return { classId: form.id, stats: capped(out, form.caps) }
}

/** Chapters fought together for C, B and A (see TelliusSupport.points). */
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

/** Skills this unit could learn in this class: those with a scroll, within any class or unit limit and with the skills
 * they need (Path of Radiance, 0x801058c4), or the skill's rules (Radiant Dawn, 0x80119dc8: none of `deny`, all of
 * `need`, one of `allow` when given). `have` is what the unit already carries. */
export function learnableSkills(data: TelliusData, unit: TelliusUnit, classId: string, have: string[] = unit.skills): string[] {
  const match = (id: string) => matchesRule(data, unit, classId, have, id)
  return Object.values(data.skills)
    .filter((s) => s.scroll)
    .filter((s) => !s.onlyClasses || s.onlyClasses.includes(classId))
    .filter((s) => !s.onlyUnits || s.onlyUnits.includes(unit.id))
    .filter((s) => (s.requires ?? []).every(match))
    .filter((s) => !(s.deny ?? []).some(match))
    .filter((s) => (s.need ?? []).every(match))
    .filter((s) => !s.allow || s.allow.some(match))
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

/** A unit's bonds (Radiant Dawn), with the other unit: the game's, and a +5 one for each A support from Path of Radiance
 * ticked in either unit's plan (0x801130d4 adds it unless the pair has a bond already). */
export function bondsOf(
  data: TelliusData,
  unitId: string,
  plans: Record<string, { transfer?: TransferPlan } | undefined> = {},
): { partner: TelliusUnit; bond: TelliusBond; fromPor?: boolean }[] {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const out: { partner: TelliusUnit; bond: TelliusBond; fromPor?: boolean }[] = (data.bonds ?? [])
    .filter((b) => b.a === unitId || b.b === unitId)
    .map((b) => ({ partner: byId.get(b.a === unitId ? b.b : b.a)!, bond: b }))
    .filter((x) => x.partner)
  const ticked = new Set(plans[unitId]?.transfer?.aSupports ?? [])
  for (const [id, plan] of Object.entries(plans)) if (plan?.transfer?.aSupports?.includes(unitId)) ticked.add(id)
  for (const id of ticked) {
    const partner = byId.get(id)
    const unit = byId.get(unitId)
    // Only a pair the save can tie: their Path of Radiance supports.
    if (!partner || !unit?.porSupports?.includes(id) || out.some((x) => x.partner.id === id)) continue
    out.push({ partner, bond: { a: unitId, b: id, value: 5 }, fromPor: true })
  }
  return out
}

/** Every class's mastery skill (Radiant Dawn's, learned with a Satori Sign; they take capacity like a scroll's). */
export function masterySkills(data: TelliusData): Set<string> {
  return new Set(Object.values(data.classes).flatMap((c) => (c.mastery ? [c.mastery] : [])))
}

/** A class's capacity at a level: its own, plus Radiant Dawn's laguz bonus (+15 from Lv 15, +50 from Lv 30). */
export function capacityOf(data: TelliusData, classId: string, level: number): number {
  const cls = data.classes[classId]
  if (!cls) return 0
  let bonus = 0
  if (cls.laguz) for (const [from, add] of data.rules.laguzCapacity ?? []) if (level >= from) bonus = add
  return cls.capacity + bonus
}

/** The skills a unit has in this class: the class's own and those carried (plan.skills). */
export function skillsIn(data: TelliusData, classId: string, carried: string[]): string[] {
  const own = data.classes[classId]?.skills ?? []
  return [...own, ...carried.filter((id) => !own.includes(id))]
}

/** The capacity the skills use in this class: every skill but the class's own (Path of Radiance), or every skill but those
 * the unit joined with, the class's included (Radiant Dawn). */
export function capacityUsed(data: TelliusData, unit: TelliusUnit, classId: string, carried: string[]): number {
  const own = data.classes[classId]?.skills ?? []
  const counted =
    data.rules.capacity === 'nonClass'
      ? carried.filter((id) => !own.includes(id))
      : skillsIn(data, classId, carried).filter((id) => !unit.skills.includes(id))
  return counted.reduce((sum, id) => sum + (data.skills[id]?.capacity ?? 0), 0)
}

/** How many skills count toward the game's limit: those carried beside the class's own (Path of Radiance), or all of them
 * (Radiant Dawn). */
export function skillCount(data: TelliusData, classId: string, carried: string[]): number {
  const own = data.classes[classId]?.skills ?? []
  return data.rules.maxSkills.withClassSkills ? skillsIn(data, classId, carried).length : carried.filter((id) => !own.includes(id)).length
}

/** Why a skill can't be added in this class at this level, or undefined if it can: past the capacity or the number of
 * skills. Who can learn it at all is learnableSkills'. */
export function cannotAdd(data: TelliusData, unit: TelliusUnit, classId: string, level: number, carried: string[], id: string): string | undefined {
  const skill = data.skills[id]
  if (!skill) return 'unknown skill'
  if (skillCount(data, classId, [...carried, id]) > data.rules.maxSkills.count) {
    return data.rules.maxSkills.withClassSkills
      ? `at most ${data.rules.maxSkills.count} skills, the class's included`
      : `at most ${data.rules.maxSkills.count} skills besides the class's`
  }
  if (capacityUsed(data, unit, classId, [...carried, id]) > capacityOf(data, classId, level)) return 'not enough capacity'
  return undefined
}

/** The skills a plan can add in this class: learnable, the mastery skill, or one the unit joined with and dropped, that
 * fit. With the reason for those that don't. */
export function skillOptions(
  data: TelliusData,
  unit: TelliusUnit,
  classId: string,
  level: number,
  carried: string[],
): { id: string; reason?: string }[] {
  const mastery = data.classes[classId]?.mastery
  const ids = [
    ...learnableSkills(data, unit, classId, carried),
    ...(mastery && data.skills[mastery] ? [mastery] : []),
    ...unit.skills.filter((id) => data.skills[id]),
  ]
  return [...new Set(ids)]
    .filter((id) => !carried.includes(id) && !(data.classes[classId]?.skills ?? []).includes(id))
    .map((id) => ({ id, reason: cannotAdd(data, unit, classId, level, carried, id) }))
}

/** Movement in a class: the class's, +2 with Celerity carried, +2 with Boots used. */
export function movementOf(data: TelliusData, classId: string, carried: string[], boots: boolean): number {
  return (data.classes[classId]?.mov ?? 0) + (carried.includes(data.rules.celerity) ? 2 : 0) + (boots ? 2 : 0)
}

/** A class's weapons: the ranks it starts with (a promotion raises the unit's to at least these) and, in Radiant Dawn, the
 * highest each can reach. '*' is a type picked at promotion (Path of Radiance). */
export function weaponsText(data: TelliusData, classId: string): string {
  const cls = data.classes[classId]
  if (!cls) return ''
  const types = [...new Set([...Object.keys(cls.ranks), ...Object.keys(cls.maxRanks ?? {})])] as TelliusRankType[]
  const picked = types.filter((t) => cls.ranks[t] === '*').map((t) => TELLIUS_RANK_LABELS[t])
  const parts = types
    .filter((t) => cls.ranks[t] !== '*')
    .map((t) => {
      const start = cls.ranks[t]
      const top = cls.maxRanks?.[t]
      return `${TELLIUS_RANK_LABELS[t]} ${start ?? '–'}${top && top !== start ? ` (up to ${top})` : ''}`
    })
  if (picked.length === 1) parts.push(`${picked[0]}, picked at promotion`)
  else if (picked.length > 1) parts.push(`one of ${picked.slice(0, -1).join(', ')} or ${picked[picked.length - 1]}, picked at promotion`)
  return parts.join(', ') || 'no weapon ranks'
}

/** Ids for art the user uploads (Edit Mode, Bulk Upload): 'fe9/ike', 'fe9/sol'. Accents are dropped (Engage's Céline: 'fe17/celine'),
 * as every game's screens drop them when they look a portrait up, so Bulk Upload keeps each where it's read. */
export function artId(gameId: string, name: string): string {
  return `${gameId}/${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
}

export function formatStat(value: number): string {
  return String(Math.trunc(value))
}
