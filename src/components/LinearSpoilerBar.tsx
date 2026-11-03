import { useSpoilerStore } from '../state/spoilerStore'
import { ChapterBar, type BarStep } from './ChapterBar'

/** The spoiler block's bar for a game whose story runs one way: its chapters in order. */
export function LinearSpoilerBar({ gameId, chapters }: { gameId: string; chapters: BarStep[] }) {
  const at = useSpoilerStore((s) => s.progress[gameId] ?? 0)
  const setProgress = useSpoilerStore((s) => s.setProgress)
  return <ChapterBar steps={chapters} at={Math.min(at, chapters.length - 1)} onChange={(i) => setProgress(gameId, Math.max(0, i))} />
}
