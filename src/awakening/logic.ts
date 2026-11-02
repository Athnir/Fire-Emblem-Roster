import { FE13_STATS, type Fe13Asset, type Fe13Class, type Fe13Skill, type Fe13Stat, type Fe13Stats, type Fe13Unit } from './types'

export interface Fe13Data {
  chapters: { id: string; label: string }[]
  units: Fe13Unit[]
  classes: Record<string, Fe13Class>
  /** The Avatar's asset and flaw table. */
  assets?: Fe13Asset[]
  /** Chrom's wife when he marries no one (PID_ダミー). */
  maiden?: Fe13Unit
  /** Every skill, by name. */
  skills?: Record<string, Fe13Skill>
}

const CHROM = 'fe13-chrom'

/** Everyone a marriage can name: the units, and the village maiden. */
export function unitsOf(data: Fe13Data): Fe13Unit[] {
  return data.maiden ? [...data.units, data.maiden] : data.units
}

export const MAX_LEVEL = 20
/** A class's top level (0x2d0ad8): 20 if it's promoted or promotes, else 30 (Villager, Dancer, the DLC's Dread Fighter...). */
export const maxLevelOf = (cls: Fe13Class) => cls.maxLevel ?? MAX_LEVEL
/** A Master Seal needs Lv 10, and so does an unpromoted unit's Second Seal (0x2d4d3c). */
export const SEAL_LEVEL = 10
/** How many class changes a plan can hold. The game has no limit; this is past what most playthroughs use. */
export const MAX_STEPS = 30

/** A step of a plan: change into `to` at level `at` of the class the unit is in. */
export interface Fe13Step {
  at: number
  to: string
}

export interface Fe13Plan {
  steps: Fe13Step[]
  targetLevel: number
  /** Aptitude equipped: 20 more on every growth (0x27d230). */
  aptitude?: boolean
  /** Limit Breaker equipped: 10 more on every maximum but HP (0x2c48f8). */
  limitBreaker?: boolean
  /** The DLC classes unlocked for the unit, open to its class changes. */
  dlc?: string[]
}

export interface Fe13Stage {
  classId: string
  level: number
  /** As the game shows them: held at the class's maximums (0x2f3ac0). */
  stats: Fe13Stats
  /** Before the maximums: the unit keeps every point it gained (0x2d0fb8), and a class with higher maximums shows them again. */
  raw: Fe13Stats
}

/** A class the unit can change into, and the lowest level of its current class it can do it at. */
export interface Fe13Change {
  to: string
  minLevel: number
  seal: 'master' | 'second' | 'dlc'
}

/** What a unit in a class can change into (the seal checks at 0x2d4d3c, the Second Seal's list at 0x2cff38):
 * - a Master Seal promotes from Lv 10;
 * - a Second Seal works once promoted, or from Lv 10 unpromoted. It lists the unit's classes (`set`), what they promote to only for a
 *   promoted unit from Lv 10 or an unpromoted one at Lv 30, and the unit's own class only at its top level;
 * - a DLC class's own seal, for the unlocked ones (`dlc`), once promoted or from Lv 10 (the Dread Fighter's, 0x214278). */
export function classChanges(data: Fe13Data, from: string, set: string[], dlc: string[] = []): Fe13Change[] {
  const cls = data.classes[from]
  const top = maxLevelOf(cls)
  const out = new Map<string, Fe13Change>()
  const add = (to: string, minLevel: number, seal: Fe13Change['seal']) => {
    if (!data.classes[to] || minLevel > top || (to === from && minLevel < top)) return
    const had = out.get(to)
    if (!had || minLevel < had.minLevel) out.set(to, { to, minLevel, seal })
  }
  for (const p of cls.promotesTo) add(p, SEAL_LEVEL, 'master')
  for (const id of set) add(id, cls.promoted ? 1 : SEAL_LEVEL, 'second')
  for (const id of set) for (const p of data.classes[id]?.promotesTo ?? []) add(p, cls.promoted ? SEAL_LEVEL : 30, 'second')
  add(from, top, 'second')
  for (const id of dlc) add(id, cls.promoted ? 1 : SEAL_LEVEL, 'dlc')
  return [...out.values()]
}

