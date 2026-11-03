import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SpoilerState {
  /** The spoiler block: on, a game is played along chapter by chapter and nothing shows before the chapter that reveals it. */
  block: boolean
  /** The chapter each game is opened up to, by game (as that game numbers its chapters). */
  progress: Record<string, number>
  setBlock: (on: boolean) => void
  setProgress: (gameId: string, chapter: number) => void
}

/** The spoiler block, for every game (CLAUDE.md: a global switch, as in the Armory). What it hides in each game is settled with the
 * user game by game; a game that isn't set up yet shows everything. The key's `fe-roster-` prefix puts it in the backup. */
export const useSpoilerStore = create<SpoilerState>()(
  persist(
    (set) => ({
      block: false,
      progress: {},
      setBlock: (on) => set({ block: on }),
      setProgress: (gameId, chapter) => set((state) => ({ progress: { ...state.progress, [gameId]: chapter } })),
    }),
    { name: 'fe-roster-spoiler' },
  ),
)
