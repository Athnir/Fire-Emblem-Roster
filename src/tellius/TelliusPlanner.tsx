import { useState } from 'react'
import { BandEditor } from './BandEditor'
import {
  capacityUsed,
  learnableSkills,
  MASTER_SEAL_LEVEL,
  maxLevelOf,
  planSegments,
  project,
  promotionsOf,
  transformedStats,
  type GrowthMode,
} from './logic'
import { useTelliusPlanStore, type TelliusUnitPlan } from './planStore'
import { chapterLabel, SkillIcon, StatTable, UnitSelect, useScreenshotUnit } from './shared'
import type { TelliusData, TelliusUnit } from './types'

function defaultPlan(data: TelliusData, unit: TelliusUnit): TelliusUnitPlan {
  const chain = promotionsOf(data, unit)
  const last = chain[chain.length - 1]?.id ?? unit.classId
  return {
    promoteAt: chain[0] ? maxLevelOf(data, unit.classId) : null,
    promoteAt2: chain[1] ? maxLevelOf(data, chain[0].id) : null,
    targetLevel: maxLevelOf(data, last),
    skills: [...unit.skills],
  }
}

const selectClass = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200'

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)
}

function Planner({ data, unit }: { data: TelliusData; unit: TelliusUnit }) {
  const saved = useTelliusPlanStore((state) => state.plans[data.gameId]?.[unit.id])
  const setPlan = useTelliusPlanStore((state) => state.setPlan)
  const clearPlan = useTelliusPlanStore((state) => state.clearPlan)
  const plan = saved ?? defaultPlan(data, unit)
  const update = (patch: Partial<TelliusUnitPlan>) => setPlan(data.gameId, unit.id, { ...plan, ...patch })

  const chain = promotionsOf(data, unit)
  const segments = planSegments(data, unit, plan)
  const fixed = Boolean(data.fixedMode && plan.mode === 'fixed' && unit.fixedStart)
  const stages = project(data, unit, plan)
  const final = stages[stages.length - 1]
  const finalClass = data.classes[final.classId]
  const startClass = data.classes[unit.classId]
  const promoted = segments.length > 1
  const targetLevels = range(promoted ? 1 : unit.level, maxLevelOf(data, finalClass.id))
  const transformed = transformedStats(data, final.classId, final.stats)

  // One select per promotion: each is offered once the one before it is planned.
  const promotionAt = [plan.promoteAt, plan.promoteAt2 ?? null]
  const promotionSelects = chain.map((to, i) => {
    const from = i === 0 ? startClass : chain[i - 1]
    if (i > 0 && promotionAt[i - 1] === null) return null
    const firstLevel = i === 0 ? unit.level : 1
    // A class the story promotes can't use a Seal or Crown: any level the unit might be at when the story does it.
    const min = from.storyPromotion ? firstLevel : Math.max(MASTER_SEAL_LEVEL, firstLevel)
    const levels = range(min, maxLevelOf(data, from.id))
    const value = promotionAt[i]
    // A new promotion plan aims for the top level of whatever class it ends in.
    const change = (v: number | null) => {
      const next = i === 0 ? { ...plan, promoteAt: v, ...(v === null ? { promoteAt2: null } : {}) } : { ...plan, promoteAt2: v }
      const ends = planSegments(data, unit, next)
      update({ ...next, targetLevel: maxLevelOf(data, ends[ends.length - 1].classId) })
    }
    return (
      <label key={to.id} className="space-y-1">
        <span className="block text-xs text-neutral-500">Promote to {to.name}</span>
        <select value={value ?? ''} onChange={(e) => change(e.target.value === '' ? null : Number(e.target.value))} className={selectClass}>
          <option value="">Don't promote</option>
          {levels.map((lv) => (
            <option key={lv} value={lv}>
              At {from.name} Lv {lv}
            </option>
          ))}
        </select>
      </label>
    )
  })

  const used = capacityUsed(data, plan.skills)
  const mastery = finalClass.mastery
  const options = [
    ...learnableSkills(data, unit, finalClass.id, plan.skills),
    ...(mastery && data.skills[mastery] ? [mastery] : []),
  ].filter((id) => !plan.skills.includes(id))
  const [adding, setAdding] = useState('')
  const gainsNote = Object.values(data.classes).some((c) => c.gains)
    ? " Promoting adds the new class's promotion gains and starts again at Lv 1."
    : " Promoting adds the difference between the two classes' bases and starts again at Lv 1."

  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-wrap items-end gap-4 text-sm text-neutral-300">
        {promotionSelects}
        {data.fixedMode && unit.fixedStart && (
          <label className="space-y-1">
            <span className="block text-xs text-neutral-500">Growths</span>
            <select value={plan.mode ?? 'random'} onChange={(e) => update({ mode: e.target.value as GrowthMode })} className={selectClass}>
              <option value="random">Random (average)</option>
              <option value="fixed">Fixed</option>
            </select>
          </label>
        )}
        <label className="space-y-1">
          <span className="block text-xs text-neutral-500">Up to Lv (as {finalClass.name})</span>
          <select value={final.level} onChange={(e) => update({ targetLevel: Number(e.target.value) })} className={selectClass}>
            {targetLevels.map((lv) => (
              <option key={lv} value={lv}>
                {lv}
              </option>
            ))}
          </select>
        </label>
        {saved && (
          <button type="button" onClick={() => clearPlan(data.gameId, unit.id)} className="rounded-md bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700">
            Reset
          </button>
        )}
      </div>

      {unit.storyPromotions && (
        <p className="text-xs text-neutral-400">
          Promoted by the story, not a Seal or Crown:{' '}
          {unit.storyPromotions.map((p) => `${p.when === 'end' ? 'at the end of' : 'at the start of'} ${chapterLabel(data, p.chapter)}`).join(', then ')}.
          Whatever level they've reached then.
        </p>
      )}

      <p className="text-xs text-neutral-500">
        {fixed
          ? "Fixed mode: each stat has growth points, starting from the unit's own; a level's worth of EXP adds the growth rate (up to 255 points), and every 100 points is +1 at the level-up. Weapons and the class of what was defeated shift the points a little; they aren't counted here. From Serenes Forest; not yet checked in the game's code."
          : 'Average stats: each level adds the growth rate.'}{' '}
        Stats stop at the class's caps (green).
        {chain.length > 0 && gainsNote}
      </p>
      <StatTable
        rows={[
          ...stages.map((st, i) => ({
            label: `${data.classes[st.classId].name} Lv ${st.level}${i === 0 ? ' (joins)' : ''}`,
            values: st.stats,
            caps: st.caps,
          })),
          ...(transformed
            ? [{ label: `Transformed (${data.classes[transformed.classId].name})`, values: transformed.stats, caps: data.classes[transformed.classId].caps }]
            : []),
          ...(fixed && final.points ? [{ label: 'Growth points left', values: final.points }] : []),
        ]}
      />
      {transformed && (
        <p className="text-xs text-neutral-500">
          Transformed: every stat but HP and Luck doubled, up to the transformed caps. That's the usual account of how laguz work;
          it isn't checked in the game's code yet.
        </p>
      )}
      <div className="flex flex-wrap gap-x-6 text-sm text-neutral-300">
        <span>
          <span className="text-neutral-500">Mov </span>
          {startClass.mov}
          {final.mov !== startClass.mov && ` → ${final.mov}`}
        </span>
        <span>
          <span className="text-neutral-500">Con </span>
          {unit.con}
          {final.con !== unit.con && ` → ${final.con}`}
        </span>
      </div>

      <BandEditor data={data} unit={unit} plan={plan} onChange={(bands) => update({ bands })} />

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-neutral-200">
          Skills{' '}
          <span className={`text-xs font-normal ${used > finalClass.capacity ? 'text-red-400' : 'text-neutral-500'}`}>
            Capacity {used} / {finalClass.capacity} ({finalClass.name})
          </span>
        </h4>
        {finalClass.skills.length > 0 && (
          <p className="text-xs text-neutral-500">
            {finalClass.name} skills: {finalClass.skills.map((id) => data.skills[id]?.name).filter(Boolean).join(', ')}
          </p>
        )}
        {mastery && data.skills[mastery] && (
          <p className="text-xs text-neutral-500">
            Mastery skill: {data.skills[mastery].name}, learned with a Satori Sign ({data.skills[mastery].capacity} capacity).
          </p>
        )}
        {plan.skills.map((id) => {
          const skill = data.skills[id]
          if (!skill) return null
          return (
            <div key={id} className="flex items-center gap-2 text-sm">
              <SkillIcon data={data} skillId={id} />
              <span className="text-neutral-200">{skill.name}</span>
              <span className="text-xs text-neutral-500">{skill.capacity}</span>
              {(skill.removable || id === mastery) && (
                <button type="button" onClick={() => update({ skills: plan.skills.filter((s) => s !== id) })} className="ml-auto text-xs text-neutral-500 hover:text-red-400">
                  Remove
                </button>
              )}
            </div>
          )
        })}
        {options.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select value={adding} onChange={(e) => setAdding(e.target.value)} className={selectClass}>
              <option value="">Add a skill…</option>
              {options.map((id) => (
                <option key={id} value={id}>
                  {data.skills[id].name} ({data.skills[id].capacity}){id === mastery ? ', mastery' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!adding}
              onClick={() => {
                update({ skills: [...plan.skills, adding] })
                setAdding('')
              }}
              className="rounded-md bg-violet-600 px-3 py-1 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        )}
        {adding && <p className="text-xs text-neutral-400">{data.skills[adding]?.description}</p>}
      </div>
    </div>
  )
}

/** One unit's stats through their promotions, and the skills they carry within their class's capacity. Saved per unit. */
export function TelliusPlanner({ data }: { data: TelliusData }) {
  const [unitId, setUnitId] = useState(data.units[0]?.id ?? '')
  const unit = data.units.find((u) => u.id === unitId)
  useScreenshotUnit(unit)
  return (
    <div className="space-y-4">
      <UnitSelect data={data} value={unitId} onChange={setUnitId} />
      {unit && <Planner key={unit.id} data={data} unit={unit} />}
    </div>
  )
}
