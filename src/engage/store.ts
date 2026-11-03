import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** The Roster's pick: Alear's gender. */
export type Fe17Picks = { alear?: 'm' | 'f' }
import type { Fe17Plan } from './logic'

interface Fe17State {
  /** {unit id: plan}. */
  plans: Record<string, Fe17Plan>
  /** Alear's gender ('m' or 'f'). */
  picks: Fe17Picks
  setPlan: (unitId: string, plan: Fe17Plan | null) => void
  setPick: (choiceId: keyof Fe17Picks, value: string | null) => void
  /** Replaces the plans and picks (loading a saved set). */
  load: (plans: Record<string, Fe17Plan>, picks: Fe17Picks) => void
}

/** Engage' unit plans and Roster picks. The key's `fe-roster-` prefix puts it in the backup (src/logic/backup.ts). */
export const useFe17Store = create<Fe17State>()(
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
          return { picks: picks as Fe17Picks }
        }),
      load: (plans, picks) => set({ plans: { ...plans }, picks: { ...picks } }),
    }),
    { name: 'fe-roster-fe17' },
  ),
)

export interface Fe17BuildSet {
  id: string
  name: string
  plans: Record<string, Fe17Plan>
  picks: Fe17Picks
  updatedAt: number
}

interface Fe17BuildState {
  sets: Fe17BuildSet[]
  save: (name: string, plans: Record<string, Fe17Plan>, picks: Fe17Picks) => void
  rename: (id: string, name: string) => void
  deleteSet: (id: string) => void
}

/** Saved sets of plans and picks: a whole playthrough under a name. The key's `fe-roster-` prefix puts it in the backup. */
export const useFe17Builds = create<Fe17BuildState>()(
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
    { name: 'fe-roster-fe17-builds' },
  ),
)
