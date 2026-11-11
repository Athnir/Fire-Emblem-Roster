import { useEffect } from 'react'
import { useScreenshotContextStore } from '../state/screenshotContextStore'
import { useSpoilerStore } from '../state/spoilerStore'
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
  const reached = useEngageReached(data)
  return { units: armyWith(data, reached), reached }
}

// The spoiler block's bar (user, 2026-11-11): the Prologue and the chapters alone. A paralogue (an Emblem's, Jean's, Anna's) counts as
// cleared from the chapter after the one that opens it, and the Expansion Pass's Divine Paralogues and Fell Xenologue (opened by
// Chapter 6) the same way; they're not steps of their own.

/** The progress key: an index into the chapters alone (the old `fe17` key counted the paralogues too). */
const PROGRESS = 'fe17-main'
export const isMainChapter = (id: string) => id.startsWith('CID_M')

/** Where the bar stands, an index into the chapters alone; a save from before the paralogues left the bar is moved to the chapter it
 * was on or after. */
export function useEngageProgress(chapters: { id: string }[]): number {
  const main = chapters.filter((c) => isMainChapter(c.id)).length
  const at = useSpoilerStore((s) => s.progress[PROGRESS])
  const old = useSpoilerStore((s) => s.progress.fe17)
  const index = at ?? (old === undefined ? 0 : chapters.slice(0, old + 1).filter((c) => isMainChapter(c.id)).length - 1)
  return Math.max(0, Math.min(index, main - 1))
}

export function useSetEngageProgress() {
  const setProgress = useSpoilerStore((s) => s.setProgress)
  return (i: number) => setProgress(PROGRESS, Math.max(0, i))
}

/** The chapter ids reached with the spoiler block on (undefined with it off): everything up to the chapter the bar is on, the
 * paralogues and the Expansion Pass's before it included. */
export function useEngageReached(data: Fe17Data): Set<string> | undefined {
  const block = useSpoilerStore((s) => s.block)
  const at = useEngageProgress(data.chapters)
  if (!block) return undefined
  const target = data.chapters.filter((c) => isMainChapter(c.id))[at]
  const end = data.chapters.findIndex((c) => c.id === target?.id)
  return new Set(data.chapters.slice(0, end + 1).map((c) => c.id))
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
