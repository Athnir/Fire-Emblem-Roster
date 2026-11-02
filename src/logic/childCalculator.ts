import { charactersById } from '../data/characters'
import { classesByName } from '../data/classes'
import type { Character, ClassData, Route, StatBlock } from '../data/types'
import { getClassLine, parentContribution } from './classResolution'
import { computeBaseStats, computeGrowthRates, computeMaxStatModifiers } from './statCalculator'

type ParentSide = 'father' | 'mother'

const ZERO_STATS: StatBlock = { hp: 0, str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 }

/** Looks up a class's base-stat contribution by display name; falls back to zero for unregistered classes. */
function classBaseStatsFor(className: string): StatBlock {
  return classesByName[className]?.statModifiers ?? ZERO_STATS
}

/**
 * Per formulas doc section 1: variable parent is the mother everywhere EXCEPT Shigure (Azura's
 * child), where it's the father, and Kana (either gender), where it's whichever side ISN'T Corrin
 * — Kana is Corrin's own child, so the non-Corrin spouse is always the variable one regardless of
 * which of Kana's two gender entries (kana_m/kana_f) or which Corrin is involved.
 * Kept as an explicit lookup rather than a blanket "mother = variable" assumption.
 */
const kanaVariableParent = (_father: Character, mother: Character): ParentSide =>
  mother.id === 'corrin_f' ? 'father' : 'mother'

const VARIABLE_PARENT_OVERRIDES: Record<
  string,
  (father: Character, mother: Character) => ParentSide
> = {
  shigure: () => 'father',
  kana_m: kanaVariableParent,
  kana_f: kanaVariableParent,
}

export function determineVariableParent(
  childId: string,
  father: Character,
  mother: Character,
): ParentSide {
  return VARIABLE_PARENT_OVERRIDES[childId]?.(father, mother) ?? 'mother'
}

export interface HairSourceInfo {
  fixedSide: ParentSide
  fixedParentId: string
  /** The side whose identity actually determines hair color — usually the variable side, except
   * Shigure (always his fixed mother, Azura) — see the hairSourceParent comment in computeChild. */
  hairSourceSide: ParentSide
  /** True when hairSourceSide === fixedSide, i.e. hair is already fully determined with no pairing
   * choice needed (currently only Shigure). */
  isHairSourceFixed: boolean
}

/**
 * Determines which side supplies a child's hair WITHOUT needing real father/mother Character
 * objects — used by the Roster tab's hair-source picker, which has no pairing context (unlike
 * computeChild, used by the Unit Planner once an actual pairing is chosen). Relies on the same
 * "possibleParents' non-empty side is fixed" convention documented on the PossibleParents type;
 * for every child except Shigure, empty-side (variable) is also the hair-determining side, matching
 * determineVariableParent's own default (Kana's override collapses to the same result here since
 * this app always fixes Kana's Corrin-gender side — see kanaVariableParent).
 */
export function getHairSourceInfo(child: Character): HairSourceInfo | undefined {
  const parents = child.possibleParents
  if (!parents) return undefined
  const isFatherFixed = (parents.father?.length ?? 0) > 0
  const isMotherFixed = (parents.mother?.length ?? 0) > 0
  if (isFatherFixed === isMotherFixed) return undefined // both/neither fixed — not a supported shape
  const fixedSide: ParentSide = isFatherFixed ? 'father' : 'mother'
  const fixedParentId = (isFatherFixed ? parents.father : parents.mother)?.[0]
  if (!fixedParentId) return undefined
  const variableSide: ParentSide = fixedSide === 'father' ? 'mother' : 'father'
  const hairSourceSide: ParentSide = child.id === 'shigure' ? fixedSide : variableSide
  return { fixedSide, fixedParentId, hairSourceSide, isHairSourceFixed: hairSourceSide === fixedSide }
}

/**
 * The fixed parent's class as it comes out when the other parent's class doesn't clash with it. For
 * a child whose fixed parent is their father it's always what they get, since the father goes first
 * (see inheritClasses). For Shigure and male Kana, whose fixed parent is their mother, the father
 * can take it first; then she gives her next class instead, so it's only certain once the father
 * is known.
 */
export function fixedParentContribution(child: Character, fixedParent: Character): string[] {
  const contributed = parentContribution(fixedParent, child, [])
  return contributed ? [contributed] : []
}

/**
 * A child's classes: their own, one from their father, then one from their mother (see
 * parentContribution). The father always goes first, Shigure and male Kana included: the program
 * puts the father in the first of a child's two parent slots, swapping them when the fixed parent is
 * female (0x3d396c), and the class list is built slot by slot (0x21a900). So when both parents
 * would give the same class, the mother gives way.
 */
export function inheritClasses(child: Character, father: Character, mother: Character): string[] {
  const taken: string[] = []
  for (const parent of [father, mother]) {
    const contributed = parentContribution(parent, child, taken)
    if (contributed) taken.push(contributed)
  }
  return [child.startingClass, ...taken]
}

export interface ComputeChildInput {
  child: Character
  father: Character
  mother: Character
  /** Parents' actual current stat totals at recruitment time (not base stats) — pass base stats for a simpler estimate mode. */
  fatherCurrentStats: StatBlock
  motherCurrentStats: StatBlock
  /** Defaults to 10 if unset — callers should normally pass the level from earliestChildLevel/levelForChapter (src/data/childLeveling.ts) instead of relying on this fallback. */
  level?: number
}

export interface ComputedChild {
  childId: string
  variableParent: ParentSide
  growthRates: StatBlock
  baseStats: StatBlock
  maxStatModifiers: StatBlock
  inheritedClasses: string[]
  hasDragonVeinAccess: boolean
  hairSourceParentId: string
}

