import { useState } from 'react'
import { chip, selectClass, useArmy, useScreenshotUnit, useUnitPlan } from './hooks'
import {
  capsOf,
  changesFrom,
  classSkill,
  INTERNAL_CAP,
  legalSteps,
  levelAfter,
  proficienciesOf,
  project,
  shownStats,
  syncBonus,
  type Fe17Data,
  type Fe17Difficulty,
  type Fe17Stage,
} from './logic'
import { UnitSelect, StatTable, SkillList } from './ui'

const SEAL_NAMES = { master: 'Master Seal', second: 'Second Seal', item: 'its item' }
const levels = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)

/** One unit's stats through their class changes, with an emblem synced, its bonds and the stat boosters. Saved per unit. */
export function Fe17Planner({ data }: { data: Fe17Data }) {
  const { units } = useArmy(data)
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const unit = units.find((u) => u.id === unitId) ?? units[0]
  useScreenshotUnit(unit)
  const { plan, saved, update, reset } = useUnitPlan(unit)
  if (!unit || !plan) return null
  const steps = legalSteps(data, unit, plan)
  const stages = project(data, unit, { ...plan, steps })
  const last = stages[stages.length - 1]
  const finalCls = data.classes[last.classId]
  const have = proficienciesOf(data, unit, plan)
  const emblem = data.emblems.find((e) => e.id === plan.emblem)
  const bond = plan.emblem ? (plan.bonds?.[plan.emblem] ?? 1) : 0
  const sync = syncBonus(emblem, bond)
  const label = (st: Fe17Stage) =>
    `${data.classes[st.classId].name} Lv ${st.level}${st.internal ? ` (int. ${st.internal})` : ''}${st.how === 'joins' ? ' (joins)' : st.how === 'change' ? ' (changes)' : st.how === 'boosters' ? ' + boosters' : ''}`
  const classAt = (i: number) => (i === 0 ? unit.classId : steps[i - 1].to)
  const levelAt = (i: number) => {
    if (i === 0) return unit.level
    const prev = steps[i - 1]
    return levelAfter(data.classes[classAt(i - 1)], prev.at, data.classes[prev.to])
  }
  const setStep = (i: number, patch: Partial<{ at: number; to: string }>) => update({ steps: steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const lastLevel = last.how === 'boosters' ? stages[stages.length - 2].level : last.level
  const fromLevel = steps.length ? levelAt(steps.length) : unit.level
  const emblems = data.emblems.filter((e) => e.levels.some((l) => l.sync.length || l.inherit.length))
  return (
    <div className="space-y-4">
      <UnitSelect data={data} units={units} value={unit.id} onChange={setUnitId} />
      <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex flex-wrap items-end gap-4 text-sm text-neutral-300">
          <label className="space-y-1">
            <span className="block text-xs text-neutral-500">Up to Lv (as {finalCls.name})</span>
            <select value={Math.max(fromLevel, Math.min(finalCls.maxLevel, plan.targetLevel))} onChange={(e) => update({ targetLevel: Number(e.target.value) })} className={selectClass}>
              {levels(fromLevel, finalCls.maxLevel).map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-neutral-500">Difficulty (the internal level's cap)</span>
            <select value={plan.difficulty ?? 'normal'} onChange={(e) => update({ difficulty: e.target.value as Fe17Difficulty })} className={selectClass}>
              {(Object.keys(INTERNAL_CAP) as Fe17Difficulty[]).map((d) => (
                <option key={d} value={d}>
                  {d[0].toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => update({ fixed: false })} className={chip(!plan.fixed)}>
              Random growths
            </button>
            <button type="button" onClick={() => update({ fixed: true })} className={chip(!!plan.fixed)}>
              Fixed growths
            </button>
          </div>
          {saved && (
            <button type="button" onClick={reset} className="rounded-md bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700">
              Reset
            </button>
          )}
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-neutral-200">Class changes</h4>
          {steps.map((st, i) => {
            const from = data.classes[classAt(i)]
            const options = changesFrom(data, unit, from.id, have)
            return (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-neutral-500">As a {from.name}, at Lv</span>
                <select value={st.at} onChange={(e) => setStep(i, { at: Number(e.target.value) })} className={selectClass}>
                  {levels(levelAt(i), from.maxLevel).map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </select>
                <span className="text-neutral-500">→</span>
                <select value={st.to} onChange={(e) => setStep(i, { to: e.target.value })} className={selectClass}>
                  {options.map((c) => (
                    <option key={c.to} value={c.to} disabled={st.at < c.minLevel}>
                      {data.classes[c.to].name} ({SEAL_NAMES[c.seal]}{c.minLevel > 1 ? `, Lv ${c.minLevel}` : ''})
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => update({ steps: steps.filter((_, j) => j !== i) })} className="text-xs text-neutral-500 hover:text-red-400">
                  Remove
                </button>
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => {
              const from = data.classes[classAt(steps.length)]
              const at = Math.max(fromLevel, Math.min(from.maxLevel, plan.targetLevel))
              const next = changesFrom(data, unit, from.id, have).find((c) => c.to !== from.id && at >= c.minLevel)
              if (next) update({ steps: [...steps, { at, to: next.to }] })
            }}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-600"
          >
            + Add a class change
          </button>
          <p className="text-xs text-neutral-500">Proficient in: {have.join(', ')}. A class asks for its weapons; emblem bonds add more.</p>
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-neutral-200">Emblem synced</h4>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select value={plan.emblem ?? ''} onChange={(e) => update({ emblem: e.target.value || undefined })} className={selectClass}>
              <option value="">None</option>
              {emblems.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            {emblem && (
              <>
                <span className="text-neutral-500">bond</span>
                <select value={bond} onChange={(e) => update({ bonds: { ...(plan.bonds ?? {}), [emblem.id]: Number(e.target.value) } })} className={selectClass}>
                  {levels(1, 20).map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
          {emblem && (
            <p className="text-xs text-neutral-500">
              Synced, {emblem.name} adds its bond level's stats on top of the caps (blue) and its sync skills; each bond level reached also
              grants its proficiency for good.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-neutral-200">Stat boosters</h4>
          <div className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-3">
            {data.boosters.map((b) => (
              <label key={b.name} className="flex items-center justify-between gap-2 rounded-md border border-neutral-800 px-2 py-1 text-neutral-300">
                <span>{b.name}</span>
                <select
                  value={plan.boosters?.[b.name] ?? 0}
                  onChange={(e) => {
                    const next = { ...(plan.boosters ?? {}), [b.name]: Number(e.target.value) }
                    if (!next[b.name]) delete next[b.name]
                    update({ boosters: next })
                  }}
                  className={selectClass}
                >
                  {levels(0, 9).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => update({ expertise: !plan.expertise })} className={chip(!!plan.expertise)}>
            Expertise (class growths ×2)
          </button>
          <button type="button" onClick={() => update({ starsphere: !plan.starsphere })} className={chip(!!plan.starsphere)}>
            Starsphere (+15 growths)
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          {plan.fixed ? "Fixed growths: each stat's running total starts at the unit's growth rate and gains a point at every 100." : 'Average stats: a level with fewer than two points is rolled again, up to four tries, the best kept.'}{' '}
          Growth is the unit's own plus the class's; a stat at its cap gains nothing. A class change starts again at Lv 1 and keeps the
          unit's own stats, so the shown ones move by the classes' bases.
        </p>
        <StatTable
          rows={stages.map((st, i) => {
            const cls = data.classes[st.classId]
            return { label: label(st), values: shownStats(cls, unit, st.own), caps: capsOf(cls, unit), extra: i === stages.length - 1 ? sync : undefined }
          })}
        />
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-neutral-200">Skills as a {finalCls.name}</h4>
          <SkillList
            data={data}
            skills={[...unit.personal, ...finalCls.skills, ...(classSkill(finalCls, lastLevel) ? [classSkill(finalCls, lastLevel)!] : []), ...(plan.inherited ?? [])]}
          />
          {finalCls.learns && lastLevel < finalCls.learns.level && (
            <p className="text-xs text-neutral-500">
              {finalCls.learns.skill} comes at Lv {finalCls.learns.level} in the class.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
