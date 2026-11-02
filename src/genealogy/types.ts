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
  /** The class they promote to (each character has their own). */
  promotesTo?: string
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
  joinChapter?: string
  join?: Fe4Join
  mother?: string
  /** Fixed by the story (Seliph, Leif, Altena). */
  father?: string
  substituteFor?: string
  /** A child: the parent their holy blood and items come from (+0x0B). Their stats and growths come from the parent of their own
   * sex ($87:A869). */
  mainParent?: 'father' | 'mother'
  /** A child: which of the parents' personal skills can pass to them ($87:A975). */
  inheritable?: string[]
  /** The story keeps them alive: 'removed' from the map instead of dying (but not in the Final Chapter), or 'retreats'. */
  protection?: 'removed' | 'retreats'
  /** What the data leaves unsettled about this unit. */
  unconfirmed?: string
}

export interface Fe4Class {
  id: string
  name: string
  mov: number
  flier: boolean
  bases: Fe4Stats
  ranks: Partial<Record<string, string>>
  /** The class's own skills (Canto, Pursuit, Adept...). */
  skills?: string[]
  /** The level a unit needs to promote into this class (20). */
  promoteLevel?: number
}

export interface Fe4Blood {
  id: string
  name: string
  weaponType: string
  /** The holy weapon major blood of this line can wield. */
  weapon: string
  /** Growth bonuses for minor blood; major doubles them. */
  growths: Fe4Stats
}

export interface Fe4Chapter {
  id: string
  /** 'Prologue', 'Ch.6', 'Final'. */
  label: string
}

export interface Fe4Join {
  /** 'start': at the start of the chapter; 'talk': recruited by talking; 'event': during the chapter. */
  how: 'start' | 'talk' | 'event'
  with?: string[]
  turn?: number
  note?: string
}

/** A choice in the story of who joins (Iuchar or Iucharba). */
export interface Fe4Choice {
  id: string
  chapter: string
  question: string
  options: { label: string; units: string[] }[]
}

/** The first generation's love ($83:850F, $83:8738): each mother's start and gain per player phase with each man she can marry,
 * and the talks that add to it. */
export interface Fe4Love {
  pairs: { woman: string; man: string; start: number; growth: number }[]
  talks: { woman: string; man: string; points: number }[]
}

/** A ring: carried anywhere, it adds to a stat (past the cap) or Mov, or gives skills. Two of the same don't stack. */
export interface Fe4Ring {
  id: string
  name: string
  stat?: Fe4Stat | 'mov'
  amount?: number
  skills?: string[]
}
