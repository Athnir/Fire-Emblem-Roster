import { useState } from 'react'

/** A saved set as the panel lists it. */
export interface PlanSetEntry {
  id: string
  name: string
}

const select = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200'

/**
 * Saved sets of plans, as Fates' Build Sets in its planners: save the current plans (every unit's, with the Roster's picks) under a
 * name, load one back, rename or delete it. The same sets the Bulk Viewer shows. Left out of "Save as image".
 */
export function PlanSets({
  sets,
  onSave,
  onLoad,
  onRename,
  onDelete,
}: {
  sets: PlanSetEntry[]
  onSave: (name: string) => void
  onLoad: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [picked, setPicked] = useState('')
  const set = sets.find((s) => s.id === picked)
  return (
    <div data-export-hide className="space-y-2 rounded-lg border border-dashed border-neutral-800 bg-neutral-900/90 p-4">
      <h3 className="text-sm font-semibold text-neutral-200">Saved sets</h3>
      <p className="text-xs text-neutral-500">
        Every unit's plan is kept as you go. Save them all under a name to keep a playthrough, and load one back here or in the Bulk
        Viewer.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Save the current plans as… (e.g. Hard run)"
          className="min-w-[12rem] flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200"
        />
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => {
            onSave(name.trim())
            setName('')
          }}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sets.some((s) => s.name === name.trim()) ? 'Update set' : 'Save set'}
        </button>
      </div>
      {sets.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <select value={picked} onChange={(e) => setPicked(e.target.value)} className={select}>
            <option value="">A saved set…</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {set && (
            <>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Replace the current plans and picks with "${set.name}"?`)) onLoad(set.id)
                }}
                className="text-violet-300 hover:text-violet-200"
              >
                Load
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = window.prompt('Rename set', set.name)
                  if (next && next.trim()) onRename(set.id, next.trim())
                }}
                className="text-neutral-400 hover:text-neutral-200"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete "${set.name}"?`)) {
                    onDelete(set.id)
                    setPicked('')
                  }
                }}
                className="text-neutral-400 hover:text-red-400"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
