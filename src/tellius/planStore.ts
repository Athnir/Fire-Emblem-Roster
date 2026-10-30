import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GrowthMode } from './logic'

export interface TelliusUnitPlan {
  promoteAt: number | null
  targetLevel: number
  /** Random (the default) or Fixed growths. */
  mode?: GrowthMode
  /** Skills chosen on top of the unit's own (their own can be dropped too). */
  skills: string[]
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
