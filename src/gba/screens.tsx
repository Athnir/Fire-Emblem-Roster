import { useEffect, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Portrait } from '../components/Portrait'
import { useScreenshotContextStore } from '../state/screenshotContextStore'
import {
  GBA_GROWING,
  GBA_STATS,
  GBA_STAT_LABELS,
  type GbaAffinity,
  type GbaClass,
  type GbaChapter,
  type GbaStats,
  type GbaStory,
  type GbaSupport,
  type GbaUnit,
} from './types'

/** Everything a GBA game's screens need, passed in so the screens don't import a game's data. */
export interface GbaData {
  gameId: string
  /** A game in more than one story shows a switch; its chapters and units each belong to one. */
  stories?: GbaStory[]
  chapters: GbaChapter[]
  units: GbaUnit[]
  classes: Record<string, GbaClass>
  supports: GbaSupport[]
  /** The points C, B and A need. */
  supportLevels: number[]
  /** When a pair gains its points, where the game's code was read for it ("each turn the two are side by side"). */
  supportGain?: string
  affinities: GbaAffinity[]
}

const MAX_LEVEL = 20
/** A promotion item works from level 10 and starts the new class at level 1 (Serenes Forest). */
const PROMOTE_LEVEL = 10

interface GbaPlan {
  promoteAt: number | null
  targetLevel: number
}

interface GbaState {
  plans: Record<string, Record<string, GbaPlan>>
  /** The story picked in each game told in several, shared by its tabs. */
  stories: Record<string, string>
  setPlan: (gameId: string, unitId: string, plan: GbaPlan | null) => void
  setStory: (gameId: string, storyId: string) => void
}

/** Saved under `fe-roster-gba`, so the backup (src/logic/backup.ts) picks it up. */
const useGbaStore = create<GbaState>()(
  persist(
    (set) => ({
      plans: {},
      stories: {},
      setPlan: (gameId, unitId, plan) =>
        set((state) => {
          const game = { ...state.plans[gameId] }
          if (plan) game[unitId] = plan
          else delete game[unitId]
          return { plans: { ...state.plans, [gameId]: game } }
        }),
      setStory: (gameId, storyId) => set((state) => ({ stories: { ...state.stories, [gameId]: storyId } })),
    }),
    { name: 'fe-roster-gba' },
  ),
)

