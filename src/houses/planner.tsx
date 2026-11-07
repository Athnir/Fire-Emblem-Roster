import { useState } from 'react'
import { ClassSegments, type Segment, type SegmentRow } from '../components/ClassSegments'
import { chip, selectClass, useArmy, useScreenshotUnit, useUnitPlan } from './hooks'
import { canTake, CLASS_TIERS, classesFor, labelOf, learnsOf, rankIndex, type Fe16Data, type Fe16Picks } from './logic'
import {
  capsOf,
  canChange,
  certifiedBy,
  estimate,
  growthsIn,
  isMounted,
  joinOptions,
  legalSteps,
  MAX_LEVEL,
  pathTo,
  project,
  ranksNeeded,
  shownStats,
  startOf,
  type Fe16Plan,
  type Fe16Stage,
} from './plan'
import { useFe16Store } from './store'
import { FE16_SKILL_LABELS, FE16_STATS, type Fe16Class, type Fe16Skill, type Fe16Stats, type Fe16Unit } from './types'
import { Fe16PlanSets, SkillChips, SkillRanks, StatTable, UnitSelect } from './ui'

const TIERS = ['Starting', 'Beginner', 'Intermediate', 'Advanced', 'Master', 'DLC', 'Unique'] as const

/** A class's name as the unit sees it, and what its exam asks for. */
function examText(cls: Fe16Class): string {
  if (cls.given) return cls.given
  const ranks = Object.entries(cls.exam?.ranks ?? {}).map(([sk, r]) => `${FE16_SKILL_LABELS[sk as Fe16Skill]} ${r}`)
  return `${cls.exam?.seal ?? 'No seal'}, from Lv ${cls.level}${ranks.length ? `; the exam asks for ${ranks.join(', ')}` : ''}.`
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
  const caps = capsOf(unit)
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
  const lastLevel = steps.length ? steps[steps.length - 1].at : start.level
  // The plan as Fates' segments: the class they join in, then each change's class, with the levels spent in each (the steps' levels
  // apart). Saved as the steps, as before.
  const segEnd = Math.max(lastLevel, Math.min(MAX_LEVEL, plan.targetLevel))
  const bounds = [start.level, ...plan.steps.map((st) => st.at), Math.max(plan.steps.at(-1)?.at ?? start.level, Math.min(MAX_LEVEL, plan.targetLevel))]
  const segments: Segment[] = [start.classId, ...plan.steps.map((st) => st.to)].map((classId, k) => ({ classId, levels: Math.max(0, bounds[k + 1] - bounds[k]) }))
  const setSegments = (next: Segment[]) => {
    let level = start.level
    const out: { at: number; to: string }[] = []
    next.forEach((sg, k) => {
      if (k > 0) out.push({ at: level, to: sg.classId })
      level = Math.min(MAX_LEVEL, level + sg.levels)
    })
    update({ steps: out, targetLevel: level })
  }
  const segRows: SegmentRow[] = segments.map((sg, k) => {
    const from = bounds[k]
    const had = certifiedBy(unit, start.classId, plan.steps.slice(0, Math.max(0, k - 1)))
    const cls = data.classes[sg.classId]
    const blocked = k > steps.length
    return {
      ...sg,
      name: cls?.name ?? sg.classId,
      from,
      to: from + sg.levels,
      max: sg.levels + (MAX_LEVEL - bounds[bounds.length - 1]),
      options:
        k === 0
          ? undefined
          : [...classesFor(data, unit)]
              .sort((a, b) => TIERS.indexOf(a.tier as (typeof TIERS)[number]) - TIERS.indexOf(b.tier as (typeof TIERS)[number]))
              .map((c) => ({
              id: c.id,
              label: c.name,
              group: c.tier === 'Starting' || c.tier === 'Unique' ? c.tier : `${c.tier} (Lv ${c.level})`,
              disabled: !canChange(unit, c, from, had),
            })),
      note: k === 0 ? (start.join ? 'The class they join in.' : undefined) : blocked ? `The game doesn't allow this change at Lv ${from}; it and the classes after it aren't counted.` : cls ? examText(cls) : undefined,
      blocked,
    }
  })
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
          <h4 className="text-sm font-semibold text-neutral-200">Classes</h4>
          {/* As Fates' (user, 2026-11-07): each class with the levels spent in it; the level carries on through a change, as the game's. */}
          <ClassSegments
            rows={segRows}
            summary={`Lv ${start.level} to ${segEnd}: ${segEnd - start.level} of ${MAX_LEVEL - start.level} levels planned`}
            onClass={(i, id) => setSegments(segments.map((sg, j) => (j === i ? { ...sg, classId: id } : sg)))}
            onLevels={(i, n) => setSegments(segments.map((sg, j) => (j === i ? { ...sg, levels: n } : sg)))}
            onRemove={(i) => setSegments(segments.filter((_, j) => j !== i))}
            onAdd={() => {
              const had = certifiedBy(unit, start.classId, steps)
              const next = classesFor(data, unit).find((c) => c.id !== last.classId && canChange(unit, c, segEnd, had) && canTake(c, unit))
              if (next) setSegments([...segments, { classId: next.id, levels: segEnd < MAX_LEVEL ? 1 : 0 }])
            }}
            canAdd={segments.length - 1 === steps.length && segEnd < MAX_LEVEL}
          />
        </div>
        {isDancer && dancers.length > 0 && (
          <p className="text-sm text-amber-400">
            {dancers.map(([id]) => labelOf(data.units.find((u) => u.id === id)!)).join(' and ')}'s plan is a Dancer too. Only the White Heron
            Cup's winner is certified, one unit a playthrough; the planner keeps both plans anyway.
          </p>
        )}
        <p className="text-xs text-neutral-500">
          Average stats. Each level rolls the unit's growth plus the class's (Cyril's Aptitude adds 20); most units get at least two
          points a level (the staff and knights don't). Maximums are the unit's own; the class's boosts (and a mount's) show on top and
          can go past them. Changing into a class, or passing its exam, lifts any stat below the class's base to it for good. The numbers
          are averages and can run a little off.
        </p>
        {/* As Fates' Unit Planner: their own growths, bases and maximums first. */}
        <StatTable
          rows={[
            { label: 'Growths (their own; a class adds its own)', values: unit.growths, suffix: '%' },
            { label: 'Bases (Lv 1)', values: unit.bases, mov: true },
            { label: 'Maximums (their own; classes have none)', values: caps },
          ]}
        />
        <Estimate key={unit.id} data={data} unit={unit} plan={plan} picks={picks} caps={caps} onFoot={onFoot} defaultClass={finalCls.id} defaultLevel={last.level} />
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-neutral-200">Projected stats</h4>
          <StatTable rows={stages.map(row)} />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-neutral-200">Skill levels as they join</h4>
          <SkillRanks data={data} unit={unit} />
        </div>
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
              <span className="text-neutral-200">
                <SkillChips data={data} skills={finalCls.abilities} />
              </span>
            </div>
          )}
          {finalCls.mastery.length > 0 && (
            <div>
              <span className="text-neutral-500">Mastering it teaches: </span>
              <span className="text-neutral-200">
                <SkillChips data={data} skills={finalCls.mastery} />
              </span>
            </div>
          )}
        </div>
      </div>
      <Fe16PlanSets />
    </div>
  )
}

