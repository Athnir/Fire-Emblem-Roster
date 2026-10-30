/** The GBA games' unit data (The Binding Blade; The Blazing Blade and The Sacred Stones share it), as the generators write it. */

export type GbaStat = 'hp' | 'str' | 'skl' | 'spd' | 'lck' | 'def' | 'res' | 'con' | 'mov'
export type GbaStats = Record<GbaStat, number>

export const GBA_STATS: GbaStat[] = ['hp', 'str', 'skl', 'spd', 'lck', 'def', 'res', 'con', 'mov']
/** The stats that grow on a level-up (Con and Mov don't). */
export const GBA_GROWING: GbaStat[] = ['hp', 'str', 'skl', 'spd', 'lck', 'def', 'res']
export const GBA_STAT_LABELS: Record<GbaStat, string> = {
  hp: 'HP',
  str: 'S/M',
  skl: 'Skl',
  spd: 'Spd',
  lck: 'Lck',
  def: 'Def',
  res: 'Res',
  con: 'Con',
  mov: 'Mov',
}

export interface GbaChapter {
  id: string
  label: string
}

export interface GbaJoin {
  /** 'start': at the start of the chapter; 'talk': recruited by talking; 'visit': by visiting a village; 'event': during the
   * chapter; 'end': at its end. */
  how: 'start' | 'talk' | 'visit' | 'event' | 'end'
  with?: string[]
  turn?: number
  note?: string
}

export interface GbaUnit {
  id: string
  name: string
  classId: string
  level: number
  joinChapter: string
  join: GbaJoin
  affinity: string
  /** Their stats when they join: the class's bases plus their own (Luck is their own). */
  bases: GbaStats
  /** Level-up growth rates: HP, Str/Mag, Skl, Spd, Lck, Def, Res. */
  growths: Partial<GbaStats>
  ranks: Partial<Record<string, string>>
}

export interface GbaClass {
  id: string
  name: string
  bases: GbaStats
  caps: Partial<GbaStats>
  promotesTo?: string
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
