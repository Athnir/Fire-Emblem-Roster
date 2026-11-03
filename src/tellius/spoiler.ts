import { useReached } from '../state/spoilerStore'
import type { TelliusData } from './types'

/** A Tellius game's data as the spoiler block opens it: the chapters reached, the units they've brought and the picks asked in them. */
export function useTelliusView(data: TelliusData): TelliusData {
  const reached = useReached(data.gameId, data.chapters)
  if (!reached) return data
  return {
    ...data,
    chapters: data.chapters.filter((c) => reached.has(c.id)),
    units: data.units.filter((u) => reached.has(u.joinChapter)),
    choices: data.choices?.filter((c) => reached.has(c.chapter)),
  }
}