/** As Fates' Projected Stats: the rough stats to expect in any class the unit can be in, at any level, by the shortest way there
 * (pathTo), with that class's growths and the unit's maximums. Not saved: it doesn't change the plan. */
function Estimate({
  data,
  unit,
  plan,
  picks,
  caps,
  onFoot,
  defaultClass,
  defaultLevel,
}: {
  data: Fe16Data
  unit: Fe16Unit
  plan: Fe16Plan
  picks: Fe16Picks
  caps: Fe16Stats
  onFoot: boolean
  defaultClass: string
  defaultLevel: number
}) {
  const [classId, setClassId] = useState(defaultClass)
  const [wanted, setWanted] = useState(defaultLevel)
  const start = startOf(data, unit, plan, picks)
  const options = classesFor(data, unit).filter((c) => c.id === start.classId || canTake(c, unit))
  const cls = data.classes[classId] ?? data.classes[start.classId]
  const steps = pathTo(data, unit, start, cls.id)
  const arrival = steps.length ? steps[steps.length - 1].at : start.level
  const level = Math.min(MAX_LEVEL, Math.max(arrival, wanted))
  const stages = estimate(data, unit, plan, picks, cls.id, level)
  const last = stages[stages.length - 1]
  const shown = shownStats(cls, last.own, !onFoot)
  const shownCaps = {} as Fe16Stats
  for (const s of FE16_STATS) shownCaps[s] = caps[s] + (shown[s] - last.own[s])
  const way = [`${data.classes[start.classId].name} Lv ${start.level}`, ...steps.map((st) => `Lv ${st.at}, then ${data.classes[st.to].name}`)].join(' to ')
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-neutral-200">Estimated stats</h4>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-500">As a</span>
        <select value={cls.id} onChange={(e) => setClassId(e.target.value)} className={selectClass}>
          {CLASS_TIERS.filter((t) => options.some((c) => c.tier === t)).map((t) => (
            <optgroup key={t} label={t}>
              {options
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
          {Array.from({ length: MAX_LEVEL - arrival + 1 }, (_, i) => arrival + i).map((lv) => (
            <option key={lv} value={lv}>
              {lv}
            </option>
          ))}
        </select>
      </div>
      <StatTable
        rows={[
          { label: `Growths as a ${cls.name}`, values: growthsIn(unit, cls), suffix: '%' },
          { label: `${cls.name} Lv ${last.level} (rough)`, values: shown, caps: shownCaps, mov: true },
        ]}
      />
      <p className="text-xs text-neutral-500">
        The way there: {way}{steps.length ? ', each exam passed' : ' (the class they join in)'}. Averages, as the plan below works them out.
      </p>
    </div>
  )
}

const fmtLevel = (lv: number) => String(lv)
