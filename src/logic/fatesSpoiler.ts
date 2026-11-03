import { FATES_JOINS, type FatesRoute } from '../data/fatesJoins'
import type { Character, Route } from '../data/types'
import { usePlannerStore } from '../state/plannerStore'
import { useSpoilerStore } from '../state/spoilerStore'

/** The first chapter of each route's own run: the routes split as Chapter 5 ends. */
export const FATES_SPLIT = 6
/** Each route's chapters run to 27; the Endgame counts as 28. */
export const FATES_ENDGAME = 28

/** The story as the spoiler block walks it: the Prologue and Chapters 1-5, then (once a route is picked) 6 to the Endgame. */
export function fatesSteps(routePicked: boolean): { id: string; label: string }[] {
  const last = routePicked ? FATES_ENDGAME : FATES_SPLIT - 1
  return Array.from({ length: last + 1 }, (_, n) => ({ id: String(n), label: n === 0 ? 'Prologue' : n === FATES_ENDGAME ? 'Endgame' : `Ch.${n}` }))
}

/** Whether a character can be yours by `chapter` on `route` (undefined before the split): their join chapter on the route (a child's
 * paralogue chapter), or before the split the first chapter they fight for you on any route; someone lost for good drops out. A
 * character the table doesn't list shows. */
export function fatesVisible(c: Character, chapter: number, route: FatesRoute | undefined): boolean {
  if (c.isChild) {
    const at = route ? c.unlockChapter?.[route] : undefined
    return at !== undefined && at <= chapter
  }
  const j = FATES_JOINS[c.id]
  if (!j) return true
  if (!route) {
    const early = j.first ?? Math.min(...(['Birthright', 'Conquest', 'Revelation'] as const).flatMap((r) => (j[r] !== undefined ? [j[r]!] : [])))
    return early <= chapter
  }
  const at = j[route]
  if (at === undefined) return true
  const gone = j.gone?.[route]
  return at <= chapter && (gone === undefined || chapter <= gone)
}

/** The spoiler block for Fates: whether it's on, the chapter you're on, and the route once the bar has passed the split. */
export function useFatesSpoiler(): { on: boolean; chapter: number; route?: FatesRoute } {
  const on = useSpoilerStore((s) => s.block)
  const chapter = useSpoilerStore((s) => s.progress.fates ?? 0)
  const activeRoute = usePlannerStore((s) => s.activeRoute) as Route
  const route = chapter >= FATES_SPLIT && activeRoute !== 'all' ? (activeRoute as FatesRoute) : undefined
  return { on, chapter, route }
}

/** Who to show under the spoiler block (everyone with it off). */
export function useFatesVisible(): (c: Character) => boolean {
  const { on, chapter, route } = useFatesSpoiler()
  return (c) => !on || fatesVisible(c, chapter, route)
}
