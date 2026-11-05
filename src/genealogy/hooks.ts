import { useEffect } from 'react'
import { useScreenshotContextStore } from '../state/screenshotContextStore'
import {
  childProfile,
  excludedUnits,
  FE4_MAX_LEVEL,
  NO_HUSBAND,
  profileOf,
  project,
  promoteLevelOf,
  type Fe4Data,
  type Fe4Parent,
  type Fe4Plan,
  type Fe4Profile,
} from './logic'
import { useFe4Store } from './store'
import type { Fe4Stat, Fe4Unit } from './types'

// What Genealogy's tabs share that isn't a component.

export const LABELS: Record<Fe4Stat, string> = { hp: 'HP', str: 'Str', mag: 'Mag', skl: 'Skl', spd: 'Spd', lck: 'Lck', def: 'Def', res: 'Res' }
export const selectClass = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200'

export function fmt(v: number): string {
  return String(Math.trunc(v))
}

/** A child's Luck range for StatTable's `extra`: the average is the value, the game adds a random 1 to 10. */
export function luckExtra(p: Fe4Profile): Partial<Record<Fe4Stat, string>> | undefined {
  return p.luckRange ? { lck: `(${p.luckRange[0]}–${p.luckRange[1]})` } : undefined
}

export function artId(gameId: string, name: string): string {
  return `${gameId}/${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
}

export function chapterLabel(data: Fe4Data, id?: string): string {
  return data.chapters.find((c) => c.id === id)?.label ?? ''
}

/** Names screenshots after the unit on screen. */
export function useScreenshotUnit(unit: Fe4Unit | undefined) {
  const setUnitLabel = useScreenshotContextStore((state) => state.setUnitLabel)
  useEffect(() => {
    setUnitLabel(unit?.name ?? '')
    return () => setUnitLabel('')
  }, [unit, setUnitLabel])
}

/** The mothers whose husband the player picks, and the fathers to pick from: the first generation's men, less those the love table
 * ties to one woman (Sigurd and Quan). */
export function pairingChoices(data: Fe4Data): { mothers: Fe4Unit[]; fathers: Fe4Unit[] } {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const mothers = [...new Set(data.units.filter((u) => u.role === 'child' && u.mother && !u.father).map((u) => u.mother!))].map((id) => byId.get(id)!)
  const fixed = new Set(data.units.flatMap((u) => (u.father ? [u.father] : [])))
  const fathers = data.units.filter((u) => u.generation === 1 && u.role === 'fixed' && !u.female && !fixed.has(u.id))
  return { mothers, fathers }
}

export function defaultPlan(data: Fe4Data, unit: Fe4Unit): Fe4Plan {
  const promo = unit.promotesTo ? data.classes[unit.promotesTo] : undefined
  return { promoteAt: promo ? Math.max(promoteLevelOf(promo), unit.level) : null, targetLevel: FE4_MAX_LEVEL }
}

/** A parent as their plan ends (the first generation's end): their class, stats and gold. */
export function parentAtEnd(data: Fe4Data, unit: Fe4Unit, plan: Fe4Plan): Fe4Parent | undefined {
  const p = profileOf(data, unit)
  if (!p) return undefined
  const stages = project(data, p, plan)
  const last = stages[stages.length - 1]
  return { unit, classId: last.classId, stats: last.stats, gold: unit.gold ?? 0 }
}

/** Every unit's profile under the given pairings and plans (the saved ones by default): a child's comes from their parents'
 * planned stats. */
export function profilesWith(data: Fe4Data, pairings: Record<string, string>, plans: Record<string, Fe4Plan>) {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const planOf = (u: Fe4Unit) => plans[u.id] ?? defaultPlan(data, u)
  const fatherOf = (child: Fe4Unit): Fe4Unit | undefined => {
    if (child.father) return byId.get(child.father)
    const pick = child.mother ? pairings[child.mother] : undefined
    return pick && pick !== NO_HUSBAND ? byId.get(pick) : undefined
  }
  const childWith = (child: Fe4Unit, father: Fe4Unit): Fe4Profile | undefined => {
    const mother = child.mother ? byId.get(child.mother) : undefined
    const f = parentAtEnd(data, father, planOf(father))
    const m = mother ? parentAtEnd(data, mother, planOf(mother)) : undefined
    return f && m ? childProfile(data, child, f, m) : undefined
  }
  const profile = (u: Fe4Unit): Fe4Profile | undefined => {
    if (u.role !== 'child') return profileOf(data, u)
    const father = fatherOf(u)
    return father ? childWith(u, father) : undefined
  }
  return { profile, planOf, fatherOf, childWith }
}

export function useProfiles(data: Fe4Data) {
  const pairings = useFe4Store((s) => s.pairings)
  const plans = useFe4Store((s) => s.plans)
  return { ...profilesWith(data, pairings, plans), pairings }
}

/** The units in your army by the story picks and the pairings (the others drop out of the lists). */
export function useArmy(data: Fe4Data): Fe4Unit[] {
  const picks = useFe4Store((s) => s.picks)
  const pairings = useFe4Store((s) => s.pairings)
  const out = excludedUnits(data, picks, pairings)
  return out.size ? data.units.filter((u) => !out.has(u.id)) : data.units
}
