/** Thracia 776's unit data, as scripts/build-fe5-units.py writes it. */

export type Fe5Stat = 'hp' | 'str' | 'mag' | 'skl' | 'spd' | 'lck' | 'def' | 'con' | 'mov'
export type Fe5Stats = Record<Fe5Stat, number>

export const FE5_STATS: Fe5Stat[] = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'con', 'mov']
export const FE5_STAT_LABELS: Record<Fe5Stat, string> = {
  hp: 'HP',
  str: 'Str',
  mag: 'Mag',
  skl: 'Skl',
  spd: 'Spd',
  lck: 'Lck',
  def: 'Def',
  con: 'Con',
  mov: 'Mov',
}

export type Fe5Weapon = 'sword' | 'lance' | 'axe' | 'bow' | 'staff' | 'fire' | 'thunder' | 'wind' | 'light' | 'dark'
export const FE5_WEAPONS: Fe5Weapon[] = ['sword', 'lance', 'axe', 'bow', 'staff', 'fire', 'thunder', 'wind', 'light', 'dark']

export interface Fe5Chapter {
  id: string
  /** 'Ch.2x', 'Ch.16A', 'Final'. */
  label: string
  /** A chapter of one route only. */
  route?: 'A' | 'B'
}

export interface Fe5Join {
  /** 'start': at the start of the chapter; 'talk': recruited by talking; 'visit': by visiting a place; 'event': during the
   * chapter; 'end': at its end, so they're yours from the next. */
  how: 'start' | 'talk' | 'visit' | 'event' | 'end'
  /** Who talks or visits (anyone when there's no list). */
  with?: string[]
  turn?: number
  /** Where a visit happens ('a house', 'the church'). */
  place?: string
  note?: string
}

export interface Fe5ClassChange {
  classId: string
  /** 'seal': a Master Seal from Lv 10; 'story': the story makes it, at any level. */
  by: 'seal' | 'story'
  note?: string
}

export interface Fe5Unit {
  id: string
  name: string
  /** Their class when they join, in its mounted form for a mounted class. */
  classId: string
  level: number
  joinChapter: string
  join: Fe5Join
  /** Another way in, on the route a Roster pick chooses (Sara: 17A on route A, 16B on route B). */
  altJoin?: { choice: string; option: number; joinChapter: string; join: Fe5Join }
  female: boolean
  /** What the game keeps: HP whole (the class's and their own); every other stat their own, apart from the class's base. */
  own: Fe5Stats
  /** Shown when they join: the class's base plus their own, held at 20 (HP as kept). */
  bases: Fe5Stats
  growths: Fe5Stats
  /** Their own weapon points; the rank shown adds the class's base points, for the types the class can use. */
  weaponPoints: Partial<Record<Fe5Weapon, number>>
  /** Their own skills (the class's come from the class). */
  skills: string[]
  leadership: number
  leadershipNote?: string
  /** Movement stars (0-5) and the pursuit critical coefficient. */
  moveStars: number
  pcc: number
  promotion?: Fe5ClassChange
  /** A class change the story can make before the promotion (Lara's Dancer). */
  storyStep?: { classId: string; note: string }
  /** A skill the story can teach (Mareeta's Astra). */
  storySkill?: { skill: string; note: string }
  notes?: string[]
  /** When they leave the army and come back. Spoilers. */
  away?: string[]
}

export interface Fe5Class {
  id: string
  name: string
  bases: Fe5Stats
  /** The class's base weapon points, for the types it can use. */
  ranks: Partial<Record<Fe5Weapon, number>>
  skills: string[]
  /** For a mounted class: the class it becomes on foot (indoors). */
  dismounted?: string
}

export interface Fe5Support {
  gets: string
  gives: string
  /** Added to hit, avoid, crit and crit avoid while the giver is within 3 tiles. */
  bonus: number
  /** A giver who isn't playable: who, and when. */
  giverNote?: string
}

export interface Fe5Scroll {
  id: string
  name: string
  growths: Fe5Stats
}

export interface Fe5Ring {
  id: string
  name: string
  stat: Fe5Stat
  amount: number
}

export interface Fe5Manual {
  id: string
  name: string
  skill: string
  where: string
  chapter: string
}

/** A story pick of who joins: units in another option than the one picked drop out of every tab. */
export interface Fe5Choice {
  id: string
  chapter: string
  question: string
  /** The units each option keeps; the route pick's options also name their route. */
  options: { label: string; units: string[]; route?: 'A' | 'B' }[]
}