/** A plan's steps the game allows, up to the first it doesn't (a plan saved before the seal rules were traced can have one). */
export function legalSteps(data: Fe13Data, startClass: string, startLevel: number, plan: Fe13Plan, set: string[]): { steps: Fe13Step[]; dropped: Fe13Step | null } {
  let from = startClass
  let level = startLevel
  const steps: Fe13Step[] = []
  for (const step of plan.steps) {
    const change = classChanges(data, from, set, plan.dlc).find((c) => c.to === step.to)
    if (!change || Math.max(level, change.minLevel) > maxLevelOf(data.classes[from])) return { steps, dropped: step }
    steps.push(step)
    from = step.to
    level = 1
  }
  return { steps, dropped: null }
}

export function classSetOf(unit: Fe13Unit, female = unit.female): string[] {
  return female ? unit.classSets.female : unit.classSets.male
}

/** A class's maximums for a unit: the class's plus the unit's modifiers, and 10 on every stat but HP with Limit Breaker (0x2c48f8). */
export function capsOf(cls: Fe13Class, modifiers: Partial<Fe13Stats>, limitBreaker = false): Fe13Stats {
  const out = { ...cls.caps }
  for (const s of FE13_STATS) out[s] += (modifiers[s] ?? 0) + (limitBreaker && s !== 'hp' ? 10 : 0)
  return out
}

/** A level's average gain in each stat from the total growths (personal and class; the level-up, 0x2cef88): every 100 is a sure point and
 * the rest a chance. A level that rolls nothing is rolled once more, unless a growth is 100 or more, so a chance counts 1 + (the odds of
 * every roll failing) times. */
export function levelGain(total: Fe13Stats): Fe13Stats {
  const sure = FE13_STATS.some((s) => total[s] >= 100)
  let none = 1
  for (const s of FE13_STATS) if (total[s] > 0 && total[s] < 100) none *= 1 - total[s] / 100
  const again = sure ? 0 : none
  const out = {} as Fe13Stats
  for (const s of FE13_STATS) out[s] = total[s] <= 0 ? 0 : Math.floor(total[s] / 100) + ((total[s] % 100) / 100) * (1 + again)
  return out
}

export interface Fe13Projection {
  /** As they join, before the maximums (a child's inheritance included). */
  start?: Fe13Stats
  growths?: Fe13Stats
  modifiers?: Partial<Fe13Stats>
  /** The classes a Second Seal opens (a child's include their parents'). */
  set?: string[]
}

/** Average stats along a plan. Each level adds the average gain (levelGain); a stat stops growing at the class's maximums plus the
 * modifiers. Changing class (0x2d0fb8) swaps the class's bases, starts at Lv 1 and keeps every point gained, so a stat over the new
 * class's maximum shows held there and comes back in a class with higher ones. */
