import { StatBlocks } from '../components/StatBlocks'
import { Portrait } from '../components/Portrait'
import type { ReactNode } from 'react'
import { artId, fmt, LABELS, selectClass } from './hooks'
import { weaponRanks, type Fe4Data, type Fe4Profile } from './logic'
import { FE4_STATS, type Fe4Stat, type Fe4Stats, type Fe4Unit } from './types'

// Genealogy's shared components.

const WEAPON_LABELS: Record<string, string> = {
  sword: 'Sword', lance: 'Lance', axe: 'Axe', bow: 'Bow', staff: 'Staff', fire: 'Fire', thunder: 'Thunder', wind: 'Wind', light: 'Light', dark: 'Dark',
}

export function UnitPortrait({ data, unit, size = 64 }: { data: Fe4Data; unit: Fe4Unit; size?: number }) {
  return <Portrait characterId={artId(data.gameId, unit.name)} isChild={false} size={size} />
}

/** Rows of stats, each a block of stats four to a line (as Fates' planner); `extra` adds a small second line to a stat (a child's
 * Luck range). */
export function StatTable({
  rows,
}: {
  rows: { label: string; title?: ReactNode; values: Fe4Stats; caps?: Fe4Stats; suffix?: string; extra?: Partial<Record<Fe4Stat, string>> }[]
}) {
  return <StatBlocks stats={FE4_STATS} labels={LABELS} fmt={fmt} rows={rows.map((r) => ({ label: r.label, title: r.title, values: r.values, caps: r.caps, suffix: r.suffix, below: r.extra }))} />
}

/** Stats four to a row, fixed-width so "Save as image" keeps the spacing (as the Fates viewer does). */
export function StatGrid({ values, suffix = '', extra, mov }: { values: Fe4Stats; suffix?: string; extra?: Partial<Record<Fe4Stat, string>>; mov?: number }) {
  return (
    <div className="grid grid-cols-[repeat(4,4.75rem)] whitespace-nowrap text-xs">
      {FE4_STATS.map((s) => (
        <span key={s} className="pb-0.5 pr-2">
          <span className="text-neutral-500">{LABELS[s]} </span>
          {fmt(values[s])}
          {suffix}
          {extra?.[s] && <span className="text-[10px] text-neutral-500"> {extra[s]}</span>}
        </span>
      ))}
      {mov !== undefined && (
        <span className="pb-0.5 pr-2">
          <span className="text-neutral-500">Mov </span>
          {mov}
        </span>
      )}
    </div>
  )
}

/** The warning for a child's stat stored at 16 or more: the save keeps 4 bits, so a reload wraps it. */
export function WrapWarning({ data, p }: { data: Fe4Data; p: Fe4Profile }) {
  if (!p.wraps?.length) return null
  const base = data.classes[p.classId].bases
  return (
    <p className="text-xs text-amber-400">
      {p.wraps
        .map((s) => {
          const stored = Math.round(p.bases[s] - base[s])
          return `${LABELS[s]} comes out ${stored} above the class's base: the save keeps 0 to 15, so after a save and reload it drops to ${
            stored % 16
          } above (${base[s] + (stored % 16)})`
        })
        .join('; ')}
      . The game caps nothing when it makes a child ($91:F11F).
    </p>
  )
}

/** A class's weapons with the unit's holy blood: the rank in each, a holy weapon with major blood. */
export function WeaponsLine({ data, classId, blood }: { data: Fe4Data; classId: string; blood: Fe4Profile['blood'] }) {
  const ranks = weaponRanks(data, classId, blood)
  return (
    <div className="text-sm text-neutral-300">
      <span className="text-neutral-500">Weapons (as a {data.classes[classId]?.name}): </span>
      {ranks.length
        ? ranks
            .map((r) => `${WEAPON_LABELS[r.type] ?? r.type} ${r.rank}${r.holy ? ` and ${r.holy}` : ''}${r.raisedBy ? ` (${r.raisedBy})` : ''}`)
            .join(', ')
        : 'none'}
    </div>
  )
}

/** The units in join order, as a select. */
export function UnitSelect({ data, units, value, onChange }: { data: Fe4Data; units: Fe4Unit[]; value: string; onChange: (id: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${selectClass} w-full max-w-xs`}>
      {data.chapters.map((ch) => {
        const list = units.filter((u) => u.joinChapter === ch.id)
        if (list.length === 0) return null
        return (
          <optgroup key={ch.id} label={ch.label}>
            {list.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}
