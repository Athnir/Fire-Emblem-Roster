import { canWear, levelUpsIn, promotionOf, type BandSegment, type ProjectionPlan } from './logic'
import type { TelliusData, TelliusUnit } from './types'

const STAT_SHORT: Record<string, string> = { hp: 'HP', str: 'Str', mag: 'Mag', skl: 'Skl', spd: 'Spd', lck: 'Lck', def: 'Def', res: 'Res' }

const selectClass = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200'

/** The class and level a unit reaches with its k-th level-up (0-based) under the plan. */
function levelAt(data: TelliusData, unit: TelliusUnit, plan: ProjectionPlan, k: number): { classId: string; level: number } {
  const promoted = promotionOf(data, unit)
  if (promoted && plan.promoteAt !== null) {
    const before = Math.max(unit.level, Math.min(plan.promoteAt, data.maxLevel)) - unit.level
    if (k >= before) return { classId: promoted.id, level: k - before + 2 }
  }
  return { classId: unit.classId, level: unit.level + k + 1 }
}

/**
 * Bands worn over the unit's levels, one row per stretch: which band and for how many level-ups, in order from when the
 * unit joins (as Fates' Unit Planner splits its levels across classes). Levels after the last row wear none.
 */
export function BandEditor({
  data,
  unit,
  plan,
  onChange,
}: {
  data: TelliusData
  unit: TelliusUnit
  plan: ProjectionPlan
  onChange: (bands: BandSegment[]) => void
}) {
  const bands = data.bands ?? []
  if (bands.length === 0) return null
  const segments = plan.bands ?? []
  const total = levelUpsIn(data, unit, plan)
  const used = segments.reduce((sum, s) => sum + s.levels, 0)
  const remaining = total - used
  const byId = new Map(bands.map((b) => [b.id, b]))

  const update = (i: number, patch: Partial<BandSegment>) => onChange(segments.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  let start = 0
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-neutral-200">
        Bands{' '}
        <span className={`text-xs font-normal ${used > total ? 'text-red-400' : 'text-neutral-500'}`}>
          {used} / {total} level-ups planned
        </span>
      </h4>
      <p className="text-xs text-neutral-500">
        A band adds its growth changes while worn, in both modes. Levels after the last band wear none.
      </p>
      {segments.map((seg, i) => {
        const band = byId.get(seg.bandId)
        const first = start
        start += seg.levels
        const from = levelAt(data, unit, plan, first)
        const to = levelAt(data, unit, plan, Math.min(first + seg.levels, Math.max(total, 1)) - 1)
        const past = first >= total
        const unwearable = band
          ? [...new Set([from.classId, to.classId])].filter((c) => !canWear(band, c)).map((c) => data.classes[c]?.name)
          : []
        const rowMax = Math.max(1, seg.levels + Math.max(0, remaining))
        return (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-800 p-2 text-xs">
            <select value={seg.bandId} onChange={(e) => update(i, { bandId: e.target.value })} className={`${selectClass} min-w-[9rem]`}>
              {bands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-neutral-400">
              Level-ups
              <select value={seg.levels} onChange={(e) => update(i, { levels: Number(e.target.value) })} className={selectClass}>
                {Array.from({ length: rowMax }, (_, n) => n + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-neutral-500">
              {past
                ? 'past the planned levels'
                : `${data.classes[from.classId].name} Lv ${from.level}` +
                  (to.level !== from.level || to.classId !== from.classId ? ` to ${to.classId !== from.classId ? `${data.classes[to.classId].name} ` : ''}Lv ${to.level}` : '')}
            </span>
            {band && (
              <span className="text-neutral-400">
                {Object.entries(band.growths)
                  .filter(([, v]) => v)
                  .map(([k, v]) => `${STAT_SHORT[k]} +${v}%`)
                  .join(', ')}
              </span>
            )}
            {unwearable.length > 0 && <span className="text-amber-400">no effect as {unwearable.join(' or ')}</span>}
            <button type="button" onClick={() => onChange(segments.filter((_, j) => j !== i))} className="ml-auto text-neutral-500 hover:text-red-400">
              Remove
            </button>
          </div>
        )
      })}
      <button
        type="button"
        disabled={remaining <= 0}
        onClick={() => onChange([...segments, { bandId: bands[0].id, levels: Math.min(remaining, Math.max(1, remaining)) }])}
        className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-600 disabled:opacity-40"
      >
        + Add band
      </button>
    </div>
  )
}
