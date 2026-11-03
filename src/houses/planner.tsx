import { useState } from 'react'
import { chip, selectClass, useArmy, useScreenshotUnit, useUnitPlan } from './hooks'
import { canTake, classesFor, labelOf, learnsOf, rankIndex, type Fe16Data } from './logic'
import {
  capsOf,
  canChange,
  certifiedBy,
  isMounted,
  joinOptions,
  legalSteps,
  MAX_LEVEL,
  project,
  ranksNeeded,
  shownStats,
  startOf,
  type Fe16Stage,
} from './plan'
import { useFe16Store } from './store'
import { FE16_SKILL_LABELS, FE16_STATS, type Fe16Class, type Fe16Skill, type Fe16Stats, type Fe16Unit } from './types'
import { StatTable, UnitSelect } from './ui'

const TIERS = ['Starting', 'Beginner', 'Intermediate', 'Advanced', 'Master', 'DLC', 'Unique'] as const
/** Which Saint Statue raises which maximums isn't traced to a name: the statues by the stats they raise (at level 9). */
const STATUE_LABELS: Record<string, string> = { '0': 'Lck, Cha', '1': 'Str, Spd', '2': 'Mag, Dex', '3': 'Def, Res' }

const levels = (from: number) => Array.from({ length: Math.max(0, MAX_LEVEL - from + 1) }, (_, i) => from + i)

/** A class's name as the unit sees it, and what its exam asks for. */
function examText(cls: Fe16Class): string {
  if (cls.given) return cls.given
  const ranks = Object.entries(cls.exam?.ranks ?? {}).map(([sk, r]) => `${FE16_SKILL_LABELS[sk as Fe16Skill]} ${r}`)
  return `${cls.exam?.seal ?? 'No seal'}, from Lv ${cls.level}${ranks.length ? `; the exam asks for ${ranks.join(', ')}` : ''}.`
}

