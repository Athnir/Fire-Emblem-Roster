import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TelliusUnitPlan } from './planStore'

export interface TelliusBuildEntry {
  unitId: string
  /** As it was when added, for the list. */
  unitName: string
  /** The unit's plan (its classes, levels and skills) when it was added. */
  plan: TelliusUnitPlan
}

export interface TelliusBuildSet {
  id: string
  /** 'fe9' or 'fe10'. */
  gameId: string
  name: string
  entries: TelliusBuildEntry[]
  updatedAt: number
}

interface TelliusBuildState {
  /** One working set per game, built up a unit at a time and then saved whole, as Fates' and Awakening's are. */
  working: Record<string, TelliusBuildEntry[]>
  sets: TelliusBuildSet[]
  /** The saved set loaded into each game's working set. */
  activeId: Record<string, string | null>
  /** Adds the unit, or replaces their entry if they're in the set already. */
  add: (gameId: string, entry: TelliusBuildEntry) => void
  remove: (gameId: string, unitId: string) => void
  /** Saves the working set: over the loaded set when the name is the same, else as a new one. Either way it empties. */
  save: (gameId: string, name: string) => void
  /** Puts a saved set back in its game's working set. */
  load: (id: string) => TelliusBuildSet | undefined
  deleteSet: (id: string) => void
  rename: (id: string, name: string) => void
}

/** Path of Radiance's and Radiant Dawn's saved sets of unit plans. The key's `fe-roster-` prefix puts it in the backup
 * (src/logic/backup.ts). */
export const useTelliusBuilds = create<TelliusBuildState>()(
  persist(
    (set, get) => ({
      working: {},
      sets: [],
      activeId: {},
      add: (gameId, entry) =>
        set((state) => {
          const current = state.working[gameId] ?? []
          const next = current.some((e) => e.unitId === entry.unitId)
            ? current.map((e) => (e.unitId === entry.unitId ? entry : e))
            : [...current, entry]
          return { working: { ...state.working, [gameId]: next } }
        }),
      remove: (gameId, unitId) =>
        set((state) => ({ working: { ...state.working, [gameId]: (state.working[gameId] ?? []).filter((e) => e.unitId !== unitId) } })),
      save: (gameId, name) => {
        const { activeId, sets, working } = get()
        const entries = working[gameId] ?? []
        const existing = sets.find((s) => s.id === activeId[gameId])
        const cleared = { working: { ...working, [gameId]: [] }, activeId: { ...activeId, [gameId]: null } }
        if (existing && existing.gameId === gameId && existing.name === name) {
          set({ sets: sets.map((s) => (s.id === existing.id ? { ...s, entries, updatedAt: Date.now() } : s)), ...cleared })
          return
        }
        set({ sets: [...sets, { id: crypto.randomUUID(), gameId, name, entries, updatedAt: Date.now() }], ...cleared })
      },
      load: (id) => {
        const found = get().sets.find((s) => s.id === id)
        if (found)
          set((state) => ({
            working: { ...state.working, [found.gameId]: found.entries },
            activeId: { ...state.activeId, [found.gameId]: found.id },
          }))
        return found
      },
      deleteSet: (id) =>
        set((state) => ({
          sets: state.sets.filter((s) => s.id !== id),
          activeId: Object.fromEntries(Object.entries(state.activeId).map(([g, a]) => [g, a === id ? null : a])),
        })),
      rename: (id, name) => set((state) => ({ sets: state.sets.map((s) => (s.id === id ? { ...s, name } : s)) })),
    }),
    { name: 'fe-roster-tellius-builds' },
  ),
)
