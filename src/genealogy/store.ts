import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Fe4Plan } from './logic'

interface Fe4State {
  /** {mother id: father id, or NO_HUSBAND (her substitutes join)}; a mother not in it isn't picked yet. */
  pairings: Record<string, string>
  /** {unit id: plan}. */
  plans: Record<string, Fe4Plan>
  /** {choice id: the option picked} (Iuchar or Iucharba). */
  picks: Record<string, number>
  setFather: (motherId: string, fatherId: string | null) => void
  setPlan: (unitId: string, plan: Fe4Plan | null) => void
  setPick: (choiceId: string, option: number | null) => void
  /** Replaces the pairings and plans (loading a saved set). */
  load: (pairings: Record<string, string>, plans: Record<string, Fe4Plan>) => void
}

/** Genealogy's pairings, unit plans and story picks. The key's `fe-roster-` prefix puts it in the backup (src/logic/backup.ts). */
export const useFe4Store = create<Fe4State>()(
  persist(
    (set) => ({
      pairings: {},
      plans: {},
      picks: {},
      setFather: (motherId, fatherId) =>
        set((state) => {
          const pairings = { ...state.pairings }
          // A father has one wife: taking him from another mother leaves her not picked.
          if (fatherId && fatherId !== 'none') for (const [m, f] of Object.entries(pairings)) if (f === fatherId) delete pairings[m]
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
      setPick: (choiceId, option) =>
        set((state) => {
          const picks = { ...state.picks }
          if (option === null) delete picks[choiceId]
          else picks[choiceId] = option
          return { picks }
        }),
      load: (pairings, plans) => set({ pairings: { ...pairings }, plans: { ...plans } }),
    }),
    { name: 'fe-roster-fe4' },
  ),
)

export interface Fe4BuildSet {
  id: string
  name: string
  pairings: Record<string, string>
  plans: Record<string, Fe4Plan>
  updatedAt: number
}

interface Fe4BuildState {
  sets: Fe4BuildSet[]
  save: (name: string, pairings: Record<string, string>, plans: Record<string, Fe4Plan>) => void
  rename: (id: string, name: string) => void
  deleteSet: (id: string) => void
}

/** Saved sets of pairings and plans: a whole playthrough under a name. The key's `fe-roster-` prefix puts it in the backup. */
export const useFe4Builds = create<Fe4BuildState>()(
  persist(
    (set) => ({
      sets: [],
      save: (name, pairings, plans) =>
        set((state) => {
          const existing = state.sets.find((s) => s.name === name)
          const entry = { name, pairings: { ...pairings }, plans: { ...plans }, updatedAt: Date.now() }
          return existing
            ? { sets: state.sets.map((s) => (s.id === existing.id ? { ...s, ...entry } : s)) }
            : { sets: [...state.sets, { id: crypto.randomUUID(), ...entry }] }
        }),
      rename: (id, name) => set((state) => ({ sets: state.sets.map((s) => (s.id === id ? { ...s, name } : s)) })),
      deleteSet: (id) => set((state) => ({ sets: state.sets.filter((s) => s.id !== id) })),
    }),
    { name: 'fe-roster-fe4-builds' },
  ),
)
