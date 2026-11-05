import { useEffect } from 'react'
import { useScreenshotContextStore } from '../state/screenshotContextStore'
import { useReached } from '../state/spoilerStore'
import { defaultPlan, labelOf, type Fe17Data, type Fe17Plan } from './logic'
import { useFe17Store } from './store'
import type { Fe17Unit } from './types'

// What Engage's tabs share that isn't a component.

export const selectClass = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200'

export const chip = (on: boolean) =>
  `rounded-full border px-3 py-1 text-xs transition-colors ${
    on ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
  }`

export function artId(gameId: string, name: string): string {
  return `${gameId}/${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
}

/** Names screenshots after the unit on screen. */
export function useScreenshotUnit(unit: Fe17Unit | undefined) {
  const setUnitLabel = useScreenshotContextStore((state) => state.setUnitLabel)
  useEffect(() => {
    setUnitLabel(unit ? labelOf(unit) : '')
    return () => setUnitLabel('')
  }, [unit, setUnitLabel])
}

/** The units that can be yours, both Alears among them; with the spoiler block on, those the chapters reached have brought. */
export function armyWith(data: Fe17Data, reached?: Set<string>) {
  return data.units.filter((u) => !reached || reached.has(u.joinChapter))
}

export function useArmy(data: Fe17Data) {
  const reached = useReached(data.gameId, data.chapters)
  return { units: armyWith(data, reached), reached }
}

/** Every unit's plan from a set of saved plans (the store's by default). */
export function plansWith(plans: Record<string, Fe17Plan>) {
  return (u: Fe17Unit): Fe17Plan => plans[u.id] ?? defaultPlan(u)
}

/** One unit's plan, and a setter that saves the whole plan. */
export function useUnitPlan(unit: Fe17Unit | undefined) {
  const raw = useFe17Store((s) => (unit ? s.plans[unit.id] : undefined))
  const setPlan = useFe17Store((s) => s.setPlan)
  const plan = unit ? (raw ?? defaultPlan(unit)) : undefined
  return {
    plan,
    saved: raw !== undefined,
    update: (patch: Partial<Fe17Plan>) => unit && plan && setPlan(unit.id, { ...plan, ...patch }),
    reset: () => unit && setPlan(unit.id, null),
  }
}