export function project(data: Fe13Data, unit: Fe13Unit, plan: Fe13Plan, opts: Fe13Projection = {}): Fe13Stage[] {
  const growths = opts.growths ?? unit.growths
  const modifiers = opts.modifiers ?? unit.modifiers
  const limitBreaker = !!plan.limitBreaker
  const aptitude = plan.aptitude ? 20 : 0
  const { steps } = legalSteps(data, unit.classId, unit.level, plan, opts.set ?? classSetOf(unit))
  let cls = data.classes[unit.classId]
  let level = unit.level
  let raw: Fe13Stats = { ...(opts.start ?? unit.bases) }
  const stage = (c: Fe13Class, lv: number, r: Fe13Stats): Fe13Stage => {
    const caps = capsOf(c, modifiers, limitBreaker)
    const stats = { ...r }
    for (const s of FE13_STATS) stats[s] = Math.min(caps[s], r[s])
    return { classId: c.id, level: lv, stats, raw: r }
  }
  const grow = (from: Fe13Stats, levels: number, c: Fe13Class) => {
    const caps = capsOf(c, modifiers, limitBreaker)
    const total = {} as Fe13Stats
    for (const s of FE13_STATS) total[s] = (growths[s] ?? 0) + (c.growths?.[s] ?? 0) + aptitude
    const gain = levelGain(total)
    const out = { ...from }
    for (const s of FE13_STATS) if (out[s] < caps[s]) out[s] = Math.min(caps[s], out[s] + gain[s] * Math.max(0, levels))
    return out
  }
  const stages: Fe13Stage[] = [stage(cls, level, raw)]
  for (const step of steps) {
    const next = data.classes[step.to]
    const change = classChanges(data, cls.id, opts.set ?? classSetOf(unit), plan.dlc).find((c) => c.to === step.to)!
    const at = Math.max(level, change.minLevel, Math.min(maxLevelOf(cls), step.at))
    if (at > level) {
      raw = grow(raw, at - level, cls)
      stages.push(stage(cls, at, raw))
    }
    raw = { ...raw }
    for (const s of FE13_STATS) raw[s] += next.bases[s] - cls.bases[s]
    cls = next
    level = 1
    stages.push(stage(cls, level, raw))
  }
  const target = Math.max(level, Math.min(maxLevelOf(cls), plan.targetLevel))
  if (target > level) stages.push(stage(cls, target, grow(raw, target - level, cls)))
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

/** The units a unit can marry: their S supports, and for Chrom the village maiden, whom the game gives him when he has no one at the
 * end of Chapter 11 (ev::HeroMarrige, 0x3b2700). */
export function spousesOf(data: Fe13Data, unit: Fe13Unit): Fe13Unit[] {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  if (unit.maiden) return [byId.get(CHROM)!].filter(Boolean)
  const out = unit.supports.filter((s) => s.levels[3] !== null).map((s) => byId.get(s.partner)!).filter(Boolean)
  return unit.id === CHROM && data.maiden ? [...out, data.maiden] : out
}


// Inheritance, as the program does it (code.bin; the routines are in data-raw/fe13/README.md). The gender swaps (Olivia's son gets
// Mercenary and Barbarian) are the game's own class sets.

const LUCINA = 'fe13-lucina'
/** Classes a parent never passes on (0x2cff38 takes Lord, Dancer and Conqueror only from the unit's own set), and those only Morgan can
 * take: no other child has a parent with them. */
const NEVER_PASSED = ['Lord', 'Dancer', 'Conqueror']
const MORGAN_ONLY = ['Taguel', 'Manakete']
/** Morgan starts as a Tactician when the other parent's first class is one of these (0x27c150). */
const NO_START = ['Lord', 'Dancer', 'Conqueror']

export const isMorgan = (u: Fe13Unit) => u.id.startsWith('fe13-morgan')
/** The two Avatars are one unit in a playthrough. */
export const sameUnit = (a: string, b: string) => a === b || (a.startsWith('fe13-avatar') && b.startsWith('fe13-avatar'))
const avatarIds = (id: string) => (id.startsWith('fe13-avatar') ? ['fe13-avatar-m', 'fe13-avatar-f'] : [id])

/** The classes a parent passes to a child: their set for the child's gender, less what can't be inherited. */
function passedOn(data: Fe13Data, set: string[], child: Fe13Unit): string[] {
  return set.filter((id) => {
    const name = data.classes[id]?.name ?? ''
    if (NEVER_PASSED.includes(name)) return child.id === LUCINA && name === 'Lord'
    return !MORGAN_ONLY.includes(name) || isMorgan(child)
  })
}

/** A parent as the child sees them: a child parent (Morgan's other parent can be one) with what they inherited themselves when their
 * own parents are in the plan (0x27c0a8); their current stats from their Unit Planner plan, else as they join. */
export interface Fe13Parent {
  unit: Fe13Unit
  growths: Fe13Stats
  modifiers: Omit<Fe13Stats, 'hp'>
  /** Their class set for the child's gender, or for a child parent every class they have. */
  classes: string[]
  /** Their current stats less their class's bases, before the maximums: the game counts every point gained. */
  personal: Fe13Stats
  /** Where the stats come from: their plan's last row, or as they join. */
  from: { classId: string; level: number; planned: boolean }
  /** For a child parent: their own inheritance, or null when their parents aren't in the plan. */
  via?: Fe13Child | null
}

export interface Fe13Child {
  child: Fe13Unit
  fixed: Fe13Parent
  other: Fe13Parent
  /** The class they join in: their own, except Morgan, who takes the other parent's first class (0x27c150). */
  startClass: string
  /** Their own growths and both parents' added, a third, rounded down (0x27d230). */
  growths: Fe13Stats
  /** Both parents' summed, plus 1 (no +1 for a Morgan whose other parent is a child, whose own +1 is counted instead; 0x2c48f8). */
  modifiers: Omit<Fe13Stats, 'hp'>
  /** Their own class set, then what each parent passes on (0x2cff38). */
  classes: string[]
  /** As they join, held at their maximums (`raw` before them). */
  bases: Fe13Stats & { mov: number }
  /** As they join (0x3a44d0): their own stats, plus a third of how far each parent's are above them (a parent below adds nothing),
   * rounded down, plus the start class's bases. */
  raw: Fe13Stats & { mov: number }
}

/** A parent's stats, growths and the rest, as passed on. `depth` stops at Morgan's grandparents. */
function parentOf(data: Fe13Data, unit: Fe13Unit, female: boolean, spouses: Record<string, string>, plans: Record<string, Fe13Plan>, depth: number): Fe13Parent {
  const via = unit.parent && depth === 0 ? childOf(data, unit, spouses, plans, depth + 1) : unit.parent ? null : undefined
  const growths = via?.growths ?? unit.growths
  const modifiers = via?.modifiers ?? unit.modifiers
  const classes = via?.classes ?? classSetOf(unit, female)
  const start = via ? { ...unit, classId: via.startClass } : unit
  const plan = plans[unit.id]
  const stages = plan ? project(data, start, plan, { start: via?.raw ?? unit.bases, growths, modifiers, set: via?.classes ?? classSetOf(unit) }) : null
  const last = stages?.[stages.length - 1] ?? { classId: start.classId, level: unit.level, raw: via?.raw ?? unit.bases }
  const personal = {} as Fe13Stats
  // The maiden has no class: her stats are her own zeros.
  for (const s of FE13_STATS) personal[s] = last.raw[s] - (data.classes[last.classId]?.bases[s] ?? 0)
  return { unit, growths, modifiers, classes, personal, from: { classId: last.classId, level: last.level, planned: !!stages && stages.length > 1 }, via }
}

/** A child's inheritance once their fixed parent is married in `spouses` (both ways). */
export function childOf(data: Fe13Data, child: Fe13Unit, spouses: Record<string, string>, plans: Record<string, Fe13Plan> = {}, depth = 0): Fe13Child | null {
  const byId = new Map(unitsOf(data).map((u) => [u.id, u]))
  const fixedUnit = child.parent ? byId.get(child.parent) : undefined
  const otherId = fixedUnit ? spouses[fixedUnit.id] : undefined
  const otherUnit = otherId ? byId.get(otherId) : undefined
  if (!fixedUnit || !otherUnit) return null
  const fixed = parentOf(data, fixedUnit, child.female, spouses, plans, depth)
  const other = parentOf(data, otherUnit, child.female, spouses, plans, depth)
  const growths = {} as Fe13Stats
  for (const s of FE13_STATS) growths[s] = Math.floor((child.growths[s] + fixed.growths[s] + other.growths[s]) / 3)
  const bonus = isMorgan(child) && otherUnit.parent ? 0 : 1
  const modifiers = {} as Omit<Fe13Stats, 'hp'>
  for (const s of FE13_STATS.slice(1) as Exclude<Fe13Stat, 'hp'>[]) modifiers[s] = fixed.modifiers[s] + other.modifiers[s] + bonus
  const classes = [...new Set([...classSetOf(child), ...passedOn(data, fixed.classes, child), ...passedOn(data, other.classes, child)])]
  const first = classSetOf(otherUnit, child.female)[0]
  const startClass = isMorgan(child) && first && !NO_START.includes(data.classes[first]?.name ?? '') ? first : child.classId
  const cls = data.classes[startClass]
  const caps = capsOf(cls, modifiers)
  const raw = { mov: cls.bases.mov } as Fe13Stats & { mov: number }
  const bases = { mov: cls.bases.mov } as Fe13Stats & { mov: number }
  for (const s of FE13_STATS) {
    const own = child.personal[s]
    raw[s] = own + Math.floor((Math.max(0, fixed.personal[s] - own) + Math.max(0, other.personal[s] - own)) / 3) + cls.bases[s]
    bases[s] = Math.min(caps[s], raw[s])
  }
  return { child, fixed, other, startClass, growths, modifiers, classes, bases, raw }
}

/** What a child always gets, whoever the other parent is: their own classes and what their fixed parent passes on, and the fixed
 * parent's modifiers plus 1 (a Morgan whose other parent is a child gets that child's own +1 instead, so still one). */
export function fixedShare(data: Fe13Data, child: Fe13Unit): { parent: Fe13Unit; classes: string[]; modifiers: Omit<Fe13Stats, 'hp'> } | null {
  const parent = child.parent ? data.units.find((u) => u.id === child.parent) : undefined
  if (!parent) return null
  const modifiers = {} as Omit<Fe13Stats, 'hp'>
  for (const s of FE13_STATS.slice(1) as Exclude<Fe13Stat, 'hp'>[]) modifiers[s] = parent.modifiers[s] + 1
  return { parent, classes: [...new Set([...classSetOf(child), ...passedOn(data, classSetOf(parent, child.female), child)])], modifiers }
}

const AETHER = 'Aether'
const RIGHTFUL_KING = 'Rightful King'
/** Chrom and Lucina pass a child Aether (a daughter) or Rightful King (a son) and nothing else (0x27bc80, SID_主人公 and SID_マルス). */
const ROYAL = [CHROM, LUCINA]

/** The DLC classes a unit can unlock: those of their gender. */
export function dlcClassesFor(data: Fe13Data, unit: Fe13Unit): string[] {
  return Object.values(data.classes)
    .filter((c) => c.dlc && c.female === unit.female)
    .map((c) => c.id)
}

/** Everyone who can be a child's other parent in some playthrough, but those in `not` (the Avatar can't be both a parent and a
 * grandparent of Morgan). */
function otherParents(data: Fe13Data, child: Fe13Unit, not: string[]): Fe13Unit[] {
  const fixed = child.parent ? data.units.find((u) => u.id === child.parent) : undefined
  return fixed ? spousesOf(data, fixed).filter((u) => !not.some((id) => sameUnit(id, u.id))) : []
}

/** Every class a unit can be in some playthrough: their set and the class they join in, a child's every possible parent's and (for
 * Morgan) grandparent's for the child's gender (0x2cff38), what those promote to, and the DLC classes of their gender. */
export function reachableClasses(data: Fe13Data, unit: Fe13Unit, not: string[] = []): string[] {
  const out = new Set([unit.classId, ...classSetOf(unit)].filter((id) => data.classes[id]))
  const fixed = unit.parent ? data.units.find((u) => u.id === unit.parent) : undefined
  if (fixed) {
    const pass = (p: Fe13Unit) => passedOn(data, classSetOf(p, unit.female), unit).forEach((id) => out.add(id))
    pass(fixed)
    for (const other of otherParents(data, unit, not)) {
      pass(other)
      // A child parent's own parents are Morgan's grandparents.
      const gp = other.parent ? data.units.find((u) => u.id === other.parent) : undefined
      if (gp) [gp, ...otherParents(data, other, [fixed.id])].forEach(pass)
    }
  }
  for (const id of [...out]) for (const p of data.classes[id]?.promotesTo ?? []) out.add(p)
  for (const id of dlcClassesFor(data, unit)) out.add(id)
  return [...out]
}

/** Every skill a unit can have in some playthrough: the ones they join with, their reachable classes', and for a child whatever a
 * possible parent could have and pass on (0x27bc80): a skill that passes to any child, Wyrmsbane only to one who can be a Manakete,
 * Beastbane only to one who can be a Taguel; from Chrom or Lucina only Aether (a daughter) or Rightful King (a son). */
export function reachableSkills(data: Fe13Data, unit: Fe13Unit, not: string[] = []): Set<string> {
  const classes = reachableClasses(data, unit, not)
  const out = new Set<string>(unit.skills ?? [])
  for (const id of classes) for (const s of data.classes[id]?.skills ?? []) out.add(s.skill)
  const fixed = unit.parent ? data.units.find((u) => u.id === unit.parent) : undefined
  if (fixed) {
    const can = (cls: string) => classes.some((id) => data.classes[id]?.name === cls)
    const passes = (name: string) => {
      const kind = data.skills?.[name]?.pass ?? 0
      return kind === 0 || (kind === 2 && can('Manakete')) || (kind === 3 && can('Taguel'))
    }
    for (const p of [fixed, ...otherParents(data, unit, not)]) {
      if (ROYAL.includes(p.id)) out.add(unit.female ? AETHER : RIGHTFUL_KING)
      else for (const name of reachableSkills(data, p, [...not, fixed.id])) if (passes(name)) out.add(name)
    }
  }
  out.delete('(No skills)')
  return out
}

/** A child's parents in the plan: the fixed one, and their spouse if married. */
export function parentsOf(data: Fe13Data, unitId: string, spouses: Record<string, string>): string[] {
  const unit = data.units.find((u) => u.id === unitId)
  if (!unit?.parent) return []
  return [unit.parent, ...(spouses[unit.parent] ? [spouses[unit.parent]] : [])]
}

/** Whether the plan makes two units parent and child, or siblings: then they can't marry. */
export function isFamilyBlocked(data: Fe13Data, a: string, b: string, spouses: Record<string, string>): boolean {
  const pa = parentsOf(data, a, spouses).flatMap(avatarIds)
  const pb = parentsOf(data, b, spouses).flatMap(avatarIds)
  return pa.some((id) => sameUnit(id, b)) || pb.some((id) => sameUnit(id, a)) || pa.some((id) => pb.includes(id))
}

/** The children a marriage gives: each whose fixed parent is one of the two (Chrom and the Avatar can each have two). */
export function childrenOf(data: Fe13Data, a: string, b: string): Fe13Unit[] {
  return data.units.filter((u) => u.parent && (u.parent === a || u.parent === b))
}

/** The Avatar's asset and flaw; null for none (the person record's own numbers, Serenes Forest's neutral tables). */
export interface Fe13Build {
  asset: Fe13Stat | null
  flaw: Fe13Stat | null
}

/** The data with both Avatars' bases, growths and modifiers changed by an asset and flaw (GameData's PersonalityData). */
export function withAvatar(data: Fe13Data, build: Fe13Build): Fe13Data {
  const asset = data.assets?.find((a) => a.stat === build.asset)?.asset
  const flaw = data.assets?.find((a) => a.stat === build.flaw)?.flaw
  if (!asset && !flaw) return data
  const add = <T extends Partial<Fe13Stats>>(base: T, key: 'bases' | 'growths' | 'modifiers'): T => {
    const out = { ...base }
    for (const s of FE13_STATS) {
      if (out[s] === undefined) continue
      ;(out as Record<string, number>)[s] = out[s]! + (asset?.[key][s] ?? 0) + (flaw?.[key][s] ?? 0)
    }
    return out
  }
  const units = data.units.map((u) =>
    u.id.startsWith('fe13-avatar')
      ? { ...u, bases: add(u.bases, 'bases'), personal: add(u.personal, 'bases'), growths: add(u.growths, 'growths'), modifiers: add(u.modifiers, 'modifiers') }
      : u,
  )
  return { ...data, units }
}