/** The class picker for a step: the unit's classes by tier; those not open at the step's level greyed out. */
function ClassSelect({ data, unit, value, level, had, onChange }: { data: Fe16Data; unit: Fe16Unit; value: string; level: number; had: Set<string>; onChange: (id: string) => void }) {
  const classes = classesFor(data, unit)
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      {TIERS.map((tier) => {
        const here = classes.filter((c) => c.tier === tier)
        if (here.length === 0) return null
        return (
          <optgroup key={tier} label={tier === 'Starting' ? 'Starting' : `${tier}${tier === 'Unique' ? '' : ` (Lv ${here[0].level})`}`}>
            {here.map((c) => (
              <option key={c.id} value={c.id} disabled={!canChange(unit, c, level, had)}>
                {c.name}
              </option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}

/** One unit's average stats through their class changes, from Lv 1 or the month they join in. Saved per unit. */
export function Fe16Planner({ data }: { data: Fe16Data }) {
  const { units, picks } = useArmy(data)
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const unit = units.find((u) => u.id === unitId) ?? units[0]
  useScreenshotUnit(unit)
  const { plan, saved, update, reset } = useUnitPlan(unit)
  const allPlans = useFe16Store((s) => s.plans)
  const [onFoot, setOnFoot] = useState(false)
  if (!unit || !plan) return null
  const start = startOf(data, unit, plan, picks)
  const steps = legalSteps(data, unit, plan, start)
  const stages = project(data, unit, { ...plan, steps }, picks)
  const caps = capsOf(data, unit, plan.statues)
  const last = stages[stages.length - 1]
  const finalCls = data.classes[last.classId]
  const options = joinOptions(unit, picks)
  const anyMounted = stages.some((st) => isMounted(data.classes[st.classId]))
  const needed = ranksNeeded(data, steps)
  const learned = learnsOf(data, unit).filter((l) => needed[l.skill] && rankIndex(l.rank) <= rankIndex(needed[l.skill]!))
  const dancers = Object.entries(allPlans).filter(([id, p]) => id !== unit.id && p.steps.some((s) => data.classes[s.to]?.name === 'Dancer'))
  const isDancer = steps.some((s) => data.classes[s.to]?.name === 'Dancer')
  const label = (st: Fe16Stage) =>
    `${data.classes[st.classId].name} Lv ${fmtLevel(st.level)}${st.how === 'joins' ? ' (joins)' : st.how === 'change' ? ' (changes)' : ''}`
  const row = (st: Fe16Stage) => {
    const cls = data.classes[st.classId]
    const shown = shownStats(cls, st.own, !onFoot)
    const shownCaps = {} as Fe16Stats
    for (const s of FE16_STATS) shownCaps[s] = caps[s] + (shown[s] - st.own[s])
    return { label: label(st), values: shown, caps: shownCaps, mov: true }
  }
  const setStep = (i: number, patch: Partial<{ at: number; to: string }>) => update({ steps: steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const lastLevel = steps.length ? steps[steps.length - 1].at : start.level
  return (
    <div className="space-y-4">
      <UnitSelect units={units} picks={picks} value={unit.id} onChange={setUnitId} />
      <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex flex-wrap items-end gap-4 text-sm text-neutral-300">
          {options.length > 0 && (
            <label className="space-y-1">
              <span className="block text-xs text-neutral-500">{options.length > 1 ? 'Recruited in the month of' : 'Joins in the month of'}</span>
              <select value={start.join?.chapter ?? options[0]} onChange={(e) => update({ joinChapter: Number(e.target.value) })} className={selectClass}>
                {options.map((ch) => (
                  <option key={ch} value={ch}>
                    Chapter {ch}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="space-y-1">
            <span className="block text-xs text-neutral-500">Up to Lv (as {finalCls.name})</span>
            <select value={Math.max(lastLevel, Math.min(MAX_LEVEL, plan.targetLevel))} onChange={(e) => update({ targetLevel: Number(e.target.value) })} className={selectClass}>
              {levels(lastLevel).map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
          </label>
          {anyMounted && (
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setOnFoot(false)} className={chip(!onFoot)}>
                Mounted
              </button>
              <button type="button" onClick={() => setOnFoot(true)} className={chip(onFoot)}>
                Dismounted
              </button>
            </div>
          )}
          {saved && (
            <button type="button" onClick={reset} className="rounded-md bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700">
              Reset
            </button>
          )}
        </div>
        {start.join && (
          <p className="text-xs text-neutral-500">
            Joins at Lv {start.join.level} as a {data.classes[start.join.classId].name}: the chapter's level (fixed_flow, 0x3d0dc0), the
            class their record gives for it, and stats averaged from Lv 1 by the game's own rule (0x3d4260), the same every time.
            {unit.id === 'fe16-gilbert' && ' Gilbert then gets a time-skip level-up.'}
          </p>
        )}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-neutral-200">Class changes</h4>
          {steps.map((st, i) => {
            const had = certifiedBy(unit, start.classId, steps.slice(0, i))
            const from = i === 0 ? start.level : steps[i - 1].at
            return (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-neutral-500">At Lv</span>
                <select value={st.at} onChange={(e) => setStep(i, { at: Number(e.target.value) })} className={selectClass}>
                  {levels(from).map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </select>
                <span className="text-neutral-500">→</span>
                <ClassSelect data={data} unit={unit} value={st.to} level={st.at} had={had} onChange={(to) => setStep(i, { to })} />
                <button type="button" onClick={() => update({ steps: steps.filter((_, j) => j !== i) })} className="text-xs text-neutral-500 hover:text-red-400">
                  Remove
                </button>
                <p className="w-full text-xs text-neutral-500">{examText(data.classes[st.to])}</p>
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => {
              const at = Math.max(lastLevel, Math.min(MAX_LEVEL, plan.targetLevel))
              const had = certifiedBy(unit, start.classId, steps)
              const next = classesFor(data, unit).find((c) => c.id !== last.classId && canChange(unit, c, at, had) && canTake(c, unit))
              if (next) update({ steps: [...steps, { at, to: next.id }] })
            }}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-600"
          >
            + Add a class change
          </button>
        </div>
        {isDancer && dancers.length > 0 && (
          <p className="text-sm text-amber-400">
            {dancers.map(([id]) => labelOf(data.units.find((u) => u.id === id)!)).join(' and ')}'s plan is a Dancer too. Only the White Heron
            Cup's winner is certified, one unit a playthrough; the planner keeps both plans anyway.
          </p>
        )}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-neutral-200">Saint Statues</h4>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(STATUE_LABELS).map((id) => {
              const on = (plan.statues ?? []).includes(id)
              return (
                <button key={id} type="button" onClick={() => update({ statues: on ? plan.statues!.filter((x) => x !== id) : [...(plan.statues ?? []), id] })} className={chip(on)}>
                  {STATUE_LABELS[id]} +5
                </button>
              )
            })}
          </div>
          <p className="text-xs text-neutral-500">
            A statue at level 9 raises two maximums by 5 for your units (0x3f32b0); its earlier levels add nothing to them.
          </p>
        </div>
        <p className="text-xs text-neutral-500">
          Average stats. Each level rolls the unit's growth plus the class's (Cyril's Aptitude adds 20); most units get at least two
          points a level (the staff and knights don't). Maximums are the unit's own; the class's boosts (and a mount's) show on top and
          can go past them. Changing into a class, or passing its exam, lifts any stat below the class's base to it for good. The numbers
          are averages and can run a little off.
        </p>
        <StatTable rows={stages.map(row)} />
        {Object.keys(needed).length > 0 && (
          <div className="space-y-1 text-sm">
            <h4 className="text-sm font-semibold text-neutral-200">Skill levels the exams need</h4>
            <div className="text-neutral-300">
              {Object.entries(needed)
                .map(([sk, r]) => `${FE16_SKILL_LABELS[sk as Fe16Skill]} ${r}`)
                .join(', ')}
            </div>
            {learned.length > 0 && (
              <div className="text-xs text-neutral-400">
                <span className="text-neutral-500">Learned by then: </span>
                {learned.map((l) => `${l.name} (${FE16_SKILL_LABELS[l.skill]} ${l.rank})`).join(', ')}
              </div>
            )}
          </div>
        )}
        <div className="space-y-1 text-sm">
          <h4 className="text-sm font-semibold text-neutral-200">As a {finalCls.name}</h4>
          {finalCls.abilities.length > 0 && (
            <div>
              <span className="text-neutral-500">Class abilities: </span>
              <span className="text-neutral-200">{finalCls.abilities.join(', ')}</span>
            </div>
          )}
          {finalCls.mastery.length > 0 && (
            <div>
              <span className="text-neutral-500">Mastering it teaches: </span>
              <span className="text-neutral-200">{finalCls.mastery.join(', ')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const fmtLevel = (lv: number) => String(lv)
