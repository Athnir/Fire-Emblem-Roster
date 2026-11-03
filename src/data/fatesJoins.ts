// The chapter each Fates character joins your army for good, by route, for the spoiler block (Serenes Forest's recruitment pages,
// as all Fates data is; each value is confirmed in the game's chapter files, castle_join.bin and the DLC pack). Chapters 1-5 are
// every route's, the Endgame is 28; a join between chapters (My Castle, a paralogue, the DLC) counts from the first chapter the unit
// can fight in. `first`: a stint before the routes split (Gunter, Kaze, Rinkah, Azura, Sakura; the retainer Corrin's gender keeps,
// Felicia or Jakob, from Chapter 2). `gone`: lost for good after that chapter (Scarlet on Revelation). The children's chapters are
// their own `unlockChapter`.
import type { Route } from './types'

export type FatesRoute = Exclude<Route, 'all'>

export interface FatesJoin {
  Birthright?: number
  Conquest?: number
  Revelation?: number
  first?: number
  gone?: Partial<Record<FatesRoute, number>>
}

export const FATES_JOINS: Record<string, FatesJoin> = {
  "anna": {
    "Birthright": 7,
    "Conquest": 7,
    "Revelation": 7
  },
  "arthur": {
    "Conquest": 7,
    "Revelation": 14
  },
  "azama": {
    "Birthright": 8,
    "Revelation": 16
  },
  "azura": {
    "Birthright": 5,
    "Conquest": 9,
    "Revelation": 5,
    "first": 5
  },
  "benny": {
    "Conquest": 13,
    "Revelation": 14
  },
  "beruka": {
    "Conquest": 10,
    "Revelation": 12
  },
  "camilla": {
    "Conquest": 10,
    "Revelation": 12
  },
  "charlotte": {
    "Conquest": 13,
    "Revelation": 14
  },
  "corrin_f": {
    "Birthright": 1,
    "Conquest": 1,
    "Revelation": 1
  },
  "corrin_m": {
    "Birthright": 1,
    "Conquest": 1,
    "Revelation": 1
  },
  "effie": {
    "Conquest": 7,
    "Revelation": 14
  },
  "elise": {
    "Conquest": 7,
    "Revelation": 14
  },
  "felicia": {
    "Birthright": 6,
    "Conquest": 6,
    "Revelation": 6,
    "first": 2
  },
  "flora": {
    "Conquest": 19,
    "Revelation": 23
  },
  "fuga": {
    "Revelation": 19
  },
  "gunter": {
    "Conquest": 15,
    "Revelation": 7,
    "first": 2
  },
  "hana": {
    "Birthright": 7,
    "Revelation": 8
  },
  "hayato": {
    "Birthright": 8,
    "Revelation": 9
  },
  "hinata": {
    "Birthright": 9,
    "Revelation": 10
  },
  "hinoka": {
    "Birthright": 8,
    "Revelation": 16
  },
  "izana": {
    "Birthright": 19,
    "Conquest": 23
  },
  "jakob": {
    "Birthright": 6,
    "Conquest": 6,
    "Revelation": 6,
    "first": 2
  },
  "kaden": {
    "Birthright": 12,
    "Revelation": 13
  },
  "kagero": {
    "Birthright": 10,
    "Revelation": 11
  },
  "kaze": {
    "Birthright": 4,
    "Conquest": 11,
    "Revelation": 8,
    "first": 4
  },
  "keaton": {
    "Conquest": 14,
    "Revelation": 13
  },
  "laslow": {
    "Conquest": 12,
    "Revelation": 17
  },
  "leo": {
    "Conquest": 14,
    "Revelation": 17
  },
  "mozu": {
    "Birthright": 8,
    "Conquest": 8,
    "Revelation": 8
  },
  "niles": {
    "Conquest": 8,
    "Revelation": 17
  },
  "nyx": {
    "Conquest": 9,
    "Revelation": 15
  },
  "oboro": {
    "Birthright": 9,
    "Revelation": 10
  },
  "odin": {
    "Conquest": 8,
    "Revelation": 17
  },
  "orochi": {
    "Birthright": 7,
    "Revelation": 11
  },
  "peri": {
    "Conquest": 12,
    "Revelation": 17
  },
  "reina": {
    "Birthright": 11,
    "Revelation": 11
  },
  "rinkah": {
    "Birthright": 4,
    "Revelation": 9,
    "first": 4
  },
  "ryoma": {
    "Birthright": 13,
    "Revelation": 16
  },
  "saizo": {
    "Birthright": 7,
    "Revelation": 11
  },
  "sakura": {
    "Birthright": 5,
    "Revelation": 8,
    "first": 5
  },
  "scarlet": {
    "Birthright": 13,
    "Revelation": 16,
    "gone": {
      "Revelation": 18
    }
  },
  "selena": {
    "Conquest": 10,
    "Revelation": 12
  },
  "setsuna": {
    "Birthright": 8,
    "Revelation": 16
  },
  "shura": {
    "Birthright": 22,
    "Conquest": 16,
    "Revelation": 15
  },
  "silas": {
    "Birthright": 7,
    "Conquest": 7,
    "Revelation": 14
  },
  "subaki": {
    "Birthright": 7,
    "Revelation": 8
  },
  "takumi": {
    "Birthright": 10,
    "Revelation": 10
  },
  "xander": {
    "Conquest": 16,
    "Revelation": 17
  },
  "yukimura": {
    "Birthright": 23
  }
}
