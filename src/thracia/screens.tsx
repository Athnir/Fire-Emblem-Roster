import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Portrait } from '../components/Portrait'
import { useScreenshotContextStore } from '../state/screenshotContextStore'
import { FE5_STATS, FE5_STAT_LABELS, type Fe5Class, type Fe5Scroll, type Fe5Stats, type Fe5Support, type Fe5Unit } from './types'

/** Everything Thracia 776's screens need, passed in so the screens don't import the game's data. */
export interface Fe5Data {
  gameId: string
  chapters: { id: string; label: string }[]
  units: Fe5Unit[]
  classes: Record<string, Fe5Class>
  supports: Fe5Support[]
  scrolls: Fe5Scroll[]
}

/** The level cap; a Knight Proof promotes from level 10 and starts the new class at level 1 (Serenes Forest). */
const MAX_LEVEL = 20
const PROMOTE_LEVEL = 10

/** The game holds HP at 80 and the other stats at 20 at a level-up ($85:F0A9; Con and Mov are taken the same, unconfirmed). */
function capsOf(): Fe5Stats {
  return Object.fromEntries(FE5_STATS.map((s) => [s, s === 'hp' ? 80 : 20])) as Fe5Stats
}

interface ScrollSegment {
  scrollId: string
  levels: number
}

interface Fe5Plan {
  promoteTo: string | null
  promoteAt: number
  targetLevel: number
  scrolls?: ScrollSegment[]
}

interface Fe5State {
  plans: Record<string, Fe5Plan>
  setPlan: (unitId: string, plan: Fe5Plan | null) => void
}

/** Saved under `fe-roster-fe5`, so the backup (src/logic/backup.ts) picks it up. */
const useFe5Store = create<Fe5State>()(
  persist(
    (set) => ({
      plans: {},
      setPlan: (unitId, plan) =>
        set((state) => {
          const plans = { ...state.plans }
          if (plan) plans[unitId] = plan
          else delete plans[unitId]
          return { plans }
        }),
    }),
    { name: 'fe-roster-fe5' },
  ),
)

const selectClass = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200'

