import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { ALEAR_FEMALE, type Fe17Plan } from './logic'

/** The picks saved with the plans: none now. `alear` was Alear's gender before both Alears were listed (2026-11-04); a plan made for
 * the female Alear then is moved to her own unit (`migrate`). */
export type Fe17Picks = { alear?: 'm' | 'f' }

/** Saves from before both Alears were listed: Alear's plan, made for the gender picked, goes to the female Alear's unit if she was
 * the one picked. */
function alearMoved<T extends { plans: Record<string, Fe17Plan>; picks: Fe17Picks }>(s: T): T {
  if (s.picks?.alear !== 'f' || !s.plans?.['fe17-alear']) return s
  const { ['fe17-alear']: plan, ...plans } = s.plans
  return { ...s, plans: { ...plans, [ALEAR_FEMALE]: plan }, picks: {} }
}

interface Fe17State {
  /** {unit id: plan}. */
  plans: Record<string, Fe17Plan>
  /** Alear's gender ('m' or 'f'). */
  picks: Fe17Picks
  setPlan: (unitId: string, plan: Fe17Plan | null) => void
  setPick: (choiceId: 'alear', value: string | null) => void
  /** Whether the Expansion Pass's content shows at all (user, 2026-11-11): its units, Emblems, Bond Rings and classes. Shown unless
   * turned off. */
  showExpansion?: boolean
  setShowExpansion: (on: boolean) => void
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
      setShowExpansion: (on) => set({ showExpansion: on }),
      load: (plans, picks) => set({ plans: { ...plans }, picks: { ...picks } }),
    }),
    { name: 'fe-roster-fe17', version: 1, migrate: (saved, version) => (version < 1 ? alearMoved(saved as Fe17State) : saved) as Fe17State },
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
    {
      name: 'fe-roster-fe17-builds',
      version: 1,
      migrate: (saved, version) => {
        const s = saved as Fe17BuildState
        return (version < 1 ? { ...s, sets: (s.sets ?? []).map(alearMoved) } : s) as Fe17BuildState
      },
    },
  ),
)
