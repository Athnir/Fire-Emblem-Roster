import { useState } from 'react'
import { useTelliusBuilds, type TelliusBuildEntry } from './buildSets'
import type { TelliusUnitPlan } from './planStore'
import type { TelliusData, TelliusUnit } from './types'

const EMPTY: TelliusBuildEntry[] = []

/**
 * As Fates' Build Set: add each unit you're planning to the set, then save the whole set under a name; a saved set loads
 * back for editing. An entry is the unit's whole plan (classes, levels, skills), so the Unit Planner and the Skill Planner
 * share one. `onLoadEntry` shows an entry's unit with its plan.
 */
export function TelliusBuildSetManager({
  data,
  unit,
  plan,
  onLoadEntry,
}: {
  data: TelliusData
  unit: TelliusUnit
  plan: TelliusUnitPlan
  onLoadEntry: (entry: TelliusBuildEntry) => void
}) {
  const working = useTelliusBuilds((s) => s.working[data.gameId] ?? EMPTY)
  const allSets = useTelliusBuilds((s) => s.sets)
  const activeId = useTelliusBuilds((s) => s.activeId[data.gameId] ?? null)
  const add = useTelliusBuilds((s) => s.add)
  const remove = useTelliusBuilds((s) => s.remove)
  const save = useTelliusBuilds((s) => s.save)
  const load = useTelliusBuilds((s) => s.load)
  const deleteSet = useTelliusBuilds((s) => s.deleteSet)
  const rename = useTelliusBuilds((s) => s.rename)
  const [name, setName] = useState('')
  const sets = allSets.filter((s) => s.gameId === data.gameId)
  const active = sets.find((s) => s.id === activeId)
  const inSet = working.some((e) => e.unitId === unit.id)

  return (
    <div className="space-y-4 rounded-lg border border-dashed border-neutral-800 bg-neutral-900/90 p-4">
      <div>
        <h3 className="text-base font-semibold text-neutral-100">Build Set</h3>
        <p className="text-xs text-neutral-500">
          Add each unit you want to plan into the set below, then save the whole set at once. A saved set shows in the Bulk Viewer.
        </p>
      </div>
      <button
        type="button"
        onClick={() => add(data.gameId, { unitId: unit.id, unitName: unit.name, plan })}
        className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
      >
        {inSet ? `Update ${unit.name} in set` : `Add ${unit.name} to set`}
      </button>
      {working.length === 0 ? (
        <p className="text-sm text-neutral-500">No units in this set yet.</p>
      ) : (
        <ul className="space-y-2">
          {working.map((e) => (
            <li
              key={e.unitId}
              className={`flex items-center justify-between gap-2 rounded-md border ${e.unitId === unit.id ? 'border-violet-500 bg-violet-950/40' : 'border-neutral-800 bg-neutral-950'}`}
            >
              <button type="button" onClick={() => onLoadEntry(e)} className="min-w-0 flex-1 px-3 py-2 text-left hover:bg-neutral-800/60" title="Tap to view or edit this unit">
                <div className="truncate text-sm font-medium text-neutral-200">{e.unitName}</div>
              </button>
              <button type="button" onClick={() => remove(data.gameId, e.unitId)} className="shrink-0 px-3 py-2 text-xs text-neutral-400 hover:text-red-400">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-3 border-t border-neutral-800 pt-3">
        <h4 className="text-sm font-semibold text-neutral-200">Saved Sets</h4>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={active ? `Update "${active.name}"` : 'e.g. Hard mode team'}
            className="min-w-[12rem] flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200"
          />
          <button
            type="button"
            onClick={() => {
              const n = name.trim() || active?.name
              if (!n) return
              save(data.gameId, n)
              setName('')
            }}
            disabled={working.length === 0}
            title={working.length === 0 ? 'Add at least one unit to the set above before saving' : undefined}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {active ? 'Save As / Update' : 'Save Current Set'}
          </button>
        </div>
        {sets.length === 0 ? (
          <p className="text-sm text-neutral-500">No saved sets yet.</p>
        ) : (
          <ul className="space-y-2">
            {sets.map((s) => (
              <li
                key={s.id}
                className={`flex items-center justify-between gap-2 rounded-md border ${s.id === activeId ? 'border-violet-500 bg-violet-950/40' : 'border-neutral-800 bg-neutral-950'}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    const found = load(s.id)
                    // Show the set's first unit straight away.
                    if (found?.entries[0]) onLoadEntry(found.entries[0])
                  }}
                  className="min-w-0 flex-1 px-3 py-2 text-left hover:bg-neutral-800/60"
                  title="Tap to load this set"
                >
                  <div className="truncate text-sm font-medium text-neutral-200">{s.name}</div>
                  <div className="text-xs text-neutral-500">
                    {s.entries.length} unit{s.entries.length === 1 ? '' : 's'}
                  </div>
                </button>
                <div className="flex shrink-0 gap-2 px-3 py-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const next = window.prompt('Rename set', s.name)
                      if (next && next.trim()) rename(s.id, next.trim())
                    }}
                    className="text-neutral-400 hover:text-neutral-200"
                  >
                    Rename
                  </button>
                  <button type="button" onClick={() => deleteSet(s.id)} className="text-neutral-400 hover:text-red-400">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
