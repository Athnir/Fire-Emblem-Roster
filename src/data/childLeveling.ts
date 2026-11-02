import type { Route } from './types'

/**
 * The game's story level once the story has reached each chapter (index 0 = Ch1), i.e. once the chapters before it are played:
 * each chapter record in GameData.bin carries a level (+0x12), and playing the chapter raises the story level to it (0x1b72f0).
 * The same on all three routes; promoted levels count on from 20 (22 is promoted Lv2). Units who join late catch up to it: a
 * child gains a level per story level past their base level of 10 (0x3d396c), so a child picked up at Ch9 is the same level at
 * Ch20 as one picked up at Ch14. Checked against the game in the tests (fatesGameJoins.ts).
 */
const STORY_LEVEL = [1, 1, 2, 3, 4, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 17, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38]

/**
 * The last chapter anyone can be recruited before: every route's Ch27 goes straight into the endgame without a My Castle visit (its
 * script calls ev::ChapterSetSkipChapterSaveCastle), so the story level a recruit can catch up to tops out at 38, promoted Lv18.
 */
export const FINAL_CHAPTER = 27

/** Chapters with no My Castle visit before them, so no recruiting there: Revelation's Ch16 goes straight into Ch17 (its script skips
 * My Castle too). */
const NO_CASTLE_BEFORE: Partial<Record<Route, number[]>> = { Revelation: [17] }

/** The chapters a unit can be recruited at on a route, from `earliest` to the last. */
export function recruitChapters(earliest: number, route: Route): number[] {
  const skipped = NO_CASTLE_BEFORE[route] ?? []
  return Array.from({ length: FINAL_CHAPTER - earliest + 1 }, (_, i) => earliest + i).filter((ch) => !skipped.includes(ch))
}

/** The story level once the story has reached this chapter (see STORY_LEVEL). */
export function storyLevelForChapter(chapter: number): number {
  const clamped = Math.min(Math.max(Math.round(chapter), 1), FINAL_CHAPTER)
  return STORY_LEVEL[clamped - 1]
}

/**
 * No child can be recruited before Ch8 on any route (earliest Deeprealms/paralogue access point in
 * the story) — without this floor, a child whose fixed parent joins turn 1 (e.g. Corrin, for Kana)
 * would otherwise read as available from Ch1 onwards, which isn't actually possible in-game.
 */
export const EARLIEST_POSSIBLE_CHAPTER = 8

/**
 * The level (and promotion state) a child auto-levels to once the story has reached this chapter: flat at Lv10 through Ch11,
 * Lv20 by Ch18, then an Offspring Seal auto-promotes them, from promoted Lv2 at Ch19 up to promoted Lv18 at Ch27.
 */
export function levelForChapter(chapter: number): { level: number; promoted: boolean } {
  const total = Math.max(10, storyLevelForChapter(chapter))
  return total > 20 ? { level: total - 20, promoted: true } : { level: total, promoted: false }
}

/**
 * The earliest chapter this child can actually be recruited on a given route — their own specific
 * unlock requirement (support rank, paralogue prerequisites, fixed parent's own join timing), never
 * earlier than Ch8. Falls back to Ch8 if no per-route data is recorded.
 */
export function earliestChapterFor(unlockChapter: Partial<Record<Route, number>> | undefined, route: Route): number {
  const specific = unlockChapter?.[route]
  return recruitChapters(Math.max(EARLIEST_POSSIBLE_CHAPTER, specific ?? EARLIEST_POSSIBLE_CHAPTER), route)[0] ?? FINAL_CHAPTER
}

/** The level a child would actually be if recruited at their earliest possible chapter on this route — the baseline used wherever no specific chapter has been picked. */
export function earliestChildLevel(unlockChapter: Partial<Record<Route, number>> | undefined, route: Route): number {
  return levelForChapter(earliestChapterFor(unlockChapter, route)).level
}
