import { useState } from 'react'
import { chip, plansWith, selectClass, useArmy, useScreenshotUnit, useUnitPlan } from './hooks'
import {
  CAP,
  classShown,
  growthsWith,
  HP_CAP,
  levelUps,
  manualClashes,
  MAX_LEVEL,
  onRoute,
  pathOf,
  project,
  SEAL_LEVEL,
  shownStats,
  skillsAt,
  type Fe5Data,
  type Fe5Plan,
  type ScrollStretch,
} from './logic'
import { useFe5Store } from './store'
import { FE5_STATS, FE5_STAT_LABELS, type Fe5Stats, type Fe5Unit } from './types'
import { SkillList, StatTable, UnitSelect, WeaponsLine } from './ui'

const CAPS = Object.fromEntries(FE5_STATS.map((s) => [s, s === 'hp' ? HP_CAP : CAP])) as Fe5Stats

const levelsFrom = (from: number) => Array.from({ length: Math.max(0, MAX_LEVEL - from + 1) }, (_, i) => from + i)

function bonusText(growths: Fe5Stats): string {
  return FE5_STATS.filter((s) => growths[s])
    .map((s) => `${FE5_STAT_LABELS[s]} ${growths[s] > 0 ? '+' : ''}${growths[s]}%`)
    .join(', ')
}

