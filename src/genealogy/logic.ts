import {
  FE4_STATS,
  type Fe4Blood,
  type Fe4BloodLevel,
  type Fe4Choice,
  type Fe4Class,
  type Fe4Love,
  type Fe4Ring,
  type Fe4Stat,
  type Fe4Stats,
  type Fe4Unit,
} from './types'

/** Everything Genealogy's screens need, passed in so the screens don't import the game's data. */
export interface Fe4Data {
  gameId: string
  chapters: { id: string; label: string }[]
  units: Fe4Unit[]
  classes: Record<string, Fe4Class>
  bloods: Fe4Blood[]
  choices?: Fe4Choice[]
  love?: Fe4Love
  rings?: Fe4Ring[]
}

/** The level cap ($84:AA44), and the level a unit can promote at: the promoted class's own (20 for every class; $87:A438). The
 * level isn't reset by promoting. */
export const FE4_MAX_LEVEL = 30
export const FE4_PROMOTE_LEVEL = 20

/** A pairing: a father's id, or NO_HUSBAND (her substitutes join); none saved means not picked yet. */
export const NO_HUSBAND = 'none'

/** A class's caps: the game holds HP at 80, Luck at 30 and every other stat at 15 above the class's base ($84:AD00), and shows at
 * most 30 ($84:9B1D). */
export function capsOf(cls: Fe4Class): Fe4Stats {
  const out = { ...cls.bases }
  for (const s of FE4_STATS) out[s] = s === 'hp' ? 80 : s === 'lck' ? 30 : Math.min(30, cls.bases[s] + 15)
  return out
}

/** The growth bonus holy blood gives: each blood's, doubled for major blood. */
export function bloodBonus(data: Fe4Data, blood: Fe4BloodLevel[]): Fe4Stats {
  const out = Object.fromEntries(FE4_STATS.map((s) => [s, 0])) as Fe4Stats
  for (const b of blood) {
    const table = data.bloods.find((x) => x.id === b.blood)
    if (!table) continue
    for (const s of FE4_STATS) out[s] += table.growths[s] * (b.level === 'major' ? 2 : 1)
  }
  return out
}

/** Growths with holy blood, held at 0 or more ($84:A464). */
function withBlood(data: Fe4Data, growths: Fe4Stats, blood: Fe4BloodLevel[]): Fe4Stats {
  const bonus = bloodBonus(data, blood)
  const out = { ...growths }
  for (const s of FE4_STATS) out[s] = Math.max(0, growths[s] + bonus[s])
  return out
}

/** A unit's stats, growths (own + holy blood), holy blood and the rest, ready to project: a fixed unit's own, or a child's from
 * their parents. */
export interface Fe4Profile {
  unit: Fe4Unit
  classId: string
  level: number
  bases: Fe4Stats
  growths: Fe4Stats
  blood: Fe4BloodLevel[]
  skills: string[]
  gold: number
  leadership: number
  /** A child: Luck's lowest and highest (a random 1 to 10 is added); `bases.lck` is the average. */
  luckRange?: [number, number]
  /** A child: stats stored at 16 or more, which wrap (mod 16) once the game saves and reloads ($91:F11F). */
  wraps?: Fe4Stat[]
}

export function profileOf(data: Fe4Data, unit: Fe4Unit): Fe4Profile | undefined {
  if (!unit.bases || !unit.growths) return undefined
  const blood = unit.blood ?? []
  return {
    unit,
    classId: unit.classId,
    level: unit.level,
    bases: { ...unit.bases },
    growths: withBlood(data, unit.growths, blood),
    blood,
    skills: unit.skills ?? [],
    gold: unit.gold ?? 0,
    leadership: unit.leadership ?? 0,
  }
}

export interface Fe4Plan {
  /** The level to promote at (20 or more); null never promotes. */
  promoteAt: number | null
  targetLevel: number
}

export interface Fe4Stage {
  classId: string
  level: number
  stats: Fe4Stats
  caps: Fe4Stats
}

function capped(stats: Fe4Stats, caps: Fe4Stats): Fe4Stats {
  const out = { ...stats }
  for (const s of FE4_STATS) out[s] = Math.min(out[s], caps[s])
  return out
}

/** The level a unit promotes into a class from: its own (20). */
export function promoteLevelOf(cls: Fe4Class | undefined): number {
  return cls?.promoteLevel ?? FE4_PROMOTE_LEVEL
}

/**
 * Average stats through the levels: each level adds the growth rate as a fraction (a sure point per 100, then one roll;
 * $84:ACE7), held at the class's caps. Promoting changes only the class ($84:ABB0): the game stores Str to Res above the class's
 * base, so they rise by the difference in the classes' bases, while HP, Luck, the level and EXP stay.
 */
