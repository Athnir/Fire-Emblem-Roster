import { FE4_STATS, type Fe4Blood, type Fe4BloodLevel, type Fe4Class, type Fe4Stats, type Fe4Unit } from './types'

/** Everything Genealogy's screens need, passed in so the screens don't import the game's data. */
export interface Fe4Data {
  gameId: string
  chapters: { id: string; label: string }[]
  units: Fe4Unit[]
  classes: Record<string, Fe4Class>
  bloods: Fe4Blood[]
}

/** The level cap, and the level a unit can promote from (Serenes Forest; the level isn't reset by promoting). */
export const FE4_MAX_LEVEL = 30
export const FE4_PROMOTE_LEVEL = 20

/** A class's caps: the game holds HP at 80, Luck at 30 and every other stat at 15 above the class's base ($84:AD00). */
export function capsOf(cls: Fe4Class): Fe4Stats {
  const out = { ...cls.bases }
  for (const s of FE4_STATS) out[s] = s === 'hp' ? 80 : s === 'lck' ? 30 : cls.bases[s] + 15
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

function add(a: Fe4Stats, b: Fe4Stats): Fe4Stats {
  const out = { ...a }
  for (const s of FE4_STATS) out[s] += b[s]
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
}

export function profileOf(data: Fe4Data, unit: Fe4Unit): Fe4Profile | undefined {
  if (!unit.bases || !unit.growths) return undefined
  const blood = unit.blood ?? []
  return {
    unit,
    classId: unit.classId,
    level: unit.level,
    bases: { ...unit.bases },
    growths: add(unit.growths, bloodBonus(data, blood)),
    blood,
    skills: unit.skills ?? [],
    gold: unit.gold ?? 0,
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

/**
 * Average stats through the levels: each level adds the growth rate as a fraction, held at the class's caps. Promoting keeps
 * what the game stores (the amount above the class's bases), so the stats rise by the difference in the classes' bases and the
 * level carries on (Serenes Forest; not yet traced in the code).
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

/** Who a child takes after: the parent of the same sex, except Leif and Altena's and Febail and Patty's, which swap (the
 * child record's flag; Serenes Forest's inheritance page says the same). */
export function mainParentIsFather(child: Fe4Unit): boolean {
  return child.mainParent === 'father'
}

/**
 * The holy blood a child inherits (Serenes Forest's inheritance page, not yet traced in the code): a blood the main parent
 * has as major stays major; the other parent's major becomes minor; minor from both parents becomes major; minor from one
 * stays minor. Loptous isn't passed on (Serenes lists Seliph without Deirdre's).
 */
export function childBlood(main: Fe4BloodLevel[], other: Fe4BloodLevel[]): Fe4BloodLevel[] {
  const names = [...new Set([...main, ...other].map((b) => b.blood))].filter((b) => b !== 'Loptous')
  return names.map((blood) => {
    const m = main.find((b) => b.blood === blood)?.level
    const o = other.find((b) => b.blood === blood)?.level
    const level: 'major' | 'minor' = m === 'major' || (m === 'minor' && o === 'minor') ? 'major' : 'minor'
    return { blood, level }
  })
}

/**
 * A child's profile from their parents as they stand at the end of the first generation (Serenes Forest's calculations page;
 * not yet traced in the code). Growths: the main parent's own + half the other's own + the child's holy blood bonus. Bases:
 * each parent adds (stat - their class's base, at least 0; HP - 20; Luck as it is), the main parent's twice, a tenth of the sum,
 * plus the child's own levels' growth, taken mod 15, on the child's class's base. HP is that + 20; Luck adds a random 1-99
 * (taken here as 50) and 1. Gold: a tenth of both parents' + 2000.
 */
export function childProfile(
  data: Fe4Data,
  child: Fe4Unit,
  father: { unit: Fe4Unit; classId: string; stats: Fe4Stats; gold: number },
  mother: { unit: Fe4Unit; classId: string; stats: Fe4Stats; gold: number },
): Fe4Profile {
  const [main, other] = mainParentIsFather(child) ? [father, mother] : [mother, father]
  const blood = childBlood(main.unit.blood ?? [], other.unit.blood ?? [])
  const growths = { ...main.unit.growths! }
  for (const s of FE4_STATS) growths[s] = main.unit.growths![s] + Math.floor(other.unit.growths![s] / 2)
  const total = add(growths, bloodBonus(data, blood))
  const cls = data.classes[child.classId]
  const addition = (parent: typeof main, s: keyof Fe4Stats) => {
    if (s === 'hp') return Math.max(0, parent.stats.hp - 20)
    if (s === 'lck') return parent.stats.lck
    return Math.max(0, parent.stats[s] - data.classes[parent.classId].bases[s])
  }
  const bases = { ...cls.bases }
  for (const s of FE4_STATS) {
    const inherited = Math.floor((2 * addition(main, s) + addition(other, s) + (s === 'lck' ? 50 : 0)) / 10)
    if (s === 'hp') bases.hp = inherited + Math.floor((child.level * total.hp) / 100) + 20
    else if (s === 'lck') bases.lck = inherited + Math.floor(((child.level - 1) * total.lck) / 100) + 1
    else bases[s] = ((inherited + Math.floor(((child.level - 1) * total[s]) / 100)) % 15) + cls.bases[s]
  }
  const skills = [...new Set([...(main.unit.skills ?? []), ...(other.unit.skills ?? [])])]
  return {
    unit: child,
    classId: child.classId,
    level: child.level,
    bases,
    growths: total,
    blood,
    skills,
    gold: Math.floor((father.gold + mother.gold) / 10) + 2000,
  }
}
