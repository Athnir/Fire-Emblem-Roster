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
  type GbaStat,
  type GbaStory,
  type GbaSupport,
  type GbaRankedSupport,
  type GbaSupportBonus,
  type GbaUnit,
} from './types'

/** Everything a GBA game's screens need, passed in so the screens don't import a game's data. */
export interface GbaData {
  gameId: string
  /** A game in more than one story shows a switch; its chapters and units each belong to one. */
  stories?: GbaStory[]
  /** The story shown until one is picked (the first, unless set). */
  defaultStory?: string
  chapters: GbaChapter[]
  units: GbaUnit[]
  classes: Record<string, GbaClass>
  supports: GbaSupport[]
  /** The points C, B and A need. */
  supportLevels: number[]
  /** When a pair gains its points, where the game's code was read for it ("each turn the two are side by side"). */
  supportGain?: string
  affinities: GbaAffinity[]
  /** The stats the game has, in its order (the GBA games' when unset), the ones that grow, and labels of its own. */
  stats?: GbaStat[]
  growing?: GbaStat[]
  statLabels?: Partial<Record<GbaStat, string>>
  /** How promoting changes stats where the class data has no gains: the difference between the classes' bases for `difference`, and
   * `raise` lifted to the new class's bases where lower (Mystery of the Emblem). Unset: the difference for every stat but Luck. */
  promotion?: { difference: GbaStat[]; raise: GbaStat[] }
  /** Fixed supports instead of support points (Mystery of the Emblem), and what they add, in words. */
  supportBonuses?: GbaSupportBonus[]
  supportBonusText?: string
  /** A stat is the unit's own plus the current class's bases, read through the class's cap and floored at 0, so a class change keeps
   * what a lower cap hides (Shadow Dragon, arm9 0x203c6c0). */
  readsClassBases?: boolean
  /** Classes of a reclass set offered in turn (Shadow Dragon's Dracoknight and Falcoknight): the first, or the next once the unit has
   * been in it. */
  reclassSwap?: string[]
  /** Supports with a bonus per rank (Shadows of Valentia), and what to say about them. */
  rankedSupports?: GbaRankedSupport[]
  rankedSupportText?: string
  /** How a class change works, in the planner's note (the GBA games' promotion item when unset). */
  promotionText?: string
}

const statsOf = (data: GbaData) => data.stats ?? GBA_STATS
const growingOf = (data: GbaData) => data.growing ?? GBA_GROWING
const labelOf = (data: GbaData, s: GbaStat) => data.statLabels?.[s] ?? GBA_STAT_LABELS[s]

const MAX_LEVEL = 20
/** A promotion item works from level 10 and starts the new class at level 1 (Serenes Forest). */
const PROMOTE_LEVEL = 10

