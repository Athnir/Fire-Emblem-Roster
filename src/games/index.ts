import type { ComponentType, RefObject } from 'react'

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
  /** "Save as image", when the game names its files with more than the tab and unit (Fates: the plan and route). */
  exportButton?: ComponentType<{ targetRef: RefObject<HTMLElement | null>; tabLabel: string }>
}

export interface Game {
  id: string
  /** As the picker lists it. */
  title: string
  /** Short form for tight spots and file names. */
  short: string
  load: () => Promise<GameParts>
}

/**
 * Every game the app covers, in the order they're being added (CLAUDE.md). Adding a game is one entry here
 * plus its own file in this folder, its data and its screens. The build precaches every file, so each game
 * works offline without being opened first.
 */
export const GAMES: Game[] = [
  {
    id: 'fates',
    title: 'Fire Emblem Fates',
    short: 'Fates',
    load: () => import('./fates').then((m) => m.default),
  },
  {
    id: 'fe9',
    title: 'Fire Emblem: Path of Radiance',
    short: 'Path of Radiance',
    load: () => import('./fe9').then((m) => m.default),
  },
  {
    id: 'fe10',
    title: 'Fire Emblem: Radiant Dawn',
    short: 'Radiant Dawn',
    load: () => import('./fe10').then((m) => m.default),
  },
  {
    id: 'fe4',
    title: 'Fire Emblem: Genealogy of the Holy War',
    short: 'Genealogy',
    load: () => import('./fe4').then((m) => m.default),
  },
  {
    id: 'fe5',
    title: 'Fire Emblem: Thracia 776',
    short: 'Thracia 776',
    load: () => import('./fe5').then((m) => m.default),
  },
  {
    id: 'fe6',
    title: 'Fire Emblem: The Binding Blade',
    short: 'Binding Blade',
    load: () => import('./fe6').then((m) => m.default),
  },
  {
    id: 'fe7',
    title: 'Fire Emblem: The Blazing Blade',
    short: 'Blazing Blade',
    load: () => import('./fe7').then((m) => m.default),
  },
  {
    id: 'fe8',
    title: 'Fire Emblem: The Sacred Stones',
    short: 'Sacred Stones',
    load: () => import('./fe8').then((m) => m.default),
  },
  {
    id: 'fe3',
    title: 'Fire Emblem: Mystery of the Emblem',
    short: 'Mystery of the Emblem',
    load: () => import('./fe3').then((m) => m.default),
  },
  {
    id: 'fe13',
    title: 'Fire Emblem Awakening',
    short: 'Awakening',
    load: () => import('./fe13').then((m) => m.default),
  },
  {
    id: 'fe15',
    title: 'Fire Emblem Echoes: Shadows of Valentia',
    short: 'Shadows of Valentia',
    load: () => import('./fe15').then((m) => m.default),
  },
]
