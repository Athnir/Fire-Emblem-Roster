import { useState } from 'react'
import { useReached } from '../state/spoilerStore'
import { armyWith, plansWith, selectClass } from './hooks'
import { project, shownStats, type Fe17Data } from './logic'
import { useFe17Builds, useFe17Store } from './store'
import { SkillChips, StatGrid, UnitPortrait } from './ui'

/** As Fates' Team Viewer: the plans and picks, now or in a saved set, with every unit's final class, stats and inherited skills at
 * once; and the saved sets themselves. */
export function Fe17BulkViewer({ data }: { data: Fe17Data }) {
  const current = { plans: useFe17Store((s) => s.plans), picks: useFe17Store((s) => s.picks) }
  const loadSet = useFe17Store((s) => s.load)
  const sets = useFe17Builds((s) => s.sets)
  const save = useFe17Builds((s) => s.save)
  const rename = useFe17Builds((s) => s.rename)
  const deleteSet = useFe17Builds((s) => s.deleteSet)
  const reached = useReached(data.gameId, data.chapters)
  const [source, setSource] = useState('current')
  const [name, setName] = useState('')
  const set = sets.find((s) => s.id === source)
  const { plans, picks } = set ?? current
  const planOf = plansWith(plans)
  const units = armyWith(data, picks, reached)
  const rows = units.map((u) => {
    const plan = planOf(u)
    const stages = project(data, u, plan)
    const final = stages[stages.length - 1]
    const cls = data.classes[final.classId]
    return { unit: u, cls, level: final.level, stats: shownStats(cls, u, final.own), skills: plan.inherited ?? [] }
  })
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="text-base font-semibold text-neutral-100">Team Viewer</h3>
        <p className="text-xs text-neutral-500">
          Everyone's final class, stats and inherited skills under the current plans and picks, or a saved set. Save the current
          plans and picks as a set to keep a playthrough, and load one back into the Roster and the planners.
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
            placeholder="Save the current as… (e.g. Maddening run)"
            className="min-w-[12rem] flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200"
          />
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => {
              save(name.trim(), current.plans, current.picks)
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
              Load into the Roster and the planners
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
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.unit.id} className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm">
            <div className="flex items-center gap-2">
              <UnitPortrait data={data} unit={r.unit} size={28} />
              <span className="font-medium text-neutral-200">{r.unit.name}</span>
              <span className="text-neutral-500">
                · {r.cls.name} Lv {r.level}
              </span>
            </div>
            {r.skills.length > 0 && (
              <div className="text-xs text-neutral-400">
                <SkillChips data={data} skills={r.skills.map((name) => ({ name }))} size={14} />
              </div>
            )}
            <StatGrid values={r.stats} />
          </div>
        ))}
      </div>
    </div>
  )
}
