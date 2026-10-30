import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Portrait } from '../components/Portrait'
import { useScreenshotContextStore } from '../state/screenshotContextStore'
import {
  MAX_LEVEL,
  SEAL_LEVEL,
  capsOf,
  childOf,
  childrenOf,
  classOptions,
  classSetOf,
  isFamilyBlocked,
  isMorgan,
  project,
  sameUnit,
  skillsOf,
  spousesOf,
  type Fe13Child,
  type Fe13Data,
  type Fe13Parent,
  type Fe13Plan,
} from './logic'
import { useFe13Store } from './store'
import { FE13_STATS, FE13_STAT_LABELS, type Fe13Stats, type Fe13Unit } from './types'

const selectClass = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200'
const panel = 'space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4'

function artId(name: string): string {
  return `fe13/${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
}

function UnitPortrait({ unit, size = 64 }: { unit: Fe13Unit; size?: number }) {
  return <Portrait characterId={artId(unit.name)} isChild={!!unit.parent} size={size} />
}

function fmt(v: number | undefined): string {
  if (v === undefined) return '–'
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

function useScreenshotUnit(unit: Fe13Unit | undefined) {
  const setUnitLabel = useScreenshotContextStore((state) => state.setUnitLabel)
  useEffect(() => {
    setUnitLabel(unit?.name ?? '')
    return () => setUnitLabel('')
  }, [unit, setUnitLabel])
}

type Row = { label: string; values: Partial<Fe13Stats & { mov: number }>; caps?: Partial<Fe13Stats>; suffix?: string; signed?: boolean }

function StatTable({ rows, mov = false }: { rows: Row[]; mov?: boolean }) {
  const cols = [...FE13_STATS, ...(mov ? (['mov'] as const) : [])]
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-sm">
        <thead>
          <tr className="text-xs text-neutral-500">
            <th className="py-1 pr-2 text-left font-normal" />
            {cols.map((s) => (
              <th key={s} className="px-1 py-1 text-right font-normal">
                {FE13_STAT_LABELS[s]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-neutral-800">
              <td className="whitespace-nowrap py-1 pr-2 text-xs text-neutral-400">{row.label}</td>
              {cols.map((s) => {
                const v = row.values[s]
                const cap = s === 'mov' ? undefined : row.caps?.[s]
                return (
                  <td key={s} className={`px-1 py-1 text-right tabular-nums ${v !== undefined && cap !== undefined && v >= cap ? 'text-emerald-400' : 'text-neutral-200'}`}>
                    {row.signed && v !== undefined && v > 0 ? '+' : ''}
                    {fmt(v)}
                    {v !== undefined ? (row.suffix ?? '') : ''}
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

function chapterLabel(data: Fe13Data, id: string): string {
  return data.chapters.find((c) => c.id === id)?.label ?? id
}

function joinText(data: Fe13Data, u: Fe13Unit): string {
  const where = chapterLabel(data, u.joinChapter)
  const j = u.join
  if (j.how === 'talk') return `${where}: talk with ${j.with?.join(' or ') ?? 'another unit'}`
  if (j.how === 'visit') return `${where}: visit a village${j.with?.length ? ` with ${j.with.join(' or ')}` : ''}`
  if (j.how === 'event') return `${where}: joins ${j.turn ? `on turn ${j.turn}` : 'during the chapter'}`
  if (j.how === 'end') return `${where}: joins at the end of the chapter`
  return `${where}: joins at the start`
}

function UnitSelect({ data, value, onChange }: { data: Fe13Data; value: string; onChange: (id: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${selectClass} w-full max-w-xs`}>
      {data.chapters.map((ch) => {
        const units = data.units.filter((u) => u.joinChapter === ch.id)
        if (!units.length) return null
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

function names(data: Fe13Data, ids: string[]): string {
  return ids.map((id) => data.classes[id]?.name ?? id).join(', ')
}

function UnitDetail({ data, unit }: { data: Fe13Data; unit: Fe13Unit }) {
  const cls = data.classes[unit.classId]
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const total = {} as Fe13Stats
  for (const s of FE13_STATS) total[s] = unit.growths[s] + (cls.growths?.[s] ?? 0)
  const spouses = spousesOf(data, unit)
  return (
    <div className={panel}>
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <UnitPortrait unit={unit} size={128} />
        <div className="space-y-1 text-sm text-neutral-300">
          <h3 className="text-lg font-semibold text-neutral-100">{unit.name}</h3>
          <div>
            {cls.name} · Lv {unit.level}
            {cls.promotesTo.length > 0 && <span className="text-neutral-500"> · promotes to {names(data, cls.promotesTo)}</span>}
          </div>
          <div>
            <span className="text-neutral-500">Joins: </span>
            {joinText(data, unit)}
          </div>
          {unit.join.note && <div className="text-neutral-400">{unit.join.note}</div>}
          {unit.parent && (
            <div>
              <span className="text-neutral-500">Parent: </span>
              {byId.get(unit.parent)?.name ?? unit.parent}
            </div>
          )}
          <div>
            <span className="text-neutral-500">Classes (Second Seal): </span>
            {names(data, classSetOf(unit))}
          </div>
          {spouses.length > 0 && (
            <div>
              <span className="text-neutral-500">Can marry: </span>
              {spouses.map((u) => u.name).join(', ')}
            </div>
          )}
        </div>
      </div>
      <StatTable
        mov
        rows={[
          { label: unit.parent ? 'Bases (own part)' : 'Bases', values: unit.bases },
          { label: 'Personal growths', values: unit.growths, suffix: '%' },
          { label: `Growths as a ${cls.name}`, values: total, suffix: '%' },
          { label: 'Modifiers', values: unit.modifiers, signed: true },
          { label: `Maximums (${cls.name})`, values: capsOf(cls, unit.modifiers) },
        ]}
      />
      {unit.parent && (
        <p className="text-xs text-neutral-500">
          A child's real bases also take after their parents' stats when they join; these are the class's plus the child's own. The
          Marriage Planner shows what they join with.
        </p>
      )}
    </div>
  )
}

/** Everyone by the chapter they join; tapping one shows their data below the list. */
export function Fe13Roster({ data }: { data: Fe13Data }) {
  const [selectedId, setSelectedId] = useState(data.units[0]?.id ?? '')
  const detailRef = useRef<HTMLDivElement>(null)
  const selected = data.units.find((u) => u.id === selectedId) ?? data.units[0]
  useScreenshotUnit(selected)
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {data.chapters.map((ch) => {
          const units = data.units.filter((u) => u.joinChapter === ch.id)
          if (!units.length) return null
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
                      u.id === selected?.id ? 'border-violet-500 bg-violet-950/50 text-neutral-100' : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-600'
                    }`}
                  >
                    <UnitPortrait unit={u} size={32} />
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

const MAX_STEPS = 4

/** One unit's average stats through Master and Second Seals. Saved per unit. */
export function Fe13Planner({ data }: { data: Fe13Data }) {
  const [unitId, setUnitId] = useState(data.units[0]?.id ?? '')
  const unit = data.units.find((u) => u.id === unitId) ?? data.units[0]
  useScreenshotUnit(unit)
  const saved = useFe13Store((s) => s.plans[unit.id])
  const spouses = useFe13Store((s) => s.spouses)
  const plans = useFe13Store((s) => s.plans)
  const setPlan = useFe13Store((s) => s.setPlan)
  const plan: Fe13Plan = saved ?? { steps: [], targetLevel: MAX_LEVEL }
  const update = (patch: Partial<Fe13Plan>) => setPlan(unit.id, { ...plan, ...patch })
  // A child whose parent is married in the Marriage Planner joins with what they inherit (Morgan in the other parent's class).
  const child = unit.parent ? childOf(data, unit, spouses, plans) : null
  const start = child ? { ...unit, classId: child.startClass } : unit
  const set = child ? child.classes : classSetOf(unit)
  const growths = child ? child.growths : unit.growths
  const modifiers = child ? child.modifiers : unit.modifiers
  const stages = project(data, start, plan, child ? child.bases : unit.bases, growths, modifiers)
  let current = start.classId
  let fromLevel = unit.level
  const rows = plan.steps.map((step, i) => {
    const options = classOptions(data, unit, current, set)
    const row = { i, step, from: current, fromLevel, options }
    current = step.to
    fromLevel = 1
    return row
  })
  const finalClass = data.classes[current]
  const levels = (from: number) => Array.from({ length: MAX_LEVEL - from + 1 }, (_, i) => from + i)
  const setStep = (i: number, patch: Partial<{ at: number; to: string }>) => {
    const steps = plan.steps.slice(0, i + 1).map((s, k) => (k === i ? { ...s, ...patch } : s))
    // Changing a step's class drops the steps after it: their choices may not be open any more.
    update({ steps: patch.to ? steps : [...steps, ...plan.steps.slice(i + 1)] })
  }
  const nextOptions = classOptions(data, unit, current, set)
  return (
    <div className="space-y-4">
      <UnitSelect data={data} value={unit.id} onChange={setUnitId} />
      <div className={panel}>
        <div className="space-y-2 text-sm text-neutral-300">
          {rows.map(({ i, step, from, fromLevel: lv, options }) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <label className="space-y-1">
                <span className="block text-xs text-neutral-500">{data.classes[from].name} changes to</span>
                <select value={step.to} onChange={(e) => setStep(i, { to: e.target.value })} className={selectClass}>
                  {options.map((id) => (
                    <option key={id} value={id}>
                      {data.classes[id].name}
                      {data.classes[from].promotesTo.includes(id) ? ' (Master Seal)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="block text-xs text-neutral-500">At Lv</span>
                <select value={step.at} onChange={(e) => setStep(i, { at: Number(e.target.value) })} className={selectClass}>
                  {levels(Math.max(SEAL_LEVEL, lv)).map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => update({ steps: plan.steps.slice(0, i) })} className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700">
                Remove
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-3">
            {plan.steps.length < MAX_STEPS && nextOptions.length > 0 && (
              <button
                type="button"
                onClick={() => update({ steps: [...plan.steps, { at: MAX_LEVEL, to: (finalClass.promotesTo[0] ?? nextOptions[0]) as string }] })}
                className="rounded-md bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700"
              >
                Add a class change
              </button>
            )}
            <label className="space-y-1">
              <span className="block text-xs text-neutral-500">Up to Lv (as {finalClass.name})</span>
              <select value={Math.max(rows.length ? 1 : unit.level, plan.targetLevel)} onChange={(e) => update({ targetLevel: Number(e.target.value) })} className={selectClass}>
                {levels(rows.length ? 1 : unit.level).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {saved && (
              <button type="button" onClick={() => setPlan(unit.id, null)} className="rounded-md bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700">
                Reset
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-neutral-500">
          Average stats: each level adds the personal growth and the class's. Stats stop at the class's maximums plus the unit's modifiers
          (green). A Master Seal promotes and a Second Seal changes to any class of the unit's set, from Lv {SEAL_LEVEL}; the new class
          starts at Lv 1 and its bases replace the old one's (Serenes Forest; not traced in the game's code).
          {child
            ? ` As ${child.fixed.unit.name} and ${child.other.unit.name}'s child, with what they inherit (the Marriage Planner).`
            : unit.parent
              ? ' Marry their parent in the Marriage Planner to plan them with what they inherit.'
              : ''}
        </p>
        <StatTable
          rows={stages.map((st, i) => ({
            label: `${data.classes[st.classId].name} Lv ${st.level}${i === 0 ? ' (joins)' : ''}`,
            values: st.stats,
            caps: capsOf(data.classes[st.classId], modifiers),
          }))}
        />
        <p className="text-sm text-neutral-300">
          <span className="text-neutral-500">Skills learned: </span>
          {skillsOf(data, stages).join(', ') || 'none'}
        </p>
      </div>
    </div>
  )
}

/** Each partner and the points C, B, A and S need. */
export function Fe13Supports({ data }: { data: Fe13Data }) {
  const [unitId, setUnitId] = useState(data.units[0]?.id ?? '')
  const unit = data.units.find((u) => u.id === unitId) ?? data.units[0]
  useScreenshotUnit(unit)
  const byId = new Map(data.units.map((u) => [u.id, u]))
  return (
    <div className="space-y-4">
      <UnitSelect data={data} value={unit.id} onChange={setUnitId} />
      <div className={panel}>
        <div className="flex items-center gap-3">
          <UnitPortrait unit={unit} size={48} />
          <div className="font-semibold text-neutral-100">{unit.name}</div>
        </div>
        <p className="text-xs text-neutral-500">
          The support points each level needs, from the unit's own support list (the person data). Only an S support leads to marriage.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] text-sm">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="py-1 text-left font-normal">Partner</th>
                {['C', 'B', 'A', 'S'].map((l) => (
                  <th key={l} className="px-1 py-1 text-right font-normal">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unit.supports.map((s) => {
                const partner = byId.get(s.partner)
                if (!partner) return null
                return (
                  <tr key={s.partner} className="border-t border-neutral-800">
                    <td className="py-1">
                      <button type="button" onClick={() => setUnitId(partner.id)} className="flex items-center gap-2 text-neutral-200 hover:text-violet-300">
                        <UnitPortrait unit={partner} size={28} />
                        {partner.name}
                      </button>
                    </td>
                    {s.levels.map((v, i) => (
                      <td key={i} className="px-1 py-1 text-right tabular-nums text-neutral-300">
                        {v ?? '–'}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const button = 'rounded-md bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700'
const primaryButton = 'rounded-md bg-violet-600 px-3 py-1 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40'

const INHERITANCE_NOTE =
  "A child's growths are their own, their mother's and their father's added and divided by 3 (rounded down); their modifiers both parents' added, plus 1 (no +1 for a Morgan whose other parent is a child); their bases as they join both parents' current stats less their class's bases, plus the child's own, divided by 3, plus their class's bases. A child takes both parents' classes for their gender, but never Lord (only Lucina has it), Dancer or Conqueror; Taguel and Manakete pass only to Morgan. Morgan starts in the other parent's first class (Tactician if that's Lord, Dancer or Conqueror). From Serenes Forest and the Fire Emblem Wiki, not traced in the game's code; the gender swaps (Olivia's son gets Mercenary and Barbarian) are the game's own class sets. A parent's current stats are their Unit Planner plan's last row, or as they join."

function sourceText(data: Fe13Data, p: Fe13Parent): string {
  const at = `${data.classes[p.from.classId].name} Lv ${p.from.level}`
  return `${p.unit.name} ${p.from.planned ? `from their Unit Planner plan (${at})` : `as they join (${at})`}`
}

/** A child's inheritance: what they join with, their growths, modifiers and classes, and where their parents' numbers come from. */
function ChildCard({ data, result }: { data: Fe13Data; result: Fe13Child }) {
  const { child, fixed, other } = result
  const cls = data.classes[result.startClass]
  const total = {} as Fe13Stats
  for (const s of FE13_STATS) total[s] = result.growths[s] + (cls.growths?.[s] ?? 0)
  return (
    <div className={panel}>
      <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-300">
        <UnitPortrait unit={child} size={48} />
        <div>
          <div className="font-semibold text-neutral-100">{child.name}</div>
          <div className="text-xs text-neutral-500">
            {fixed.unit.name} and {other.unit.name} · joins as a {cls.name}
          </div>
        </div>
      </div>
      {other.via && (
        <p className="text-xs text-neutral-400">
          {other.unit.name} passes on what they inherited from {other.via.fixed.unit.name} and {other.via.other.unit.name} (assumed: the
          sources only say Morgan gets no +1).
        </p>
      )}
      {other.via === null && (
        <p className="text-xs text-amber-400">
          {other.unit.name}'s parents aren't in the plan, so their own growths, modifiers and classes are used. Marry{' '}
          {data.units.find((u) => u.id === other.unit.parent)?.name ?? 'their parent'} to see what they pass on.
        </p>
      )}
      <StatTable
        mov
        rows={[
          { label: 'Bases (as they join)', values: result.bases },
          { label: 'Personal growths', values: result.growths, suffix: '%' },
          { label: `Growths as a ${cls.name}`, values: total, suffix: '%' },
          { label: 'Modifiers', values: result.modifiers, signed: true },
        ]}
      />
      <p className="text-sm text-neutral-300">
        <span className="text-neutral-500">Classes: </span>
        {names(data, result.classes)}
      </p>
      <p className="text-xs text-neutral-500">
        Parents' stats: {sourceText(data, fixed)}; {sourceText(data, other)}.
      </p>
    </div>
  )
}

/** The plan's marriages as a tree: each marriage, its children, and under a married child their own marriage (Morgan's other parent
 * can be a child). */
function PlanTree({ data, spouses, onRemove }: { data: Fe13Data; spouses: Record<string, string>; onRemove: (id: string) => void }) {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const order = new Map(data.units.map((u, i) => [u.id, i]))
  const pairs = Object.entries(spouses).filter(([a, b]) => (order.get(a) ?? 0) < (order.get(b) ?? 0))
  // A marriage hangs under the marriage that gave one of the two as a child.
  const fromPair = (id: string) => {
    const p = byId.get(id)?.parent
    return p ? pairs.find(([x, y]) => x === p || y === p) : undefined
  }
  const roots = pairs.filter(([a, b]) => !fromPair(a) && !fromPair(b))
  const shown = new Set<string>()
  const node = ([a, b]: [string, string], depth: number): ReactNode => {
    shown.add(`${a}|${b}`)
    const kids = childrenOf(data, a, b)
    const married = kids.map((k) => pairs.find(([x, y]) => x === k.id || y === k.id)).filter((p): p is [string, string] => !!p && !shown.has(`${p[0]}|${p[1]}`))
    return (
      <li key={`${a}|${b}`} className={depth ? 'ml-4 border-l border-neutral-800 pl-3' : ''}>
        <div className="flex items-center justify-between gap-2 py-1">
          <span className="text-sm text-neutral-200">
            {byId.get(a)?.name} × {byId.get(b)?.name}
            {kids.length > 0 && <span className="ml-2 text-neutral-500">→ {kids.map((k) => k.name).join(' & ')}</span>}
          </span>
          <button type="button" onClick={() => onRemove(a)} className="shrink-0 text-xs text-neutral-500 hover:text-red-400">
            Remove
          </button>
        </div>
        {married.length > 0 && <ul>{married.map((p) => node(p, depth + 1))}</ul>}
      </li>
    )
  }
  if (!pairs.length) return <p className="text-sm text-neutral-500">No marriages added yet.</p>
  return <ul className="space-y-1">{roots.map((p) => node(p, 0))}</ul>
}

function Fe13PlanManager() {
  const saved = useFe13Store((s) => s.saved)
  const activePlanId = useFe13Store((s) => s.activePlanId)
  const spouses = useFe13Store((s) => s.spouses)
  const savePlan = useFe13Store((s) => s.savePlan)
  const loadPlan = useFe13Store((s) => s.loadPlan)
  const deletePlan = useFe13Store((s) => s.deletePlan)
  const renamePlan = useFe13Store((s) => s.renamePlan)
  const [name, setName] = useState('')
  const active = saved.find((p) => p.id === activePlanId)
  const empty = Object.keys(spouses).length === 0
  return (
    <div className={panel}>
      <h3 className="text-base font-semibold text-neutral-100">Saved Plans</h3>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={active ? `Update "${active.name}"` : 'e.g. Lunatic run'}
          className="min-w-[12rem] flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200"
        />
        <button
          type="button"
          disabled={empty}
          onClick={() => {
            const n = name.trim() || active?.name
            if (!n) return
            savePlan(n)
            setName('')
          }}
          className={primaryButton}
        >
          {active ? 'Save As / Update' : 'Save Current Plan'}
        </button>
      </div>
      {empty && <p className="text-xs text-neutral-500">Add at least one marriage before saving.</p>}
      {saved.length === 0 ? (
        <p className="text-sm text-neutral-500">No saved plans yet.</p>
      ) : (
        <ul className="space-y-2">
          {saved.map((p) => {
            const count = Object.keys(p.spouses).length / 2
            return (
              <li
                key={p.id}
                className={`flex items-center justify-between gap-2 rounded-md border ${p.id === activePlanId ? 'border-violet-500 bg-violet-950/40' : 'border-neutral-800 bg-neutral-950'}`}
              >
                <button type="button" onClick={() => loadPlan(p.id)} className="min-w-0 flex-1 px-3 py-2 text-left hover:bg-neutral-800/60" title="Tap to load this plan">
                  <div className="truncate text-sm font-medium text-neutral-200">{p.name}</div>
                  <div className="text-xs text-neutral-500">
                    {count} marriage{count === 1 ? '' : 's'}
                  </div>
                </button>
                <div className="flex shrink-0 gap-2 px-3 py-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const next = window.prompt('Rename plan', p.name)
                      if (next && next.trim()) renamePlan(p.id, next.trim())
                    }}
                    className="text-neutral-400 hover:text-neutral-200"
                  >
                    Rename
                  </button>
                  <button type="button" onClick={() => deletePlan(p.id)} className="text-neutral-400 hover:text-red-400">
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Marriages, as the Fates Marriage Planner builds them: pick someone, then one of their S partners, see the children, and add the
 * marriage to the plan. The plan shows as a tree, with every child it gives below. */
export function Fe13MarriagePlanner({ data }: { data: Fe13Data }) {
  const spouses = useFe13Store((s) => s.spouses)
  const plans = useFe13Store((s) => s.plans)
  const marry = useFe13Store((s) => s.marry)
  const clearSpouses = useFe13Store((s) => s.clearSpouses)
  const [primaryId, setPrimaryId] = useState('')
  const [spouseId, setSpouseId] = useState('')
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const primary = byId.get(primaryId)
  const spouse = byId.get(spouseId)
  useScreenshotUnit(primary)
  // Someone already married (either Avatar, for the Avatar) is out of a new marriage.
  const assigned = (id: string) => Object.keys(spouses).some((k) => sameUnit(k, id))
  const fixedParents = new Set(data.units.map((u) => u.parent).filter(Boolean))
  const free = data.units.filter((u) => spousesOf(data, u).length > 0 && !assigned(u.id))
  const options = primary ? spousesOf(data, primary).filter((p) => !assigned(p.id) && !isFamilyBlocked(data, primary.id, p.id, spouses)) : []
  const preview = primary && spouse ? { ...spouses, [primary.id]: spouse.id, [spouse.id]: primary.id } : null
  const direct = primary && spouse ? childrenOf(data, primary.id, spouse.id) : []
  // A Morgan whose other parent is one of this marriage's children changes with it too.
  const indirect = preview ? data.units.filter((u) => isMorgan(u) && u.parent && direct.some((d) => d.id === preview[u.parent!])) : []
  const children = data.units.filter((u) => u.parent)
  const planned = children.map((c) => childOf(data, c, spouses, plans)).filter((r): r is Fe13Child => !!r)
  const waiting = children.filter((c) => !planned.some((r) => r.child.id === c.id))
  const count = Object.keys(spouses).length / 2
  const clear = () => {
    setPrimaryId('')
    setSpouseId('')
  }
  const option = (u: Fe13Unit) => (
    <option key={u.id} value={u.id}>
      {u.name}
    </option>
  )
  return (
    <div className="space-y-6">
      <div className={panel}>
        <h3 className="text-base font-semibold text-neutral-100">New Marriage</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            value={primaryId}
            onChange={(e) => {
              setPrimaryId(e.target.value)
              setSpouseId('')
            }}
            className={selectClass}
          >
            <option value="">Select someone…</option>
            <optgroup label="Has a child with any spouse">{free.filter((u) => fixedParents.has(u.id)).map(option)}</optgroup>
            <optgroup label="Others">{free.filter((u) => !fixedParents.has(u.id)).map(option)}</optgroup>
          </select>
          <select value={spouseId} onChange={(e) => setSpouseId(e.target.value)} disabled={!primary} className={`${selectClass} disabled:opacity-50`}>
            <option value="">{primary ? 'Select a spouse…' : 'Select someone first…'}</option>
            {options.map(option)}
          </select>
          {primary && !spouse && (
            <p className="text-xs text-neutral-500 sm:col-span-2">
              {options.length
                ? `Only ${primary.name}'s S-support partners who aren't married in the plan or family.`
                : `Everyone ${primary.name} can marry is married in the plan or family.`}
            </p>
          )}
        </div>
        {preview && primary && spouse && (
          <div className="space-y-3">
            {direct.length === 0 && (
              <p className="text-sm text-amber-400">
                {primary.name} and {spouse.name} have no child{primary.parent && spouse.parent ? ' (children who marry each other have none)' : ''}.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {[...direct, ...indirect].map((c) => {
                const r = childOf(data, c, preview, plans)
                return r ? <ChildCard key={c.id} data={data} result={r} /> : null
              })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  marry(primary.id, spouse.id)
                  clear()
                }}
                className={primaryButton}
              >
                Add to Plan
              </button>
              <button type="button" onClick={clear} className={button}>
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-neutral-100">Current Plan ({count})</h3>
          {count > 0 && (
            <button type="button" onClick={clearSpouses} className="text-xs text-neutral-500 hover:text-red-400">
              Clear all
            </button>
          )}
        </div>
        <PlanTree data={data} spouses={spouses} onRemove={(id) => marry(id, null)} />
        {!spouses['fe13-chrom'] && (
          <p className="text-xs text-neutral-500">
            Chrom marries whoever he has the highest support with at the end of Chapter 11, or a village maiden (not a unit) if there's no
            one; Lucina's numbers need his wife (the Fire Emblem Wiki).
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Children in the plan</h3>
        {planned.length === 0 && <p className="text-sm text-neutral-500">Add a marriage to see the children it gives.</p>}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {planned.map((r) => (
            <ChildCard key={r.child.id} data={data} result={r} />
          ))}
        </div>
        {waiting.length > 0 && (
          <p className="text-xs text-neutral-500">Not in the plan yet: {waiting.map((c) => `${c.name} (${byId.get(c.parent!)?.name})`).join(', ')}.</p>
        )}
        <p className="text-xs text-neutral-500">{INHERITANCE_NOTE}</p>
      </div>

      <Fe13PlanManager />
    </div>
  )
}

/** A compact four-column grid of stats (fits a phone, as in the Fates Parent Checker). */
function StatGrid({ values, suffix = '', signed = false }: { values: Partial<Fe13Stats>; suffix?: string; signed?: boolean }) {
  return (
    <div className="grid grid-cols-[repeat(4,4.5rem)] whitespace-nowrap text-xs">
      {FE13_STATS.filter((s) => values[s] !== undefined).map((s) => {
        const v = values[s]!
        const color = signed ? (v > 0 ? 'text-sky-400' : v < 0 ? 'text-red-400' : 'text-neutral-400') : 'text-neutral-200'
        return (
          <span key={s} className="pb-0.5 pr-2">
            <span className="text-neutral-500">{FE13_STAT_LABELS[s]} </span>
            <span className={color}>
              {signed && v > 0 ? '+' : ''}
              {v}
              {suffix}
            </span>
          </span>
        )
      })}
    </div>
  )
}

/** As the Fates Parent Checker: pick a child and stack up candidates for their other parent to compare what each gives. A candidate
 * who's a child themselves (Morgan's other parent can be) gets a picker for their own other parent. */
export function Fe13ParentChecker({ data }: { data: Fe13Data }) {
  const plans = useFe13Store((s) => s.plans)
  const [childId, setChildId] = useState('')
  const [ids, setIds] = useState<string[]>([])
  const [add, setAdd] = useState('')
  const [nested, setNested] = useState<Record<string, string>>({})
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const child = byId.get(childId)
  useScreenshotUnit(child)
  const fixed = child?.parent ? byId.get(child.parent) : undefined
  const options = fixed && child ? spousesOf(data, fixed).filter((p) => !ids.includes(p.id) && (!p.parent || isMorgan(child))) : []
  const nestedOptions = (c: Fe13Unit) => {
    const f = c.parent ? byId.get(c.parent) : undefined
    // The Avatar is marrying this candidate, so isn't their parent's spouse.
    return f ? spousesOf(data, f).filter((p) => !p.parent && !p.id.startsWith('fe13-avatar')) : []
  }
  const resultFor = (id: string) => {
    if (!child || !fixed) return null
    const cand = byId.get(id)!
    const n = nested[id]
    const spouses: Record<string, string> = { [fixed.id]: id, [id]: fixed.id, ...(n && cand.parent ? { [cand.parent]: n, [n]: cand.parent } : {}) }
    return childOf(data, child, spouses, plans)
  }
  return (
    <div className="space-y-4">
      <div className={panel}>
        <h3 className="text-base font-semibold text-neutral-100">Parent Checker</h3>
        <p className="text-xs text-neutral-500">
          Pick a child and stack up candidates for their other parent to compare growths, modifiers and bases side by side. It's separate
          from the Marriage Planner's plan; parents' stats come from their Unit Planner plans.
        </p>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Child
          <select
            value={childId}
            onChange={(e) => {
              setChildId(e.target.value)
              setIds([])
              setNested({})
            }}
            className={`${selectClass} w-full max-w-sm`}
          >
            <option value="">Select a child…</option>
            {data.units
              .filter((u) => u.parent)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({byId.get(u.parent!)?.name})
                </option>
              ))}
          </select>
        </label>
        {child && (
          <label className="flex flex-col gap-1 text-xs text-neutral-400">
            Add a candidate other parent
            <div className="flex gap-2">
              <select value={add} onChange={(e) => setAdd(e.target.value)} className={`${selectClass} w-full max-w-sm`}>
                <option value="">Select a unit…</option>
                {options.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!add}
                onClick={() => {
                  setIds([...ids, add])
                  setAdd('')
                }}
                className={primaryButton}
              >
                Add
              </button>
            </div>
          </label>
        )}
      </div>
      {child && ids.length === 0 && <p className="text-sm text-neutral-500">Add at least one candidate to compare.</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {ids.map((id) => {
          const cand = byId.get(id)!
          const r = resultFor(id)
          return (
            <div key={id} className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
              <div className="flex items-center gap-2 font-medium text-neutral-200">
                <UnitPortrait unit={cand} size={32} />
                {cand.name}
                <button
                  type="button"
                  onClick={() => {
                    setIds(ids.filter((x) => x !== id))
                    const next = { ...nested }
                    delete next[id]
                    setNested(next)
                  }}
                  className="ml-auto text-xs text-neutral-500 hover:text-red-400"
                >
                  Remove
                </button>
              </div>
              {cand.parent && (
                <label className="flex flex-col gap-1 text-[11px] text-neutral-500">
                  {cand.name}'s own other parent
                  <select value={nested[id] ?? ''} onChange={(e) => setNested({ ...nested, [id]: e.target.value })} className={`${selectClass} max-w-[14rem] text-xs`}>
                    <option value="">(none: their own numbers)</option>
                    {nestedOptions(cand).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {r && (
                <>
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Personal growths</div>
                    <StatGrid values={r.growths} suffix="%" />
                  </div>
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Modifiers</div>
                    <StatGrid values={r.modifiers} signed />
                  </div>
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Bases as a {data.classes[r.startClass].name}</div>
                    <StatGrid values={r.bases} />
                  </div>
                  <p className="text-xs text-neutral-400">
                    <span className="text-neutral-500">Classes: </span>
                    {names(data, r.classes)}
                  </p>
                </>
              )}
            </div>
          )
        })}
      </div>
      {child && <p className="text-xs text-neutral-500">{INHERITANCE_NOTE}</p>}
    </div>
  )
}
