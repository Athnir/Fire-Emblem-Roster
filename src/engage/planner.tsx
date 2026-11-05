import { useState } from 'react'
import { chip, selectClass, useArmy, useScreenshotUnit, useUnitPlan } from './hooks'
import {
  capsOf,
  changesFrom,
  classSkill,
  estimate,
  growthsIn,
  INTERNAL_CAP,
  legalSteps,
  levelAfter,
  pathTo,
  proficienciesOf,
  project,
  shownStats,
  syncBonus,
  type Fe17Data,
  type Fe17Difficulty,
  type Fe17Plan,
  type Fe17Stage,
} from './logic'
import type { Fe17Class, Fe17Unit } from './types'
import { useFe17Store } from './store'
import { Fe17PlanSets, SkillList, StatTable, UnitSelect } from './ui'

const SEAL_NAMES = { master: 'Master Seal', second: 'Second Seal', item: 'its item' }
const levels = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)
const TIER_NAMES: Record<Fe17Class['tier'], string> = { base: 'Base classes', special: 'Special classes', advanced: 'Advanced classes' }

/** As Fates' Projected Stats: the rough stats to expect in any class the unit can be in, at any level, by the shortest way there
 * (pathTo), with that class's growths and maximums. Not saved: it doesn't change the plan. */
function Estimate({ data, unit, plan, defaultClass, defaultLevel }: { data: Fe17Data; unit: Fe17Unit; plan: Fe17Plan; defaultClass: string; defaultLevel: number }) {
  const [classId, setClassId] = useState(defaultClass)
  const [wanted, setWanted] = useState(defaultLevel)
  const [promoteAt, setPromoteAt] = useState(20)
  const reachable = Object.values(data.classes).filter((c) => c.id === unit.classId || pathTo(data, unit, c.id).length > 0)
  const cls = data.classes[classId] ?? data.classes[unit.classId]
  const steps = pathTo(data, unit, cls.id, promoteAt)
  const arrival = estimate(data, unit, plan, cls.id, 0, promoteAt).at(-1)!.level
  const level = Math.min(cls.maxLevel, Math.max(arrival, wanted))
  const stages = estimate(data, unit, plan, cls.id, level, promoteAt)
  const last = stages[stages.length - 1]
  const promotes = steps.some((st, i) => data.classes[st.to].tier === 'advanced' && data.classes[i ? steps[i - 1].to : unit.classId].tier === 'base')
  const way = [`${data.classes[unit.classId].name} Lv ${unit.level}`, ...steps.map((st) => `Lv ${st.at}, then ${data.classes[st.to].name}`)].join(' to ')
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-neutral-200">Estimated stats</h4>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-500">As a</span>
        <select value={cls.id} onChange={(e) => setClassId(e.target.value)} className={selectClass}>
          {(['base', 'special', 'advanced'] as const).map((t) => (
            <optgroup key={t} label={TIER_NAMES[t]}>
              {reachable
                .filter((c) => c.tier === t)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <span className="text-neutral-500">at Lv</span>
        <select value={level} onChange={(e) => setWanted(Number(e.target.value))} className={selectClass}>
          {levels(arrival, cls.maxLevel).map((lv) => (
            <option key={lv} value={lv}>
              {lv}
            </option>
          ))}
        </select>
        {promotes && (
          <>
            <span className="text-neutral-500">promoted at Lv</span>
            <select value={promoteAt} onChange={(e) => setPromoteAt(Number(e.target.value))} className={selectClass}>
              {levels(10, 20).map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      <StatTable
        rows={[
          { label: `Growths as a ${cls.name}`, values: growthsIn(unit, cls, plan), suffix: '%' },
          { label: `Maximums as a ${cls.name}`, values: capsOf(cls, unit) },
          { label: `${cls.name} Lv ${last.level} (rough)`, values: shownStats(cls, unit, last.own), caps: capsOf(cls, unit) },
        ]}
      />
      <p className="text-xs text-neutral-500">
        The way there: {way}{steps.length ? '' : ' (the class they join in)'}. Averages with the plan's growth settings, without boosters
        or an Emblem; any proficiency a class needs is taken as had (an Emblem's bonds give it). The plan itself is below.
      </p>
    </div>
  )
}

/** One unit's stats through their class changes, with an emblem synced, its bonds and the stat boosters. Saved per unit. */
export function Fe17Planner({ data }: { data: Fe17Data }) {
  const { units } = useArmy(data)
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const unit = units.find((u) => u.id === unitId) ?? units[0]
  useScreenshotUnit(unit)
  const { plan, saved, update, reset } = useUnitPlan(unit)
  const pactRing = useFe17Store((s) => s.picks.pactRing)
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
  // The Pact Ring's partner can take their bond with Emblem Alear to 21 (GodBond.GetMaxLevel 0x2b4db90).
  const bondMax = emblem?.name === 'Alear' && pactRing?.partner === unit.id ? 21 : 20
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
                  {levels(1, bondMax).map((lv) => (
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
        <Estimate key={unit.id} data={data} unit={unit} plan={plan} defaultClass={finalCls.id} defaultLevel={lastLevel} />
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-neutral-200">Projected stats</h4>
          <StatTable
            rows={stages.map((st, i) => {
              const cls = data.classes[st.classId]
              return { label: label(st), values: shownStats(cls, unit, st.own), caps: capsOf(cls, unit), extra: i === stages.length - 1 ? sync : undefined }
            })}
          />
        </div>
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
      <Fe17PlanSets />
    </div>
  )
}
