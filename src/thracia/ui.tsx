import { Portrait } from '../components/Portrait'
import { artId, chip, selectClass } from './hooks'
import { chapterLabel, fmt, ranksOf, ranksText, type Fe5Data } from './logic'
import { useFe5Store } from './store'
import { FE5_STATS, FE5_STAT_LABELS, type Fe5Choice, type Fe5Class, type Fe5Stats, type Fe5Unit } from './types'

// Thracia's shared components.

export function UnitPortrait({ data, unit, size = 64 }: { data: Fe5Data; unit: Fe5Unit; size?: number }) {
  return <Portrait characterId={artId(data.gameId, unit.name)} isChild={false} size={size} />
}

/** Rows of stats, a column per stat; a stat at its cap is green. */
export function StatTable({ rows }: { rows: { label: string; values: Fe5Stats; caps?: Fe5Stats; suffix?: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="text-xs text-neutral-500">
            <th className="py-1 pr-2 text-left font-normal" />
            {FE5_STATS.map((s) => (
              <th key={s} className="px-1 py-1 text-right font-normal">
                {FE5_STAT_LABELS[s]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.label}-${i}`} className="border-t border-neutral-800">
              <td className="whitespace-nowrap py-1 pr-2 text-xs text-neutral-400">{row.label}</td>
              {FE5_STATS.map((s) => (
                <td key={s} className={`px-1 py-1 text-right tabular-nums ${row.caps && row.values[s] >= row.caps[s] ? 'text-emerald-400' : 'text-neutral-200'}`}>
                  {fmt(row.values[s])}
                  {row.suffix ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Stats four to a row, fixed-width so "Save as image" keeps the spacing (as the Fates viewer does). */
export function StatGrid({ values, suffix = '' }: { values: Fe5Stats; suffix?: string }) {
  return (
    <div className="grid grid-cols-[repeat(4,4.75rem)] whitespace-nowrap text-xs">
      {FE5_STATS.map((s) => (
        <span key={s} className="pb-0.5 pr-2">
          <span className="text-neutral-500">{FE5_STAT_LABELS[s]} </span>
          <span className="tabular-nums text-neutral-200">
            {fmt(values[s])}
            {suffix}
          </span>
        </span>
      ))}
    </div>
  )
}

/** The units of the army by the chapter they join in (under the story's picks). */
export function UnitSelect({
  data,
  units,
  chapterOf,
  value,
  onChange,
}: {
  data: Fe5Data
  units: Fe5Unit[]
  chapterOf: (u: Fe5Unit) => string
  value: string
  onChange: (id: string) => void
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${selectClass} w-full max-w-xs`}>
      {data.chapters.map((ch) => {
        const here = units.filter((u) => chapterOf(u) === ch.id)
        if (here.length === 0) return null
        return (
          <optgroup key={ch.id} label={chapterLabel(data, ch.id)}>
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

/** A story pick of who joins, as buttons: picking one leaves the others' units out of every tab. */
export function ChoicePicker({ choice }: { choice: Fe5Choice }) {
  const picked = useFe5Store((s) => s.picks[choice.id])
  const setPick = useFe5Store((s) => s.setPick)
  return (
    <div className="mb-2 space-y-1.5 rounded-md border border-neutral-800 bg-neutral-900/60 p-2">
      <div className="text-xs text-neutral-400">{choice.question}</div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setPick(choice.id, null)} className={chip(picked === undefined)}>
          Not picked
        </button>
        {choice.options.map((opt, i) => (
          <button key={opt.label} type="button" onClick={() => setPick(choice.id, i)} className={chip(picked === i)}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** A unit's weapons in a class, as the game shows them, with the points behind each letter. */
export function WeaponsLine({ cls, unit }: { cls: Fe5Class; unit: Fe5Unit }) {
  const ranks = ranksOf(cls, unit)
  return (
    <span>
      {ranks.length === 0
        ? ranksText(ranks)
        : ranks.map((r, i) => (
            <span key={r.weapon}>
              {i > 0 && ', '}
              {r.weapon[0].toUpperCase()}
              {r.weapon.slice(1)} {r.letter}
              <span className="text-neutral-500"> ({r.points})</span>
            </span>
          ))}
    </span>
  )
}

/** Skills with what each does, one to a line. */
export function SkillList({ data, skills }: { data: Fe5Data; skills: string[] }) {
  if (skills.length === 0) return <p className="text-sm text-neutral-500">No skills.</p>
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
