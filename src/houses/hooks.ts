import { useEffect } from 'react'
import { useScreenshotContextStore } from '../state/screenshotContextStore'
import { defaultPlan, inArmy, labelOf, type Fe16Data, type Fe16Picks, type Fe16Plan } from './logic'
import { useFe16Store } from './store'
import type { Fe16Unit } from './types'

// What Three Houses' tabs share that isn't a component.

export const selectClass = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200'

export const chip = (on: boolean) =>
  `rounded-full border px-3 py-1 text-xs transition-colors ${
    on ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
  }`

export function artId(gameId: string, name: string): string {
  return `${gameId}/${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
}

/** Names screenshots after the unit on screen. */
export function useScreenshotUnit(unit: Fe16Unit | undefined) {
  const setUnitLabel = useScreenshotContextStore((state) => state.setUnitLabel)
  useEffect(() => {
    setUnitLabel(unit ? labelOf(unit) : '')
    return () => setUnitLabel('')
  }, [unit, setUnitLabel])
}

/** The units that can be in your army under the picks. */
export function armyWith(data: Fe16Data, picks: Fe16Picks) {
  return data.units.filter((u) => inArmy(u, picks))
}

export function useArmy(data: Fe16Data) {
  const picks = useFe16Store((s) => s.picks)
  return { units: armyWith(data, picks), picks }
}

/** Every unit's plan from a set of saved plans (the store's by default). */
export function plansWith(plans: Record<string, Fe16Plan>) {
  return (u: Fe16Unit): Fe16Plan => plans[u.id] ?? defaultPlan(u)
}

/** One unit's plan, and a setter that saves the whole plan. */
export function useUnitPlan(unit: Fe16Unit | undefined) {
  const raw = useFe16Store((s) => (unit ? s.plans[unit.id] : undefined))
  const setPlan = useFe16Store((s) => s.setPlan)
  const plan = unit ? (raw ?? defaultPlan(unit)) : undefined
  return {
    plan,
    saved: raw !== undefined,
    update: (patch: Partial<Fe16Plan>) => unit && plan && setPlan(unit.id, { ...plan, ...patch }),
    reset: () => unit && setPlan(unit.id, null),
  }
}
