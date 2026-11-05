import { useState } from 'react'
import { isPlanned } from '../logic/planned'
import { armyWith, plansWith, selectClass, useReached } from './hooks'
import { defaultPlan, manualClashes, project, ranksOf, ranksText, shownStats, skillsAt, type Fe5Data, type Fe5Plan } from './logic'
import { useFe5Builds, useFe5Store } from './store'
import { StatGrid, UnitPortrait } from './ui'

/** As Fates' Team Viewer: the plans and picks, now or in a saved set, with every unit's final class, stats, weapons and skills at
 * once; and the saved sets themselves. */
export function Fe5BulkViewer({ data }: { data: Fe5Data }) {
  const current = { plans: useFe5Store((s) => s.plans), picks: useFe5Store((s) => s.picks) }
  const loadSet = useFe5Store((s) => s.load)
  const sets = useFe5Builds((s) => s.sets)
  const save = useFe5Builds((s) => s.save)
  const rename = useFe5Builds((s) => s.rename)
  const deleteSet = useFe5Builds((s) => s.deleteSet)
  const [source, setSource] = useState('current')
  const [name, setName] = useState('')
  const set = sets.find((s) => s.id === source)
  const { plans, picks } = set ?? current
  const planOf = plansWith(plans)
  const reached = useReached(data, picks)
  const { units } = armyWith(data, picks, reached)
  const clashes = manualClashes(units, planOf)
  // Only the units with a plan, as Fates' Team Viewer shows only the units in its sets (user, 2026-11-05).
  const rows = units
    .filter((u) => isPlanned(plans[u.id], defaultPlan(u)))
    .map((u) => {
    const stages = project(data, u, planOf(u))
    const final = stages[stages.length - 1]
    const cls = data.classes[final.classId]
    return { unit: u, cls, level: final.level, stats: shownStats(cls, final.own), skills: skillsAt(data, u, cls.id, planOf(u)) }
  })
  // What gets saved: every unit's plan in today's shape.
  const savedPlans = (): Record<string, Fe5Plan> => Object.fromEntries(Object.keys(current.plans).flatMap((id) => {
    const u = data.units.find((x) => x.id === id)
    return u ? [[id, plansWith(current.plans)(u)]] : []
  }))
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="text-base font-semibold text-neutral-100">Team Viewer</h3>
        <p className="text-xs text-neutral-500">
          Everyone's final class, stats, weapons and skills under the current plans and picks, or a saved set. Save the current plans and
          picks as a set to keep a playthrough, and load one back into the Roster and the Unit Planner.
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
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Save the current as… (e.g. Route A run)"
            className="min-w-[12rem] flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200"
          />
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => {
              save(name.trim(), savedPlans(), current.picks)
              setName('')
            }}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save set
          </button>
        </div>
        {set && (
          <div className="flex flex-wrap gap-3 text-xs">
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Replace the current plans and picks with "${set.name}"?`)) {
                  loadSet(set.plans, set.picks)
                  setSource('current')
                }
              }}
              className="text-violet-300 hover:text-violet-200"
            >
              Load into the Roster and the Unit Planner
            </button>
            <button
              type="button"
              onClick={() => {
                const next = window.prompt('Rename set', set.name)
                if (next && next.trim()) rename(set.id, next.trim())
              }}
              className="text-neutral-400 hover:text-neutral-200"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                deleteSet(set.id)
                setSource('current')
              }}
              className="text-neutral-400 hover:text-red-400"
            >
              Delete
            </button>
          </div>
        )}
        {[...clashes].map(([id, us]) => (
          <p key={id} className="text-sm text-amber-400">
            The {data.manuals.find((m) => m.id === id)?.name} is in {us.map((u) => u.name).join(' and ')}'s plans. The game has one copy, so
            only one unit can use it.
          </p>
        ))}
      </div>
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-neutral-500">No plans yet: a unit shows here once it has a plan (change anything for them in the Unit or Skill Planner), as in Fates' Team Viewer.</p>}
        {rows.map((r) => (
          <div key={r.unit.id} className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm">
            <div className="flex items-center gap-2">
              <UnitPortrait data={data} unit={r.unit} size={28} />
              <span className="font-medium text-neutral-200">{r.unit.name}</span>
              <span className="text-neutral-500">
                · {r.cls.name} Lv {r.level}
              </span>
            </div>
            <div className="text-xs text-neutral-400">
              {ranksText(ranksOf(r.cls, r.unit))}
              {r.skills.length > 0 && ` · ${r.skills.join(', ')}`}
            </div>
            <StatGrid values={r.stats} />
          </div>
        ))}
      </div>
    </div>
  )
}
