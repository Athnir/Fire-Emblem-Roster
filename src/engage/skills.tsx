import { useState } from 'react'
import { useArmy, useScreenshotUnit, useUnitPlan } from './hooks'
import { inheritable, type Fe17Data } from './logic'
import { SkillIcon, UnitSelect } from './ui'

/** The skill slots inheriting fills (Unit.EquipSkillMax). */
const SLOTS = 2

/** The skills a unit inherits from the emblems: two slots, each skill from the bond level it opens at, for its SP. Saved per unit. */
export function Fe17SkillPlanner({ data }: { data: Fe17Data }) {
  const { units } = useArmy(data)
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const unit = units.find((u) => u.id === unitId) ?? units[0]
  useScreenshotUnit(unit)
  const { plan, update } = useUnitPlan(unit)
  const [emblemFilter, setEmblemFilter] = useState('')
  if (!unit || !plan) return null
  const chosen = plan.inherited ?? []
  const all = inheritable(data).filter((s) => !emblemFilter || s.emblem === emblemFilter)
  // A skill several emblems teach is listed once, with each way to it.
  const byName = new Map<string, { name: string; ways: string[]; sp: number }>()
  for (const s of all) {
    const had = byName.get(s.name)
    const way = `${s.emblem} bond ${s.level}`
    if (had) had.ways.push(way)
    else byName.set(s.name, { name: s.name, ways: [way], sp: s.sp })
  }
  const emblems = [...new Set(inheritable(data).map((s) => s.emblem))]
  const sp = chosen.reduce((sum, n) => sum + (inheritable(data).find((s) => s.name === n)?.sp ?? 0), 0)
  return (
    <div className="space-y-4">
      <UnitSelect data={data} units={units} value={unit.id} onChange={setUnitId} />
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <p className="text-xs text-neutral-500">
          Skills inherited from the emblems: two at a time, each once the bond with its emblem reaches the level shown (inheriting opens
          at bond 5), for its SP. {unit.name} starts with {unit.sp} SP; SP comes from EXP earned with an emblem ring on (half with a
          bond ring).
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-neutral-500">Equipped:</span>
          <span className={chosen.length > SLOTS ? 'text-red-400' : 'text-neutral-200'}>{chosen.length ? chosen.join(', ') : 'none'}</span>
          <span className="text-neutral-500">· {sp} SP</span>
        </div>
        <select value={emblemFilter} onChange={(e) => setEmblemFilter(e.target.value)} className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200">
          <option value="">Every emblem</option>
          {emblems.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {[...byName.values()].map((s) => {
            const on = chosen.includes(s.name)
            return (
              <button
                key={s.name}
                type="button"
                disabled={!on && chosen.length >= SLOTS}
                title={data.skills[s.name]}
                onClick={() => update({ inherited: on ? chosen.filter((x) => x !== s.name) : [...chosen, s.name] })}
                className={`flex min-w-[9rem] max-w-xs flex-col gap-0.5 rounded-md border px-2 py-1 text-left text-xs transition-colors disabled:opacity-40 ${
                  on ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <SkillIcon data={data} skill={s.name} size={18} />
                  <span>
                    {s.name} <span className="text-neutral-500">({s.sp} SP)</span>
                  </span>
                </span>
                <span className="text-[10px] leading-tight text-neutral-500">{s.ways.join(', ')}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