export function computeChild(input: ComputeChildInput): ComputedChild {
  const { child, father, mother, fatherCurrentStats, motherCurrentStats } = input
  const level = input.level ?? 10

  const variableParent = determineVariableParent(child.id, father, mother)
  const variableParentGrowths =
    variableParent === 'father' ? father.growthRates : mother.growthRates
  const growthRates = computeGrowthRates(variableParentGrowths, child.growthRates)

  // A deliberate low estimate (user, 2026-11-01): the parents count at their join stats, and the levels above 10 grow at the
  // child's personal growth alone (Serenes Forest's formula adds the class's growth too). In the game, children usually come
  // out a point or two higher; the screens say so.
  const baseStats = computeBaseStats(
    child.baseStats,
    classBaseStatsFor(child.startingClass),
    growthRates,
    level,
    fatherCurrentStats,
    classBaseStatsFor(father.joinClass ?? father.startingClass),
    motherCurrentStats,
    classBaseStatsFor(mother.joinClass ?? mother.startingClass),
  )

  const isKana = child.id === 'kana_m' || child.id === 'kana_f'
  const isKanaWithChildParent = isKana && (father.isChild || mother.isChild)
  const maxStatModifiers = computeMaxStatModifiers(
    father.maxStatModifiers,
    mother.maxStatModifiers,
    isKanaWithChildParent,
  )

  const inheritedClasses = inheritClasses(child, father, mother)

  const hasDragonVeinAccess = Boolean(
    father.isRoyal || father.hasFirstBlood || mother.isRoyal || mother.hasFirstBlood,
  )

  // Hair follows the same mother-default/father-exception rule as the variable parent for
  // most children (e.g. male Kana -> father/Corrin's hair, per formulas doc section 8) — but
  // Shigure is a further FIXED exception: always Azura's hair regardless of the variable-parent
  // rule (which is the father, for his growth/class computations).
  const hairSourceParent: ParentSide = child.id === 'shigure' ? 'mother' : variableParent
  const hairSourceParentId = hairSourceParent === 'father' ? father.id : mother.id

  return {
    childId: child.id,
    variableParent,
    growthRates,
    baseStats,
    maxStatModifiers,
    inheritedClasses,
    hasDragonVeinAccess,
    hairSourceParentId,
  }
}

/**
 * A parent who is themselves a second-gen child (only reachable for Kana — see the "second-gen
 * marriage" mechanic) has just this app's placeholder baseStats/growthRates/maxStatModifiers until
 * THEIR OWN parents are resolved too — a raw lookup would silently contribute an empty placeholder
 * instead of their real blended values. `ownVariableParentId` is whichever unit was picked as this
 * specific parent's own non-fixed side (their own "Variable parent" selection); returns the parent
 * unchanged if they're not a child, or if that selection hasn't been made yet (same "can't resolve
 * without both sides" fallback as everywhere else). Level 20 is an approximation — there's no real
 * "recruitment level" for a hypothetical grandparent pairing to anchor to, same as every other
 * "current stats" proxy already used for parent slots throughout this app.
 */
export function resolveSecondGenParent(
  rawParent: Character,
  fixedInfo: { id: string; side: ParentSide } | undefined,
  ownVariableParent: Character | undefined,
): Character {
  if (!rawParent.isChild || !fixedInfo || !ownVariableParent) return rawParent
  const fixedChar = charactersById[fixedInfo.id]
  if (!fixedChar) return rawParent
  const father = fixedInfo.side === 'father' ? fixedChar : ownVariableParent
  const mother = fixedInfo.side === 'father' ? ownVariableParent : fixedChar
  const resolved = computeChild({
    child: rawParent,
    father,
    mother,
    fatherCurrentStats: father.baseStats,
    motherCurrentStats: mother.baseStats,
    level: 20,
  })
  return {
    ...rawParent,
    baseStats: resolved.baseStats,
    growthRates: resolved.growthRates,
    maxStatModifiers: resolved.maxStatModifiers,
  }
}

/**
 * All classes reachable by a child: their own Class Set + fixed parent's contribution (always
 * known, regardless of who the variable parent turns out to be), plus — once a variable parent is
 * given — that parent's own contributed class-line too. Shared by the Roster child-detail panel
 * and by the pair-up partner picker (a child can be picked as someone's pair-up partner too, and
 * needs the same parent-dependent class resolution to show their real available classes).
 */
export function childAvailableClasses(
  child: Character,
  fixedParent: Character,
  fixedSide: ParentSide,
  variableParent: Character | undefined,
  route: Route,
): ClassData[] {
  const ownClassLine = getClassLine(child.startingClass, route)
  const guaranteedById = new Map<string, ClassData>(ownClassLine.map((c) => [c.id, c]))
  fixedParentContribution(child, fixedParent).forEach((name) => {
    getClassLine(name, route).forEach((c) => guaranteedById.set(c.id, c))
  })
  const guaranteedNames = new Set(Array.from(guaranteedById.values(), (c) => c.name))

  if (!variableParent) return Array.from(guaranteedById.values())

  const father = fixedSide === 'father' ? fixedParent : variableParent
  const mother = fixedSide === 'father' ? variableParent : fixedParent
  const result = computeChild({
    child,
    father,
    mother,
    fatherCurrentStats: father.baseStats,
    motherCurrentStats: mother.baseStats,
  })

  const extraById = new Map<string, ClassData>()
  result.inheritedClasses
    .filter((name) => !guaranteedNames.has(name))
    .forEach((name) => {
      getClassLine(name, route).forEach((c) => {
        if (!guaranteedNames.has(c.name)) extraById.set(c.id, c)
      })
    })

  return [...guaranteedById.values(), ...extraById.values()]
}
