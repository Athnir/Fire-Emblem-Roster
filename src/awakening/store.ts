import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Fe13Plan } from './logic'

/** A named set of marriages, as in the Fates Marriage Planner's saved plans. */
export interface Fe13SavedPlan {
  id: string
  name: string
  spouses: Record<string, string>
  updatedAt: number
}

interface Fe13State {
  /** The current plan's marriages, both ways: {unit id: spouse id}. */
  spouses: Record<string, string>
  /** {unit id: plan}. */
  plans: Record<string, Fe13Plan>
  saved: Fe13SavedPlan[]
  activePlanId: string | null
  marry: (a: string, b: string | null) => void
  setPlan: (unitId: string, plan: Fe13Plan | null) => void
  clearSpouses: () => void
  savePlan: (name: string) => void
  loadPlan: (id: string) => void
  deletePlan: (id: string) => void
  renamePlan: (id: string, name: string) => void
}

/** Awakening's marriages, saved marriage plans and unit plans. The key's `fe-roster-` prefix puts it in the backup
 * (src/logic/backup.ts). */
export const useFe13Store = create<Fe13State>()(
  persist(
    (set, get) => ({
      spouses: {},
      plans: {},
      saved: [],
      activePlanId: null,
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
      clearSpouses: () => set({ spouses: {}, activePlanId: null }),
      // Saving under the loaded plan's name updates it; a new name saves a new plan.
      savePlan: (name) => {
        const { activePlanId, saved, spouses } = get()
        const existing = saved.find((p) => p.id === activePlanId)
        if (existing && existing.name === name) {
          set({ saved: saved.map((p) => (p.id === existing.id ? { ...p, spouses, updatedAt: Date.now() } : p)) })
          return
        }
        const plan: Fe13SavedPlan = { id: crypto.randomUUID(), name, spouses, updatedAt: Date.now() }
        set({ saved: [...saved, plan], activePlanId: plan.id })
      },
      loadPlan: (id) => {
        const plan = get().saved.find((p) => p.id === id)
        if (plan) set({ spouses: plan.spouses, activePlanId: plan.id })
      },
      deletePlan: (id) =>
        set((state) => ({ saved: state.saved.filter((p) => p.id !== id), activePlanId: state.activePlanId === id ? null : state.activePlanId })),
      renamePlan: (id, name) => set((state) => ({ saved: state.saved.map((p) => (p.id === id ? { ...p, name } : p)) })),
    }),
    { name: 'fe-roster-fe13' },
  ),
)