function artId(gameId: string, name: string): string {
  return `${gameId}/${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
}

function UnitPortrait({ data, unit, size = 64 }: { data: Fe5Data; unit: Fe5Unit; size?: number }) {
  return <Portrait characterId={artId(data.gameId, unit.name)} isChild={false} size={size} />
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

function StatTable({ rows }: { rows: { label: string; values: Fe5Stats; caps?: Fe5Stats; suffix?: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-sm">
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
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-neutral-800">
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

function useScreenshotUnit(unit: Fe5Unit | undefined) {
  const setUnitLabel = useScreenshotContextStore((state) => state.setUnitLabel)
  useEffect(() => {
    setUnitLabel(unit?.name ?? '')
    return () => setUnitLabel('')
  }, [unit, setUnitLabel])
}

function chapterLabel(data: Fe5Data, id: string): string {
  return data.chapters.find((c) => c.id === id)?.label ?? id
}

function joinText(data: Fe5Data, u: Fe5Unit): string {
  const where = chapterLabel(data, u.joinChapter)
  const j = u.join
  if (j.how === 'talk') return `${where}: talk to them with ${j.with?.join(' or ') ?? 'another unit'}`
  if (j.how === 'event') return `${where}: joins ${j.turn ? `on turn ${j.turn}` : 'during the chapter'}`
  if (j.how === 'end') return `${where}: joins at the end of the chapter`
  return `${where}: joins at the start`
}

function UnitSelect({ data, value, onChange }: { data: Fe5Data; value: string; onChange: (id: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${selectClass} w-full max-w-xs`}>
      {data.chapters.map((ch) => {
        const units = data.units.filter((u) => u.joinChapter === ch.id)
        if (units.length === 0) return null
        return (
          <optgroup key={ch.id} label={ch.label}>
            {units.map((u) => (
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

function supportLines(data: Fe5Data, unitId: string) {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const gets = data.supports.filter((s) => s.gets === unitId).map((s) => ({ unit: byId.get(s.gives)!, bonus: s.bonus }))
  const gives = data.supports.filter((s) => s.gives === unitId).map((s) => ({ unit: byId.get(s.gets)!, bonus: s.bonus }))
  return { gets, gives }
}

function UnitDetail({ data, unit }: { data: Fe5Data; unit: Fe5Unit }) {
  const cls = data.classes[unit.classId]
  const { gets, gives } = supportLines(data, unit.id)
  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <UnitPortrait data={data} unit={unit} size={128} />
        <div className="space-y-1 text-sm text-neutral-300">
          <h3 className="text-lg font-semibold text-neutral-100">{unit.name}</h3>
          <div>
            {cls.name} · Lv {unit.level}
            {unit.promotesTo && (
              <span className="text-neutral-500"> · promotes to {unit.promotesTo.map((c) => data.classes[c]?.name).join(' or ')}</span>
            )}
          </div>
          <div>
            <span className="text-neutral-500">Joins: </span>
            {joinText(data, unit)}
          </div>
          {unit.join.note && <div className="text-neutral-400">{unit.join.note}</div>}
          <div>
            <span className="text-neutral-500">Movement stars </span>
            {unit.moveStars}
            <span className="ml-4 text-neutral-500">Pursuit critical </span>
            {unit.pcc}
            {unit.leadership ? (
              <>
                <span className="ml-4 text-neutral-500">Leadership </span>
                {'★'.repeat(unit.leadership)}
              </>
            ) : null}
          </div>
          {Object.keys(unit.ranks).length > 0 && (
            <div>
              <span className="text-neutral-500">Weapons </span>
              {Object.entries(unit.ranks)
                .map(([w, r]) => `${w[0].toUpperCase()}${w.slice(1)} ${r}`)
                .join(', ')}
            </div>
          )}
        </div>
      </div>
      <StatTable
        rows={[
          { label: 'Bases', values: unit.bases, caps: capsOf() },
          { label: 'Growths', values: unit.growths, suffix: '%' },
        ]}
      />
      {(gets.length > 0 || gives.length > 0) && (
        <div className="space-y-1 text-sm text-neutral-300">
          <h4 className="text-sm font-semibold text-neutral-200">Supports</h4>
          {gets.length > 0 && (
            <div>
              <span className="text-neutral-500">Gets from: </span>
              {gets.map((g) => `${g.unit.name} (+${g.bonus})`).join(', ')}
            </div>
          )}
          {gives.length > 0 && (
            <div>
              <span className="text-neutral-500">Gives to: </span>
              {gives.map((g) => `${g.unit.name} (+${g.bonus})`).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Every playable unit by the chapter they join; tapping one shows their data below the list. */
export function Fe5Roster({ data }: { data: Fe5Data }) {
  const [selectedId, setSelectedId] = useState(data.units[0]?.id ?? '')
  const detailRef = useRef<HTMLDivElement>(null)
  const selected = data.units.find((u) => u.id === selectedId)
  useScreenshotUnit(selected)
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {data.chapters.map((ch) => {
          const units = data.units.filter((u) => u.joinChapter === ch.id)
          if (units.length === 0) return null
          return (
            <div key={ch.id}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{ch.label}</h3>
              <div className="flex flex-wrap gap-2">
                {units.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(u.id)
                      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
                    }}
                    className={`flex items-center gap-2 rounded-md border px-2 py-1 text-sm ${
                      u.id === selectedId ? 'border-violet-500 bg-violet-950/50 text-neutral-100' : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-600'
                    }`}
                  >
                    <UnitPortrait data={data} unit={u} size={32} />
                    {u.name}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div ref={detailRef} className="scroll-mt-4">
        {selected && <UnitDetail data={data} unit={selected} />}
      </div>
    </div>
  )
}

interface Stage {
  classId: string
  level: number
  stats: Fe5Stats
}

/** Average stats: each level adds the growth rate (plus the scroll carried for it), held at the caps. Promoting adds the
 * difference in the classes' bases (Serenes Forest's promotion gains are exactly that) and starts again at level 1. */
function project(data: Fe5Data, unit: Fe5Unit, plan: Fe5Plan): Stage[] {
  const caps = capsOf()
  const scrolls = new Map(data.scrolls.map((s) => [s.id, s]))
  const carried: (Fe5Scroll | undefined)[] = []
  for (const seg of plan.scrolls ?? []) for (let i = 0; i < seg.levels; i++) carried.push(scrolls.get(seg.scrollId))
  let k = 0
  const grow = (stats: Fe5Stats, levels: number) => {
    const out = { ...stats }
    for (let i = 0; i < levels; i++) {
      const scroll = carried[k++]
      for (const s of FE5_STATS) out[s] = Math.min(caps[s], out[s] + (unit.growths[s] + (scroll?.growths[s] ?? 0)) / 100)
    }
    return out
  }
  const stages: Stage[] = [{ classId: unit.classId, level: unit.level, stats: { ...unit.bases } }]
  const promoted = plan.promoteTo ? data.classes[plan.promoteTo] : undefined
  if (promoted) {
    const at = Math.max(unit.level, Math.min(MAX_LEVEL, plan.promoteAt))
    let stats = grow(unit.bases, at - unit.level)
    if (at > unit.level) stages.push({ classId: unit.classId, level: at, stats })
    stats = { ...stats }
    const from = data.classes[unit.classId]
    for (const s of FE5_STATS) stats[s] = Math.min(caps[s], stats[s] + promoted.bases[s] - from.bases[s])
    stages.push({ classId: promoted.id, level: 1, stats })
    const target = Math.max(1, Math.min(MAX_LEVEL, plan.targetLevel))
    if (target > 1) stages.push({ classId: promoted.id, level: target, stats: grow(stats, target - 1) })
    return stages
  }
  const target = Math.max(unit.level, Math.min(MAX_LEVEL, plan.targetLevel))
  if (target > unit.level) stages.push({ classId: unit.classId, level: target, stats: grow(unit.bases, target - unit.level) })
  return stages
}

function levelUpsIn(unit: Fe5Unit, plan: Fe5Plan): number {
  if (plan.promoteTo) {
    const at = Math.max(unit.level, Math.min(MAX_LEVEL, plan.promoteAt))
    return at - unit.level + Math.max(0, Math.min(MAX_LEVEL, plan.targetLevel) - 1)
  }
  return Math.max(0, Math.min(MAX_LEVEL, plan.targetLevel) - unit.level)
}

function ScrollEditor({ data, unit, plan, onChange }: { data: Fe5Data; unit: Fe5Unit; plan: Fe5Plan; onChange: (s: ScrollSegment[]) => void }) {
  const segments = plan.scrolls ?? []
  const total = levelUpsIn(unit, plan)
  const used = segments.reduce((sum, s) => sum + s.levels, 0)
  const remaining = total - used
  const update = (i: number, patch: Partial<ScrollSegment>) => onChange(segments.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-neutral-200">
        Holy scrolls <span className={`text-xs font-normal ${used > total ? 'text-red-400' : 'text-neutral-500'}`}>{used} / {total} level-ups planned</span>
      </h4>
      <p className="text-xs text-neutral-500">A scroll carried adds its growth changes to each level-up, in order from when the unit joins.</p>
      {segments.map((seg, i) => {
        const scroll = data.scrolls.find((s) => s.id === seg.scrollId)
        return (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-800 p-2 text-xs">
            <select value={seg.scrollId} onChange={(e) => update(i, { scrollId: e.target.value })} className={selectClass}>
              {data.scrolls.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-neutral-400">
              Level-ups
              <select value={seg.levels} onChange={(e) => update(i, { levels: Number(e.target.value) })} className={selectClass}>
                {Array.from({ length: Math.max(1, seg.levels + Math.max(0, remaining)) }, (_, n) => n + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            {scroll && (
              <span className="text-neutral-400">
                {FE5_STATS.filter((s) => scroll.growths[s])
                  .map((s) => `${FE5_STAT_LABELS[s]} ${scroll.growths[s] > 0 ? '+' : ''}${scroll.growths[s]}%`)
                  .join(', ')}
              </span>
            )}
            <button type="button" onClick={() => onChange(segments.filter((_, j) => j !== i))} className="ml-auto text-neutral-500 hover:text-red-400">
              Remove
            </button>
          </div>
        )
      })}
      <button
        type="button"
        disabled={remaining <= 0}
        onClick={() => onChange([...segments, { scrollId: data.scrolls[0].id, levels: remaining }])}
        className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-600 disabled:opacity-40"
      >
        + Add scroll
      </button>
    </div>
  )
}

/** One unit's average stats through a promotion, with the holy scrolls they carry. Saved per unit. */
export function Fe5Planner({ data }: { data: Fe5Data }) {
  const [unitId, setUnitId] = useState(data.units[0]?.id ?? '')
  const unit = data.units.find((u) => u.id === unitId)
  useScreenshotUnit(unit)
  const plans = useFe5Store((s) => s.plans)
  const setPlan = useFe5Store((s) => s.setPlan)
  if (!unit) return null
  const plan: Fe5Plan = plans[unit.id] ?? { promoteTo: unit.promotesTo?.[0] ?? null, promoteAt: MAX_LEVEL, targetLevel: MAX_LEVEL }
  const update = (patch: Partial<Fe5Plan>) => setPlan(unit.id, { ...plan, ...patch })
  const stages = project(data, unit, plan)
  const levels = (from: number) => Array.from({ length: MAX_LEVEL - from + 1 }, (_, i) => from + i)
  const finalClass = data.classes[stages[stages.length - 1].classId]
  return (
    <div className="space-y-4">
      <UnitSelect data={data} value={unitId} onChange={setUnitId} />
      <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex flex-wrap items-end gap-4 text-sm text-neutral-300">
          {unit.promotesTo && (
            <>
              <label className="space-y-1">
                <span className="block text-xs text-neutral-500">Promote to</span>
                <select value={plan.promoteTo ?? ''} onChange={(e) => update({ promoteTo: e.target.value || null })} className={selectClass}>
                  <option value="">Don't promote</option>
                  {unit.promotesTo.map((c) => (
                    <option key={c} value={c}>
                      {data.classes[c]?.name}
                    </option>
                  ))}
                </select>
              </label>
              {plan.promoteTo && (
                <label className="space-y-1">
                  <span className="block text-xs text-neutral-500">At Lv</span>
                  <select value={Math.max(plan.promoteAt, unit.level)} onChange={(e) => update({ promoteAt: Number(e.target.value) })} className={selectClass}>
                    {levels(Math.max(PROMOTE_LEVEL, unit.level)).map((lv) => (
                      <option key={lv} value={lv}>
                        {lv}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
          <label className="space-y-1">
            <span className="block text-xs text-neutral-500">Up to Lv (as {finalClass.name})</span>
            <select value={plan.targetLevel} onChange={(e) => update({ targetLevel: Number(e.target.value) })} className={selectClass}>
              {levels(plan.promoteTo ? 1 : unit.level).map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
          </label>
          {plans[unit.id] && (
            <button type="button" onClick={() => setPlan(unit.id, null)} className="rounded-md bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700">
              Reset
            </button>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          Average stats: each level adds the growth rate. HP stops at 80 and every other stat at 20 (green), as the game's level-up
          code holds them. A Knight Proof promotes from Lv 10, adds the difference between the classes' bases and starts again at Lv 1.
          {unit.promotesTo && unit.promotesTo.length > 1 && ' Which of these classes the game gives this unit isn\'t found in its code yet, so both are offered.'}
        </p>
        <StatTable
          rows={stages.map((st, i) => ({
            label: `${data.classes[st.classId].name} Lv ${st.level}${i === 0 ? ' (joins)' : ''}`,
            values: st.stats,
            caps: capsOf(),
          }))}
        />
        <ScrollEditor data={data} unit={unit} plan={plan} onChange={(scrolls) => update({ scrolls })} />
      </div>
    </div>
  )
}

/** Who gives whom a bonus: the table goes one way per entry, so a unit's gets and gives are listed apart. */
export function Fe5Supports({ data }: { data: Fe5Data }) {
  const [unitId, setUnitId] = useState(data.units[0]?.id ?? '')
  const unit = data.units.find((u) => u.id === unitId)
  useScreenshotUnit(unit)
  const lines = unit ? supportLines(data, unit.id) : { gets: [], gives: [] }
  const list = (title: string, items: { unit: Fe5Unit; bonus: number }[]) => (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold text-neutral-200">{title}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">No one.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((it) => (
            <button key={it.unit.id} type="button" onClick={() => setUnitId(it.unit.id)} className="flex items-center gap-2 rounded-md border border-neutral-800 px-2 py-1 text-sm text-neutral-200 hover:border-neutral-600">
              <UnitPortrait data={data} unit={it.unit} size={28} />
              {it.unit.name} <span className="text-emerald-400">+{it.bonus}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
  return (
    <div className="space-y-4">
      <UnitSelect data={data} value={unitId} onChange={setUnitId} />
      {unit && (
        <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-xs text-neutral-500">
            Thracia 776 has no support levels: a unit gets its partner's bonus to hit, avoid, crit and crit avoid whenever the partner is
            alive, on the map and within 3 tiles (the game's support code, $83:E5A5). The table goes one way per entry.
          </p>
          {list(`${unit.name} gets a bonus from`, lines.gets)}
          {list(`${unit.name} gives a bonus to`, lines.gives)}
        </div>
      )}
    </div>
  )
}
