/** The GBA games' unit data (The Binding Blade, The Blazing Blade, The Sacred Stones; Mystery of the Emblem shares the screens), as
 * the generators write it. */

export type GbaStat = 'hp' | 'str' | 'mag' | 'skl' | 'spd' | 'lck' | 'wlv' | 'def' | 'res' | 'con' | 'mov'
/** A game keeps the stats it has: Mystery of the Emblem has a weapon level (wlv) and no Con; Shadow Dragon has Magic. */
export type GbaStats = Partial<Record<GbaStat, number>>

export const GBA_STATS: GbaStat[] = ['hp', 'str', 'skl', 'spd', 'lck', 'def', 'res', 'con', 'mov']
/** The stats that grow on a level-up (Con and Mov don't). */
export const GBA_GROWING: GbaStat[] = ['hp', 'str', 'skl', 'spd', 'lck', 'def', 'res']
export const GBA_STAT_LABELS: Record<GbaStat, string> = {
  hp: 'HP',
  str: 'S/M',
  mag: 'Mag',
  skl: 'Skl',
  spd: 'Spd',
  lck: 'Lck',
  wlv: 'Wlv',
  def: 'Def',
  res: 'Res',
  con: 'Con',
  mov: 'Mov',
}

/** A game told in more than one story (The Blazing Blade: Lyn's, Eliwood's, Hector's), each with its own chapters. */
export interface GbaStory {
  id: string
  label: string
  /** Supports can't be built in this story. */
  noSupports?: boolean
}

export interface GbaChapter {
  id: string
  label: string
  story?: string
}

export interface GbaJoin {
  /** 'start': at the start of the chapter; 'talk': recruited by talking; 'visit': by visiting a village; 'event': during the
   * chapter; 'end': at its end; 'unlock': added by the game's code once a condition (the note) is met. */
  how: 'start' | 'talk' | 'visit' | 'event' | 'end' | 'unlock'
  with?: string[]
  turn?: number
  note?: string
}

export interface GbaUnit {
  /** One id per character and army: a unit in two stories that share an army is listed once per story, under one id. */
  id: string
  story?: string
  name: string
  classId: string
  level: number
  joinChapter: string
  join: GbaJoin
  /** None in Mystery of the Emblem. */
  affinity?: string
  /** Their stats when they join: the class's bases plus their own (Luck is their own). */
  bases: GbaStats
  /** Level-up growth rates: HP, Str/Mag, Skl, Spd, Lck, Def, Res. */
  growths: Partial<GbaStats>
  ranks: Partial<Record<string, string>>
  /** Their own maximums, where the game keeps them per character (Shadows of Valentia) instead of per class. */
  caps?: GbaStats
  /** The classes they can reclass into (Shadow Dragon), both tiers: a change within a tier keeps the level. */
  reclass?: string[]
}

export interface GbaClass {
  id: string
  name: string
  bases: GbaStats
  caps: Partial<GbaStats>
  promotesTo?: string
  /** Every class it can promote to, when there's a choice (The Sacred Stones); `promotesTo` is the first. */
  promotions?: string[]
  /** The level the class stops at (a trainee's 10; otherwise 20). */
  maxLevel?: number
  /** The level it must reach to change class (a promotion item's Lv 10 when unset). */
  promoteLevel?: number
  /** The class promotes by itself on reaching its last level (The Sacred Stones' trainees). */
  autoPromote?: boolean
  /** What promoting into this class adds (HP to Res), when the game keeps it in the class data; otherwise the difference between
   * the two classes' bases. */
  gains?: Partial<GbaStats>
  /** Growth rates the class adds to the unit's own (Shadow Dragon). */
  growths?: Partial<GbaStats>
  /** A promoted class (a reclass stays within the tier). */
  promoted?: boolean
}

export interface GbaSupport {
  a: string
  b: string
  /** Points the pair starts with, and gains each turn the two end within reach. */
  start: number
  perTurn: number
}

export interface GbaAffinity {
  name: string
  atk: number
  def: number
  hit: number
  avoid: number
  crit: number
  dodge: number
}

/** A fixed support (Mystery of the Emblem): with the giver in reach, the receiver gets the bonus. */
export interface GbaSupportBonus {
  giver: string
  receiver: string
  bonus: number
}

/** A support with bonuses per rank (Shadows of Valentia). Each bonus is [Hit, Crit, Avoid, Crit avoid], with no rank and then at C, B
 * and A. */
export interface GbaRankedSupport {
  a: string
  b: string
  /** What a gets from b in reach, at each rank. */
  aGets: number[][]
  bGets: number[][]
  /** The points C, B and A need, and the act each opens in; absent for a fixed bonus with no conversations. */
  points?: number[]
  acts?: number[]
}
