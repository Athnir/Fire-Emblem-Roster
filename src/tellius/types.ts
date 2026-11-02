/** Path of Radiance's and Radiant Dawn's unit data, as the generators write it (scripts/build-fe9-units.py, build-fe10-units.py). */

export type TelliusStat = 'hp' | 'str' | 'mag' | 'skl' | 'spd' | 'lck' | 'def' | 'res'
export type TelliusStats = Record<TelliusStat, number>

export const TELLIUS_STATS: TelliusStat[] = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res']
export const TELLIUS_STAT_LABELS: Record<TelliusStat, string> = {
  hp: 'HP',
  str: 'Str',
  mag: 'Mag',
  skl: 'Skl',
  spd: 'Spd',
  lck: 'Lck',
  def: 'Def',
  res: 'Res',
}

export type TelliusRankType =
  | 'sword'
  | 'lance'
  | 'axe'
  | 'bow'
  | 'knife'
  | 'strike'
  | 'fire'
  | 'thunder'
  | 'wind'
  | 'staff'
  | 'light'
  | 'dark'
export const TELLIUS_RANK_LABELS: Record<TelliusRankType, string> = {
  sword: 'Sword',
  lance: 'Lance',
  axe: 'Axe',
  bow: 'Bow',
  knife: 'Knife',
  strike: 'Strike',
  fire: 'Fire',
  thunder: 'Thunder',
  wind: 'Wind',
  staff: 'Staff',
  light: 'Light',
  dark: 'Dark',
}

export interface TelliusChapter {
  id: string
  /** 'Prologue', 'Ch.8', 'Endgame'; Radiant Dawn's 'Part 3 Ch.4'. */
  label: string
  title: string
  /** Radiant Dawn: the part ('Part 3') and the chapter within it ('Ch.4'). */
  part?: string
  short?: string
}

export interface TelliusJoin {
  /** 'start': at the start of the chapter; 'base': an Info conversation at the base before it; 'talk': recruited by
   * talking; 'event': during the chapter. */
  how: 'start' | 'base' | 'talk' | 'event' | 'bonus'
  /** Who can talk to them, for a talk. */
  with?: string[]
  /** The turn a turn event brings them in. */
  turn?: number
  /** A condition the script puts on the join. */
  note?: string
}

export interface TelliusUnit {
  id: string
  name: string
  classId: string
  level: number
  joinChapter: string
  join: TelliusJoin
  affinity: string
  /** Their stats when they join: the class's bases plus their own. */
  bases: TelliusStats
  growths: TelliusStats
  /** Fixed mode's growth points when they join (Path of Radiance). */
  fixedStart?: TelliusStats
  con: number
  wt: number
  /** Starting weapon ranks. */
  ranks: Partial<Record<TelliusRankType, string>>
  /** Their own skills, by id (FE9_SKILLS). */
  skills: string[]
  /** What the data leaves unsettled about this unit. */
  unconfirmed?: string
  /** Radiant Dawn: the chapters they're in your army for (their army changes from part to part). */
  available?: string[]
  /** Radiant Dawn: chapters they're in your army for but the chapter keeps off the field. */
  heldBack?: string[]
  /** Leadership stars. */
  leadership?: number
  /** Promotions the story gives (the class can't use a Seal or Crown): at the start or end of these chapters, and what
   * they depend on ('if you pick "Hire." when he asks'). A unit in such a class without one never promotes. */
  storyPromotions?: { chapter: string; when: 'start' | 'end'; note?: string }[]
  /** Chapters where, fighting for the other side, a talk brings them back (Radiant Dawn's Jill and Zihark); `porA`: of
   * those who can talk, the ones who need an A support with them in Path of Radiance. */
  talkedBack?: { chapter: string; with: string[]; porA?: string[] }[]
  /** Radiant Dawn: other talks that need an A support from Path of Radiance. */
  porNotes?: string[]
  /** Radiant Dawn: the Path of Radiance unit whose save data they take (its id in Path of Radiance's data). */
  porUnit?: string
  /** Radiant Dawn: units (Radiant Dawn ids) whose A support with them in Path of Radiance becomes a bond here. */
  porSupports?: string[]
  /** Radiant Dawn: chapters the maps keep them half-transformed for (Volug in Part 1). */
  halfTransformed?: string[]
}

export interface TelliusClass {
  id: string
  name: string
  /** Radiant Dawn's third tier is 'master'. */
  tier: 'base' | 'promoted' | 'master'
  laguz: boolean
  /** For a laguz class: true for the transformed form. */
  transformed?: boolean
  promotesTo?: string
  transformsTo?: string
  bases: TelliusStats
  caps: TelliusStats
  mov: number
  con: number
  wt: number
  /** Skill capacity. */
  capacity: number
  /** Weapon ranks the class starts with; '*' is a type picked at promotion. */
  ranks: Partial<Record<TelliusRankType, string>>
  /** The highest rank of each weapon the class uses (Radiant Dawn). */
  maxRanks?: Partial<Record<TelliusRankType, string>>
  skills: string[]
  /** Promotes only through the story, not with a Seal or Crown (Radiant Dawn). */
  storyPromotion?: boolean
  /** The class's mastery skill, learned with a Satori Sign (Radiant Dawn). */
  mastery?: string
  /** The highest level, when it isn't the game's (Radiant Dawn's laguz go to 40). */
  maxLevel?: number
  /** What promoting into this class adds (Radiant Dawn). Without it, promotion adds the difference in bases. */
  gains?: TelliusStats
  /** The game's unit-type tags (SFXC_HUMAN for beorc, SFXC_ALIZE for laguz...), which skill rules test. */
  attributes?: string[]
}

