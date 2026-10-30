import { useEffect, useRef, useState } from 'react'
import { Portrait } from '../components/Portrait'
import { useScreenshotContextStore } from '../state/screenshotContextStore'
import {
  MAX_LEVEL,
  SEAL_LEVEL,
  capsOf,
  childOf,
  classOptions,
  classSetOf,
  project,
  skillsOf,
  spousesOf,
  type Fe13Data,
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
          A child's real bases also take after their parents' stats when they join; these are the class's plus the child's own.
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
  const setPlan = useFe13Store((s) => s.setPlan)
  const plan: Fe13Plan = saved ?? { steps: [], targetLevel: MAX_LEVEL }
  const update = (patch: Partial<Fe13Plan>) => setPlan(unit.id, { ...plan, ...patch })
  // A child married off in the Pairings tab opens their parents' classes too.
  const child = unit.parent ? childOf(data, unit, spouses) : null
  const set = child ? child.classes : classSetOf(unit)
  const growths = child ? child.growths : unit.growths
  const modifiers = child ? child.modifiers : unit.modifiers
  const stages = project(data, unit, plan, unit.bases, growths, modifiers)
  let current = unit.classId
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
          {child ? ` As ${child.fixed.name} and ${child.other.name}'s child, with their growths, modifiers and classes.` : ''}
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

/** Marriages, from each unit's S supports, and the children they give. */
export function Fe13Pairings({ data }: { data: Fe13Data }) {
  const spouses = useFe13Store((s) => s.spouses)
  const marry = useFe13Store((s) => s.marry)
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const adults = data.units.filter((u) => !u.parent && spousesOf(data, u).some((p) => !p.parent))
  const children = data.units.filter((u) => u.parent)
  return (
    <div className="space-y-6">
      <p className="text-xs text-neutral-500">
        Each unit can marry one of their S-support partners. A child's growths are their own, their mother's and their father's averaged;
        their modifiers are both parents' summed, plus 1; they can take their own classes and both parents' for their gender (the Fire
        Emblem Wiki's inheritance page; not traced in the game's code). The class sets are the game's.
      </p>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Marriages</h3>
        {adults
          .filter((u) => u.female)
          .map((u) => {
            const options = spousesOf(data, u).filter((p) => !p.parent)
            const spouse = spouses[u.id] ? byId.get(spouses[u.id]) : undefined
            return (
              <div key={u.id} className="flex flex-wrap items-center gap-2 text-sm text-neutral-300">
                <UnitPortrait unit={u} size={32} />
                <span className="w-28 font-semibold text-neutral-100">{u.name}</span>
                <span className="text-neutral-500">and</span>
                <select value={spouse?.id ?? ''} onChange={(e) => marry(u.id, e.target.value || null)} className={selectClass}>
                  <option value="">No one</option>
                  {options.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {spouses[p.id] && spouses[p.id] !== u.id ? ' (married)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
      </div>
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Children</h3>
        {children.map((c) => {
          const result = childOf(data, c, spouses)
          const fixed = c.parent ? byId.get(c.parent) : undefined
          return (
            <div key={c.id} className={panel}>
              <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-300">
                <UnitPortrait unit={c} size={48} />
                <span className="font-semibold text-neutral-100">{c.name}</span>
                <span className="text-neutral-500">
                  {fixed?.name ?? '?'} and {result ? result.other.name : 'no one yet'}
                </span>
              </div>
              {result ? (
                <>
                  <StatTable
                    rows={[
                      { label: 'Growths', values: result.growths, suffix: '%' },
                      { label: 'Modifiers', values: result.modifiers, signed: true },
                    ]}
                  />
                  <p className="text-sm text-neutral-300">
                    <span className="text-neutral-500">Classes: </span>
                    {names(data, result.classes)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-neutral-400">Marry {fixed?.name ?? 'their parent'} above to see this child.</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
