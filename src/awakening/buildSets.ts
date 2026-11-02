import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Which planner a set comes from. */
export type Fe13BuildTab = 'skills' | 'unit'

export interface Fe13BuildEntry {
  unitId: string
  /** As it was when added, for the list. */
  unitName: string
  /** The planner's own snapshot: the Unit Planner's plan, or the Skill Planner's classes and loadout. */
  data: Record<string, unknown>
}

export interface Fe13BuildSet {
  id: string
  tab: Fe13BuildTab
  name: string
  entries: Fe13BuildEntry[]
  updatedAt: number
}

interface Fe13BuildState {
  /** One working set per planner, built up a unit at a time and then saved whole, as the Fates build sets are (Awakening has no
   * routes, so one each). */
  working: Record<Fe13BuildTab, Fe13BuildEntry[]>
  sets: Fe13BuildSet[]
  activeId: string | null
  /** Adds the unit, or replaces their entry if they're in the set already. */
  add: (tab: Fe13BuildTab, unitId: string, unitName: string, data: Record<string, unknown>) => void
  remove: (tab: Fe13BuildTab, unitId: string) => void
  /** Saves the working set: over the loaded set when the name is the same, else as a new one. Either way the working set empties. */
  save: (tab: Fe13BuildTab, name: string) => void
  /** Puts a saved set back in its planner's working set. */
  load: (id: string) => Fe13BuildSet | undefined
  deleteSet: (id: string) => void
  rename: (id: string, name: string) => void
  /** Merges fields into one unit's entry in a saved set (the Team Viewer's backpack picks), adding the entry if there's none. */
  patch: (setId: string, unitId: string, unitName: string, data: Record<string, unknown>) => void
}

/** Awakening's saved build sets. The key's `fe-roster-` prefix puts it in the backup (src/logic/backup.ts). */
export const useFe13Builds = create<Fe13BuildState>()(
  persist(
    (set, get) => ({
      working: { skills: [], unit: [] },
      sets: [],
      activeId: null,
      add: (tab, unitId, unitName, data) =>
        set((state) => {
          const current = state.working[tab]
          const entry = { unitId, unitName, data }
          const next = current.some((e) => e.unitId === unitId) ? current.map((e) => (e.unitId === unitId ? entry : e)) : [...current, entry]
          return { working: { ...state.working, [tab]: next } }
        }),
      remove: (tab, unitId) => set((state) => ({ working: { ...state.working, [tab]: state.working[tab].filter((e) => e.unitId !== unitId) } })),
      save: (tab, name) => {
        const { activeId, sets, working } = get()
        const entries = working[tab]
        const existing = sets.find((s) => s.id === activeId)
        const cleared = { ...working, [tab]: [] }
        if (existing && existing.tab === tab && existing.name === name) {
          set({ sets: sets.map((s) => (s.id === existing.id ? { ...s, entries, updatedAt: Date.now() } : s)), working: cleared, activeId: null })
          return
        }
        set({ sets: [...sets, { id: crypto.randomUUID(), tab, name, entries, updatedAt: Date.now() }], working: cleared, activeId: null })
      },
      load: (id) => {
        const found = get().sets.find((s) => s.id === id)
        if (found) set((state) => ({ working: { ...state.working, [found.tab]: found.entries }, activeId: found.id }))
        return found
      },
      deleteSet: (id) => set((state) => ({ sets: state.sets.filter((s) => s.id !== id), activeId: state.activeId === id ? null : state.activeId })),
      rename: (id, name) => set((state) => ({ sets: state.sets.map((s) => (s.id === id ? { ...s, name } : s)) })),
      patch: (setId, unitId, unitName, data) =>
        set((state) => ({
          sets: state.sets.map((s) => {
            if (s.id !== setId) return s
            const has = s.entries.some((e) => e.unitId === unitId)
            const entries = has
              ? s.entries.map((e) => (e.unitId === unitId ? { ...e, data: { ...e.data, ...data } } : e))
              : [...s.entries, { unitId, unitName, data }]
            return { ...s, entries, updatedAt: Date.now() }
          }),
        })),
    }),
    { name: 'fe-roster-fe13-builds' },
  ),
)
