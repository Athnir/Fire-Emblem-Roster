import { useState } from 'react'
import { useReached } from '../state/spoilerStore'
import { isPlanned } from '../logic/planned'
import { armyWith, plansWith, selectClass } from './hooks'
import { capsOf, defaultPlan, growthsIn, labelOf, project, shownStats, type Fe17Data } from './logic'
import { useFe17Builds, useFe17Store } from './store'
import { Fe17PlanSets, SkillChips, StatGrid, UnitPortrait } from './ui'

/** As Fates' Team Viewer: the plans, now or in a saved set, with every unit's final class, stats, growths, maximums and inherited
 * skills at once: a table on a wide screen, a card each on a phone; and the saved sets themselves. */
export function Fe17BulkViewer({ data }: { data: Fe17Data }) {
  const current = useFe17Store((s) => s.plans)
  const sets = useFe17Builds((s) => s.sets)
  const reached = useReached(data.gameId, data.chapters)
  const [source, setSource] = useState('current')
  const set = sets.find((s) => s.id === source)
  const planOf = plansWith(set?.plans ?? current)
  // Only the units with a plan, as Fates' Team Viewer shows only the units in its sets (user, 2026-11-05).
  const plans = set?.plans ?? current
  const rows = armyWith(data, reached)
    .filter((u) => {
      // Normal difficulty is the untouched setting, picked or not.
      const p = plans[u.id]
      return isPlanned(p && p.difficulty === 'normal' ? { ...p, difficulty: undefined } : p, defaultPlan(u))
    })
    .map((u) => {
    const plan = planOf(u)
    const stages = project(data, u, plan)
    const final = stages[stages.length - 1]
    const cls = data.classes[final.classId]
    return {
      unit: u,
      cls,
      level: final.level,
      stats: shownStats(cls, u, final.own),
      growths: growthsIn(u, cls, plan),
      caps: capsOf(cls, u),
      skills: plan.inherited ?? [],
    }
  })
  const skills = (r: (typeof rows)[number]) => (r.skills.length ? <SkillChips data={data} skills={r.skills.map((name) => ({ name }))} size={14} /> : null)
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="text-base font-semibold text-neutral-100">Team Viewer</h3>
        <p className="text-xs text-neutral-500">
          Everyone's final class and level, their stats then, their growths and maximums in that class, and the skills they inherit,
          under the current plans or a saved set.
        </p>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Show
          <select value={source} onChange={(e) => setSource(e.target.value)} className={`${selectClass} max-w-xs`}>
            <option value="current">The current plans</option>
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
      <Fe17PlanSets />
    </div>
  )
}
