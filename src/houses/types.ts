/** Fire Emblem: Three Houses' unit data, as scripts/build-fe16-units.py writes it. */

export type Fe16Stat = 'hp' | 'str' | 'mag' | 'dex' | 'spd' | 'lck' | 'def' | 'res' | 'cha'
export type Fe16Stats = Record<Fe16Stat, number>
export type Fe16StatsMov = Fe16Stats & { mov: number }

export const FE16_STATS: Fe16Stat[] = ['hp', 'str', 'mag', 'dex', 'spd', 'lck', 'def', 'res', 'cha']
export const FE16_STAT_LABELS: Record<Fe16Stat | 'mov', string> = {
  hp: 'HP',
  str: 'Str',
  mag: 'Mag',
  dex: 'Dex',
  spd: 'Spd',
  lck: 'Lck',
  def: 'Def',
  res: 'Res',
  cha: 'Cha',
  mov: 'Mov',
}

/** The eleven skills, as the game orders them. */
export type Fe16Skill = 'sword' | 'lance' | 'axe' | 'bow' | 'brawl' | 'reason' | 'faith' | 'authority' | 'armor' | 'riding' | 'flying'
export const FE16_SKILLS: Fe16Skill[] = ['sword', 'lance', 'axe', 'bow', 'brawl', 'reason', 'faith', 'authority', 'armor', 'riding', 'flying']
export const FE16_SKILL_LABELS: Record<Fe16Skill, string> = {
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
export const FE16_RANKS = ['E', 'E+', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+', 'S', 'S+']

/** The four routes of Part II: Crimson Flower and Silver Snow (the Black Eagles), Azure Moon (the Blue Lions), Verdant Wind (the
 * Golden Deer). */
export type Fe16Route = 'cf' | 'ss' | 'am' | 'vw'
/** The three houses: the Black Eagles, the Blue Lions, the Golden Deer. */
export type Fe16House = 'be' | 'bl' | 'gd'

/** Something a unit learns at a skill rank: an ability, a combat art or a spell. */
export interface Fe16Learn {
  skill: Fe16Skill
  rank: string
  name: string
  kind: 'ability' | 'art' | 'spell'
}

/** What a unit from another house (or the staff) needs to join you (fixed_lobby_common.bin section 4). */
export interface Fe16Recruit {
  stat?: { stat: Fe16Stat; value: number }
  skill?: { skill: Fe16Skill; rank: string }
  /** Byleth's level (the staff). */
  bylethLevel?: number
  /** Joins a female Byleth with no requirements (Sylvain). */
  femaleByleth?: true
  /** When the monastery script offers it, where it isn't every chapter. */
  window?: string
}

export interface Fe16Unit {
  id: string
  name: string
  female: boolean
  /** The house they're a student of. */
  house: string | null
  allegiance: string
  classId: string
  level: number
  /** At Lv 1, as the person record keeps them. */
  bases: Fe16StatsMov
  growths: Fe16Stats
  /** Their own maximums; classes have none. */
  caps: Fe16Stats
  crests: { name: string; minor: boolean }[]
  /** Starting skill ranks. */
  ranks: Partial<Record<Fe16Skill, string>>
  strengths: Fe16Skill[]
  weaknesses: Fe16Skill[]
  /** A hidden talent: a weakness that turns into a strength, with what it teaches. */
  budding?: { skill: Fe16Skill; name: string; kind: 'ability' | 'art' }
  /** Their personal ability, and its Part II form where they have one. */
  personal: string[]
  /** What they learn at their skill ranks, beyond what every unit learns. */
  learns: Fe16Learn[]
  /** Classes certified as they join. */
  certified: string[]
  /** The routes they can be yours on. */
  routes: Fe16Route[]
  /** The chapter they can first be yours in, by the house taught (1 where not given): what the spoiler block opens. */
  joinsAt?: Partial<Record<Fe16House, number>>
  /** The chapter they leave in for good, by route: with the spoiler block on, they drop out from then. */
  leavesAt?: Partial<Record<Fe16Route, number>>
  /** The level-up's two-point minimum applies to them (persondata section 3 +8 bit 7): not the staff and knights. */
  minimumTwo?: true
  /** Random level-ups the time skip gives them (section 3 +0). */
  timeskipLevels?: number
  /** The class they're put in when they join partway: from Lv 5 the first, from Lv 10 the second (fixed_lobby_common.bin). */
  recruitClasses?: [string, string]
  /** 'lord': Byleth; 'house': only in their own house; 'student': their house, or recruited by another; 'recruit': staff and DLC
   * units, recruited; 'auto': joins on their own. */
  join: { how: 'lord' | 'house' | 'student' | 'recruit' | 'auto'; house?: string; note?: string }
  recruit?: Fe16Recruit
  notes?: string[]
  /** When they leave and come back (blank under the spoiler block). */
  away?: string[]
  dlc?: true
}

export interface Fe16Class {
  id: string
  name: string
  nameFemale?: string
  tier: 'Starting' | 'Beginner' | 'Intermediate' | 'Advanced' | 'Master' | 'DLC' | 'Unique'
  /** The level its exam needs. */
  level: number
  /** HP to Res. */
  bases: Omit<Fe16Stats, 'cha'>
  /** Added to the unit's own growth rates. */
  growths: Fe16StatsMov
  /** Added to the unit's stats while in the class. */
  boosts: Fe16StatsMov
  /** Added while mounted. */
  mount?: Partial<Fe16StatsMov>
  types: string[]
  gender: 'any' | 'male' | 'female'
  /** Its certification exam: the seal and the skill ranks it asks for. */
  exam?: { seal: string | null; ranks: Partial<Record<Fe16Skill, string>> }
  /** What mastering it teaches. */
  mastery: string[]
  /** Its class abilities. */
  abilities: string[]
  /** The only units who can be in it. */
  who?: string[]
  /** Reached outside the exams (the Dancer: the White Heron Cup). */
  unique?: true
  dlc?: true
  /** The growths a unit joining partway in this class is levelled with (classdata +0x13, +0x1e). */
  joinGrowths: Fe16StatsMov
  /** How the story gives a unique class. */
  given?: string
  /** A class that must be certified first (the Dark Bishop's Dark Mage). */
  requires?: string
}

export interface Fe16Support {
  a: string
  b: string
  /** The support conversations, C to S. */
  talks: string[]
  /** Not a unit (Rhea, Sothis): their name. */
  npc?: string
  pairedEnding?: true
}
