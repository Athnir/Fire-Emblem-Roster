import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AllLevelsState {
  /** {game id: true} where every level of the skills that come in levels is shown (src/logic/skillChains.ts). */
  on: Record<string, boolean>
  set: (gameId: string, on: boolean) => void
}

/** The Skill Planners' and Rosters' "every level" tickbox, per game. The key's `fe-roster-` prefix puts it in the backup. */
export const useAllLevelsStore = create<AllLevelsState>()(
  persist(
    (set) => ({
      on: {},
      set: (gameId, on) => set((state) => ({ on: { ...state.on, [gameId]: on } })),
    }),
    { name: 'fe-roster-all-levels' },
  ),
)

/** Whether a game shows every level, and its setter. */
export function useAllLevels(gameId: string): [boolean, (on: boolean) => void] {
  const on = useAllLevelsStore((s) => !!s.on[gameId])
  const set = useAllLevelsStore((s) => s.set)
  return [on, (v: boolean) => set(gameId, v)]
}
