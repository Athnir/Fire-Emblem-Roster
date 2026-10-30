import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Fe4Plan } from './logic'

interface Fe4State {
  /** {mother id: father id}; a mother without one has no children (her substitutes join instead). */
  pairings: Record<string, string>
  /** {unit id: plan}. */
  plans: Record<string, Fe4Plan>
  setFather: (motherId: string, fatherId: string | null) => void
  setPlan: (unitId: string, plan: Fe4Plan | null) => void
}

/** Genealogy's pairings and unit plans. The key's `fe-roster-` prefix puts it in the backup (src/logic/backup.ts). */
export const useFe4Store = create<Fe4State>()(
  persist(
    (set) => ({
      pairings: {},
      plans: {},
      setFather: (motherId, fatherId) =>
        set((state) => {
          const pairings = { ...state.pairings }
          // A father has one wife: taking him from another mother leaves her unpaired.
          for (const [m, f] of Object.entries(pairings)) if (f === fatherId) delete pairings[m]
          if (fatherId) pairings[motherId] = fatherId
          else delete pairings[motherId]
          return { pairings }
        }),
      setPlan: (unitId, plan) =>
        set((state) => {
          const plans = { ...state.plans }
          if (plan) plans[unitId] = plan
          else delete plans[unitId]
          return { plans }
        }),
    }),
    { name: 'fe-roster-fe4' },
  ),
)
