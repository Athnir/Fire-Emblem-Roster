/** Fire Emblem Awakening's unit data, as scripts/build-fe13-units.py writes it. */

export type Fe13Stat = 'hp' | 'str' | 'mag' | 'skl' | 'spd' | 'lck' | 'def' | 'res'
export type Fe13Stats = Record<Fe13Stat, number>

export const FE13_STATS: Fe13Stat[] = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res']
export const FE13_STAT_LABELS: Record<Fe13Stat | 'mov', string> = {
  hp: 'HP',
  str: 'Str',
  mag: 'Mag',
  skl: 'Skl',
  spd: 'Spd',
  lck: 'Lck',
  def: 'Def',
  res: 'Res',
  mov: 'Mov',
}

export interface Fe13Chapter {
  id: string
  label: string
}

export interface Fe13Join {
  /** 'start': yours as the chapter starts; 'event': during it; 'talk': recruited by a talk; 'visit': by a village; 'end': at its end. */
  how: 'start' | 'event' | 'talk' | 'visit' | 'end'
  with?: string[]
  turn?: number
  note?: string
}

export interface Fe13Support {
  partner: string
  /** The support points C, B, A and S need (null: no S with this partner). */
  levels: (number | null)[]
}

export interface Fe13Unit {
  id: string
  name: string
  female: boolean
  classId: string
  level: number
  joinChapter: string
  join: Fe13Join
  /** As they join: the class's bases plus their own. A child's real ones also take after their parents. */
  bases: Fe13Stats & { mov: number }
  /** Their own bases, added to the class's. */
  personal: Fe13Stats
  /** Personal growth rates; a class adds its own. */
  growths: Fe13Stats
  /** Added to every class's maximums (Str to Res). */
  modifiers: Omit<Fe13Stats, 'hp'>
  /** The classes a Second Seal opens to them, for a man and for a woman (a child takes their parents' for the child's own gender). */
  classSets: { male: string[]; female: string[] }
  /** A child's fixed parent. */
  parent?: string
  supports: Fe13Support[]
}

export interface Fe13Class {
  id: string
  name: string
  female: boolean
  promoted: boolean
  bases: Fe13Stats & { mov: number }
  caps: Fe13Stats
  growths?: Fe13Stats
  /** The skills it teaches and the class level they come at. */
  skills: { skill: string; level: number }[]
  promotesTo: string[]
}
