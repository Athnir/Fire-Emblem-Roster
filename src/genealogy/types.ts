/** Genealogy of the Holy War's unit data, as scripts/build-fe4-units.py writes it. */

export type Fe4Stat = 'hp' | 'str' | 'mag' | 'skl' | 'spd' | 'lck' | 'def' | 'res'
export type Fe4Stats = Record<Fe4Stat, number>

export const FE4_STATS: Fe4Stat[] = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res']

export interface Fe4BloodLevel {
  blood: string
  level: 'major' | 'minor'
}

export interface Fe4Unit {
  id: string
  name: string
  generation: 1 | 2
  classId: string
  level: number
  /** 'fixed': stats of their own; 'child': stats from their parents; 'substitute': stands in for a child whose mother
   * had none. */
  role: 'fixed' | 'child' | 'substitute'
  female?: boolean
  /** Their stats when they join: HP is their own, the rest the class's bases plus their own (Luck has no class base). */
  bases?: Fe4Stats
  /** What the game stores: HP, and each other stat's amount above the class's base (held at 15; Luck at 30). */
  personal?: Fe4Stats
  /** Their own growth rates, before holy blood. */
  growths?: Fe4Stats
  blood?: Fe4BloodLevel[]
  skills?: string[]
  gold?: number
  leadership?: number
  /** The second generation's slot a child and its substitute share. */
  slot?: number
  mother?: string
  /** Fixed by the story (Seliph, Leif, Altena). */
  father?: string
  substituteFor?: string
}

export interface Fe4Class {
  id: string
  name: string
  mov: number
  flier: boolean
  bases: Fe4Stats
  ranks: Partial<Record<string, string>>
}

export interface Fe4Blood {
  id: string
  name: string
  weaponType: string
  /** Growth bonuses for minor blood; major doubles them. */
  growths: Fe4Stats
}
