import { useEffect } from 'react'
import { useScreenshotContextStore } from '../state/screenshotContextStore'
import { excludedUnits, joinOf, normalizePlan, type Fe5Data, type Fe5Plan } from './logic'
import { useFe5Store } from './store'
import type { Fe5Unit } from './types'

// What Thracia's tabs share that isn't a component.

export const selectClass = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200'

export const chip = (on: boolean) =>
  `rounded-full border px-3 py-1 text-xs transition-colors ${
    on ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
  }`

export function artId(gameId: string, name: string): string {
  return `${gameId}/${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
}

/** Names screenshots after the unit on screen. */
export function useScreenshotUnit(unit: Fe5Unit | undefined) {
  const setUnitLabel = useScreenshotContextStore((state) => state.setUnitLabel)
  useEffect(() => {
    setUnitLabel(unit?.name ?? '')
    return () => setUnitLabel('')
  }, [unit, setUnitLabel])
}

/** Every unit's plan from a set of saved plans (the store's by default), in today's shape. */
export function plansWith(plans: Record<string, unknown>) {
  return (u: Fe5Unit): Fe5Plan => normalizePlan(u, plans[u.id])
}

/** The units in your army by the story's picks, each with the chapter they join in under those picks. */
export function armyWith(data: Fe5Data, picks: Record<string, number>) {
  const left = excludedUnits(data, picks)
  const units = data.units.filter((u) => !left.has(u.id))
  const chapterOf = (u: Fe5Unit) => joinOf(u, picks).joinChapter
  return { units, left, chapterOf }
}

export function useArmy(data: Fe5Data) {
  const picks = useFe5Store((s) => s.picks)
  return { ...armyWith(data, picks), picks }
}

/** One unit's plan, and a setter that saves the whole plan. */
export function useUnitPlan(unit: Fe5Unit | undefined) {
  const raw = useFe5Store((s) => (unit ? s.plans[unit.id] : undefined))
  const setPlan = useFe5Store((s) => s.setPlan)
  const plan = unit ? normalizePlan(unit, raw) : undefined
  return {
    plan,
    saved: raw !== undefined,
    update: (patch: Partial<Fe5Plan>) => unit && plan && setPlan(unit.id, { ...plan, ...patch }),
    reset: () => unit && setPlan(unit.id, null),
  }
}
