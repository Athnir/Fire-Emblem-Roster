import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SpoilerState {
  /** The spoiler block: on, a game is played along chapter by chapter and nothing shows before the chapter that reveals it. */
  block: boolean
  /** The chapter each game is opened up to, by game (or game/story, for a game told in several): as that game counts them. */
  progress: Record<string, number>
  /** The route picked at each split that only the spoiler block asks for (The Binding Blade's), by game/split. */
  branches: Record<string, string>
  setBlock: (on: boolean) => void
  setProgress: (key: string, chapter: number) => void
  setBranch: (key: string, choice: string | null) => void
}

/** The spoiler block, for every game (CLAUDE.md: a global switch, as in the Armory). What it hides in each game is settled with the
 * user game by game; a game that isn't set up yet shows everything. The key's `fe-roster-` prefix puts it in the backup. */
export const useSpoilerStore = create<SpoilerState>()(
  persist(
    (set) => ({
      block: true,
      progress: {},
      branches: {},
      setBlock: (on) => set({ block: on }),
      setProgress: (key, chapter) => set((state) => ({ progress: { ...state.progress, [key]: chapter } })),
      setBranch: (key, choice) =>
        set((state) => {
          const branches = { ...state.branches }
          if (choice === null) delete branches[key]
          else branches[key] = choice
          return { branches }
        }),
    }),
    {
      name: 'fe-roster-spoiler',
      // Version 1 (user, 2026-11-03): the block is on by default, so it's switched on once for those saved with the old default.
      version: 1,
      migrate: (state, version) => (version < 1 ? { ...(state as SpoilerState), block: true } : (state as SpoilerState)),
    },
  ),
)

/** For a game whose story runs one way: the chapters reached with the spoiler block on (undefined with it off). */
export function useReached(key: string, chapters: { id: string }[]): Set<string> | undefined {
  const block = useSpoilerStore((s) => s.block)
  const at = useSpoilerStore((s) => s.progress[key] ?? 0)
  if (!block) return undefined
  return new Set(chapters.slice(0, Math.min(at, chapters.length - 1) + 1).map((c) => c.id))
}
