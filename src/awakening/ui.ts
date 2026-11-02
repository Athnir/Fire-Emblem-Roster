import { useEffect, useMemo } from 'react'
import { useScreenshotContextStore } from '../state/screenshotContextStore'
import { withAvatar, type Fe13Data } from './logic'
import { useFe13Store } from './store'
import type { Fe13Unit } from './types'

// What Awakening's tabs share that isn't a component.

export const selectClass = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200'
export const panel = 'space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4'
export const button = 'rounded-md bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700'
export const primaryButton = 'rounded-md bg-violet-600 px-3 py-1 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40'

/** The data with the Avatar's asset and flaw applied. */
export function useAvatarData(data: Fe13Data): Fe13Data {
  const avatar = useFe13Store((s) => s.avatar)
  return useMemo(() => withAvatar(data, avatar), [data, avatar])
}

/** Names screenshots after the unit on screen. */
export function useScreenshotUnit(unit: Fe13Unit | undefined) {
  const setUnitLabel = useScreenshotContextStore((state) => state.setUnitLabel)
  useEffect(() => {
    setUnitLabel(unit?.name ?? '')
    return () => setUnitLabel('')
  }, [unit, setUnitLabel])
}

export function names(data: Fe13Data, ids: string[]): string {
  return ids.map((id) => data.classes[id]?.name ?? id).join(', ')
}
