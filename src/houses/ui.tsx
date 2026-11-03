import { Portrait } from '../components/Portrait'
import { artId, chip, selectClass } from './hooks'
import { fmt, groupOf, groupsFor, helpOf, labelOf, learnsOf, type Fe16Choice, type Fe16Data, type Fe16Picks } from './logic'
import { useFe16Store } from './store'
import { FE16_SKILL_LABELS, FE16_SKILLS, FE16_STATS, FE16_STAT_LABELS, type Fe16Learn, type Fe16Stats, type Fe16Unit } from './types'

// Three Houses' shared components.

export function UnitPortrait({ data, unit, size = 64 }: { data: Fe16Data; unit: Fe16Unit; size?: number }) {
  return <Portrait characterId={artId(data.gameId, labelOf(unit))} isChild={false} size={size} />
}

type Row = { label: string; values: Fe16Stats & { mov?: number }; caps?: Partial<Fe16Stats>; suffix?: string; mov?: boolean }

/** Rows of stats, a column per stat (and Mov where a row has it); a stat at its cap is green. */
export function StatTable({ rows }: { rows: Row[] }) {
  const mov = rows.some((r) => r.mov)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-sm">
        <thead>
          <tr className="text-xs text-neutral-500">
            <th className="py-1 pr-2 text-left font-normal" />
            {FE16_STATS.map((s) => (
              <th key={s} className="px-1 py-1 text-right font-normal">
                {FE16_STAT_LABELS[s]}
              </th>
            ))}
            {mov && <th className="px-1 py-1 text-right font-normal">Mov</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.label}-${i}`} className="border-t border-neutral-800">
              <td className="whitespace-nowrap py-1 pr-2 text-xs text-neutral-400">{row.label}</td>
              {FE16_STATS.map((s) => {
                const cap = row.caps?.[s]
                return (
                  <td key={s} className={`px-1 py-1 text-right tabular-nums ${cap !== undefined && row.values[s] >= cap ? 'text-emerald-400' : 'text-neutral-200'}`}>
                    {fmt(row.values[s])}
                    {row.suffix ?? ''}
                  </td>
                )
              })}
              {mov && <td className="px-1 py-1 text-right tabular-nums text-neutral-200">{row.mov && row.values.mov !== undefined ? fmt(row.values.mov) : ''}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Stats in a fixed-width grid, so "Save as image" keeps the spacing. */
export function StatGrid({ values, suffix = '' }: { values: Fe16Stats & { mov?: number }; suffix?: string }) {
  return (
    <div className="grid grid-cols-[repeat(4,4.75rem)] whitespace-nowrap text-xs">
      {FE16_STATS.map((s) => (
        <span key={s} className="pb-0.5 pr-2">
          <span className="text-neutral-500">{FE16_STAT_LABELS[s]} </span>
          <span className="tabular-nums text-neutral-200">
            {fmt(values[s])}
            {suffix}
          </span>
        </span>
      ))}
      {values.mov !== undefined && (
        <span className="pb-0.5 pr-2">
          <span className="text-neutral-500">Mov </span>
          <span className="tabular-nums text-neutral-200">{fmt(values.mov)}</span>
        </span>
      )}
    </div>
  )
}

/** The units in your army, by group. */
export function UnitSelect({ units, picks, value, onChange }: { units: Fe16Unit[]; picks: Fe16Picks; value: string; onChange: (id: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${selectClass} w-full max-w-xs`}>
      {groupsFor(picks.route).map((g) => {
        const here = units.filter((u) => groupOf(u) === g)
        if (here.length === 0) return null
        return (
          <optgroup key={g} label={g}>
            {here.map((u) => (
              <option key={u.id} value={u.id}>
                {labelOf(u)}
              </option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}

/** One of the Roster's picks, as buttons. */
export function ChoicePicker({ choice }: { choice: Fe16Choice }) {
  const picked = useFe16Store((s) => s.picks[choice.id as keyof Fe16Picks])
  const setPick = useFe16Store((s) => s.setPick)
  return (
    <div className="space-y-1.5 rounded-md border border-neutral-800 bg-neutral-900/60 p-2">
      <div className="text-xs text-neutral-400">{choice.question}</div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setPick(choice.id as keyof Fe16Picks, null)} className={chip(picked === undefined)}>
          Not picked
        </button>
        {choice.options.map((opt) => (
          <button key={opt.value} type="button" onClick={() => setPick(choice.id as keyof Fe16Picks, opt.value)} className={chip(picked === opt.value)}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const KIND: Record<Fe16Learn['kind'], string> = { ability: 'ability', art: 'combat art', spell: 'spell' }

/** What a unit learns at each skill rank, a skill to a row; theirs alone in violet. */
export function LearnTable({ data, unit, everyone = false }: { data: Fe16Data; unit: Fe16Unit; everyone?: boolean }) {
  const all = everyone ? learnsOf(data, unit) : learnsOf({ ...data, rankRewards: [] }, unit)
  const own = new Set(unit.learns.map((l) => `${l.skill}/${l.rank}/${l.name}`))
  return (
    <div className="space-y-1 text-sm">
      {FE16_SKILLS.map((sk) => {
        const here = all.filter((l) => l.skill === sk)
        if (here.length === 0) return null
        return (
          <div key={sk}>
            <span className="text-neutral-500">{FE16_SKILL_LABELS[sk]}: </span>
            {here.map((l, i) => (
              <span key={`${l.rank}-${l.name}`} title={`${KIND[l.kind]}: ${helpOf(data, l) ?? ''}`}>
                {i > 0 && ', '}
                <span className={own.has(`${l.skill}/${l.rank}/${l.name}`) ? 'text-violet-300' : 'text-neutral-200'}>{l.name}</span>
                <span className="text-neutral-500"> {l.rank}</span>
              </span>
            ))}
          </div>
        )
      })}
    </div>
  )
}
