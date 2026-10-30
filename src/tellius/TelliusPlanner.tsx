import { useState } from 'react'
import { capacityUsed, learnableSkills, MASTER_SEAL_LEVEL, project, promotionOf } from './logic'
import { useTelliusPlanStore, type TelliusUnitPlan } from './planStore'
import { SkillIcon, StatTable, UnitSelect, useScreenshotUnit } from './shared'
import type { TelliusData, TelliusUnit } from './types'

function defaultPlan(data: TelliusData, unit: TelliusUnit): TelliusUnitPlan {
  return { promoteAt: promotionOf(data, unit) ? data.maxLevel : null, targetLevel: data.maxLevel, skills: [...unit.skills] }
}

const selectClass = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200'

function Planner({ data, unit }: { data: TelliusData; unit: TelliusUnit }) {
  const saved = useTelliusPlanStore((state) => state.plans[data.gameId]?.[unit.id])
  const setPlan = useTelliusPlanStore((state) => state.setPlan)
  const clearPlan = useTelliusPlanStore((state) => state.clearPlan)
  const plan = saved ?? defaultPlan(data, unit)
  const update = (patch: Partial<TelliusUnitPlan>) => setPlan(data.gameId, unit.id, { ...plan, ...patch })

  const promoted = promotionOf(data, unit)
  const stages = project(data, unit, plan)
  const final = stages[stages.length - 1]
  const finalClass = data.classes[final.classId]
  const startClass = data.classes[unit.classId]
  const minPromote = Math.max(MASTER_SEAL_LEVEL, unit.level)
  const promoteLevels = Array.from({ length: Math.max(0, data.maxLevel - minPromote + 1) }, (_, i) => minPromote + i)
  const firstTarget = promoted && plan.promoteAt !== null ? 1 : unit.level
  const targetLevels = Array.from({ length: data.maxLevel - firstTarget + 1 }, (_, i) => firstTarget + i)

  const used = capacityUsed(data, plan.skills)
  const options = learnableSkills(data, unit, finalClass.id).filter((id) => !plan.skills.includes(id))
  const [adding, setAdding] = useState('')

  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-wrap items-end gap-4 text-sm text-neutral-300">
        {promoted && (
          <label className="space-y-1">
            <span className="block text-xs text-neutral-500">Promote to {promoted.name}</span>
            <select
              value={plan.promoteAt ?? ''}
              onChange={(e) => update({ promoteAt: e.target.value === '' ? null : Number(e.target.value), targetLevel: data.maxLevel })}
              className={selectClass}
            >
              <option value="">Don't promote</option>
              {promoteLevels.map((lv) => (
                <option key={lv} value={lv}>
                  At Lv {lv}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="space-y-1">
          <span className="block text-xs text-neutral-500">Up to Lv (as {finalClass.name})</span>
          <select value={plan.targetLevel} onChange={(e) => update({ targetLevel: Number(e.target.value) })} className={selectClass}>
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

      <p className="text-xs text-neutral-500">
        Average stats: each level adds the growth rate, held at the class's caps (green).
        {promoted && ' Promoting adds the difference between the two classes\' bases and starts again at Lv 1.'}
      </p>
      <StatTable
        rows={stages.map((st, i) => ({
          label: `${data.classes[st.classId].name} Lv ${st.level}${i === 0 ? ' (joins)' : ''}`,
          values: st.stats,
          caps: st.caps,
        }))}
      />
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
        {plan.skills.map((id) => {
          const skill = data.skills[id]
          if (!skill) return null
          return (
            <div key={id} className="flex items-center gap-2 text-sm">
              <SkillIcon data={data} skillId={id} />
              <span className="text-neutral-200">{skill.name}</span>
              <span className="text-xs text-neutral-500">{skill.capacity}</span>
              {skill.removable && (
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
                  {data.skills[id].name} ({data.skills[id].capacity})
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

/** One unit's stats through promotion, and the skills they carry within their class's capacity. Saved per unit. */
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
