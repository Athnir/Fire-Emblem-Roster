/** Fire Emblem Engage's unit data, as scripts/build-fe17-units.py writes it. */

export type Fe17Stat = 'hp' | 'str' | 'mag' | 'dex' | 'spd' | 'def' | 'res' | 'lck' | 'bld'
export type Fe17Stats = Record<Fe17Stat, number>
export type Fe17StatsMov = Fe17Stats & { mov: number }

/** The game's status screen order. */
export const FE17_STATS: Fe17Stat[] = ['hp', 'str', 'mag', 'dex', 'spd', 'def', 'res', 'lck', 'bld']
export const FE17_STAT_LABELS: Record<Fe17Stat | 'mov', string> = {
  hp: 'HP',
  str: 'Str',
  mag: 'Mag',
  dex: 'Dex',
  spd: 'Spd',
  def: 'Def',
  res: 'Res',
  lck: 'Lck',
  bld: 'Bld',
  mov: 'Mov',
}

export interface Fe17Chapter {
  id: string
  label: string
}

export interface Fe17Unit {
  id: string
  name: string
  female: boolean
  classId: string
  level: number
  internalLevel: number
  /** Their own stats, kept apart from the class's bases (Unit.m_BaseCapability): shown = class base + own, held at the caps. */
  own: Fe17StatsMov
  /** As they join (the class's bases plus their own, held at the caps). */
  joinStats: Fe17StatsMov
  growths: Fe17Stats
  /** Added to every class's caps. */
  capMods: Fe17StatsMov
  /** Their innate weapon proficiency (a class marked + gives them a rank more in it). */
  innate: string[]
  /** Every proficiency they join with: innate, additional, and their starting class's weapons. */
  proficiencies: string[]
  personal: string[]
  /** Skill points they join with. */
  sp: number
  supportType: string
  joinChapter: string
  join: { how: string; note: string }
  expansionPass?: true
  /** When they can't be lost (they retreat instead): 'always', or until a chapter. */
  protected?: string
}

export interface Fe17ClassWeapon {
  weapon: string
  /** 'always', or one of the class's choices ('choose 1', 'choose 2'). */
  use: string
  rank: string
  /** A rank more for a unit with innate proficiency in it. */
  plus?: true
}

export interface Fe17Class {
  id: string
  jid: string
  name: string
  help: string
  tier: 'base' | 'advanced' | 'special'
  maxLevel: number
  internalLevel: number
  moveType: string
  style: string
  bases: Fe17StatsMov
  caps: Fe17StatsMov
  /** Added to a unit's own growths. */
  growths: Fe17Stats
  weapons: Fe17ClassWeapon[]
  /** The proficiencies a unit needs to change into it: every one in `all`, and `choose` of `from`. */
  needs: { all: string[]; choose: number; from: string[] }
  skills: string[]
  /** The class skill and the level it's learned at (5; 25 in a class that goes to Lv 40). */
  learns?: { skill: string; level: number }
  promotesTo: string[]
  promotesFrom: string[]
  femaleOnly?: true
  /** The units alone who can be in it (a class without AnyoneCC: its person's default class or what it promotes to). */
  uniqueTo?: string[]
  expansionPass?: true
  /** The item that changes a unit into it (the Mystic Satchel, the Mage Cannon). */
  items?: string[]
}

export interface Fe17BondLevel {
  level: number
  /** Skills that can be inherited from this bond level on, with their SP. */
  inherit: { name: string; sp: number }[]
  /** Every sync skill and engage skill the unit has at this bond level. */
  sync: string[]
  engage: string[]
  /** What the synced emblem adds to the stats at this level. */
  stats: Partial<Fe17StatsMov>
  /** Weapon proficiency the bond level grants. */
  proficiency: string[]
  weapons?: unknown
}

export interface Fe17Emblem {
  id: string
  name: string
  /** The chapter its ring first comes in (a switch half or Robin: their pair's); the spoiler block shows it from there. */
  joinChapter: string
  /** The ring's name (a switch half or a shared bond has none of its own). */
  ring?: string
  expansionPass?: true
  engageAttack?: string
  bondCap: number
  levels: Fe17BondLevel[]
}

/** A bond ring at one rank: what it adds while worn, and the skill an S rank can carry. */
export interface Fe17RingRank {
  rank: 'C' | 'B' | 'A' | 'S'
  stats: Partial<Fe17StatsMov>
  skills?: string[]
}

/** A bond ring: one hero of an Emblem's world, at each rank it comes in (the Expansion Pass's at S alone). */
export interface Fe17BondRing {
  name: string
  ranks: Fe17RingRank[]
}

/** One game's bond rings (ring.xml names each set by the game's own short title). */
export interface Fe17BondRingSet {
  game: string
  /** The Emblem whose pedestal forges them, and Engage's name for its world (the Expansion Pass's three have neither). */
  emblem?: string
  world?: string
  /** Shown from here with the spoiler block on: the chapter the Emblem's ring first comes in (the Expansion Pass's three: the first
   * visit to the Somniel, where they're given). */
  joinChapter: string
  expansionPass?: true
  rings: Fe17BondRing[]
}

export interface Fe17Support {
  a: string
  b: string
  /** The highest rank: C, B or A (the Pact Ring is Alear's, after Paralogue 15). */
  top: string
}

export interface Fe17Booster {
  name: string
  raises: Partial<Fe17StatsMov>
}
