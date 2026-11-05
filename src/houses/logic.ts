import {
  FE16_RANKS,
  FE16_SKILL_LABELS,
  FE16_SKILLS,
  type Fe16Class,
  type Fe16House,
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
  /** The level a unit joining partway gets in each chapter's month, by route (index = chapter). */
  joinLevels: Record<string, (number | null)[]>
  /** The Saint Statues' raises to the maximums, by statue and level. */
  statues: Record<string, Record<string, Partial<Record<string, number>>>>
  /** The abilities that come in levels, each chain lowest first. */
  chains: string[][]
}

// The Roster's picks: the house taught, and for the Black Eagles the route they take at Chapter 12. Each leaves the units it rules out
// out of every tab. With the spoiler block on, the Roster follows the chapter you're on: the route is asked only at the split, and a
// unit shows once they can be yours. Both Byleths are always listed, as Fates' two Corrins are (user, 2026-11-04).

export interface Fe16Choice {
  id: 'house' | 'route'
  question: string
  options: { label: string; value: string }[]
}

export const HOUSE_NAMES: Record<Fe16House, string> = { be: 'Black Eagles', bl: 'Blue Lions', gd: 'Golden Deer' }

export const HOUSE_CHOICE: Fe16Choice = {
  id: 'house',
  question: 'The house you teach',
  options: (Object.entries(HOUSE_NAMES) as [Fe16House, string][]).map(([value, label]) => ({ label, value })),
}

/** The Black Eagles' split at Chapter 12: siding with Edelgard or with the Church. */
export const ROUTE_CHOICE: Fe16Choice = {
  id: 'route',
  question: "The Black Eagles' route from Chapter 12",
  options: [
    { label: 'Crimson Flower', value: 'cf' },
    { label: 'Silver Snow', value: 'ss' },
  ],
}

export const ROUTE_NAMES: Record<Fe16Route, string> = {
  cf: 'Crimson Flower',
  ss: 'Silver Snow',
  am: 'Azure Moon',
  vw: 'Verdant Wind',
}

/** The routes a house can take. */
export const HOUSE_ROUTES: Record<Fe16House, Fe16Route[]> = { be: ['cf', 'ss'], bl: ['am'], gd: ['vw'] }

/** The house each route is taught in. */
export const ROUTE_HOUSE: Record<Fe16Route, Fe16House> = { cf: 'be', ss: 'be', am: 'bl', vw: 'gd' }

/** `byleth` was Byleth's gender before both were listed (2026-11-04); it's no longer read. */
export type Fe16Picks = { byleth?: 'm' | 'f'; house?: Fe16House; route?: 'cf' | 'ss' }

/** The route under the picks: the Black Eagles' as picked, the other houses' own. */
export function routeOf(picks: Fe16Picks): Fe16Route | undefined {
  if (!picks.house) return undefined
  if (picks.house !== 'be') return HOUSE_ROUTES[picks.house][0]
  return picks.route === 'cf' || picks.route === 'ss' ? picks.route : undefined
}

/** The routes still open under the picks. */
export function routesOpen(picks: Fe16Picks): Fe16Route[] {
  const route = routeOf(picks)
  if (route) return [route]
  return picks.house ? HOUSE_ROUTES[picks.house] : ['cf', 'ss', 'am', 'vw']
}

/** The chapter where the routes part (the Black Eagles' split; still Part I), and each route's last chapter (the game's flow, as the
 * Armory reads it). */
export const SPLIT_CHAPTER = 12
/** The first chapter of Part II on every route, Crimson Flower too: the chapter change (0x3d8980) sets the Part II flag for a battle
 * whose scenario has bit 6 at +0x24 (scenarios 13-30 and 32-39; not 12, nor Crimson Flower's Chapter 12, 31). */
export const PART_TWO = 13
/** The chapter from which Byleth has the Part II personal ability: the Sothis fusion partway through Chapter 10 sets it (movie 11,
 * 0x54c36c -> 0xa7b50, bit 1 at +0xae), so all of Chapter 11 on has it; with the spoiler block on it shows from 11. */
export const BYLETH_PART_TWO = 11
export const LAST_CHAPTER: Record<Fe16Route, number> = { cf: 18, ss: 21, am: 22, vw: 22 }

