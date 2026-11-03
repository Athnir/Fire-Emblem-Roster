import { Portrait } from '../components/Portrait'
import { artId, chip, selectClass } from './hooks'
import { fmt, type Fe17Data } from './logic'
import { useFe17Store } from './store'
import { FE17_STATS, FE17_STAT_LABELS, type Fe17Stat, type Fe17StatsMov, type Fe17Unit } from './types'

// Engage's shared components.

export function UnitPortrait({ data, unit, size = 64 }: { data: Fe17Data; unit: Fe17Unit; size?: number }) {
  return <Portrait characterId={artId(data.gameId, unit.name)} isChild={false} size={size} />
}

type Row = { label: string; values: Partial<Fe17StatsMov>; caps?: Partial<Fe17StatsMov>; suffix?: string; extra?: Partial<Record<Fe17Stat | 'mov', number>> }
const COLS = [...FE17_STATS, 'mov'] as (Fe17Stat | 'mov')[]

/** Rows of stats, a column per stat and Mov; a stat at its cap is green; `extra` (a synced emblem's) shows as +n beside it. */
export function StatTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <thead>
          <tr className="text-xs text-neutral-500">
            <th className="py-1 pr-2 text-left font-normal" />
            {COLS.map((s) => (
              <th key={s} className="px-1 py-1 text-right font-normal">
                {FE17_STAT_LABELS[s]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.label}-${i}`} className="border-t border-neutral-800">
              <td className="whitespace-nowrap py-1 pr-2 text-xs text-neutral-400">{row.label}</td>
              {COLS.map((s) => {
                const v = row.values[s]
                const cap = row.caps?.[s]
                const plus = row.extra?.[s]
                return (
                  <td key={s} className={`px-1 py-1 text-right tabular-nums ${v !== undefined && cap !== undefined && v >= cap ? 'text-emerald-400' : 'text-neutral-200'}`}>
                    {v === undefined ? '' : fmt(v)}
                    {v !== undefined ? (row.suffix ?? '') : ''}
                    {plus ? <span className="text-sky-400">+{plus}</span> : null}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Stats in a fixed-width grid, so "Save as image" keeps the spacing. */
export function StatGrid({ values }: { values: Fe17StatsMov }) {
  return (
    <div className="grid grid-cols-[repeat(4,4.75rem)] whitespace-nowrap text-xs">
      {COLS.map((s) => (
        <span key={s} className="pb-0.5 pr-2">
          <span className="text-neutral-500">{FE17_STAT_LABELS[s]} </span>
          <span className="tabular-nums text-neutral-200">{fmt(values[s])}</span>
        </span>
      ))}
    </div>
  )
}

/** The units of the army by the chapter they join in. */
export function UnitSelect({ data, units, value, onChange }: { data: Fe17Data; units: Fe17Unit[]; value: string; onChange: (id: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${selectClass} w-full max-w-xs`}>
      {data.chapters.map((ch) => {
        const here = units.filter((u) => u.joinChapter === ch.id)
        if (here.length === 0) return null
        return (
          <optgroup key={ch.id} label={ch.label}>
            {here.map((u) => (
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

/** Alear's gender: the classes for women alone hang on it. */
export function AlearPicker() {
  const picked = useFe17Store((s) => s.picks.alear)
  const setPick = useFe17Store((s) => s.setPick)
  return (
    <div className="space-y-1.5 rounded-md border border-neutral-800 bg-neutral-900/60 p-2">
      <div className="text-xs text-neutral-400">Alear: a man or a woman? (The fliers' classes are for women alone.)</div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setPick('alear', null)} className={chip(picked === undefined)}>
          Not picked
        </button>
        <button type="button" onClick={() => setPick('alear', 'm')} className={chip(picked === 'm')}>
          Male
        </button>
        <button type="button" onClick={() => setPick('alear', 'f')} className={chip(picked === 'f')}>
          Female
        </button>
      </div>
    </div>
  )
}

/** Skills with what each does, one to a line. */
export function SkillList({ data, skills }: { data: Fe17Data; skills: string[] }) {
  if (skills.length === 0) return <p className="text-sm text-neutral-500">None.</p>
  return (
    <ul className="space-y-1 text-sm">
      {skills.map((s) => (
        <li key={s}>
          <span className="font-medium text-neutral-200">{s}</span>
          {data.skills[s] && <span className="text-neutral-400">: {data.skills[s]}</span>}
        </li>
      ))}
    </ul>
  )
}
