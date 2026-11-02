import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { maxLevelOf, promotionsOf, type BandSegment, type GrowthMode, type TransferPlan } from './logic'
import type { TelliusData, TelliusUnit } from './types'

export interface TelliusUnitPlan {
  promoteAt: number | null
  /** Radiant Dawn's second promotion; absent in Path of Radiance's plans. */
  promoteAt2?: number | null
  targetLevel: number
  /** Random (the default) or Fixed growths. */
  mode?: GrowthMode
  /** Bands worn, in order from when the unit joins. */
  bands?: BandSegment[]
  /** Skills chosen on top of the unit's own (their own can be dropped too). */
  skills: string[]
  /** Radiant Dawn: bonus EXP level-ups in each class of the plan. */
  bexp?: number[]
  /** Radiant Dawn: what a Path of Radiance save brings. */
  transfer?: TransferPlan
}

interface TelliusPlanState {
  /** {gameId: {unitId: plan}}. */
  plans: Record<string, Record<string, TelliusUnitPlan>>
  setPlan: (gameId: string, unitId: string, plan: TelliusUnitPlan) => void
  clearPlan: (gameId: string, unitId: string) => void
}

/** One plan per unit, per game. The key's `fe-roster-` prefix puts it in the backup (src/logic/backup.ts). */
export const useTelliusPlanStore = create<TelliusPlanState>()(
  persist(
    (set) => ({
      plans: {},
      setPlan: (gameId, unitId, plan) =>
        set((state) => ({ plans: { ...state.plans, [gameId]: { ...state.plans[gameId], [unitId]: plan } } })),
      clearPlan: (gameId, unitId) =>
        set((state) => {
          const game = { ...state.plans[gameId] }
          delete game[unitId]
          return { plans: { ...state.plans, [gameId]: game } }
        }),
    }),
    { name: 'fe-roster-tellius-plans' },
  ),
)

/** A unit's plan before it's changed: every promotion at the top level, to the top level of the last class, with the
 * skills they join with. */
export function defaultPlan(data: TelliusData, unit: TelliusUnit): TelliusUnitPlan {
  const chain = promotionsOf(data, unit)
  const last = chain[chain.length - 1]?.id ?? unit.classId
  return {
    promoteAt: chain[0] ? maxLevelOf(data, unit.classId) : null,
    promoteAt2: chain[1] ? maxLevelOf(data, chain[0].id) : null,
    targetLevel: maxLevelOf(data, last),
    skills: [...unit.skills],
  }
}

/** The unit's saved plan (or the default), and its setters. The Unit Planner and the Skill Planner share it. */
export function useUnitPlan(data: TelliusData, unit: TelliusUnit) {
  const saved = useTelliusPlanStore((state) => state.plans[data.gameId]?.[unit.id])
  const setPlan = useTelliusPlanStore((state) => state.setPlan)
  const clearPlan = useTelliusPlanStore((state) => state.clearPlan)
  const plan = saved ?? defaultPlan(data, unit)
  return {
    plan,
    saved,
    update: (patch: Partial<TelliusUnitPlan>) => setPlan(data.gameId, unit.id, { ...plan, ...patch }),
    replace: (next: TelliusUnitPlan) => setPlan(data.gameId, unit.id, next),
    clear: () => clearPlan(data.gameId, unit.id),
  }
}