/** Stretches of level-ups, from when the unit joins, each with the holy scrolls carried through it (any number; they add up). */
function ScrollEditor({ data, unit, total, stretches, onChange }: { data: Fe5Data; unit: Fe5Unit; total: number; stretches: ScrollStretch[]; onChange: (s: ScrollStretch[]) => void }) {
  const used = stretches.reduce((sum, s) => sum + s.levels, 0)
  const remaining = total - used
  const update = (i: number, patch: Partial<ScrollStretch>) => onChange(stretches.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-neutral-200">
        Holy scrolls{' '}
        <span className={`text-xs font-normal ${used > total ? 'text-red-400' : 'text-neutral-500'}`}>
          {used} / {total} level-ups planned
        </span>
      </h4>
      <p className="text-xs text-neutral-500">
        Every scroll carried anywhere in the inventory adds to each level-up, and several add up; a growth that goes below 0 counts as 0
        ($83:DDCC, $83:DEE0). Stretches run in order from when the unit joins.
      </p>
      {stretches.map((st, i) => {
        const carried = st.scrollIds.flatMap((id) => data.scrolls.find((s) => s.id === id) ?? [])
        const growths = growthsWith(unit, carried)
        return (
          <div key={i} className="space-y-2 rounded-md border border-neutral-800 p-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-neutral-400">
                Level-ups
                <select value={st.levels} onChange={(e) => update(i, { levels: Number(e.target.value) })} className={selectClass}>
                  {Array.from({ length: Math.max(1, st.levels + Math.max(0, remaining)) }, (_, n) => n + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => onChange(stretches.filter((_, j) => j !== i))} className="ml-auto text-neutral-500 hover:text-red-400">
                Remove
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.scrolls.map((sc) => {
                const on = st.scrollIds.includes(sc.id)
                return (
                  <button
                    key={sc.id}
                    type="button"
                    title={bonusText(sc.growths)}
                    onClick={() => update(i, { scrollIds: on ? st.scrollIds.filter((x) => x !== sc.id) : [...st.scrollIds, sc.id] })}
                    className={chip(on)}
                  >
                    {sc.name.replace(/'s Scroll$/, '')}
                  </button>
                )
              })}
            </div>
            <div className="text-neutral-400">
              {carried.length ? `Growths with ${carried.map((c) => c.name).join(' and ')}: ${bonusText(growths)}` : 'No scroll in this stretch.'}
            </div>
          </div>
        )
      })}
      <button
        type="button"
        disabled={remaining <= 0}
        onClick={() => onChange([...stretches, { scrollIds: [], levels: remaining }])}
        className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-600 disabled:opacity-40"
      >
        + Add a stretch
      </button>
    </div>
  )
}

/** How many of each ring the unit uses; each raises its stat once, by a fixed amount, held at the caps ($87:BCBF). */
function RingEditor({ data, rings, onChange }: { data: Fe5Data; rings: Record<string, number>; onChange: (r: Record<string, number>) => void }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-neutral-200">Rings</h4>
      <p className="text-xs text-neutral-500">Each ring raises one stat once, by a fixed amount, held at the caps. They count at the end of the plan.</p>
      <div className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-3">
        {data.rings.map((ring) => (
          <label key={ring.id} className="flex items-center justify-between gap-2 rounded-md border border-neutral-800 px-2 py-1 text-neutral-300">
            <span>
              {ring.name} <span className="text-neutral-500">({FE5_STAT_LABELS[ring.stat]} +{ring.amount})</span>
            </span>
            <select
              value={rings[ring.id] ?? 0}
              onChange={(e) => {
                const next = { ...rings, [ring.id]: Number(e.target.value) }
                if (!next[ring.id]) delete next[ring.id]
                onChange(next)
              }}
              className={selectClass}
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  )
}

/** The skill manuals the unit uses, Mareeta's Astra, and a note when another plan uses the same manual (the game has one of each). */
function ManualEditor({
  data,
  unit,
  plan,
  others,
  picks,
  reached,
  onChange,
}: {
  data: Fe5Data
  unit: Fe5Unit
  plan: Fe5Plan
  others: Map<string, Fe5Unit[]>
  picks: Record<string, number>
  reached?: Set<string>
  onChange: (patch: Partial<Fe5Plan>) => void
}) {
  const chosen = plan.manuals ?? []
  // With the spoiler block on, a manual shows once its chapter is reached.
  const manuals = data.manuals.filter((m) => chosen.includes(m.id) || (onRoute(data, m.chapter, picks) && (!reached || reached.has(m.chapter))))
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-neutral-200">Skill manuals</h4>
      <p className="text-xs text-neutral-500">
        A manual teaches its skill for good, and is refused if the unit has the skill already ($87:BDAF). These eight are in the chapters,
        one copy each.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {manuals.map((m) => {
          const on = chosen.includes(m.id)
          const has = unit.skills.includes(m.skill)
          return (
            <button
              key={m.id}
              type="button"
              disabled={has && !on}
              title={has ? `${unit.name} has ${m.skill} already` : m.where}
              onClick={() => onChange({ manuals: on ? chosen.filter((x) => x !== m.id) : [...chosen, m.id] })}
              className={`${chip(on)} disabled:opacity-40`}
            >
              {m.skill}
            </button>
          )
        })}
      </div>
      {chosen.length > 0 && (
        <ul className="space-y-0.5 text-xs text-neutral-400">
          {chosen.flatMap((id) => data.manuals.filter((m) => m.id === id)).map((m) => (
            <li key={m.id}>
              {m.name}: {m.where}.
            </li>
          ))}
        </ul>
      )}
      {chosen.flatMap((id) => {
        const m = data.manuals.find((x) => x.id === id)
        const users = (others.get(id) ?? []).filter((u) => u.id !== unit.id)
        if (!m || users.length === 0) return []
        return [
          <p key={id} className="text-sm text-amber-400">
            The {m.name} is also in {users.map((u) => u.name).join(' and ')}'s plan. The game has one copy, so only one unit can use it; the
            planner keeps both plans anyway.
          </p>,
        ]
      })}
      {unit.storySkill && (
        <label className="flex items-start gap-2 text-sm text-neutral-300">
          <input type="checkbox" checked={!!plan.storySkill} onChange={(e) => onChange({ storySkill: e.target.checked })} className="mt-1" />
          <span>
            Learns {unit.storySkill.skill} <span className="text-neutral-500">({unit.storySkill.note})</span>
          </span>
        </label>
      )}
    </div>
  )
}

/** One unit's average stats through their class changes, with the scrolls, rings and manuals they use. Saved per unit. */
export function Fe5Planner({ data }: { data: Fe5Data }) {
  const { units, chapterOf, picks, reached } = useArmy(data)
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const unit = units.find((u) => u.id === unitId) ?? units[0]
  useScreenshotUnit(unit)
  const { plan, saved, update, reset } = useUnitPlan(unit)
  const allPlans = useFe5Store((s) => s.plans)
  const [onFoot, setOnFoot] = useState(false)
  if (!unit || !plan) return null
  const stages = project(data, unit, plan)
  const path = pathOf(unit, plan)
  const last = path[path.length - 1]
  const finalStage = stages[stages.length - 1]
  const canDismount = stages.some((st) => data.classes[st.classId].dismounted)
  const promo = unit.promotion ? data.classes[unit.promotion.classId] : undefined
  const step = unit.storyStep ? data.classes[unit.storyStep.classId] : undefined
  const fromBeforePromotion = unit.storyStep && plan.stepAt != null ? 1 : unit.level
  const promoteFrom = unit.promotion?.by === 'seal' ? Math.max(SEAL_LEVEL, fromBeforePromotion) : fromBeforePromotion
  const clashes = manualClashes(units, plansWith(allPlans))
  const label = (st: (typeof stages)[number], i: number) => {
    const cls = classShown(data, st.classId, onFoot)
    const how = st.how === 'joins' && i === 0 ? ' (joins)' : st.how === 'seal' ? ' (Master Seal)' : st.how === 'story' ? ' (story)' : st.how === 'rings' ? ' with rings' : ''
    return `${cls.name}${onFoot && cls.id !== st.classId ? ' on foot' : ''} Lv ${st.level}${how}`
  }
  return (
    <div className="space-y-4">
      <UnitSelect data={data} units={units} chapterOf={chapterOf} value={unit.id} onChange={setUnitId} />
      <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex flex-wrap items-end gap-4 text-sm text-neutral-300">
          {step && unit.storyStep && (
            <label className="space-y-1">
              <span className="block text-xs text-neutral-500">Becomes a {step.name}</span>
              <select value={plan.stepAt ?? ''} onChange={(e) => update({ stepAt: e.target.value === '' ? null : Number(e.target.value) })} className={selectClass}>
                <option value="">No</option>
                {levelsFrom(unit.level).map((lv) => (
                  <option key={lv} value={lv}>
                    At Lv {lv}
                  </option>
                ))}
              </select>
            </label>
          )}
          {promo && unit.promotion && (
            <label className="space-y-1">
              <span className="block text-xs text-neutral-500">{unit.promotion.by === 'seal' ? `Master Seal to ${promo.name}` : `Becomes a ${promo.name}`}</span>
              <select
                value={plan.promote ? Math.max(promoteFrom, Math.min(MAX_LEVEL, plan.promoteAt)) : ''}
                onChange={(e) => (e.target.value === '' ? update({ promote: false }) : update({ promote: true, promoteAt: Number(e.target.value) }))}
                className={selectClass}
              >
                <option value="">Don't promote</option>
                {levelsFrom(promoteFrom).map((lv) => (
                  <option key={lv} value={lv}>
                    At Lv {lv}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="space-y-1">
            <span className="block text-xs text-neutral-500">Up to Lv (as {data.classes[last.classId].name})</span>
            <select value={Math.max(last.from, Math.min(MAX_LEVEL, plan.targetLevel))} onChange={(e) => update({ targetLevel: Number(e.target.value) })} className={selectClass}>
              {levelsFrom(last.from).map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
          </label>
          {canDismount && (
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setOnFoot(false)} className={chip(!onFoot)}>
                Mounted
              </button>
              <button type="button" onClick={() => setOnFoot(true)} className={chip(onFoot)}>
                On foot (indoors)
              </button>
            </div>
          )}
          {saved && (
            <button type="button" onClick={reset} className="rounded-md bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700">
              Reset
            </button>
          )}
        </div>
        {unit.promotion?.note && <p className="text-xs text-neutral-500">{unit.promotion.note}</p>}
        {unit.storyStep && <p className="text-xs text-neutral-500">{unit.storyStep.note}</p>}
        <p className="text-xs text-neutral-500">
          Average stats: each level adds the growth. The game keeps every stat but HP apart from the class and shows the class's base plus
          it, held at 20 (HP at 80; green). So a class change moves the shown stats by the classes' bases and leaves HP where it was, and
          on foot indoors a mounted unit shows its dismounted class's bases. A class change starts again at Lv 1. The numbers are averages
          and can run a little off.
        </p>
        <StatTable
          rows={stages.map((st, i) => ({
            label: label(st, i),
            values: shownStats(classShown(data, st.classId, onFoot), st.own),
            caps: CAPS,
          }))}
        />
        <div className="space-y-1 text-sm text-neutral-300">
          <div>
            <span className="text-neutral-500">Weapons{onFoot ? ' on foot' : ''}: </span>
            <WeaponsLine cls={classShown(data, finalStage.classId, onFoot)} unit={unit} />
          </div>
          <p className="text-xs text-neutral-500">The points the unit joins with, plus the class's; each attack adds a point.</p>
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-neutral-200">Skills as a {classShown(data, finalStage.classId, onFoot).name}</h4>
          <SkillList data={data} skills={skillsAt(data, unit, classShown(data, finalStage.classId, onFoot).id, plan)} />
        </div>
        <ScrollEditor data={data} unit={unit} total={levelUps(unit, plan)} stretches={plan.scrolls ?? []} onChange={(scrolls) => update({ scrolls })} />
        <RingEditor data={data} rings={plan.rings ?? {}} onChange={(rings) => update({ rings })} />
        <ManualEditor data={data} unit={unit} plan={plan} others={clashes} picks={picks} reached={reached} onChange={update} />
      </div>
    </div>
  )
}
