import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TelliusData, TelliusUnit } from './types'

interface TelliusChoiceState {
  /** {gameId: {choice id: the option picked}}; a choice not picked leaves every option's units in. */
  picks: Record<string, Record<string, number>>
  setPick: (gameId: string, choiceId: string, option: number | null) => void
}

/** The story choices picked in the Roster (who joins in Path of Radiance's Ch.28 and Endgame). The key's `fe-roster-`
 * prefix puts it in the backup (src/logic/backup.ts). */
export const useTelliusChoices = create<TelliusChoiceState>()(
  persist(
    (set) => ({
      picks: {},
      setPick: (gameId, choiceId, option) =>
        set((state) => {
          const game = { ...state.picks[gameId] }
          if (option === null) delete game[choiceId]
          else game[choiceId] = option
          return { picks: { ...state.picks, [gameId]: game } }
        }),
    }),
    { name: 'fe-roster-tellius-choices' },
  ),
)

/** The units a choice picked leaves out: the other options' units. */
export function excludedUnits(data: TelliusData, picks: Record<string, number> | undefined): Set<string> {
  const out = new Set<string>()
  for (const choice of data.choices ?? []) {
    const picked = picks?.[choice.id]
    if (picked === undefined || !choice.options[picked]) continue
    choice.options.forEach((opt, i) => {
      if (i !== picked) for (const id of opt.units) if (!choice.options[picked].units.includes(id)) out.add(id)
    })
  }
  return out
}

/** The units in your army, by the story choices picked. */
export function useArmy(data: TelliusData): TelliusUnit[] {
  const picks = useTelliusChoices((s) => s.picks[data.gameId])
  const out = excludedUnits(data, picks)
  return out.size ? data.units.filter((u) => !out.has(u.id)) : data.units
}