/** The game's data for the story picked (all of it for a game told in one), and the switch to pick another. */
function useStory(data: GbaData): { view: GbaData; story?: GbaStory; picker: ReactNode } {
  const picked = useGbaStore((s) => s.stories?.[data.gameId])
  const setStory = useGbaStore((s) => s.setStory)
  if (!data.stories?.length) return { view: data, picker: null }
  const story = data.stories.find((s) => s.id === picked) ?? data.stories[data.stories.length > 1 ? 1 : 0]
  const view: GbaData = {
    ...data,
    chapters: data.chapters.filter((c) => !c.story || c.story === story.id),
    units: data.units.filter((u) => !u.story || u.story === story.id),
  }
  const picker = (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Story">
      {data.stories.map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={s.id === story.id}
          onClick={() => setStory(data.gameId, s.id)}
          className={`rounded-md border px-3 py-1 text-sm ${
            s.id === story.id ? 'border-violet-500 bg-violet-950/50 text-neutral-100' : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-600'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
  return { view, story, picker }
}

const selectClass = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200'

function artId(gameId: string, name: string): string {
  return `${gameId}/${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
}

function UnitPortrait({ data, unit, size = 64 }: { data: GbaData; unit: GbaUnit; size?: number }) {
  return <Portrait characterId={artId(data.gameId, unit.name)} isChild={false} size={size} />
}

function fmt(v: number | undefined): string {
  if (v === undefined) return '–'
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

function StatTable({ rows }: { rows: { label: string; values: Partial<GbaStats>; caps?: Partial<GbaStats>; suffix?: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-sm">
        <thead>
          <tr className="text-xs text-neutral-500">
            <th className="py-1 pr-2 text-left font-normal" />
            {GBA_STATS.map((s) => (
              <th key={s} className="px-1 py-1 text-right font-normal">
                {GBA_STAT_LABELS[s]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-neutral-800">
              <td className="whitespace-nowrap py-1 pr-2 text-xs text-neutral-400">{row.label}</td>
              {GBA_STATS.map((s) => {
                const v = row.values[s]
                const cap = row.caps?.[s]
                return (
                  <td key={s} className={`px-1 py-1 text-right tabular-nums ${v !== undefined && cap !== undefined && v >= cap ? 'text-emerald-400' : 'text-neutral-200'}`}>
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

function useScreenshotUnit(unit: GbaUnit | undefined) {
  const setUnitLabel = useScreenshotContextStore((state) => state.setUnitLabel)
  useEffect(() => {
    setUnitLabel(unit?.name ?? '')
    return () => setUnitLabel('')
  }, [unit, setUnitLabel])
}

function chapterLabel(data: GbaData, id: string): string {
  return data.chapters.find((c) => c.id === id)?.label ?? id
}

function joinText(data: GbaData, u: GbaUnit): string {
  const where = chapterLabel(data, u.joinChapter)
  const j = u.join
  if (j.how === 'talk') return `${where}: talk to them with ${j.with?.join(' or ') ?? 'another unit'}`
  if (j.how === 'visit') return `${where}: visit their village${j.with?.length ? ` with ${j.with.join(' or ')}` : ''}`
  if (j.how === 'event') return `${where}: joins ${j.turn ? `on turn ${j.turn}` : 'during the chapter'}`
  if (j.how === 'end') return `${where}: joins at the end of the chapter${j.with?.length ? ` if ${j.with.join(' or ')} talked to them` : ''}`
  return `${where}: joins at the start`
}

function UnitSelect({ data, value, onChange }: { data: GbaData; value: string; onChange: (id: string) => void }) {
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

/** A unit's supports: each partner with the pair's starting points and gain per turn. */
function supportsOf(data: GbaData, unitId: string) {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  return data.supports
    .filter((s) => s.a === unitId || s.b === unitId)
    .map((s) => ({ partner: byId.get(s.a === unitId ? s.b : s.a)!, support: s }))
    .filter((x) => x.partner)
}

/** Turns of building up for each level: points needed less the start, over the gain per turn, rounded up. */
function turnsFor(levels: number[], s: GbaSupport): (number | null)[] {
  return levels.map((need) => (s.perTurn ? Math.max(0, Math.ceil((need - s.start) / s.perTurn)) : null))
}

function UnitDetail({ data, unit }: { data: GbaData; unit: GbaUnit }) {
  const cls = data.classes[unit.classId]
  const promo = cls.promotesTo ? data.classes[cls.promotesTo] : undefined
  const supports = supportsOf(data, unit.id)
  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <UnitPortrait data={data} unit={unit} size={128} />
        <div className="space-y-1 text-sm text-neutral-300">
          <h3 className="text-lg font-semibold text-neutral-100">{unit.name}</h3>
          <div>
            {cls.name} · Lv {unit.level}
            {promo && <span className="text-neutral-500"> · promotes to {promo.name}</span>}
          </div>
          <div>
            <span className="text-neutral-500">Affinity: </span>
            {unit.affinity}
          </div>
          <div>
            <span className="text-neutral-500">Joins: </span>
            {joinText(data, unit)}
          </div>
          {unit.join.note && <div className="text-neutral-400">{unit.join.note}</div>}
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
          { label: 'Bases', values: unit.bases },
          { label: 'Growths', values: unit.growths, suffix: '%' },
          { label: `Caps (${cls.name})`, values: cls.caps },
        ]}
      />
      {supports.length > 0 && (
        <p className="text-sm text-neutral-300">
          <span className="text-neutral-500">Supports: </span>
          {supports.map((s) => s.partner.name).join(', ')}
        </p>
      )}
    </div>
  )
}

/** Every playable unit by the chapter they join; tapping one shows their data below the list. */
export function GbaRoster({ data: game }: { data: GbaData }) {
  const { view: data, picker } = useStory(game)
  const [selectedId, setSelectedId] = useState(data.units[0]?.id ?? '')
  const detailRef = useRef<HTMLDivElement>(null)
  const selected = data.units.find((u) => u.id === selectedId) ?? data.units[0]
  useScreenshotUnit(selected)
  return (
    <div className="space-y-6">
      {picker}
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
                      u.id === selected?.id ? 'border-violet-500 bg-violet-950/50 text-neutral-100' : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-600'
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
  stats: GbaStats
}

/** Average stats: each level adds the growth rate, held at the class's caps. Promoting adds the difference between the classes'
 * bases (Con and Mov too) and starts again at level 1. */
function project(data: GbaData, unit: GbaUnit, plan: GbaPlan): Stage[] {
  const start = data.classes[unit.classId]
  const capped = (stats: GbaStats, cls: GbaClass) => {
    const out = { ...stats }
    for (const s of GBA_STATS) if (cls.caps[s] !== undefined) out[s] = Math.min(out[s], cls.caps[s]!)
    return out
  }
  const grow = (stats: GbaStats, levels: number, cls: GbaClass) => {
    const out = { ...stats }
    for (const s of GBA_GROWING) out[s] += ((unit.growths[s] ?? 0) / 100) * Math.max(0, levels)
    return capped(out, cls)
  }
  const stages: Stage[] = [{ classId: start.id, level: unit.level, stats: { ...unit.bases } }]
  const promoted = start.promotesTo ? data.classes[start.promotesTo] : undefined
  if (promoted && plan.promoteAt !== null) {
    const at = Math.max(unit.level, Math.min(MAX_LEVEL, plan.promoteAt))
    let stats = grow(unit.bases, at - unit.level, start)
    if (at > unit.level) stages.push({ classId: start.id, level: at, stats })
    stats = { ...stats }
    // The game's own gains when its class data has them (The Blazing Blade: 0x08029818 adds them, held at the new caps; Con and
    // Mov come from the class); otherwise the difference between the two classes' bases.
    const gains = promoted.gains
    for (const s of GBA_STATS) {
      if (s === 'lck') continue
      stats[s] += gains && s !== 'con' && s !== 'mov' ? (gains[s] ?? 0) : promoted.bases[s] - start.bases[s]
    }
    stats = capped(stats, promoted)
    stages.push({ classId: promoted.id, level: 1, stats })
    const target = Math.max(1, Math.min(MAX_LEVEL, plan.targetLevel))
    if (target > 1) stages.push({ classId: promoted.id, level: target, stats: grow(stats, target - 1, promoted) })
    return stages
  }
  const target = Math.max(unit.level, Math.min(MAX_LEVEL, plan.targetLevel))
  if (target > unit.level) stages.push({ classId: start.id, level: target, stats: grow(unit.bases, target - unit.level, start) })
  return stages
}

/** One unit's average stats through a promotion. Saved per unit. */
export function GbaPlanner({ data: game }: { data: GbaData }) {
  const { view: data, picker } = useStory(game)
  const [unitId, setUnitId] = useState(data.units[0]?.id ?? '')
  const unit = data.units.find((u) => u.id === unitId) ?? data.units[0]
  useScreenshotUnit(unit)
  const saved = useGbaStore((s) => (unit ? s.plans[data.gameId]?.[unit.id] : undefined))
  const setPlan = useGbaStore((s) => s.setPlan)
  if (!unit) return null
  const start = data.classes[unit.classId]
  const promoted = start.promotesTo ? data.classes[start.promotesTo] : undefined
  const plan: GbaPlan = saved ?? { promoteAt: promoted ? MAX_LEVEL : null, targetLevel: MAX_LEVEL }
  const update = (patch: Partial<GbaPlan>) => setPlan(data.gameId, unit.id, { ...plan, ...patch })
  const stages = project(data, unit, plan)
  const levels = (from: number) => Array.from({ length: MAX_LEVEL - from + 1 }, (_, i) => from + i)
  const finalClass = data.classes[stages[stages.length - 1].classId]
  return (
    <div className="space-y-4">
      {picker}
      <UnitSelect data={data} value={unit.id} onChange={setUnitId} />
      <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex flex-wrap items-end gap-4 text-sm text-neutral-300">
          {promoted && (
            <label className="space-y-1">
              <span className="block text-xs text-neutral-500">Promote to {promoted.name}</span>
              <select value={plan.promoteAt ?? ''} onChange={(e) => update({ promoteAt: e.target.value === '' ? null : Number(e.target.value) })} className={selectClass}>
                <option value="">Don't promote</option>
                {levels(Math.max(PROMOTE_LEVEL, unit.level)).map((lv) => (
                  <option key={lv} value={lv}>
                    At Lv {lv}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="space-y-1">
            <span className="block text-xs text-neutral-500">Up to Lv (as {finalClass.name})</span>
            <select value={plan.targetLevel} onChange={(e) => update({ targetLevel: Number(e.target.value) })} className={selectClass}>
              {levels(promoted && plan.promoteAt !== null ? 1 : unit.level).map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
          </label>
          {saved && (
            <button type="button" onClick={() => setPlan(data.gameId, unit.id, null)} className="rounded-md bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700">
              Reset
            </button>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          Average stats: each level adds the growth rate. Stats stop at the class's caps (green). A promotion item works from Lv 10 and
          starts again at Lv 1 (Serenes Forest).{' '}
          {promoted?.gains
            ? "Promoting adds the new class's promotion gains from the game's class data, and Con and Mov become the new class's."
            : "Promoting adds the difference between the classes' bases (Serenes Forest; not yet traced in the game's code)."}
        </p>
        <StatTable
          rows={stages.map((st, i) => ({
            label: `${data.classes[st.classId].name} Lv ${st.level}${i === 0 ? ' (joins)' : ''}`,
            values: st.stats,
            caps: data.classes[st.classId].caps,
          }))}
        />
      </div>
    </div>
  )
}

/** Each partner: affinity, starting points and gain per turn, the turns to each level, and what the pair gives per level. */
export function GbaSupports({ data: game }: { data: GbaData }) {
  const { view: data, story, picker } = useStory(game)
  const [unitId, setUnitId] = useState(data.units[0]?.id ?? '')
  const unit = data.units.find((u) => u.id === unitId) ?? data.units[0]
  useScreenshotUnit(unit)
  const partners = unit ? supportsOf(data, unit.id) : []
  const row = (name: string) => data.affinities.find((a) => a.name === name)
  const bonus = (a: string, b: string) => {
    const x = row(a)
    const y = row(b)
    if (!x || !y) return ''
    const keys: [keyof GbaAffinity, string][] = [
      ['atk', 'Atk'],
      ['def', 'Def'],
      ['hit', 'Hit'],
      ['avoid', 'Avo'],
      ['crit', 'Crit'],
      ['dodge', 'Dodge'],
    ]
    // Per level: both rows summed and halved, rounded down (the game multiplies by the level before halving).
    return keys
      .map(([k, label]) => [label, ((x[k] as number) + (y[k] as number)) / 2] as const)
      .filter(([, v]) => v)
      .map(([label, v]) => `${label} +${v}`)
      .join(', ')
  }
  return (
    <div className="space-y-4">
      {picker}
      {story?.noSupports && <p className="text-sm text-neutral-400">Supports can't be built in {story.label} (the game's support code skips it).</p>}
      {!story?.noSupports && <UnitSelect data={data} value={unit?.id ?? ''} onChange={setUnitId} />}
      {unit && !story?.noSupports && (
        <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex items-center gap-3">
            <UnitPortrait data={data} unit={unit} size={48} />
            <div>
              <div className="font-semibold text-neutral-100">{unit.name}</div>
              <div className="text-xs text-neutral-400">Affinity: {unit.affinity}</div>
            </div>
          </div>
          {partners.length === 0 ? (
            <p className="text-sm text-neutral-400">{unit.name} has no supports.</p>
          ) : (
            <>
              <p className="text-xs text-neutral-500">
                A pair starts with some points and gains more {data.supportGain ?? 'each turn it ends within reach'}; C, B and A need {data.supportLevels.join(', ')}{' '}
                points. Turns are counted from the start. A unit can hold five support levels at most. The bonus is what each level adds
                with the partner within 3 tiles (both affinities summed and halved).
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead>
                    <tr className="text-xs text-neutral-500">
                      <th className="py-1 text-left font-normal">Partner</th>
                      <th className="py-1 text-left font-normal">Affinity</th>
                      <th className="px-1 py-1 text-right font-normal">Start</th>
                      <th className="px-1 py-1 text-right font-normal">/ turn</th>
                      <th className="px-1 py-1 text-right font-normal">C</th>
                      <th className="px-1 py-1 text-right font-normal">B</th>
                      <th className="px-1 py-1 text-right font-normal">A</th>
                      <th className="py-1 pl-2 text-left font-normal">Per level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map(({ partner, support }) => (
                      <tr key={partner.id} className="border-t border-neutral-800">
                        <td className="py-1">
                          <button type="button" onClick={() => setUnitId(partner.id)} className="flex items-center gap-2 text-neutral-200 hover:text-violet-300">
                            <UnitPortrait data={data} unit={partner} size={28} />
                            {partner.name}
                          </button>
                        </td>
                        <td className="py-1 text-neutral-400">{partner.affinity}</td>
                        <td className="px-1 py-1 text-right tabular-nums text-neutral-300">{support.start}</td>
                        <td className="px-1 py-1 text-right tabular-nums text-neutral-300">{support.perTurn}</td>
                        {turnsFor(data.supportLevels, support).map((t, i) => (
                          <td key={i} className="px-1 py-1 text-right tabular-nums text-neutral-200">
                            {t ?? '–'}
                          </td>
                        ))}
                        <td className="py-1 pl-2 text-xs text-neutral-400">{bonus(unit.affinity, partner.affinity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