export function project(data: Fe4Data, p: Fe4Profile, plan: Fe4Plan): Fe4Stage[] {
  const start = data.classes[p.classId]
  const promoted = p.unit.promotesTo ? data.classes[p.unit.promotesTo] : undefined
  const stages: Fe4Stage[] = [{ classId: start.id, level: p.level, stats: { ...p.bases }, caps: capsOf(start) }]
  const grow = (stats: Fe4Stats, levels: number, caps: Fe4Stats) => {
    const out = { ...stats }
    for (const s of FE4_STATS) out[s] += (p.growths[s] / 100) * Math.max(0, levels)
    return capped(out, caps)
  }
  const target = Math.min(FE4_MAX_LEVEL, Math.max(p.level, plan.targetLevel))
  if (promoted && plan.promoteAt !== null) {
    const at = Math.min(target, Math.max(p.level, plan.promoteAt))
    let stats = grow(p.bases, at - p.level, capsOf(start))
    if (at > p.level) stages.push({ classId: start.id, level: at, stats, caps: capsOf(start) })
    stats = { ...stats }
    for (const s of FE4_STATS) if (s !== 'hp' && s !== 'lck') stats[s] += promoted.bases[s] - start.bases[s]
    stats = capped(stats, capsOf(promoted))
    stages.push({ classId: promoted.id, level: at, stats, caps: capsOf(promoted) })
    if (target > at) stages.push({ classId: promoted.id, level: target, stats: grow(stats, target - at, capsOf(promoted)), caps: capsOf(promoted) })
    return stages
  }
  if (target > p.level) stages.push({ classId: start.id, level: target, stats: grow(p.bases, target - p.level, capsOf(start)), caps: capsOf(start) })
  return stages
}

const LEVEL = { minor: 1, major: 2 } as const

/**
 * The holy blood a child gets ($87:A9FB): for each blood, the main parent's (+0x0B: mainParent) level, plus one if the other
 * parent has that blood at all, held at major. So minor and minor, or minor and major, make major. Seliph's isn't worked out:
 * the game sets it ($84:835E), and the data has it.
 */
export function childBlood(main: Fe4BloodLevel[], other: Fe4BloodLevel[]): Fe4BloodLevel[] {
  const names = [...new Set([...main, ...other].map((b) => b.blood))]
  return names.map((blood) => {
    const m = main.find((b) => b.blood === blood)
    const level = (m ? LEVEL[m.level] : 0) + (other.some((b) => b.blood === blood) ? 1 : 0)
    return { blood, level: level >= 2 ? 'major' : 'minor' }
  })
}

/** A parent as they stand at the end of the first generation: their class and stats (the Unit Planner's plan), gold. */
export interface Fe4Parent {
  unit: Fe4Unit
  classId: string
  stats: Fe4Stats
  gold: number
}

/**
 * A child's profile from their parents ($87:A869 growths, $87:A6E6 stats; run on the game's own code for every mother, father and
 * child). The parent of the child's own sex is the main one for growths and stats: growths = theirs + half the other's (rounded
 * down) + the child's holy blood. Each stat is (2 x main's + other's) / 10, rounded down, from what the game stores (max HP;
 * Str to Res above the class's base; Luck), plus (level - 1) x growth / 100; HP adds 15, Luck 1 and a random 1 to 10 (5.5 here,
 * with its range). Nothing is capped, so a stat can be stored at 16 or more, which wraps once the game saves (`wraps`).
 * Skills: both parents', through the child's mask. Gold: a tenth of both parents', + 2000.
 */
export function childProfile(data: Fe4Data, child: Fe4Unit, father: Fe4Parent, mother: Fe4Parent): Fe4Profile {
  const [main, other] = child.female ? [mother, father] : [father, mother]
  const [bloodMain, bloodOther] = child.mainParent === 'father' ? [father, mother] : [mother, father]
  const blood = child.blood ?? childBlood(bloodMain.unit.blood ?? [], bloodOther.unit.blood ?? [])
  const own = { ...main.unit.growths! }
  for (const s of FE4_STATS) own[s] = main.unit.growths![s] + Math.floor(other.unit.growths![s] / 2)
  const growths = withBlood(data, own, blood)
  const cls = data.classes[child.classId]
  // What the game stores for a parent: HP and Luck as they are, Str to Res above their class's base (0 to 15).
  const stored = (parent: Fe4Parent, s: Fe4Stat) => {
    if (s === 'hp' || s === 'lck') return parent.stats[s]
    return Math.min(15, Math.max(0, parent.stats[s] - data.classes[parent.classId].bases[s]))
  }
  const bases = { ...cls.bases }
  const wraps: Fe4Stat[] = []
  let luckLow = 0
  for (const s of FE4_STATS) {
    const inherited = Math.floor((2 * stored(main, s) + stored(other, s)) / 10)
    const levels = Math.floor(((child.level - 1) * growths[s]) / 100)
    if (s === 'hp') bases.hp = inherited + 15 + levels
    else if (s === 'lck') {
      // + 1 + (a random 0-99) / 10: 1 to 10, 5.5 on average.
      luckLow = inherited + levels + 1
      bases.lck = inherited + levels + 5.5
    } else {
      const value = inherited + levels
      if (value >= 16) wraps.push(s)
      bases[s] = Math.min(30, cls.bases[s] + value)
    }
  }
  const skills = [...new Set([...(father.unit.skills ?? []), ...(mother.unit.skills ?? [])])].filter((s) => child.inheritable?.includes(s) ?? true)
  return {
    unit: child,
    classId: child.classId,
    level: child.level,
    bases,
    growths,
    blood,
    skills,
    gold: Math.floor((father.gold + mother.gold) / 10) + 2000,
    leadership: child.leadership ?? 0,
    luckRange: [luckLow, luckLow + 9],
    ...(wraps.length ? { wraps } : {}),
  }
}

