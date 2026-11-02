import { useState } from 'react'
import { TelliusBuildSetManager } from './builds'
import { useArmy } from './choiceStore'
import { cannotAdd, capacityOf, capacityUsed, learnableSkills, maxLevelOf, planSegments, project, promotionsOf, skillCount } from './logic'
import { useTelliusPlanStore, useUnitPlan } from './planStore'
import { SkillIcon, UnitSelect, useScreenshotUnit } from './shared'
import type { TelliusData, TelliusUnit } from './types'

const selectClass = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200'

function SkillButton({
  data,
  id,
  selected,
  tag,
  reason,
  onToggle,
}: {
  data: TelliusData
  id: string
  selected: boolean
  tag?: string
  reason?: string
  onToggle?: () => void
}) {
  const skill = data.skills[id]
  if (!skill) return null
  const disabled = !onToggle || (!selected && Boolean(reason))
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={reason}
      className={`flex min-w-[10rem] max-w-xs flex-col gap-0.5 rounded-md border px-2 py-1 text-left text-xs transition-colors ${
        selected
          ? 'border-violet-500 bg-violet-950/50 text-violet-200'
          : disabled
            ? 'border-neutral-800 bg-neutral-900 text-neutral-500'
            : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
      }`}
    >
      <span className="flex items-center gap-1.5">
        <SkillIcon data={data} skillId={id} size={18} />
        <span className="min-w-0 break-words">
          {skill.name}
          {tag ? <span className="text-neutral-500"> ({tag})</span> : null}
        </span>
        <span className="ml-auto shrink-0 text-neutral-500">{skill.capacity}</span>
      </span>
      {skill.description && <span className="text-[10px] leading-tight text-neutral-400">{skill.description}</span>}
      {reason && !selected && <span className="text-[10px] leading-tight text-amber-400">{reason}</span>}
    </button>
  )
}

