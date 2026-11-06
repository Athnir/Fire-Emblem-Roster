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

/** A split in a story: after a chapter, the ways on, each with its own chapters. */
export interface GbaBranch {
  id: string
  /** The last chapter before it. */
  after: string
  question: string
  choices: { id: string; label: string; chapters: string[] }[]
}

export interface GbaChapter {
  id: string
  label: string
  story?: string
  /** What opens the chapter, for one the story can skip (New Mystery's x chapters). */
  note?: string
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
  /** Every class of their gender, both tiers, once a setting opens them all (New Mystery, after clearing Hard). */
  reclassAll?: string[]
  /** When they leave the army and come back (New Mystery's prologue), shown in the Roster; blank under the spoiler block. */
  away?: string[]
  /** The name the game itself shows, where the app shows another (Gaiden's translation: "Bird" for Tobin). */
  altName?: string
  /** What only they can do (Gaiden's special attacks), shown in the Roster as a personal skill is. */
  traits?: string[]
}

/** One answer to a creation question for the Avatar (New Mystery's Kris): what it adds to the bases and the growths. */
export interface GbaAvatarAnswer {
  label: string
  bases?: GbaStats
  growths?: GbaStats
}

/** A class the Avatar's creation offers: the reclass set it gives and the kind of weapon it starts with. */
export interface GbaAvatarClass {
  classId: string
  reclass?: string[]
  /** The starting weapon's kind, as the class's weapons name it ('Sword'). */
  weapon?: string
}

/** The Avatar's creation, as the game asks it (New Mystery's Kris): for each of its units (the man and the woman) the classes on
 * offer, the questions and the answers a new save starts on. The Unit Planner picks them; they add to the unit's own bases and
 * growths. */
export interface GbaAvatar {
  /** Their name as others' rows show it, for both units ("Kris"). */
  name?: string
  classes: Record<string, GbaAvatarClass[]>
  questions: { question: string; answers: GbaAvatarAnswer[] }[]
  defaults: { classIndex: number; answers: number[] }
  /** The ranks the starting weapon's kind and the class's other weapons start at. */
  ranks?: { start: string; other: string }
  text?: string
}

/** A story choice that moves when some units join, not who joins (New Mystery's prologue questions): asked at the end of `after`, each
 * answer giving the units it names their join. */
export interface GbaJoinChoice {
  id: string
  after: string
  question: string
  options: {
    id: string
    label: string
    joins: Record<string, { joinChapter: string; join: GbaJoin; level?: number; classId?: string; away?: string[] }>
  }[]
}

/** A one-way support (New Mystery): `unit` gets the bonus while `partner` is near. Points start at `start` and rise each turn;
 * `levels` are the points C, B and A need (null: never). */
export interface GbaSlotSupport {
  unit: string
  partner: string
  start: number
  levels: (number | null)[]
}

/** A talk at the base (New Mystery): between two units, at a level, and what it gives. */
export interface GbaBaseTalk {
  a: string
  b: string
  /** `b` is the Avatar, either of its units. */
  avatar?: boolean
  level: string
  reward?: string
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
  /** No promotion item works on the class; the story promotes it, at whatever level (The Binding Blade's Lord): when and how. */
  storyPromotion?: string
  /** The kinds of weapon the class can use, in the game's order (Sword, Anima, Staff...). */
  weapons?: string[]
  /** What else about its weapons: Mystery of the Emblem's mounted classes on foot indoors. */
  weaponsNote?: string
  /** What promoting into this class adds (HP to Res), when the game keeps it in the class data; otherwise the difference between
   * the two classes' bases. */
  gains?: Partial<GbaStats>
  /** Growth rates the class adds to the unit's own (Shadow Dragon). */
  growths?: Partial<GbaStats>
  /** A promoted class (a reclass stays within the tier). */
  promoted?: boolean
  /** How the change into one of its options works, beyond the level it needs (Gaiden's Villager: a random class, asked again). */
  changeNote?: string
  /** Becoming this class changes nothing but the level (Gaiden's Princess: Celica's scene at Fort Geeth). */
  keepsStats?: boolean
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

/** A spell's numbers and what it does (Gaiden, Shadows of Valentia): the Spells tab's cards. */
export interface GbaSpellInfo {
  /** Black magic or white magic. */
  kind: string
  /** Its Mt, or what it heals (`heals`); none for a spell that neither hurts nor heals. */
  mt?: number
  heals?: true
  /** None where the spell doesn't roll to hit (Gaiden's white magic). */
  hit?: number
  crit?: number
  /** "1-2", "1-Atk/2", "any"; empty where it targets the caster. */
  range: string
  /** The HP casting it costs. */
  hp: number
  /** The game's help text, or what the spell does. */
  text?: string
  notes?: string[]
}

/** One of a unit's spell lists (Shadows of Valentia): the classes that use it, and what it teaches. */
export interface GbaSpellList {
  /** Black magic or white magic. */
  kind: string
  /** The classes using it that the unit can reach: the first's (rank 0) and the promoted one's (rank 1), each "A or B" ("" none). */
  classes: string[]
  /** How the unit reaches them, where it isn't their own class tree (a Dread Fighter's change back to Villager). */
  via?: string
  /** Each spell, its rank (0 learned in either class, 1 only in the promoted one) and level (0 known on entering the class). */
  entries: { spell: string; rank: number; level: number }[]
}
