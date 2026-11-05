import { AssetIcon } from '../components/AssetIcon'
import { Portrait } from '../components/Portrait'
import { emblemFaceId, FEMALE_ALEAR, ringFaceId, skillIconId } from './art'
import { artId, selectClass } from './hooks'
import { ALEAR_FEMALE, fmt, labelOf, type Fe17Data } from './logic'
import { FE17_STATS, FE17_STAT_LABELS, type Fe17Stat, type Fe17StatsMov, type Fe17Unit } from './types'

// Engage's shared components.

export function UnitPortrait({ data, unit, size = 64 }: { data: Fe17Data; unit: Fe17Unit; size?: number }) {
  // The female Alear has her own portrait.
  return <Portrait characterId={artId(data.gameId, unit.id === ALEAR_FEMALE ? FEMALE_ALEAR : unit.name)} isChild={false} size={size} />
}

/** A Bond Ring's face: its hero as the Ring Chamber shows them (Bulk Upload's "rings" folder). */
export function RingFace({ data, ring, size = 36 }: { data: Fe17Data; ring: string; size?: number }) {
  return <Portrait characterId={ringFaceId(data.gameId, ring)} isChild={false} size={size} />
}

/** An Emblem's face, as the Somniel's ring book shows it (Bulk Upload's "emblems" folder). */
export function EmblemFace({ data, emblem, size = 64 }: { data: Fe17Data; emblem: string; size?: number }) {
  const face = (name: string) => <Portrait characterId={emblemFaceId(data.gameId, name)} isChild={false} size={size} />
  // The Emblem Alear is the player's Alear, a man or a woman: both faces.
  if (emblem === 'Alear')
    return (
      <span className="flex gap-1">
        {face(emblem)}
        {face(FEMALE_ALEAR)}
      </span>
    )
  return face(emblem)
}

/** A skill's icon, as the game draws it (Bulk Upload's "skills" folder). */
export function SkillIcon({ data, skill, size = 20 }: { data: Fe17Data; skill: string; size?: number }) {
  return <AssetIcon type="skill" iconId={skillIconId(data.gameId, skill)} label={skill} size={size} />
}

/** Skills in a row that wraps, each with its icon. */
export function SkillChips({ data, skills, size = 16 }: { data: Fe17Data; skills: { name: string; note?: string }[]; size?: number }) {
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
      {skills.map((s) => (
        <span key={s.name + (s.note ?? '')} className="inline-flex items-center gap-1 whitespace-nowrap">
          <SkillIcon data={data} skill={s.name} size={size} />
          {s.name}
          {s.note && <span className="text-neutral-500">{s.note}</span>}
        </span>
      ))}
    </span>
  )
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
                {labelOf(u)}
              </option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}

/** Skills with what each does, one to a line. */
export function SkillList({ data, skills }: { data: Fe17Data; skills: string[] }) {
  if (skills.length === 0) return <p className="text-sm text-neutral-500">None.</p>
  return (
    <ul className="space-y-1 text-sm">
      {skills.map((s) => (
        <li key={s} className="flex items-start gap-2">
          <SkillIcon data={data} skill={s} />
          <span>
            <span className="font-medium text-neutral-200">{s}</span>
            {data.skills[s] && <span className="text-neutral-400">: {data.skills[s]}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