function SkillPlannerFor({ data, unit, onShowUnit }: { data: TelliusData; unit: TelliusUnit; onShowUnit: (id: string) => void }) {
  const { plan, update } = useUnitPlan(data, unit)
  const segments = planSegments(data, unit, plan)
  const stages = project(data, unit, plan)
  const finalId = segments[segments.length - 1].classId
  const chain = [unit.classId, ...promotionsOf(data, unit).map((c) => c.id)]
  const [picked, setPicked] = useState<string | null>(null)
  const classId = picked && chain.includes(picked) ? picked : finalId
  const cls = data.classes[classId]
  // A laguz's capacity grows with their level (Radiant Dawn): the plan's level, or one picked.
  const planLevel = classId === finalId ? stages[stages.length - 1].level : maxLevelOf(data, classId)
  const [levelPick, setLevelPick] = useState<number | null>(null)
  const level = levelPick ?? planLevel
  const [search, setSearch] = useState('')

  const carried = plan.skills
  const capacity = capacityOf(data, classId, level)
  const used = capacityUsed(data, unit, classId, carried)
  const count = skillCount(data, classId, carried)
  const limit = data.rules.maxSkills
  const mastery = cls.mastery && data.skills[cls.mastery] ? cls.mastery : undefined
  const order = Object.keys(data.skills)
  const pool = [...new Set([...learnableSkills(data, unit, classId, carried), ...carried, ...unit.skills, ...(mastery ? [mastery] : [])])]
    .filter((id) => data.skills[id] && !cls.skills.includes(id))
    .filter((id) => data.skills[id].name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
  const removable = (id: string) => data.skills[id]?.removable || id === mastery || unit.skills.includes(id)
  const toggle = (id: string) => update({ skills: carried.includes(id) ? carried.filter((s) => s !== id) : [...carried, id] })
  const tagOf = (id: string) => (unit.skills.includes(id) ? 'their own' : id === mastery ? 'mastery' : undefined)
  const pct = capacity ? Math.min(100, Math.round((used / capacity) * 100)) : 0

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="text-base font-semibold text-neutral-100">Skill Planner</h3>
        {unit.skills.length > 0 && (
          <div className="text-sm text-neutral-300">
            <span className="text-neutral-500">Joins with: </span>
            {unit.skills.map((id) => data.skills[id]?.name).filter(Boolean).join(', ')}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="mb-1.5 text-xs text-neutral-500">Plan the skills in</div>
            <div className="flex flex-wrap gap-2">
              {chain.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setPicked(id)
                    setLevelPick(null)
                  }}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    id === classId ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
                  }`}
                >
                  {data.classes[id]?.name}
                  {id === finalId ? ' (the plan’s)' : ''}
                </button>
              ))}
            </div>
          </div>
          {cls.laguz && data.rules.laguzCapacity && (
            <label className="space-y-1">
              <span className="block text-xs text-neutral-500">At Lv</span>
              <select value={level} onChange={(e) => setLevelPick(Number(e.target.value))} className={selectClass}>
                {Array.from({ length: maxLevelOf(data, classId) }, (_, i) => i + 1)
                  .filter((lv) => classId !== unit.classId || lv >= unit.level)
                  .map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <span className={used > capacity ? 'text-red-400' : 'text-neutral-300'}>
              Capacity {used} / {capacity}
            </span>
            <span className={count > limit.count ? 'text-red-400' : 'text-neutral-400'}>
              {count} / {limit.count} skills{limit.withClassSkills ? ', the class’s included' : ' besides the class’s'}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
            <div className={`h-full ${used > capacity ? 'bg-red-500' : 'bg-violet-500'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {cls.skills.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">{cls.name}'s own skills</h4>
            <div className="flex flex-wrap gap-2">
              {cls.skills.map((id) => (
                <SkillButton key={id} data={data} id={id} selected={false} tag={data.rules.capacity === 'allButOwn' ? 'class, takes capacity' : 'class'} />
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">Carried ({carried.length})</h4>
          {carried.length === 0 ? (
            <p className="text-sm text-neutral-500">No skills yet: tap one in the pool below.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {carried.map((id) => (
                <SkillButton
                  key={id}
                  data={data}
                  id={id}
                  selected
                  tag={tagOf(id)}
                  onToggle={removable(id) ? () => toggle(id) : undefined}
                  reason={removable(id) ? undefined : "can't be removed"}
                />
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          {limit.withClassSkills
            ? "Radiant Dawn: at most six skills, the class's included, and every skill takes capacity but those the unit joins with, the class's own too (0x802279c4, 0x8011b8a4). A laguz's capacity grows by 15 from Lv 15 and by 50 from Lv 30 (0x80127a90)."
            : "Path of Radiance: at most five skills besides the class's own, and every skill but the class's takes capacity, the unit's own included (0x801be92c, 0x8017c3c8). Smite needs Shove, which every class without Canto has. A removed skill is gone for good."}{' '}
          The Unit Planner uses the same skills.
        </p>
      </div>

      <div data-export-hide>
        <TelliusBuildSetManager
          data={data}
          unit={unit}
          plan={plan}
          onLoadEntry={(entry) => {
            useTelliusPlanStore.getState().setPlan(data.gameId, entry.unitId, entry.plan)
            onShowUnit(entry.unitId)
          }}
        />
      </div>

      <div data-export-hide className="space-y-3 rounded-lg border border-dashed border-neutral-800 bg-neutral-900/90 p-4">
        <h3 className="text-base font-semibold text-neutral-100">Skill Pool (every skill {unit.name} can learn as a {cls.name})</h3>
        <p className="text-xs text-neutral-500">
          The scrolls the game names whose rules {unit.name} meets in this class, the class's mastery skill, and the skills they join
          with. A skill that doesn't fit says why.
        </p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills…"
          className="w-full max-w-sm rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200 placeholder:text-neutral-500"
        />
        <div className="flex flex-wrap gap-2">
          {pool.map((id) => {
            const on = carried.includes(id)
            return (
              <SkillButton
                key={id}
                data={data}
                id={id}
                selected={on}
                tag={tagOf(id)}
                reason={on ? undefined : cannotAdd(data, unit, classId, level, carried, id)}
                onToggle={on && !removable(id) ? undefined : () => toggle(id)}
              />
            )
          })}
          {pool.length === 0 && <p className="text-sm text-neutral-500">Nothing to learn here.</p>}
        </div>
      </div>
    </div>
  )
}

/** As Fates' Skill Planner, for Path of Radiance's and Radiant Dawn's capacity: the class's skills, what's carried, and every
 * skill the unit can learn, each saying whether it fits. Edits the same plan as the Unit Planner. */
export function TelliusSkillPlanner({ data }: { data: TelliusData }) {
  const army = useArmy(data)
  const [unitId, setUnitId] = useState(army[0]?.id ?? '')
  const unit = army.find((u) => u.id === unitId) ?? army[0]
  useScreenshotUnit(unit)
  return (
    <div className="space-y-4">
      <UnitSelect data={data} value={unit?.id ?? ''} onChange={setUnitId} />
      {unit && <SkillPlannerFor key={unit.id} data={data} unit={unit} onShowUnit={setUnitId} />}
    </div>
  )
}
