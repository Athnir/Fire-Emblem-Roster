import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Fe5Plan } from './logic'

interface Fe5State {
  /** {unit id: plan}. Plans saved before the review have an older shape: read them through normalizePlan. */
  plans: Record<string, unknown>
  /** {choice id: the option picked} (the route, Olwen or Ilios, Ced or Saias). */
  picks: Record<string, number>
  setPlan: (unitId: string, plan: Fe5Plan | null) => void
  setPick: (choiceId: string, option: number | null) => void
  /** Replaces the plans and picks (loading a saved set). */
  load: (plans: Record<string, Fe5Plan>, picks: Record<string, number>) => void
}

/** Thracia's unit plans and story picks. The key (kept from before the picks) has the `fe-roster-` prefix that puts it in the
 * backup (src/logic/backup.ts). */
export const useFe5Store = create<Fe5State>()(
  persist(
    (set) => ({
      plans: {},
      picks: {},
      setPlan: (unitId, plan) =>
        set((state) => {
          const plans = { ...state.plans }
          if (plan) plans[unitId] = plan
          else delete plans[unitId]
          return { plans }
        }),
      setPick: (choiceId, option) =>
        set((state) => {
          const picks = { ...state.picks }
          if (option === null) delete picks[choiceId]
          else picks[choiceId] = option
          return { picks }
        }),
      load: (plans, picks) => set({ plans: { ...plans }, picks: { ...picks } }),
    }),
    { name: 'fe-roster-fe5' },
  ),
)

export interface Fe5BuildSet {
  id: string
  name: string
  plans: Record<string, Fe5Plan>
  picks: Record<string, number>
  updatedAt: number
}

interface Fe5BuildState {
  sets: Fe5BuildSet[]
  save: (name: string, plans: Record<string, Fe5Plan>, picks: Record<string, number>) => void
  rename: (id: string, name: string) => void
  deleteSet: (id: string) => void
}

/** Saved sets of plans and picks: a whole playthrough under a name. The key's `fe-roster-` prefix puts it in the backup. */
export const useFe5Builds = create<Fe5BuildState>()(
  persist(
    (set) => ({
      sets: [],
      save: (name, plans, picks) =>
        set((state) => {
          const existing = state.sets.find((s) => s.name === name)
          const entry = { name, plans: { ...plans }, picks: { ...picks }, updatedAt: Date.now() }
          return existing
            ? { sets: state.sets.map((s) => (s.id === existing.id ? { ...s, ...entry } : s)) }
            : { sets: [...state.sets, { id: crypto.randomUUID(), ...entry }] }
        }),
      rename: (id, name) => set((state) => ({ sets: state.sets.map((s) => (s.id === id ? { ...s, name } : s)) })),
      deleteSet: (id) => set((state) => ({ sets: state.sets.filter((s) => s.id !== id) })),
    }),
    { name: 'fe-roster-fe5-builds' },
  ),
)
