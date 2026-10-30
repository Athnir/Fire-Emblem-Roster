/** Path of Radiance's and Radiant Dawn's unit data, as the generators write it (scripts/build-fe9-units.py, build-fe10-units.py). */

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

export type TelliusRankType =
  | 'sword'
  | 'lance'
  | 'axe'
  | 'bow'
  | 'knife'
  | 'strike'
  | 'fire'
  | 'thunder'
  | 'wind'
  | 'staff'
  | 'light'
  | 'dark'
export const TELLIUS_RANK_LABELS: Record<TelliusRankType, string> = {
  sword: 'Sword',
  lance: 'Lance',
  axe: 'Axe',
  bow: 'Bow',
  knife: 'Knife',
  strike: 'Strike',
  fire: 'Fire',
  thunder: 'Thunder',
  wind: 'Wind',
  staff: 'Staff',
  light: 'Light',
  dark: 'Dark',
}

export interface TelliusChapter {
  id: string
  /** 'Prologue', 'Ch.8', 'Endgame'; Radiant Dawn's 'Part 3 Ch.4'. */
  label: string
  title: string
  /** Radiant Dawn: the part ('Part 3') and the chapter within it ('Ch.4'). */
  part?: string
  short?: string
}

export interface TelliusJoin {
  /** 'start': at the start of the chapter; 'base': an Info conversation at the base before it; 'talk': recruited by
   * talking; 'event': during the chapter. */
  how: 'start' | 'base' | 'talk' | 'event' | 'bonus'
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
  /** Fixed mode's growth points when they join (Path of Radiance). */
  fixedStart?: TelliusStats
  con: number
  wt: number
  /** Starting weapon ranks. */
  ranks: Partial<Record<TelliusRankType, string>>
  /** Their own skills, by id (FE9_SKILLS). */
  skills: string[]
  /** What the data leaves unsettled about this unit. */
  unconfirmed?: string
  /** Radiant Dawn: the chapters they're in your army for (their army changes from part to part). */
  available?: string[]
  /** Radiant Dawn: chapters they're in your army for but the chapter keeps off the field. */
  heldBack?: string[]
  /** Leadership stars. */
  leadership?: number
  /** Promotions the story gives (the class can't use a Seal or Crown): at the start or end of these chapters. */
  storyPromotions?: { chapter: string; when: 'start' | 'end' }[]
  /** Chapters where, fighting for the other side, a talk brings them back (Radiant Dawn's Jill and Zihark). */
  talkedBack?: { chapter: string; with: string[] }[]
}

export interface TelliusClass {
  id: string
  name: string
  /** Radiant Dawn's third tier is 'master'. */
  tier: 'base' | 'promoted' | 'master'
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
  /** Promotes only through the story, not with a Seal or Crown (Radiant Dawn). */
  storyPromotion?: boolean
  /** The class's mastery skill, learned with a Satori Sign (Radiant Dawn). */
  mastery?: string
  /** The highest level, when it isn't the game's (Radiant Dawn's laguz go to 40). */
  maxLevel?: number
  /** What promoting into this class adds (Radiant Dawn). Without it, promotion adds the difference in bases. */
  gains?: TelliusStats
  /** The game's unit-type tags (SFXC_HUMAN for beorc, SFXC_ALIZE for laguz...), which skill rules test. */
  attributes?: string[]
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
  /** Radiant Dawn's rules, by SID_/PID_/JID_/SFXC_ id: a unit matching any `deny` can't learn it; one must match
   * every `need`, and one of `allow` when given (with neither, beorc only). */
  deny?: string[]
  need?: string[]
  allow?: string[]
}

export interface TelliusSupport {
  a: string
  b: string
  /** The totals the game stores for C, B and A. Serenes Forest's chapters together are C, B - 1 and A - 2 for every
   * pair (checked in the tests); why the stored totals run one higher per level already reached isn't confirmed. */
  points: [number, number, number]
}

/** Radiant Dawn's supports: anyone in the pool can support anyone else in it. */
export interface TelliusOpenSupports {
  pool: string[]
  /** The points C, B and A need in total. */
  levels: number[]
  /** The points each action gives (RelianceParam; which action is which is in data-raw/fe10/README.md). */
  actions: number[]
  /** What each kind of pair adds to every gain, by kind (0 to 4). */
  kindBonus: number[]
  /** The pairs whose kind isn't 2 (the usual), or whose flag is set. */
  pairs: { a: string; b: string; kind: number; flag?: number }[]
}

/** A bond: a fixed tie between two units (Radiant Dawn). */
export interface TelliusBond {
  a: string
  b: string
  value: number
}

/** An accessory that changes growth rates while equipped (Path of Radiance's bands). */
export interface TelliusBand {
  id: string
  name: string
  /** Added to each growth rate (random) or to the growth points a level gives (fixed). */
  growths: TelliusStats
  /** Only these classes can equip it (the Knight Ward). */
  onlyClasses?: string[]
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
  /** The game has Fixed mode growths (Path of Radiance, from a second playthrough). */
  fixedMode?: boolean
  /** Accessories that change growth rates. */
  bands?: TelliusBand[]
  /** Radiant Dawn's supports and bonds. */
  openSupports?: TelliusOpenSupports
  bonds?: TelliusBond[]
}