export interface TelliusSkill {
  id: string
  name: string
  description: string
  capacity: number
  /** False for a class's own skills, which can't be removed. */
  removable: boolean
  /** The scroll that teaches it ('Vantage', 'Occult'). Without one, only those who start with it have it. */
  scroll?: string
  /** Only these classes can learn it (a mastery skill). */
  onlyClasses?: string[]
  /** Only these units can carry it. */
  onlyUnits?: string[]
  /** Skills a unit needs too (Path of Radiance's Smite needs Shove). */
  requires?: string[]
  /** Radiant Dawn's rules, by SID_/PID_/JID_/SFXC_ id: a unit matching any `deny` can't learn it; one must match
   * every `need`, and one of `allow` when given (with neither, beorc only). */
  deny?: string[]
  need?: string[]
  allow?: string[]
}

export interface TelliusSupport {
  a: string
  b: string
  /** The totals the game stores for C, B and A. Viewing a conversation adds a point to both units (0x8017fc70), so the
   * chapters fought together are C, B - 1 and A - 2 (as Serenes Forest has them for every pair, checked in the tests). */
  points: [number, number, number]
}

/** Radiant Dawn's supports: anyone in the pool can support anyone else in it. */
export interface TelliusOpenSupports {
  pool: string[]
  /** The points C, B and A need in total. */
  levels: number[]
  /** The points each action gives (RelianceParam; which action is which is in data-raw/fe10/README.md). */
  actions: number[]
  /** What each kind of pair adds to every gain, by kind (0 to 4). */
  kindBonus: number[]
  /** The pairs whose kind isn't 2 (the usual), or whose flag is set. */
  pairs: { a: string; b: string; kind: number; flag?: number }[]
}

/** A bond: a fixed tie between two units (Radiant Dawn). */
export interface TelliusBond {
  a: string
  b: string
  value: number
}

/** An accessory that changes growth rates while equipped (Path of Radiance's bands). */
export interface TelliusBand {
  id: string
  name: string
  /** Added to each growth rate (random) or to the growth points a level gives (fixed). */
  growths: TelliusStats
  /** Only these classes can equip it (the Knight Ward). */
  onlyClasses?: string[]
}

/** A choice in the story of who joins (Path of Radiance's Nasir or Ena, and the royal called in the Endgame). */
export interface TelliusChoice {
  id: string
  /** The chapter it's made for. */
  chapter: string
  question: string
  /** Each answer and the units it brings (none for "Don't call."). */
  options: { label: string; units: string[] }[]
}

/** Where the two games' rules differ, each from the game's program. */
export interface TelliusRules {
  /** Transformed laguz: the transformed class's bases and caps (Path of Radiance, 0x8003bbd4), or every stat but HP and
   * Luck doubled (Radiant Dawn, 0x80122770). */
  transform: 'form' | 'double'
  /** What uses capacity: every skill but the class's own (Path of Radiance, 0x8017c3c8), or every skill but those the
   * unit joins with, the class's included (Radiant Dawn, 0x8011b8a4). */
  capacity: 'nonClass' | 'allButOwn'
  /** The most skills a unit carries: besides the class's (Path of Radiance, 5, 0x801be92c), or all told (Radiant Dawn, 6,
   * 0x802279c4). */
  maxSkills: { count: number; withClassSkills: boolean }
  /** Laguz capacity added from a level (Radiant Dawn, 0x80127a90): [level, added]. */
  laguzCapacity?: [number, number][]
  /** Blossom: a failed growth roll is rolled again, and Fixed mode turns 90 points into a stat. */
  blossom: string
  /** Celerity: Mov +2. */
  celerity: string
  /** Bonus EXP gives exactly three stats (Radiant Dawn, 0x8006d790); without it, a bonus EXP level is a level. */
  bexp?: boolean
  /** Radiant Dawn: the unit a Path of Radiance save gives their stats there, rather than bonuses (Sothe, 0x8011d978). */
  transferCopies?: string
}

/** Everything a Tellius game's screens need, passed in so the screens don't import a game's data. */
export interface TelliusData {
  /** 'fe9': the namespace for uploaded art and saved plans. */
  gameId: string
  chapters: TelliusChapter[]
  units: TelliusUnit[]
  classes: Record<string, TelliusClass>
  skills: Record<string, TelliusSkill>
  supports: TelliusSupport[]
  /** The level a class tops out at (and promotes at, in a base class). */
  maxLevel: number
  /** The game has Fixed mode growths (Path of Radiance, from a second playthrough). */
  fixedMode?: boolean
  /** Accessories that change growth rates. */
  bands?: TelliusBand[]
  /** Radiant Dawn's supports and bonds. */
  openSupports?: TelliusOpenSupports
  bonds?: TelliusBond[]
  /** The story's choices of who joins. */
  choices?: TelliusChoice[]
  rules: TelliusRules
}
