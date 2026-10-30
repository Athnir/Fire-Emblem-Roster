import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Fe13Plan } from './logic'

interface Fe13State {
  /** Marriages, both ways: {unit id: spouse id}. */
  spouses: Record<string, string>
  /** {unit id: plan}. */
  plans: Record<string, Fe13Plan>
  marry: (a: string, b: string | null) => void
  setPlan: (unitId: string, plan: Fe13Plan | null) => void
}

/** Awakening's marriages and unit plans. The key's `fe-roster-` prefix puts it in the backup (src/logic/backup.ts). */
export const useFe13Store = create<Fe13State>()(
  persist(
    (set) => ({
      spouses: {},
      plans: {},
      marry: (a, b) =>
        set((state) => {
          const spouses = { ...state.spouses }
          // Each marries once: whoever either was married to is left single.
          for (const id of [a, b]) {
            if (id && spouses[id]) {
              delete spouses[spouses[id]]
              delete spouses[id]
            }
          }
          if (b) {
            spouses[a] = b
            spouses[b] = a
          }
          return { spouses }
        }),
      setPlan: (unitId, plan) =>
        set((state) => {
          const plans = { ...state.plans }
          if (plan) plans[unitId] = plan
          else delete plans[unitId]
          return { plans }
        }),
    }),
    { name: 'fe-roster-fe13' },
  ),
)
