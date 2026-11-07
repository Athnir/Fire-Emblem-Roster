import { useState } from 'react'
import { isPlanned } from '../logic/planned'
import { armyWith, plansWith, selectClass, useSpoiler } from './hooks'
import { labelOf, type Fe16Data } from './logic'
import { capsOf, defaultPlan, growthsIn, project, shownStats } from './plan'
import { useFe16Builds, useFe16Store } from './store'
import { Fe16PlanSets, SkillChips, StatGrid, UnitPortrait } from './ui'

/** As Fates' Team Viewer: the plans and picks, now or in a saved set, with every unit's final class, stats, growths, maximums,
 * abilities and combat arts at once: a table on a wide screen, a card each on a phone; and the saved sets themselves. */
export function Fe16BulkViewer({ data }: { data: Fe16Data }) {
  const current = { plans: useFe16Store((s) => s.plans), picks: useFe16Store((s) => s.picks) }
  const sets = useFe16Builds((s) => s.sets)
  const { chapter } = useSpoiler(data)
  const [source, setSource] = useState('current')
  const set = sets.find((s) => s.id === source)
  const { plans, picks } = set ?? current
  const planOf = plansWith(plans)
  // Only the units with a plan, as Fates' Team Viewer shows only the units in its sets (user, 2026-11-05).
  const rows = armyWith(data, picks, chapter)
    .filter((u) => isPlanned(plans[u.id], defaultPlan(u)))
    .map((u) => {
    const plan = planOf(u)
    const stages = project(data, u, plan, picks)
    const final = stages[stages.length - 1]
    const cls = data.classes[final.classId]
    return {
      unit: u,
      cls,
      level: final.level,
      stats: shownStats(cls, final.own),
      growths: growthsIn(u, cls),
      caps: capsOf(u),
      skills: [...(plan.abilities ?? []), ...(plan.arts ?? [])],
    }
  })
  const skills = (r: (typeof rows)[number]) => (r.skills.length ? <SkillChips data={data} skills={r.skills} size={14} /> : null)
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="text-base font-semibold text-neutral-100">Team Viewer</h3>
        <p className="text-xs text-neutral-500">
          Everyone's final class and level, their stats then, their growths in that class and their own maximums, and their abilities
          and combat arts, under the current plans and picks or a saved set.
        </p>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Show
          <select value={source} onChange={(e) => setSource(e.target.value)} className={`${selectClass} max-w-xs`}>
            <option value="current">The current plans and picks</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {rows.length === 0 && <p className="text-sm text-neutral-500">No plans yet: a unit shows here once it has a plan (change anything for them in the Unit or Skill Planner), as in Fates' Team Viewer.</p>}
      <div data-export-table className="hidden overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900 sm:block">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Skills</th>
              <th className="px-3 py-2">Stats</th>
              <th className="px-3 py-2">Growth %</th>
              <th className="px-3 py-2">Max Stats</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.unit.id} className="border-b border-neutral-800 align-top last:border-0">
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2 whitespace-nowrap text-neutral-200">
                    <UnitPortrait data={data} unit={r.unit} size={28} />
                    {labelOf(r.unit)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-300">
                  {r.cls.name} Lv {r.level}
                </td>
                <td className="px-3 py-2 text-xs text-neutral-400">{skills(r)}</td>
                <td className="px-3 py-2">
                  <StatGrid values={r.stats} />
                </td>
                <td className="px-3 py-2">
                  <StatGrid values={r.growths} suffix="%" />
                </td>
                <td className="px-3 py-2">
                  <StatGrid values={r.caps} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div data-export-cards className="space-y-3 sm:hidden">
        {rows.map((r) => (
          <div key={r.unit.id} className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm">
            <div className="flex items-center gap-2">
              <UnitPortrait data={data} unit={r.unit} size={28} />
              <span className="font-medium text-neutral-200">{labelOf(r.unit)}</span>
              <span className="text-neutral-500">
                · {r.cls.name} Lv {r.level}
              </span>
            </div>
            {r.skills.length > 0 && <div className="text-xs text-neutral-400">{skills(r)}</div>}
            <StatGrid values={r.stats} />
            <div className="text-xs text-neutral-500">Growth %</div>
            <StatGrid values={r.growths} suffix="%" />
            <div className="text-xs text-neutral-500">Max Stats</div>
            <StatGrid values={r.caps} />
          </div>
        ))}
      </div>
      <Fe16PlanSets />
    </div>
  )
}
