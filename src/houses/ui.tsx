import { StatBlocks } from '../components/StatBlocks'
import { AssetIcon } from '../components/AssetIcon'
import { PlanSets } from '../components/PlanSets'
import { Portrait } from '../components/Portrait'
import { skillIconId } from '../tellius/art'
import { artId, chip, selectClass } from './hooks'
import { fmt, groupOf, groupsFor, labelOf, type Fe16Choice, type Fe16Data, type Fe16Picks } from './logic'
import { useFe16Builds, useFe16Store } from './store'
import { FE16_SKILL_LABELS, FE16_SKILLS, FE16_STATS, FE16_STAT_LABELS, type Fe16Stats, type Fe16Unit } from './types'

// Three Houses' shared components.

export function UnitPortrait({ data, unit, size = 64 }: { data: Fe16Data; unit: Fe16Unit; size?: number }) {
  return <Portrait characterId={artId(data.gameId, labelOf(unit))} isChild={false} size={size} />
}

/** An ability's or combat art's icon, as the game draws it (Bulk Upload's "skills" folder): an ability's square, with a "+" in its
 * corner where it has one, a combat art's round. Spells have none of their own. */
export function SkillIcon({ data, skill, size = 20 }: { data: Fe16Data; skill: string; size?: number }) {
  return <AssetIcon type="skill" iconId={skillIconId(data.gameId, skill)} label={skill} size={size} shape={skill in data.arts ? 'round' : 'square'} />
}

/** Abilities and combat arts in a row that wraps, each with its icon. */
export function SkillChips({ data, skills, size = 16 }: { data: Fe16Data; skills: string[]; size?: number }) {
  return (
    <span className="inline-flex flex-wrap gap-x-2 gap-y-0.5 align-top">
      {skills.map((s) => (
        <span key={s} className="inline-flex items-center gap-1 whitespace-nowrap">
          <SkillIcon data={data} skill={s} size={size} />
          {s}
        </span>
      ))}
    </span>
  )
}

type Row = { label: string; values: Partial<Fe16Stats> & { mov?: number }; caps?: Partial<Fe16Stats>; suffix?: string; mov?: boolean }

/** Rows of stats, each a block of stats four to a line (as Fates' planner), Mov where a row has it; a stat at its cap is green. */
export function StatTable({ rows }: { rows: Row[] }) {
  return (
    <StatBlocks
      stats={[...FE16_STATS, 'mov'] as const}
      labels={FE16_STAT_LABELS}
      fmt={fmt}
      rows={rows.map((r) => ({ label: r.label, values: r.mov ? r.values : { ...r.values, mov: undefined }, caps: r.caps, suffix: r.suffix }))}
    />
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
      {groupsFor(picks.house).map((g) => {
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

/** One of the Roster's picks, as buttons. `onPick` runs after a pick (the spoiler block moves on with the house). */
export function ChoicePicker({ choice, onPick }: { choice: Fe16Choice; onPick?: (value: string | null) => void }) {
  const picked = useFe16Store((s) => s.picks[choice.id as keyof Fe16Picks])
  const setPick = useFe16Store((s) => s.setPick)
  const pick = (value: string | null) => {
    setPick(choice.id, value)
    onPick?.(value)
  }
  return (
    <div className="space-y-1.5 rounded-md border border-neutral-800 bg-neutral-900/60 p-2">
      <div className="text-xs text-neutral-400">{choice.question}</div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => pick(null)} className={chip(picked === undefined)}>
          Not picked
        </button>
        {choice.options.map((opt) => (
          <button key={opt.value} type="button" onClick={() => pick(opt.value)} className={chip(picked === opt.value)}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The ranks a unit starts with, their strengths and weaknesses, and a budding talent. */
export function SkillRanks({ data, unit }: { data: Fe16Data; unit: Fe16Unit }) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-4">
        {FE16_SKILLS.map((sk) => {
          const strong = unit.strengths.includes(sk)
          const weak = unit.weaknesses.includes(sk)
          const bud = unit.budding?.skill === sk
          return (
            <div key={sk} className="flex justify-between gap-2">
              <span className={strong ? 'text-emerald-400' : weak ? 'text-red-400' : 'text-neutral-400'}>
                {FE16_SKILL_LABELS[sk]}
                {strong ? ' ▲' : weak ? ' ▼' : ''}
                {bud ? ' ✦' : ''}
              </span>
              <span className="tabular-nums text-neutral-200">{unit.ranks[sk] ?? 'E'}</span>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-neutral-500">
        ▲ a strength, ▼ a weakness (skill EXP comes faster or slower).
        {unit.budding && (
          <>
            {' '}
            ✦ a budding talent: {FE16_SKILL_LABELS[unit.budding.skill]}, which teaches {unit.budding.name}
            {data.abilities[unit.budding.name] || data.arts[unit.budding.name] ? ` (${data.abilities[unit.budding.name] ?? data.arts[unit.budding.name]})` : ''}.
          </>
        )}
      </p>
    </div>
  )
}


/** Saved sets of every unit's plan and the Roster's picks (as Fates' Build Sets), at the foot of the planners and the Bulk Viewer. */
export function Fe16PlanSets() {
  const plans = useFe16Store((s) => s.plans)
  const picks = useFe16Store((s) => s.picks)
  const load = useFe16Store((s) => s.load)
  const { sets, save, rename, deleteSet } = useFe16Builds()
  return (
    <PlanSets
      sets={sets}
      onSave={(name) => save(name, plans, picks)}
      onLoad={(id) => {
        const set = sets.find((x) => x.id === id)
        if (set) load(set.plans, set.picks)
      }}
      onRename={rename}
      onDelete={deleteSet}
    />
  )
}
