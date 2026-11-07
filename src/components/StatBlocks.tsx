import type { ReactNode } from 'react'

// Rows of stats laid out as Fates' Unit Planner shows them: each row a titled block, its stats four to a line, so a phone sees them
// all without scrolling sideways (user, 2026-11-05). Every game's stat table draws through this.

export interface StatBlockRow<K extends string> {
  label: string
  /** Shown in place of the label: a title with a picker in it (the caps' class). */
  title?: ReactNode
  values: Partial<Record<K, number>>
  /** A stat at its cap shows green. */
  caps?: Partial<Record<K, number>>
  suffix?: string
  /** A plus sign on the positive values (a change). */
  signed?: boolean
  /** Shown after a stat's value: a synced Emblem's +n, the points kept past a cap. */
  after?: Partial<Record<K, ReactNode>>
  /** A small second line under a stat (a child's Luck range). */
  below?: Partial<Record<K, ReactNode>>
}

export function StatBlocks<K extends string>({
  stats,
  labels,
  rows,
  fmt,
}: {
  stats: readonly K[]
  labels: Record<K, string>
  rows: StatBlockRow<K>[]
  fmt: (n: number) => string
}) {
  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        // A plan can pass through the same class and level more than once.
        <div key={`${i}-${row.label}`}>
          <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">{row.title ?? row.label}</h5>
          <div className="grid max-w-md grid-cols-4 gap-x-3 gap-y-1 text-sm">
            {stats
              .filter((s) => row.values[s] !== undefined)
              .map((s) => {
                const v = row.values[s] as number
                const cap = row.caps?.[s]
                return (
                  <div key={s} className="flex justify-between gap-1">
                    <span className="text-neutral-500">{labels[s]}</span>
                    <span className={`text-right tabular-nums ${cap !== undefined && v >= cap ? 'text-emerald-400' : 'text-neutral-100'}`}>
                      {row.signed && v > 0 ? '+' : ''}
                      {fmt(v)}
                      {row.suffix ?? ''}
                      {row.after?.[s]}
                      {row.below?.[s] && <span className="block text-[10px] leading-tight text-neutral-500">{row.below[s]}</span>}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}

/** The caps of one class, picked from the classes the unit can be in (user, 2026-11-07): one block with a dropdown in its title, not a
 * block for every class. Without a pick it shows `fallback` (the plan's last class); with one class there's nothing to pick. */
export function capsTitle({
  options,
  value,
  onChange,
  label = 'Caps',
}: {
  options: { id: string; name: string }[]
  value: string
  onChange: (id: string) => void
  label?: string
}): ReactNode {
  const name = options.find((o) => o.id === value)?.name ?? ''
  if (options.length < 2) return `${label} (${name})`
  return (
    <span className="flex flex-wrap items-center gap-2">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label}: class`}
        className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs font-normal normal-case tracking-normal text-neutral-200"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </span>
  )
}
