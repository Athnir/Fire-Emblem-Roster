import type { ComponentType, RefObject } from 'react'
import type { GameArt } from '../logic/bulkAssetImport'

export interface GameTab {
  id: string
  label: string
  component: ComponentType
}

/** A game's screens. These are big, so each game's are their own file, loaded when the game is first picked. */
export interface GameParts {
  /** Every tool for the game, as tabs. A game with nothing like a tool has no tab for it. */
  tabs: GameTab[]
  /** Shown under the header on every tab (Fates' Corrin build). */
  banner?: ComponentType
  /** Drawn behind the page (Fates' route colours). */
  background?: ComponentType
  /** Edit Mode's Bulk Upload for this game's art. */
  bulkUpload: ComponentType<{ onClose: () => void }>
  /** The game's art as a folder, for the home screen's Bulk Upload of every game at once (each game's folder in its own). */
  art: GameArt
  /** What the spoiler block hides in this game, said under the header while it's on. A game without one isn't set up yet. */
  spoiler?: string
  /** The spoiler block's chapter bar, under the header on every tab while the block is on (a game whose tabs carry their own has none). */
  spoilerBar?: ComponentType
  /** "Save as image", when the game names its files with more than the tab and unit (Fates: the plan and route). */
  exportButton?: ComponentType<{ targetRef: RefObject<HTMLElement | null>; tabLabel: string }>
}

export interface Game {
  id: string
  /** Its number in the series (Fates is the 14th): the picker's order, and the name of its art folder ("fe14"). */
  number: number
  /** As the picker lists it. */
  title: string
  /** Short form for tight spots and file names. */
  short: string
  load: () => Promise<GameParts>
}

/**
 * Every game the app covers, in the series' order (the order they came out). Adding a game is one entry here plus its own file in
 * this folder, its data and its screens, and taking it out of MISSING_GAMES. The build precaches every file, so each game works
 * offline without being opened first.
 */
export const GAMES: Game[] = [
  {
    id: 'fe1',
    number: 1,
    title: 'Fire Emblem: Shadow Dragon & the Blade of Light',
    short: 'Blade of Light',
    load: () => import('./fe1').then((m) => m.default),
  },
  {
    id: 'fe3',
    number: 3,
    title: 'Fire Emblem: Mystery of the Emblem',
    short: 'Mystery of the Emblem',
    load: () => import('./fe3').then((m) => m.default),
  },
  {
    id: 'fe4',
    number: 4,
    title: 'Fire Emblem: Genealogy of the Holy War',
    short: 'Genealogy',
    load: () => import('./fe4').then((m) => m.default),
  },
  {
    id: 'fe5',
    number: 5,
    title: 'Fire Emblem: Thracia 776',
    short: 'Thracia 776',
    load: () => import('./fe5').then((m) => m.default),
  },
  {
    id: 'fe6',
    number: 6,
    title: 'Fire Emblem: The Binding Blade',
    short: 'Binding Blade',
    load: () => import('./fe6').then((m) => m.default),
  },
  {
    id: 'fe7',
    number: 7,
    title: 'Fire Emblem: The Blazing Blade',
    short: 'Blazing Blade',
    load: () => import('./fe7').then((m) => m.default),
  },
  {
    id: 'fe8',
    number: 8,
    title: 'Fire Emblem: The Sacred Stones',
    short: 'Sacred Stones',
    load: () => import('./fe8').then((m) => m.default),
  },
  {
    id: 'fe9',
    number: 9,
    title: 'Fire Emblem: Path of Radiance',
    short: 'Path of Radiance',
    load: () => import('./fe9').then((m) => m.default),
  },
  {
    id: 'fe10',
    number: 10,
    title: 'Fire Emblem: Radiant Dawn',
    short: 'Radiant Dawn',
    load: () => import('./fe10').then((m) => m.default),
  },
  {
    id: 'fe11',
    number: 11,
    title: 'Fire Emblem: Shadow Dragon',
    short: 'Shadow Dragon',
    load: () => import('./fe11').then((m) => m.default),
  },
  {
    id: 'fe13',
    number: 13,
    title: 'Fire Emblem Awakening',
    short: 'Awakening',
    load: () => import('./fe13').then((m) => m.default),
  },
  {
    id: 'fates',
    number: 14,
    title: 'Fire Emblem Fates',
    short: 'Fates',
    load: () => import('./fates').then((m) => m.default),
  },
  {
    id: 'fe15',
    number: 15,
    title: 'Fire Emblem Echoes: Shadows of Valentia',
    short: 'Shadows of Valentia',
    load: () => import('./fe15').then((m) => m.default),
  },
  {
    id: 'fe16',
    number: 16,
    title: 'Fire Emblem: Three Houses',
    short: 'Three Houses',
    load: () => import('./fe16').then((m) => m.default),
  },
  {
    id: 'fe17',
    number: 17,
    title: 'Fire Emblem Engage',
    short: 'Engage',
    load: () => import('./fe17').then((m) => m.default),
  },
]

export interface MissingGame {
  number?: number
  title: string
  why: string
}

/** The mainline games the app doesn't have, listed in their place in the picker so the gaps show: the user doesn't own Gaiden or
 * New Mystery of the Emblem, and Fortune's Weave is too new for solid data (CLAUDE.md). */
export const MISSING_GAMES: MissingGame[] = [
  { number: 2, title: 'Fire Emblem Gaiden', why: 'not in the app' },
  { number: 12, title: 'Fire Emblem: New Mystery of the Emblem', why: 'not in the app' },
  { title: "Fire Emblem: Fortune's Weave", why: 'not in the app yet' },
]

/** The game's art folder in an all-games upload: "fe" and its number. Fates' "fates" folder from before is still read. */
export function artFolder(game: Game): string {
  return `fe${game.number}`
}

/** As the picker lists a game: its number, then its title. */
export function gameLabel(game: { number?: number; title: string }): string {
  return game.number ? `${game.number}. ${game.title}` : game.title
}

export type PickerEntry = { game: Game; missing?: undefined } | { game?: undefined; missing: MissingGame }

/** The picker's list: every game and every missing one, in the series' order (one without a number last). */
export function pickerList(): PickerEntry[] {
  const n = (e: PickerEntry) => (e.game ? e.game.number : e.missing.number) ?? Infinity
  return [...GAMES.map((game): PickerEntry => ({ game })), ...MISSING_GAMES.map((missing): PickerEntry => ({ missing }))].sort((a, b) => n(a) - n(b))
}
