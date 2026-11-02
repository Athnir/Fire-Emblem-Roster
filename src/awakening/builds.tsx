import { useState } from 'react'
import { useFe13Builds, type Fe13BuildEntry, type Fe13BuildTab } from './buildSets'

const EMPTY: Fe13BuildEntry[] = []

/** The S partner an entry pairs up with, if any: the one 1:1 tie in the game, so two units in a set can't share one. */
function sPartner(entry: Fe13BuildEntry): string | undefined {
  const pair = entry.data.plan && typeof entry.data.plan === 'object' ? (entry.data.plan as { pairUp?: { partner?: string; rank?: number } }).pairUp : undefined
  return pair?.rank === 4 && pair.partner ? pair.partner : undefined
}

/**
 * As Fates' Build Set: add each unit you're planning to the set, then save the whole set under a name; a saved set loads back for
 * editing. `data` is the unit on screen's snapshot; `onLoadEntry` shows an entry's unit with its snapshot.
 */
export function Fe13BuildSetManager({
  tab,
  unit,
  data,
  onLoadEntry,
  nameOf,
}: {
  tab: Fe13BuildTab
  unit: { id: string; name: string } | undefined
  data: Record<string, unknown>
  onLoadEntry: (entry: Fe13BuildEntry) => void
  nameOf: (unitId: string) => string
}) {
  const working = useFe13Builds((s) => s.working[tab] ?? EMPTY)
  const allSets = useFe13Builds((s) => s.sets)
  const activeId = useFe13Builds((s) => s.activeId)
  const add = useFe13Builds((s) => s.add)
  const remove = useFe13Builds((s) => s.remove)
  const save = useFe13Builds((s) => s.save)
  const load = useFe13Builds((s) => s.load)
  const deleteSet = useFe13Builds((s) => s.deleteSet)
  const rename = useFe13Builds((s) => s.rename)
  const [name, setName] = useState('')
  const sets = allSets.filter((s) => s.tab === tab)
  const active = sets.find((s) => s.id === activeId)
  const inSet = unit ? working.some((e) => e.unitId === unit.id) : false

  // Checked with the unit on screen as they are now, so the warning shows while picking, as the Marriage Planner warns before adding.
  const entries = unit ? [...working.filter((e) => e.unitId !== unit.id), { unitId: unit.id, unitName: unit.name, data }] : working
  const byPartner = new Map<string, string[]>()
  for (const e of entries) {
    const p = sPartner(e)
    if (p) byPartner.set(p, [...(byPartner.get(p) ?? []), e.unitName])
  }
  const clashes = [...byPartner.entries()].filter(([, who]) => who.length > 1)

  return (
    <div className="space-y-4 rounded-lg border border-dashed border-neutral-800 bg-neutral-900/90 p-4">
      <div>
        <h3 className="text-base font-semibold text-neutral-100">Build Set</h3>
        <p className="text-xs text-neutral-500">Add each unit you want to plan into the set below, then save the whole set at once.</p>
      </div>
      <button
        type="button"
        onClick={() => unit && add(tab, unit.id, unit.name, data)}
        disabled={!unit}
        className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {inSet ? `Update ${unit?.name} in set` : `Add ${unit?.name ?? 'the unit'} to set`}
      </button>
      {clashes.map(([partner, who]) => (
        <p key={partner} className="text-sm text-amber-400">
          {nameOf(partner)} is the S partner of {who.slice(0, -1).join(', ')} and {who[who.length - 1]}.
        </p>
      ))}
      {working.length === 0 ? (
        <p className="text-sm text-neutral-500">No units in this set yet.</p>
      ) : (
        <ul className="space-y-2">
          {working.map((e) => (
            <li
              key={e.unitId}
              className={`flex items-center justify-between gap-2 rounded-md border ${e.unitId === unit?.id ? 'border-violet-500 bg-violet-950/40' : 'border-neutral-800 bg-neutral-950'}`}
            >
              <button type="button" onClick={() => onLoadEntry(e)} className="min-w-0 flex-1 px-3 py-2 text-left hover:bg-neutral-800/60" title="Tap to view or edit this unit">
                <div className="truncate text-sm font-medium text-neutral-200">{e.unitName}</div>
              </button>
              <button type="button" onClick={() => remove(tab, e.unitId)} className="shrink-0 px-3 py-2 text-xs text-neutral-400 hover:text-red-400">
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
            placeholder={active ? `Update "${active.name}"` : 'e.g. Lunatic kids'}
            className="min-w-[12rem] flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200"
          />
          <button
            type="button"
            onClick={() => {
              const n = name.trim() || active?.name
              if (!n) return
              save(tab, n)
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