const RANK_ORDER = ['C', 'B', 'A']

/**
 * The weapon ranks a unit has in a class, with holy blood ($84:A095): the class's rank in each type it has; a minor blood of that
 * type raises it a letter, a major one to A. A holy weapon needs major blood of its line ($84:F66E).
 */
export function weaponRanks(
  data: Fe4Data,
  classId: string,
  blood: Fe4BloodLevel[],
): { type: string; rank: string; raisedBy?: string; holy?: string }[] {
  const cls = data.classes[classId]
  if (!cls) return []
  return Object.entries(cls.ranks).map(([type, rank]) => {
    let r = RANK_ORDER.indexOf(rank ?? 'C')
    let raisedBy: string | undefined
    let holy: string | undefined
    for (const b of blood) {
      const line = data.bloods.find((x) => x.id === b.blood)
      if (!line || line.weaponType !== type) continue
      raisedBy = `${b.blood} ${b.level}`
      if (b.level === 'major') {
        r = 2
        holy = line.weapon
      } else r = Math.min(2, r + 1)
    }
    return { type, rank: RANK_ORDER[r], ...(raisedBy && (RANK_ORDER[r] !== rank || holy) ? { raisedBy } : {}), ...(holy ? { holy } : {}) }
  })
}

/** A unit's skills in a class: their own, the class's, and the rings carried. */
export function skillsWith(data: Fe4Data, own: string[], classId: string, ringIds: string[] = []): string[] {
  const rings = (data.rings ?? []).filter((r) => ringIds.includes(r.id)).flatMap((r) => r.skills ?? [])
  return [...new Set([...own, ...(data.classes[classId]?.skills ?? []), ...rings])]
}

/** What the rings carried add: to stats (after the caps) and to Mov. */
export function ringBonus(data: Fe4Data, ringIds: string[]): { stats: Partial<Fe4Stats>; mov: number } {
  const stats: Partial<Fe4Stats> = {}
  let mov = 0
  for (const ring of (data.rings ?? []).filter((r) => ringIds.includes(r.id))) {
    if (ring.stat === 'mov') mov += ring.amount ?? 0
    else if (ring.stat) stats[ring.stat] = (stats[ring.stat] ?? 0) + (ring.amount ?? 0)
  }
  return { stats, mov }
}

/** A mother's love with each man she can marry: the start, the gain each player phase (to turn 50; $84:C33D), the talks' points,
 * and the player phases to 500 from those alone (standing next to her adds 5 a phase more). */
export function loveFor(data: Fe4Data, motherId: string): { man: string; start: number; growth: number; talks: number[]; turns?: number }[] {
  const love = data.love
  if (!love) return []
  return love.pairs
    .filter((p) => p.woman === motherId)
    .map((p) => {
      const talks = love.talks.filter((t) => t.woman === motherId && t.man === p.man).map((t) => t.points)
      const need = 500 - p.start - talks.reduce((a, b) => a + b, 0)
      const turns = need <= 0 ? 0 : p.growth > 0 ? Math.ceil(need / p.growth) : undefined
      return { man: p.man, start: p.start, growth: p.growth, talks, ...(turns !== undefined ? { turns } : {}) }
    })
}

/** The units in your army by the story choices and the pairings: a choice picked leaves out the other options' units; a mother
 * with a husband has her children, not their substitutes, and one with none (NO_HUSBAND) her substitutes. A mother not picked yet
 * keeps both. */
export function excludedUnits(data: Fe4Data, picks: Record<string, number>, pairings: Record<string, string>): Set<string> {
  const out = new Set<string>()
  for (const choice of data.choices ?? []) {
    const picked = picks[choice.id]
    if (picked === undefined || !choice.options[picked]) continue
    choice.options.forEach((opt, i) => {
      if (i !== picked) for (const id of opt.units) if (!choice.options[picked].units.includes(id)) out.add(id)
    })
  }
  for (const child of data.units.filter((u) => u.role === 'child' && u.mother && !u.father)) {
    const pick = pairings[child.mother!]
    if (pick === undefined) continue
    const subs = data.units.filter((u) => u.substituteFor === child.id).map((u) => u.id)
    if (pick === NO_HUSBAND) out.add(child.id)
    else for (const id of subs) out.add(id)
  }
  return out
}