/** The chapter a unit can first be yours in, under the house taught. */
export const joinChapter = (unit: Fe16Unit, house: Fe16House) => unit.joinsAt?.[house] ?? 1

/** Whether a unit can be in your army under the picks; with the spoiler block on (`chapter`), only once they can have joined. */
export function inArmy(unit: Fe16Unit, picks: Fe16Picks, chapter?: number): boolean {
  if (!unit.routes.some((r) => routesOpen(picks).includes(r))) return false
  if (chapter === undefined) return true
  if (!picks.house) return isByleth(unit)
  const route = routeOf(picks)
  const leaves = route ? unit.leavesAt?.[route] : undefined
  return joinChapter(unit, picks.house) <= chapter && (leaves === undefined || chapter < leaves)
}

export const isByleth = (u: Fe16Unit) => u.id.startsWith('fe16-byleth')

/** How a unit joins, in a line, under the house taught. */
export function joinText(unit: Fe16Unit, house?: Fe16House): string {
  const { how } = unit.join
  const theirs = unit.join.house
  if (how === 'lord') return 'The professor: yours from the start.'
  if (how === 'auto') return unit.join.note ?? 'Joins on their own.'
  const own = house && theirs === HOUSE_NAMES[house]
  if (how === 'house') return `A student of the ${theirs}: yours from the start when you teach them; no one else can recruit them.`
  if (how === 'student') {
    if (own) return `A student of the ${theirs}: yours from the start.`
    return `A student of the ${theirs}: yours from the start when you teach them; another house recruits them (${recruitText(unit)}).`
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
  // Noble or Commoner: a unit has the one it's certified in as it joins, never the other (user, 2026-11-04; the class lists offer a
  // class without an exam only once certified, 0x651160).
  if (cls.tier === 'Starting') return unit.certified.includes(cls.id)
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

export function groupsFor(house?: Fe16House): string[] {
  const houses = ['Black Eagles', 'Blue Lions', 'Golden Deer']
  const first = house ? HOUSE_NAMES[house] : undefined
  return ['Byleth', ...(first ? [first, ...houses.filter((h) => h !== first)] : houses), 'Church of Seiros', 'Ashen Wolves (Cindered Shadows)', 'Expansion Pass']
}

/** The help text of an ability, combat art or spell. */
export function helpOf(data: Fe16Data, l: Pick<Fe16Learn, 'kind' | 'name'>): string | undefined {
  return l.kind === 'art' ? data.arts[l.name] : l.kind === 'spell' ? data.spells[l.name] : data.abilities[l.name]
}


/** The game's limits: five abilities and three combat arts equipped (the personal ability and the class's own come on their own). */
const learnerCache = new WeakMap<Fe16Data, { counts: Map<string, number>; units: number }>()

/** The name a skill is counted under: a dark magic one as its black magic twin, as they work the same (Dark Tomefaire as Black
 * Tomefaire, Dark Magic Range +1 as Black Magic Range +1; user, 2026-11-05). */
function countedAs(data: Fe16Data, name: string): string {
  const twin = name.startsWith('Dark ') ? `Black ${name.slice(5)}` : name
  return data.abilities[twin] !== undefined ? twin : name
}

/** How many units can learn each ability and combat art, any way but as a personal ability (user, 2026-11-05): at the ranks, as a
 * budding talent, by mastering a class or winning the White Heron Cup. Both Byleths count as one; a dark magic skill and its black
 * magic twin count as one skill. */
export function learners(data: Fe16Data): { counts: Map<string, number>; units: number } {
  const had = learnerCache.get(data)
  if (had) return had
  const who = new Map<string, Set<string>>()
  for (const u of data.units) {
    for (const s of learnable(data, u)) {
      const key = countedAs(data, s.name)
      who.set(key, (who.get(key) ?? new Set()).add(u.name))
    }
  }
  const out = { counts: new Map([...who].map(([name, set]) => [name, set.size])), units: new Set(data.units.map((u) => u.name)).size }
  learnerCache.set(data, out)
  return out
}

/** A skill's stars: none for a standard one (more than half the units can learn it), ★ for one half or fewer can, ★★ for one three
 * or fewer can (user, 2026-11-05). */
export function starsOf(data: Fe16Data, name: string): number {
  const { counts, units } = learners(data)
  const n = counts.get(countedAs(data, name)) ?? 0
  return n * 2 > units ? 0 : n <= 3 ? 2 : 1
}

/** The lowest pass rate an exam can be taken at (0x1a274c8). */
export const EXAM_MIN_RATE = 30

/**
 * A certification exam's pass rate (0x633f60): 100, less the exam's cost for each rank short of what it asks (each "+" a rank; a
 * beginner exam takes its closest skill alone, the others add every skill's shortfall up), plus half the unit's own Luck (no class
 * boost), rounded, held at 0 to 100. Only the ranks count, not the EXP within them; going past a rank adds nothing.
 */
export function examRate(cls: Fe16Class, have: Partial<Record<Fe16Skill, string>>, luck: number): number {
  const exam = cls.exam
  if (!exam?.cost) return 0
  const gaps = (Object.entries(exam.ranks) as [Fe16Skill, string][]).map(([sk, r]) => Math.max(rankIndex(r) - rankIndex(have[sk] ?? 'E'), 0))
  const gap = gaps.length === 0 ? 0 : exam.anyOne ? Math.min(...gaps) : gaps.reduce((a, b) => a + b, 0)
  const raw = 100 - gap * exam.cost + luck / 2
  return raw < 0 ? 0 : Math.min(100, Math.round(raw))
}

/** The classes' tiers, in the order the exams climb. */
export const CLASS_TIERS: Fe16Class['tier'][] = ['Starting', 'Beginner', 'Intermediate', 'Advanced', 'Master', 'Unique', 'DLC']

export const MAX_ABILITIES = 5
export const MAX_ARTS = 3

/** Whether a skill a unit learns is a combat art (equipped in the arts' slots) or an ability. */
export const kindOf = (data: Fe16Data, name: string): 'ability' | 'art' => (data.arts[name] !== undefined && data.abilities[name] === undefined ? 'art' : 'ability')

/** The personal ability shown, and which part of the story it's from. With the spoiler block on (`chapter`), only the one the chapter
 * has: the "+" form in place of the first once the game swaps it (user, 2026-11-04): Byleth's from Chapter 11, the house leaders'
 * from Part II (the getter 0x40e520: persondata section 5 +0x15 under the Part II flag, or Byleth's own bit). With it off, both. */
export function personalNow(unit: Fe16Unit, chapter?: number): { name: string; part?: string }[] {
  const [first, second] = unit.personal
  if (!second) return first ? [{ name: first }] : []
  const from = isByleth(unit) ? BYLETH_PART_TWO : PART_TWO
  if (chapter === undefined) return [{ name: first }, { name: second, part: `from Chapter ${from}` }]
  return [{ name: chapter >= from ? second : first }]
}

export interface Fe16Source {
  name: string
  kind: 'ability' | 'art'
  /** Where it's learned: a skill rank, mastering a class, a budding talent. */
  from: string[]
}

/** Every ability and combat art a unit can learn, with where from: their skill ranks (every unit's and their own), a budding talent,
 * and mastering the classes they can be in. */
export function learnable(data: Fe16Data, unit: Fe16Unit): Fe16Source[] {
  const out = new Map<string, Fe16Source>()
  const add = (name: string, kind: 'ability' | 'art', from: string) => {
    const had = out.get(`${kind}/${name}`)
    if (had) {
      if (!had.from.includes(from)) had.from.push(from)
    } else out.set(`${kind}/${name}`, { name, kind, from: [from] })
  }
  for (const l of learnsOf(data, unit)) if (l.kind !== 'spell') add(l.name, l.kind, `${FE16_SKILL_LABELS[l.skill]} ${l.rank}`)
  if (unit.budding) add(unit.budding.name, unit.budding.kind, `budding talent (${FE16_SKILL_LABELS[unit.budding.skill]})`)
  for (const cls of classesFor(data, unit)) {
    if (!canTake(cls, unit) && cls.id !== unit.classId) continue
    for (const m of cls.mastery) add(m, kindOf(data, m), `mastering ${cls.name}`)
    for (const m of cls.alsoTeaches ?? []) add(m, kindOf(data, m), `the White Heron Cup (${cls.name})`)
  }
  return [...out.values()]
}

