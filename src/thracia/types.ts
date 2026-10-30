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

export interface Fe5Chapter {
  id: string
  /** 'Ch.2x', 'Ch.16A', 'Final'. */
  label: string
}

export interface Fe5Join {
  /** 'start': at the start of the chapter; 'talk': recruited by talking; 'event': during the chapter; 'end': at its end. */
  how: 'start' | 'talk' | 'event' | 'end'
  with?: string[]
  turn?: number
  note?: string
}

export interface Fe5Unit {
  id: string
  name: string
  classId: string
  level: number
  joinChapter: string
  join: Fe5Join
  female: boolean
  /** Their stats when they join: the class's bases plus their own. */
  bases: Fe5Stats
  growths: Fe5Stats
  ranks: Partial<Record<string, string>>
  leadership?: number
  /** Movement stars (0-5) and the pursuit critical coefficient. */
  moveStars: number
  pcc: number
  /** The classes the class can promote to (more than one where the game's per-character choice isn't found yet). */
  promotesTo?: string[]
}

export interface Fe5Class {
  id: string
  name: string
  bases: Fe5Stats
}

export interface Fe5Support {
  gets: string
  gives: string
  /** Added to hit, avoid, crit and crit avoid while the giver is within 3 tiles. */
  bonus: number
}

export interface Fe5Scroll {
  id: string
  name: string
  growths: Fe5Stats
}
