import { useState } from 'react'
import { selectClass } from './hooks'
import { EXAM_MIN_RATE, examRate } from './logic'
import { FE16_RANKS, FE16_SKILL_LABELS, type Fe16Class, type Fe16Skill } from './types'

/** The exam's pass chance for the ranks and Luck put in, as the game works it out (examRate). */
export function ExamCalculator({ cls }: { cls: Fe16Class }) {
  const required = Object.entries(cls.exam?.ranks ?? {}) as [Fe16Skill, string][]
  const [have, setHave] = useState<Partial<Record<Fe16Skill, string>>>(() => Object.fromEntries(required))
  const [luck, setLuck] = useState(0)
  const rate = examRate(cls, have, luck)
  return (
    <div className="space-y-2 rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Pass chance</div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {required.map(([sk]) => (
          <label key={sk} className="flex items-center gap-1.5 text-neutral-400">
            {FE16_SKILL_LABELS[sk]}
            <select value={have[sk] ?? 'E'} onChange={(e) => setHave({ ...have, [sk]: e.target.value })} className={selectClass}>
              {FE16_RANKS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="flex items-center gap-1.5 text-neutral-400">
          Luck
          <input
            type="number"
            min={0}
            max={99}
            value={luck}
            onChange={(e) => setLuck(Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
            className={`${selectClass} w-16`}
          />
        </label>
      </div>
      <div className="text-sm">
        <span className={`text-lg font-semibold ${rate >= EXAM_MIN_RATE ? 'text-emerald-400' : 'text-red-400'}`}>{rate}%</span>{' '}
        <span className="text-neutral-400">
          {rate < EXAM_MIN_RATE ? `under ${EXAM_MIN_RATE}%: the exam can't be taken` : rate >= 100 ? 'a sure pass' : `passes on ${rate + 1} rolls of 100`}
        </span>
      </div>
      <p className="text-xs text-neutral-500">
        100%, less {cls.exam?.cost} for each rank short
        {cls.exam?.anyOne ? ' in the skill closest to its rank (any one of them will do)' : required.length > 1 ? ', the skills added up' : ''}, plus half the
        unit's own Luck (without the class's boost). Only the ranks count, not the EXP within them. The seal is used up pass or fail,
        and the day's roll is fixed: reloading and retaking it the same day gives the same result (0x633f60, 0x64efa4).
      </p>
    </div>
  )
}
