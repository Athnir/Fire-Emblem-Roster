/** Path of Radiance's (and later Radiant Dawn's) unit data, as the generators write it (scripts/build-fe9-units.py). */

export type TelliusStat = 'hp' | 'str' | 'mag' | 'skl' | 'spd' | 'lck' | 'def' | 'res'
export type TelliusStats = Record<TelliusStat, number>

export const TELLIUS_STATS: TelliusStat[] = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res']
export const TELLIUS_STAT_LABELS: Record<TelliusStat, string> = {
  hp: 'HP',
  str: 'Str',
  mag: 'Mag',
  skl: 'Skl',
  spd: 'Spd',
  lck: 'Lck',
  def: 'Def',
  res: 'Res',
}

export type TelliusRankType = 'sword' | 'lance' | 'axe' | 'bow' | 'fire' | 'thunder' | 'wind' | 'staff' | 'light'
export const TELLIUS_RANK_LABELS: Record<TelliusRankType, string> = {
  sword: 'Sword',
  lance: 'Lance',
  axe: 'Axe',
  bow: 'Bow',
  fire: 'Fire',
  thunder: 'Thunder',
  wind: 'Wind',
  staff: 'Staff',
  light: 'Light',
}

export interface TelliusChapter {
  id: string
  /** 'Prologue', 'Ch.8', 'Endgame'. */
  label: string
  title: string
}

export interface TelliusJoin {
  /** 'start': at the start of the chapter; 'base': an Info conversation at the base before it; 'talk': recruited by
   * talking; 'event': during the chapter. */
  how: 'start' | 'base' | 'talk' | 'event'
  /** Who can talk to them, for a talk. */
  with?: string[]
  /** The turn a turn event brings them in. */
  turn?: number
  /** A condition the script puts on the join. */
  note?: string
}

export interface TelliusUnit {
  id: string
  name: string
  classId: string
  level: number
  joinChapter: string
  join: TelliusJoin
  affinity: string
  /** Their stats when they join: the class's bases plus their own. */
  bases: TelliusStats
  growths: TelliusStats
  con: number
  wt: number
  /** Starting weapon ranks. */
  ranks: Partial<Record<TelliusRankType, string>>
  /** Their own skills, by id (FE9_SKILLS). */
  skills: string[]
  /** What the data leaves unsettled about this unit. */
  unconfirmed?: string
}

export interface TelliusClass {
  id: string
  name: string
  tier: 'base' | 'promoted'
  laguz: boolean
  /** For a laguz class: true for the transformed form. */
  transformed?: boolean
  promotesTo?: string
  transformsTo?: string
  bases: TelliusStats
  caps: TelliusStats
  mov: number
  con: number
  wt: number
  /** Skill capacity. */
  capacity: number
  /** Weapon ranks the class starts with; '*' is a type picked at promotion. */
  ranks: Partial<Record<TelliusRankType, string>>
  skills: string[]
}

export interface TelliusSkill {
  id: string
  name: string
  description: string
  capacity: number
  /** False for a class's own skills, which can't be removed. */
  removable: boolean
  /** The scroll that teaches it ('Vantage', 'Occult'). Without one, only those who start with it have it. */
  scroll?: string
  /** Only these classes can learn it (a mastery skill). */
  onlyClasses?: string[]
  /** Only these units can carry it. */
  onlyUnits?: string[]
}

export interface TelliusSupport {
  a: string
  b: string
  /** The totals the game stores for C, B and A. Serenes Forest's chapters together are C, B - 1 and A - 2 for every
   * pair (checked in the tests); why the stored totals run one higher per level already reached isn't confirmed. */
  points: [number, number, number]
}

/** Everything a Tellius game's screens need, passed in so the screens don't import a game's data. */
export interface TelliusData {
  /** 'fe9': the namespace for uploaded art and saved plans. */
  gameId: string
  chapters: TelliusChapter[]
  units: TelliusUnit[]
  classes: Record<string, TelliusClass>
  skills: Record<string, TelliusSkill>
  supports: TelliusSupport[]
  /** The level a class tops out at (and promotes at, in a base class). */
  maxLevel: number
}
