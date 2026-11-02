import { describe, expect, it } from 'vitest'
import { lateRecruitJoin } from '../../logic/lateRecruit'
import { getBaseStats, getStartingLevel } from '../../logic/levelProjection'
import { characters, charactersById } from '../characters'
import { FINAL_CHAPTER, levelForChapter, recruitChapters, storyLevelForChapter } from '../childLeveling'
import { classes, classesById } from '../classes'
import { STAT_KEYS, type Route } from '../types'
import { FATES_GAME_JOINS, FATES_GAME_NO_CASTLE_AFTER, FATES_GAME_PROMOTIONS, FATES_GAME_STORY_LEVELS } from './fatesGameJoins'

const REAL_ROUTES: Route[] = ['Birthright', 'Conquest', 'Revelation']
const adults = characters.filter((c) => !c.isChild && c.id !== 'corrin_m' && c.id !== 'corrin_f')
const routesOf = (route: Route[]) => (route.includes('all') ? REAL_ROUTES : route)

describe("Fates joins against the game's own files", () => {
  it("gives every unit the game's join level, class and stats on each of their routes", () => {
    for (const c of adults) {
      const game = FATES_GAME_JOINS[c.name]
      for (const route of routesOf(c.route)) {
        const join = game.routes[route] ?? game
        const app = getBaseStats(c, route)
        expect([c.name, route, getStartingLevel(c.startingLevel, route), c.joinClass ?? c.startingClass, STAT_KEYS.map((k) => app[k])])
          .toEqual([c.name, route, join.level, join.joinClass, join.bases])
      }
    }
  })

  it('levels up on joining late only the units the game does, from the story level it gives them', () => {
    // Felicia and Jakob carry one too (5), but they join in Chapter 2 (Dispos/A002.bin), at story level 1, so it never lifts them.
    const exempt = ['Felicia', 'Jakob']
    for (const c of adults) {
      if (exempt.includes(c.name)) continue
      expect([c.name, c.joinScalesFrom]).toEqual([c.name, FATES_GAME_JOINS[c.name].scalesFrom])
    }
    expect(exempt.map((name) => FATES_GAME_JOINS[name].scalesFrom)).toEqual([5, 5])
  })

  it("follows the game's story level per chapter, and the children's levels follow from it", () => {
    for (let chapter = 1; chapter <= FINAL_CHAPTER; chapter++) {
      expect([chapter, storyLevelForChapter(chapter)]).toEqual([chapter, FATES_GAME_STORY_LEVELS[chapter - 1]])
    }
    expect(levelForChapter(11)).toEqual({ level: 10, promoted: false })
    expect(levelForChapter(12)).toEqual({ level: 11, promoted: false })
    expect(levelForChapter(18)).toEqual({ level: 20, promoted: false })
    expect(levelForChapter(19)).toEqual({ level: 2, promoted: true })
    expect(levelForChapter(27)).toEqual({ level: 18, promoted: true })
  })

  it('offers no recruiting where the game skips My Castle: the endgame on every route, and after Revelation\'s Ch16', () => {
    for (const route of REAL_ROUTES) {
      const skipped = FATES_GAME_NO_CASTLE_AFTER[route]
      expect(skipped.at(-1)).toBe(FINAL_CHAPTER)
      const offered = recruitChapters(8, route)
      expect(offered.at(-1)).toBe(FINAL_CHAPTER)
      for (const after of skipped.slice(0, -1)) expect([route, offered.includes(after + 1)]).toEqual([route, false])
    }
    expect(recruitChapters(16, 'Revelation')).toEqual([16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27])
  })

  it("gives each base class the game's promotions", () => {
    const appName = (id: string) => (classesById[id].name === 'Butler/Maid' ? 'Butler' : classesById[id].name)
    for (const c of classes) {
      if (c.tier !== 'base') continue
      const game = FATES_GAME_PROMOTIONS[c.name === 'Nohr Prince(ss)' ? 'Nohr Prince' : c.name] ?? []  // special classes don't promote
      const app = c.routeLockedPromotions ? [...new Set(Object.values(c.routeLockedPromotions).flat())] : c.promotesTo ?? []
      expect([c.name, app.map(appName).sort()]).toEqual([c.name, [...game].sort()])
    }
  })
})

describe('late recruits', () => {
  const izana = charactersById['izana']
  const fuga = charactersById['fuga']

  it('join at their own level until the story passes their threshold', () => {
    expect(lateRecruitJoin(izana, 'Birthright', 19)).toEqual({ level: 5, baseStats: izana.baseStats })
    expect(lateRecruitJoin(charactersById['silas'], 'Birthright', 27)).toBeUndefined()
  })

  it("gain a level per story level past it, with the levels' growth rounded half up (0x3d396c, 0x3d7164)", () => {
    // Ch23: story level 30, two past Izana's 28, so two levels of his growth plus the Onmyoji's, each stat rounded half up.
    const onmyoji = classes.find((c) => c.name === 'Onmyoji')!
    const join = lateRecruitJoin(izana, 'Birthright', 23)!
    expect(join.level).toBe(7)
    for (const key of STAT_KEYS) {
      const growth = izana.growthRates[key] + onmyoji.growthModifiers[key]
      expect(join.baseStats[key]).toBe(izana.baseStats[key] + Math.floor((growth * 2 + 50) / 100))
    }
  })

  it('end three levels behind a child recruited at the same time: promoted Lv15 to their Lv18 at Ch27', () => {
    expect(levelForChapter(27)).toEqual({ level: 18, promoted: true })
    expect(lateRecruitJoin(izana, 'Birthright', 27)?.level).toBe(15)
    expect(lateRecruitJoin(fuga, 'Revelation', 27)?.level).toBe(15)
  })
})
