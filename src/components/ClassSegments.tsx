import { useEffect, useState, type ReactNode } from 'react'

// Class changes as Fates' Unit Planner plans them (user, 2026-11-07, for Three Houses and Engage): a row for each class, with how many
// levels are spent in it, added one after another. Each game turns the rows into its own steps and works out the levels by its own
// rules (Three Houses keeps the level through a change; Engage starts again at Lv 1). The editor only lays them out.

/** One class to pick for a row: grouped (a tier) and greyed out where the game doesn't allow it there. */
export interface SegmentOption {
  id: string
  label: string
  group?: string
  disabled?: boolean
}

export interface Segment {
  classId: string
  /** Levels gained in the class. */
  levels: number
}

export interface SegmentRow extends Segment {
  /** The class's name, for a row whose class is fixed (the class they join in). */
  name: string
  /** The level the row starts at and ends at, as the game counts them. */
  from: number
  to: number
  /** The most levels this row can take. */
  max: number
  /** The classes it can be; none for the first row (the class they join in). */
  options?: SegmentOption[]
  /** Under the row: what the change needs (an exam, a seal), or why the game doesn't allow it there. */
  note?: ReactNode
  /** The game doesn't allow this change here: it and the rows after it aren't counted. */
  blocked?: boolean
}

function LevelsInput({ value, max, onCommit }: { value: number; max: number; onCommit: (value: number) => void }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  return (
    <input
      type="number"
      min={0}
      max={max}
      value={text}
      inputMode="numeric"
      onChange={(e) => {
        const next = e.target.value
        setText(next)
        if (next === '') return
        const parsed = Math.round(Number(next))
        if (!Number.isNaN(parsed)) onCommit(Math.min(Math.max(0, parsed), max))
      }}
      onBlur={() => {
        if (text === '' || Number.isNaN(Number(text))) setText(String(value))
      }}
      className="w-14 rounded-md border border-neutral-700 bg-neutral-800 px-1.5 py-1 text-xs text-neutral-200"
    />
  )
}

function OptionList({ options }: { options: SegmentOption[] }) {
  const groups = [...new Set(options.map((o) => o.group ?? ''))]
  const item = (o: SegmentOption) => (
    <option key={o.id} value={o.id} disabled={o.disabled}>
      {o.label}
    </option>
  )
  if (groups.length === 1 && !groups[0]) return <>{options.map(item)}</>
  return (
    <>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {options.filter((o) => (o.group ?? '') === g).map(item)}
        </optgroup>
      ))}
    </>
  )
}

/** The rows, each a class and the levels in it, with "+ Add class segment" (as Fates'). `summary`: the levels planned. */
export function ClassSegments({
  rows,
  summary,
  onClass,
  onLevels,
  onRemove,
  onAdd,
  canAdd,
}: {
  rows: SegmentRow[]
  summary: ReactNode
  onClass: (index: number, classId: string) => void
  onLevels: (index: number, levels: number) => void
  onRemove: (index: number) => void
  onAdd: () => void
  canAdd: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-neutral-400">{summary}</div>
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className={`space-y-1 rounded-md border p-2 ${row.blocked ? 'border-amber-700/60' : 'border-neutral-800'}`}>
            <div className="flex flex-wrap items-center gap-2">
              {row.options ? (
                <select
                  value={row.classId}
                  onChange={(e) => onClass(i, e.target.value)}
                  className="w-full min-w-[9rem] max-w-xs rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200"
                >
                  <OptionList options={row.options} />
                </select>
              ) : (
                <span className="text-sm text-neutral-200">{row.name}</span>
              )}
              <label className="flex items-center gap-1 text-xs text-neutral-400">
                Levels
                <LevelsInput value={row.levels} max={Math.max(row.levels, row.max)} onCommit={(n) => onLevels(i, n)} />
              </label>
              <span className="text-xs tabular-nums text-neutral-500">
                Lv {row.from} → {row.to}
              </span>
              {i > 0 && (
                <button type="button" onClick={() => onRemove(i)} className="ml-auto text-xs text-neutral-500 hover:text-red-400">
                  Remove
                </button>
              )}
            </div>
            {row.note && <div className={`text-xs ${row.blocked ? 'text-amber-400' : 'text-neutral-500'}`}>{row.note}</div>}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={!canAdd}
        className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-300 transition-colors hover:border-neutral-600 disabled:opacity-40"
      >
        + Add class segment
      </button>
    </div>
  )
}
