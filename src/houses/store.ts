import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Fe16Picks } from './logic'
import type { Fe16Plan } from './plan'

interface Fe16State {
  /** {unit id: plan}. */
  plans: Record<string, Fe16Plan>
  /** The Roster's picks: the house and the route. */
  picks: Fe16Picks
  setPlan: (unitId: string, plan: Fe16Plan | null) => void
  setPick: (choiceId: keyof Fe16Picks, value: string | null) => void
  /** Replaces the plans and picks (loading a saved set). */
  load: (plans: Record<string, Fe16Plan>, picks: Fe16Picks) => void
}

/** Three Houses' unit plans and Roster picks. The key's `fe-roster-` prefix puts it in the backup (src/logic/backup.ts). */
export const useFe16Store = create<Fe16State>()(
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
      setPick: (choiceId, value) =>
        set((state) => {
          const picks = { ...state.picks } as Record<string, string>
          if (value === null) delete picks[choiceId]
          else picks[choiceId] = value
          return { picks: picks as Fe16Picks }
        }),
      load: (plans, picks) => set({ plans: { ...plans }, picks: { ...picks } }),
    }),
    { name: 'fe-roster-fe16' },
  ),
)

export interface Fe16BuildSet {
  id: string
  name: string
  plans: Record<string, Fe16Plan>
  picks: Fe16Picks
  updatedAt: number
}

interface Fe16BuildState {
  sets: Fe16BuildSet[]
  save: (name: string, plans: Record<string, Fe16Plan>, picks: Fe16Picks) => void
  rename: (id: string, name: string) => void
  deleteSet: (id: string) => void
}

/** Saved sets of plans and picks: a whole playthrough under a name. The key's `fe-roster-` prefix puts it in the backup. */
export const useFe16Builds = create<Fe16BuildState>()(
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
    { name: 'fe-roster-fe16-builds' },
  ),
)