/** A unit's plan: up to two promotions (a trainee's at Lv 10, then a promotion item's), each into a class of its own picking. */
interface GbaPlan {
  promoteAt: number | null
  targetLevel: number
  to?: string
  promoteAt2?: number | null
  to2?: string
  promoteAt3?: number | null
  to3?: string
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
  const story = data.stories.find((s) => s.id === picked) ?? data.stories.find((s) => s.id === data.defaultStory) ?? data.stories[0]
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

function StatTable({ data, rows }: { data: GbaData; rows: { label: string; values: GbaStats; caps?: GbaStats; suffix?: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-sm">
        <thead>
          <tr className="text-xs text-neutral-500">
            <th className="py-1 pr-2 text-left font-normal" />
            {statsOf(data).map((s) => (
              <th key={s} className="px-1 py-1 text-right font-normal">
                {labelOf(data, s)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-neutral-800">
              <td className="whitespace-nowrap py-1 pr-2 text-xs text-neutral-400">{row.label}</td>
              {statsOf(data).map((s) => {
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
  if (j.how === 'unlock') return `${where}: unlocked`
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

/** A unit's fixed supports: who gives it a bonus, and whom it gives one. */
function bonusesOf(data: GbaData, unitId: string) {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const all = data.supportBonuses ?? []
  return {
    gets: all.filter((b) => b.receiver === unitId).map((b) => ({ partner: byId.get(b.giver)!, bonus: b.bonus })).filter((x) => x.partner),
    gives: all.filter((b) => b.giver === unitId).map((b) => ({ partner: byId.get(b.receiver)!, bonus: b.bonus })).filter((x) => x.partner),
  }
}

function bonusPartnersOf(data: GbaData, unitId: string) {
  const { gets, gives } = bonusesOf(data, unitId)
  const seen = new Set<string>()
  return [...gets, ...gives].filter((x) => !seen.has(x.partner.id) && seen.add(x.partner.id)).map((x) => ({ partner: x.partner }))
}

/** A unit's ranked supports: each partner, what the unit gets and gives at each rank, and the points and acts. */
function rankedOf(data: GbaData, unitId: string) {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  return (data.rankedSupports ?? [])
    .filter((p) => p.a === unitId || p.b === unitId)
    .map((p) => {
      const mine = p.a === unitId
      return { partner: byId.get(mine ? p.b : p.a)!, gets: mine ? p.aGets : p.bGets, gives: mine ? p.bGets : p.aGets, points: p.points, acts: p.acts }
    })
    .filter((x) => x.partner)
}

/** Turns of building up for each level: points needed less the start, over the gain per turn, rounded up. */
function turnsFor(levels: number[], s: GbaSupport): (number | null)[] {
  return levels.map((need) => (s.perTurn ? Math.max(0, Math.ceil((need - s.start) / s.perTurn)) : null))
}

function UnitDetail({ data, unit }: { data: GbaData; unit: GbaUnit }) {
  const cls = data.classes[unit.classId]
  const promo = optionsOf(data, cls)
  const supports = [...supportsOf(data, unit.id), ...bonusPartnersOf(data, unit.id), ...rankedOf(data, unit.id)]
  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <UnitPortrait data={data} unit={unit} size={128} />
        <div className="space-y-1 text-sm text-neutral-300">
          <h3 className="text-lg font-semibold text-neutral-100">{unit.name}</h3>
          <div>
            {cls.name} · Lv {unit.level}
            {promo.length > 0 && <span className="text-neutral-500"> · promotes to {promo.map((c) => c.name).join(' or ')}</span>}
          </div>
          {unit.affinity && (
            <div>
              <span className="text-neutral-500">Affinity: </span>
              {unit.affinity}
            </div>
          )}
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
        data={data}
        rows={[
          { label: 'Bases', values: unit.bases },
          { label: cls.growths ? 'Personal growths' : 'Growths', values: unit.growths, suffix: '%' },
          ...(cls.growths ? [{ label: `Growths as a ${cls.name}`, values: withClassGrowths(data, unit, cls), suffix: '%' }] : []),
          unit.caps ? { label: 'Maximums', values: unit.caps } : { label: `Caps (${cls.name})`, values: cls.caps },
        ]}
      />
      {unit.reclass && (
        <p className="text-sm text-neutral-300">
          <span className="text-neutral-500">Reclass set: </span>
          {unit.reclass.map((id) => data.classes[id]?.name ?? id).join(', ')}
        </p>
      )}
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
const maxLevelOf = (cls: GbaClass) => cls.maxLevel ?? MAX_LEVEL
/** The level a class must reach before it can change (a promotion item's 10, unless the class says). */
const minLevelOf = (cls: GbaClass) => cls.promoteLevel ?? PROMOTE_LEVEL
/** A unit's maximums: their own where the game keeps them per character (Shadows of Valentia), else the class's. */
const capsFor = (unit: GbaUnit, cls: GbaClass): GbaStats => unit.caps ?? cls.caps
const optionsOf = (data: GbaData, cls: GbaClass) =>
  (cls.promotions ?? (cls.promotesTo ? [cls.promotesTo] : [])).map((id) => data.classes[id]).filter(Boolean)
/** Every change on offer from a class: its promotions, then (Shadow Dragon) the unit's reclass set's classes of the same tier. `been`:
 * the classes the unit has been in, for the swap (the Falcoknight replaces the Dracoknight once the unit has been one). */
const changesOf = (data: GbaData, unit: GbaUnit, cls: GbaClass, been: string[] = [cls.id]) => {
  const promos = optionsOf(data, cls)
  const [first, second] = data.reclassSwap ?? []
  const hidden = second && been.includes(second) ? first : second
  const reclass = (unit.reclass ?? [])
    .map((id) => data.classes[id])
    .filter((c) => c && c.id !== cls.id && c.id !== hidden && !!c.promoted === !!cls.promoted && !promos.includes(c))
  return [...promos, ...reclass]
}
/** A unit's growth in a class: their own plus what the class adds (Shadow Dragon), never below 0 (Serenes Forest's full growths: Marth's
 * Magic as a Lord, 5 - 10, is 0). */
const growthIn = (unit: GbaUnit, cls: GbaClass, s: GbaStat) => Math.max(0, (unit.growths[s] ?? 0) + (cls.growths?.[s] ?? 0))
function withClassGrowths(data: GbaData, unit: GbaUnit, cls: GbaClass): GbaStats {
  const out: GbaStats = {}
  for (const s of growingOf(data)) out[s] = growthIn(unit, cls, s)
  return out
}
const isPromotion = (data: GbaData, from: GbaClass, to: GbaClass) => optionsOf(data, from).some((c) => c.id === to.id)

interface Step {
  from: GbaClass
  options: GbaClass[]
  to: GbaClass
  /** The level it's taken at; a trainee class's is its last level, and it can't be declined. */
  at: number
  forced: boolean
  /** A promotion starts again at Lv 1; a reclass (Shadow Dragon) keeps the level. */
  promotion: boolean
}

/** The promotions a plan takes: the first from the class the unit joins in, a second from the class that one leads to. */
function stepsOf(data: GbaData, unit: GbaUnit, plan: GbaPlan): Step[] {
  const steps: Step[] = []
  let cls = data.classes[unit.classId]
  let level = unit.level
  const wanted: [number | null, string | undefined][] = [
    [plan.promoteAt, plan.to],
    [plan.promoteAt2 ?? null, plan.to2],
    [plan.promoteAt3 ?? null, plan.to3],
  ]
  const been = [cls.id]
  for (const [at, to] of wanted) {
    const options = changesOf(data, unit, cls, been)
    if (!options.length) break
    const forced = !!cls.autoPromote
    if (!forced && at === null) break
    const max = maxLevelOf(cls)
    const next = options.find((o) => o.id === to) ?? options[0]
    const promotion = isPromotion(data, cls, next)
    const taken = forced ? max : Math.max(level, promotion ? minLevelOf(cls) : level, Math.min(max, at!))
    steps.push({ from: cls, options, to: next, at: taken, forced, promotion })
    been.push(next.id)
    cls = next
    level = promotion ? 1 : taken
  }
  return steps
}

/** Average stats: each level adds the growth rate, held at the class's caps. Promoting adds the new class's gains where the game keeps
 * them (Con and Mov from the class), otherwise the difference between the classes' bases, and starts again at level 1. */
function project(data: GbaData, unit: GbaUnit, plan: GbaPlan): Stage[] {
  const capped = (stats: GbaStats, cls: GbaClass) => {
    const out = { ...stats }
    const caps = capsFor(unit, cls)
    for (const s of statsOf(data)) if (caps[s] !== undefined && out[s] !== undefined) out[s] = Math.min(out[s]!, caps[s]!)
    return out
  }
  // Shadow Dragon keeps the unit's own stats and reads them through the class (arm9 0x203c6c0): `stats` stays uncapped through class
  // changes, and is capped and floored at 0 only as it's shown. A level-up adds nothing to a stat at its cap (0x203d6dc).
  const raw = !!data.readsClassBases
  const shown = (stats: GbaStats, cls: GbaClass) => {
    if (!raw) return stats
    const out = capped(stats, cls)
    for (const s of statsOf(data)) if (out[s] !== undefined) out[s] = Math.max(0, out[s]!)
    return out
  }
  const grow = (stats: GbaStats, levels: number, cls: GbaClass) => {
    const out = { ...stats }
    const caps = capsFor(unit, cls)
    for (const s of growingOf(data)) {
      const cur = out[s] ?? 0
      const next = cur + (growthIn(unit, cls, s) / 100) * Math.max(0, levels)
      out[s] = raw && caps[s] !== undefined ? (cur >= caps[s]! ? cur : Math.min(caps[s]!, next)) : next
    }
    return raw ? out : capped(out, cls)
  }
  let cls = data.classes[unit.classId]
  let level = unit.level
  let stats: GbaStats = { ...unit.bases }
  const stages: Stage[] = [{ classId: cls.id, level, stats: shown(stats, cls) }]
  for (const step of stepsOf(data, unit, plan)) {
    stats = grow(stats, step.at - level, cls)
    if (step.at > level) stages.push({ classId: cls.id, level: step.at, stats: shown(stats, cls) })
    stats = { ...stats }
    // The game's own gains when its class data has them (The Blazing Blade 0x08029818, The Sacred Stones 0x0802BC20: added, held at
    // the new caps; Con and Mov come from the class); otherwise the difference between the two classes' bases.
    const gains = step.to.gains
    const diff = (s: GbaStat) => (step.to.bases[s] ?? 0) - (cls.bases[s] ?? 0)
    if (gains) {
      for (const s of statsOf(data)) if (s !== 'lck') stats[s] = (stats[s] ?? 0) + (s !== 'con' && s !== 'mov' ? (gains[s] ?? 0) : diff(s))
    } else if (data.promotion) {
      // Mystery of the Emblem ($83:FD2B): the old class's bases come off and the new class's go on ($93:D9FF, $93:D951); HP and the
      // weapon level are lifted to the new class's where lower ($83:FD76).
      for (const s of data.promotion.difference) stats[s] = (stats[s] ?? 0) + diff(s)
      for (const s of data.promotion.raise) stats[s] = Math.max(stats[s] ?? 0, step.to.bases[s] ?? 0)
    } else {
      for (const s of statsOf(data)) if (s !== 'lck' || raw) stats[s] = (stats[s] ?? 0) + diff(s)
    }
    if (!raw) stats = capped(stats, step.to)
    cls = step.to
    level = step.promotion ? 1 : step.at
    stages.push({ classId: cls.id, level, stats: shown(stats, cls) })
  }
  const target = Math.max(level, Math.min(maxLevelOf(cls), plan.targetLevel))
  if (target > level) stages.push({ classId: cls.id, level: target, stats: shown(grow(stats, target - level, cls), cls) })
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
  const first = changesOf(data, unit, start)
  const plan: GbaPlan = saved ?? {
    promoteAt: first.length ? maxLevelOf(start) : null,
    targetLevel: MAX_LEVEL,
    promoteAt2: first.length && isPromotion(data, start, first[0]) && changesOf(data, unit, first[0]).length ? MAX_LEVEL : null,
  }
  const atOf = [plan.promoteAt, plan.promoteAt2 ?? null, plan.promoteAt3 ?? null]
  const patchAt = (i: number, v: number | null): Partial<GbaPlan> => (i === 0 ? { promoteAt: v } : i === 1 ? { promoteAt2: v } : { promoteAt3: v })
  const patchTo = (i: number, v: string): Partial<GbaPlan> => (i === 0 ? { to: v } : i === 1 ? { to2: v } : { to3: v })
  const update = (patch: Partial<GbaPlan>) => setPlan(data.gameId, unit.id, { ...plan, ...patch })
  const steps = stepsOf(data, unit, plan)
  const stages = project(data, unit, plan)
  const levels = (from: number, to = MAX_LEVEL) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)
  const finalClass = data.classes[stages[stages.length - 1].classId]
  const last = steps[steps.length - 1]
  const lastLevel = last ? (last.promotion ? 1 : last.at) : unit.level
  // The promotions offered: the first from the class the unit joins in, then one from wherever that leads.
  const offers: { index: number; from: GbaClass; options: GbaClass[]; fromLevel: number }[] = []
  if (first.length) offers.push({ index: 0, from: start, options: first, fromLevel: unit.level })
  for (const i of [1, 2]) {
    const prev = steps[i - 1]
    const next = prev ? changesOf(data, unit, prev.to, [unit.classId, ...steps.slice(0, i).map((s) => s.to.id)]) : []
    if (prev && next.length) offers.push({ index: i, from: prev.to, options: next, fromLevel: prev.promotion ? 1 : prev.at })
  }
  const reclassing = !!unit.reclass
  return (
    <div className="space-y-4">
      {picker}
      <UnitSelect data={data} value={unit.id} onChange={setUnitId} />
      <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex flex-wrap items-end gap-4 text-sm text-neutral-300">
          {offers.map(({ index, from, options, fromLevel }) => {
            const step = steps[index]
            const at = atOf[index]
            const to = step?.to.id ?? options[0].id
            const promoting = isPromotion(data, from, data.classes[to])
            return (
              <div key={index} className="flex flex-wrap items-end gap-2">
                {options.length > 1 ? (
                  <label className="space-y-1">
                    <span className="block text-xs text-neutral-500">
                      {from.name} {reclassing ? 'changes' : 'promotes'} to
                    </span>
                    <select value={to} onChange={(e) => update(patchTo(index, e.target.value))} className={selectClass}>
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                          {reclassing ? (isPromotion(data, from, o) ? ' (promotion)' : ' (reclass)') : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="space-y-1">
                  <span className="block text-xs text-neutral-500">{options.length > 1 ? 'When' : `Promote to ${options[0].name}`}</span>
                  {from.autoPromote ? (
                    <span className="block py-1 text-neutral-400">At Lv {maxLevelOf(from)} (automatic)</span>
                  ) : (
                    <select
                      value={at ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : Number(e.target.value)
                        update(patchAt(index, v))
                      }}
                      className={selectClass}
                    >
                      <option value="">{reclassing ? "Don't change" : "Don't promote"}</option>
                      {levels(Math.max(promoting ? minLevelOf(from) : fromLevel, fromLevel), maxLevelOf(from)).map((lv) => (
                        <option key={lv} value={lv}>
                          At Lv {lv}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              </div>
            )
          })}
          <label className="space-y-1">
            <span className="block text-xs text-neutral-500">Up to Lv (as {finalClass.name})</span>
            <select value={Math.max(lastLevel, Math.min(maxLevelOf(finalClass), plan.targetLevel))} onChange={(e) => update({ targetLevel: Number(e.target.value) })} className={selectClass}>
              {levels(lastLevel, maxLevelOf(finalClass)).map((lv) => (
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
          Average stats: each level adds the growth rate. Stats stop at the {unit.caps ? "unit's own maximums" : "class's caps"} (green).{' '}
          {data.promotionText ?? 'A promotion item works from Lv 10 and starts again at Lv 1 (Serenes Forest).'}{' '}
          {data.promotionText
            ? ''
            : (steps[0]?.to ?? first[0])?.gains
            ? "Promoting adds the new class's promotion gains from the game's class data, and Con and Mov become the new class's."
            : data.promotion
              ? "Promoting adds the difference between the classes' bases, and lifts HP and the weapon level to the new class's where lower (the game's code)."
              : "Promoting adds the difference between the classes' bases (Serenes Forest; not yet traced in the game's code)."}
          {start.autoPromote ? ` A trainee promotes on reaching Lv ${maxLevelOf(start)} (Serenes Forest).` : ''}
        </p>
        <StatTable
          data={data}
          rows={stages.map((st, i) => ({
            label: `${data.classes[st.classId].name} Lv ${st.level}${i === 0 ? ' (joins)' : ''}`,
            values: st.stats,
            caps: capsFor(unit, data.classes[st.classId]),
          }))}
        />
      </div>
    </div>
  )
}

/** Each partner: affinity, starting points and gain per turn, the turns to each level, and what the pair gives per level. */
export function GbaSupports({ data: game }: { data: GbaData }) {
  const { view: data, story, picker } = useStory(game)
  // Partners from every story: Alm's and Celica's armies meet.
  const everyone = { ...data, units: game.units }
  const [unitId, setUnitId] = useState(data.units[0]?.id ?? '')
  const unit = data.units.find((u) => u.id === unitId) ?? data.units[0]
  useScreenshotUnit(unit)
  const partners = unit ? supportsOf(data, unit.id) : []
  const fixed = unit && data.supportBonuses ? bonusesOf(data, unit.id) : null
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
              {unit.affinity && <div className="text-xs text-neutral-400">Affinity: {unit.affinity}</div>}
            </div>
          </div>
          {data.rankedSupports ? (
            <RankedSupports data={everyone} unit={unit} onPick={(id) => data.units.some((u) => u.id === id) && setUnitId(id)} />
          ) : fixed ? (
            <FixedSupports data={data} unit={unit} fixed={fixed} onPick={setUnitId} />
          ) : partners.length === 0 ? (
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
                        <td className="py-1 pl-2 text-xs text-neutral-400">{bonus(unit.affinity ?? '', partner.affinity ?? '')}</td>
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

/** Fixed supports: who gives this unit a bonus when in reach, and whom it gives one. */
function FixedSupports({
  data,
  unit,
  fixed,
  onPick,
}: {
  data: GbaData
  unit: GbaUnit
  fixed: ReturnType<typeof bonusesOf>
  onPick: (id: string) => void
}) {
  if (!fixed.gets.length && !fixed.gives.length) return <p className="text-sm text-neutral-400">{unit.name} has no supports.</p>
  const list = (title: string, rows: { partner: GbaUnit; bonus: number }[]) =>
    rows.length > 0 && (
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h4>
        <ul className="space-y-1">
          {rows.map(({ partner, bonus }) => (
            <li key={partner.id} className="flex items-center gap-2 text-sm">
              <button type="button" onClick={() => onPick(partner.id)} className="flex items-center gap-2 text-neutral-200 hover:text-violet-300">
                <UnitPortrait data={data} unit={partner} size={28} />
                {partner.name}
              </button>
              <span className="tabular-nums text-neutral-400">+{bonus}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  return (
    <>
      {data.supportBonusText && <p className="text-xs text-neutral-500">{data.supportBonusText}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {list(`${unit.name} gets`, fixed.gets)}
        {list(`${unit.name} gives`, fixed.gives)}
      </div>
    </>
  )
}

const RANKS = ['No rank', 'C', 'B', 'A']
const BONUS_LABELS = ['Hit', 'Crit', 'Avo', 'CEv']

function bonusText(b: number[]): string {
  return (
    b
      .map((v, i) => (v ? `${BONUS_LABELS[i]} ${v > 0 ? '+' : ''}${v}` : ''))
      .filter(Boolean)
      .join(', ') || '–'
  )
}

/** Ranked supports: per partner, each rank's points and act, and what each side gets. */
function RankedSupports({ data, unit, onPick }: { data: GbaData; unit: GbaUnit; onPick: (id: string) => void }) {
  const partners = rankedOf(data, unit.id)
  if (!partners.length) return <p className="text-sm text-neutral-400">{unit.name} has no supports.</p>
  return (
    <>
      {data.rankedSupportText && <p className="text-xs text-neutral-500">{data.rankedSupportText}</p>}
      <div className="space-y-3">
        {partners.map(({ partner, gets, gives, points, acts }) => {
          // No rank shows when it adds something; C, B and A when the pair has conversations.
          const ranks = RANKS.map((label, i) => ({ label, i })).filter(({ i }) => (i === 0 ? gets[0].some(Boolean) || gives[0].some(Boolean) : !!points))
          return (
            <div key={partner.id} className="rounded-md border border-neutral-800 p-2">
              <button type="button" onClick={() => onPick(partner.id)} className="mb-1 flex items-center gap-2 text-sm text-neutral-200 hover:text-violet-300">
                <UnitPortrait data={data} unit={partner} size={28} />
                {partner.name}
                {!points && <span className="text-xs text-neutral-500">(fixed bonus, no conversations)</span>}
              </button>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-neutral-500">
                      <th className="py-0.5 pr-2 text-left font-normal">Rank</th>
                      {points && <th className="px-1 py-0.5 text-right font-normal">Points</th>}
                      {acts && <th className="px-1 py-0.5 text-right font-normal">Act</th>}
                      <th className="py-0.5 pl-2 text-left font-normal">{unit.name} gets</th>
                      <th className="py-0.5 pl-2 text-left font-normal">{partner.name} gets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranks.map(({ label, i }) => (
                      <tr key={label} className="border-t border-neutral-800">
                        <td className="whitespace-nowrap py-0.5 pr-2 text-neutral-400">{label}</td>
                        {points && <td className="px-1 py-0.5 text-right tabular-nums text-neutral-300">{i ? points[i - 1] : ''}</td>}
                        {acts && <td className="px-1 py-0.5 text-right tabular-nums text-neutral-300">{i ? acts[i - 1] : ''}</td>}
                        <td className="py-0.5 pl-2 text-neutral-200">{bonusText(gets[i])}</td>
                        <td className="py-0.5 pl-2 text-neutral-200">{bonusText(gives[i])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
