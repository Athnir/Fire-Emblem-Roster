import { describe, expect, it } from 'vitest'
import { FE10_BIORHYTHM, FE10_UNITS } from '../../data/fe10/fe10Units'
import { FE9_BIORHYTHM, FE9_UNITS } from '../../data/fe9/fe9Units'

// The biorhythm as the games' code works it out (scripts/tellius_biorhythm.py), checked against Serenes Forest's tables.

const fe9 = (name: string) => FE9_UNITS.find((u) => u.name === name)!.biorhythm!
const fe10 = (name: string) => FE10_UNITS.find((u) => u.name === name)!.biorhythm!

describe('Path of Radiance biorhythm', () => {
  const wave = FE9_BIORHYTHM.curves['30'].points
  it('is one 30-point wave for everyone', () => {
    expect(Object.keys(FE9_BIORHYTHM.curves)).toEqual(['30'])
    expect(FE9_UNITS.every((u) => u.biorhythm?.curve === '30')).toBe(true)
  })

  it("puts the states where Serenes Forest's points do (Best 6-11, Good 3-5 and 12-14, Normal 1-2, 15-17 and 30, Bad 18-20 and 27-29, Worst 21-26)", () => {
    const at = (state: string) => wave.flatMap((p, i) => (p.state === state ? [i + 1] : []))
    expect(at('Best')).toEqual([6, 7, 8, 9, 10, 11])
    expect(at('Good')).toEqual([3, 4, 5, 12, 13, 14])
    expect(at('Normal')).toEqual([1, 2, 15, 16, 17, 30])
    expect(at('Bad')).toEqual([18, 19, 20, 27, 28, 29])
    expect(at('Worst')).toEqual([21, 22, 23, 24, 25, 26])
  })

  it('moves Hit and Avoid by 5 either way', () => {
    expect(FE9_BIORHYTHM.effects.map((e) => [e.state, e.hit ?? 0, e.avoid ?? 0])).toEqual([
      ['Best', 5, 5],
      ['Good', 5, 5],
      ['Normal', 0, 0],
      ['Bad', -5, -5],
      ['Worst', -5, -5],
    ])
  })

  it("gives a place of their own only to Serenes Forest's fixed units; the rest are rolled at power-on", () => {
    expect(['Ike', 'Boyd', 'Titania', 'Oscar', 'Shinon', 'Gatrie', 'Soren', 'Mia', 'Mist', 'Rolf'].map((n) => fe9(n).phase)).toEqual([
      1, 1, 16, 53, 1, 1, 45, 50, 1, 1,
    ])
    expect(FE9_UNITS.filter((u) => u.biorhythm?.phase !== null)).toHaveLength(10)
  })

  it("matches Serenes Forest's internal points where each fixed unit joins (Ike 8 in the Prologue, Oscar 23, Titania 30, Soren 22, Mia 8, Mist 11)", () => {
    const point = (name: string) => {
      const u = FE9_UNITS.find((x) => x.name === name)!
      return ((((FE9_BIORHYTHM.chapterShift![u.joinChapter] - u.biorhythm!.phase!) % 30) + 30) % 30) + 1
    }
    expect(['Ike', 'Oscar', 'Titania', 'Soren', 'Mia', 'Mist', 'Rolf', 'Shinon', 'Gatrie'].map(point)).toEqual([8, 23, 30, 22, 8, 11, 11, 29, 29])
  })
})

describe('Radiant Dawn biorhythm', () => {
  it("gives every unit Serenes Forest's type", () => {
    const types: Record<string, string> = { Micaiah: '1', Edward: '5', Leonardo: '2', Nolan: '0', Sothe: '6', Ike: '7', Heather: '3', Jill: '4', Elincia: '0', Titania: '5' }
    for (const [name, type] of Object.entries(types)) expect(fe10(name).curve, name).toBe(type)
    expect(FE10_UNITS.every((u) => u.biorhythm && u.biorhythm.phase === 0)).toBe(true)
  })

  it("follows Serenes Forest's turn tables (type 1: Best on turns 4-11, Worst on 16-23)", () => {
    const t1 = FE10_BIORHYTHM.curves['1'].points
    expect(t1).toHaveLength(25)
    expect(t1.flatMap((p, i) => (p.state === 'Best' ? [i + 1] : []))).toEqual([4, 5, 6, 7, 8, 9, 10, 11])
    expect(t1.flatMap((p, i) => (p.state === 'Worst' ? [i + 1] : []))).toEqual([16, 17, 18, 19, 20, 21, 22, 23])
    // Type 0: turn 2 at +0.482 (Good), turn 10 at -0.982 (Worst).
    expect(FE10_BIORHYTHM.curves['0'].points[1]).toEqual({ value: 0.4818, state: 'Good' })
    expect(FE10_BIORHYTHM.curves['0'].points[9].state).toBe('Worst')
  })

  it('moves Hit, Avoid and skill activation by 5 or 10, and the buried treasure chance by 10 or 20', () => {
    expect(FE10_BIORHYTHM.effects.find((e) => e.state === 'Best')).toEqual({ state: 'Best', hit: 10, avoid: 10, skill: 10, treasure: 20 })
    expect(FE10_BIORHYTHM.effects.find((e) => e.state === 'Bad')).toEqual({ state: 'Bad', hit: -5, avoid: -5, skill: -5, treasure: -10 })
  })
})
