import { useEffect, useRef, useState } from 'react'
import { Portrait } from '../components/Portrait'
import { useScreenshotContextStore } from '../state/screenshotContextStore'
import { childProfile, FE4_MAX_LEVEL, FE4_PROMOTE_LEVEL, profileOf, project, type Fe4Data, type Fe4Plan, type Fe4Profile } from './logic'
import { useFe4Store } from './store'
import { FE4_STATS, type Fe4Stats, type Fe4Unit } from './types'

const LABELS: Record<string, string> = { hp: 'HP', str: 'Str', mag: 'Mag', skl: 'Skl', spd: 'Spd', lck: 'Lck', def: 'Def', res: 'Res' }
const selectClass = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200'

function artId(gameId: string, name: string): string {
  return `${gameId}/${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
}

function UnitPortrait({ data, unit, size = 64 }: { data: Fe4Data; unit: Fe4Unit; size?: number }) {
  return <Portrait characterId={artId(data.gameId, unit.name)} isChild={false} size={size} />
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

function StatTable({ rows }: { rows: { label: string; values: Fe4Stats; caps?: Fe4Stats; suffix?: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="text-xs text-neutral-500">
            <th className="py-1 pr-2 text-left font-normal" />
            {FE4_STATS.map((s) => (
              <th key={s} className="px-1 py-1 text-right font-normal">
                {LABELS[s]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-neutral-800">
              <td className="whitespace-nowrap py-1 pr-2 text-xs text-neutral-400">{row.label}</td>
              {FE4_STATS.map((s) => (
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

function useScreenshotUnit(unit: Fe4Unit | undefined) {
  const setUnitLabel = useScreenshotContextStore((state) => state.setUnitLabel)
  useEffect(() => {
    setUnitLabel(unit?.name ?? '')
    return () => setUnitLabel('')
  }, [unit, setUnitLabel])
}

function chapterLabel(data: Fe4Data, id?: string): string {
  return data.chapters.find((c) => c.id === id)?.label ?? ''
}

/** The mothers whose husband the player picks, and the fathers to pick from (the first generation's men, less Sigurd and
 * Quan, whose wives the story sets). */
export function pairingChoices(data: Fe4Data): { mothers: Fe4Unit[]; fathers: Fe4Unit[] } {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const mothers = [...new Set(data.units.filter((u) => u.role === 'child' && u.mother && !u.father).map((u) => u.mother!))].map((id) => byId.get(id)!)
  const fixed = new Set(data.units.flatMap((u) => (u.father ? [u.father] : [])))
  const fathers = data.units.filter((u) => u.generation === 1 && !u.female && !fixed.has(u.id))
  return { mothers, fathers }
}

function defaultPlan(unit: Fe4Unit): Fe4Plan {
  return { promoteAt: unit.promotesTo ? Math.max(FE4_PROMOTE_LEVEL, unit.level) : null, targetLevel: FE4_MAX_LEVEL }
}

/** Every unit's profile under the saved pairings and plans: a child's comes from their parents' planned stats. */
function useProfiles(data: Fe4Data) {
  const pairings = useFe4Store((s) => s.pairings)
  const plans = useFe4Store((s) => s.plans)
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const planOf = (u: Fe4Unit) => plans[u.id] ?? defaultPlan(u)
  const parentAtEnd = (u: Fe4Unit) => {
    const p = profileOf(data, u)!
    const stages = project(data, p, planOf(u))
    const last = stages[stages.length - 1]
    return { unit: u, classId: last.classId, stats: last.stats, gold: u.gold ?? 0 }
  }
  const fatherOf = (child: Fe4Unit): Fe4Unit | undefined =>
    child.father ? byId.get(child.father) : child.mother ? byId.get(pairings[child.mother] ?? '') : undefined
  const profile = (u: Fe4Unit): Fe4Profile | undefined => {
    if (u.role !== 'child') return profileOf(data, u)
    const father = fatherOf(u)
    const mother = u.mother ? byId.get(u.mother) : undefined
    if (!father || !mother) return undefined
    return childProfile(data, u, parentAtEnd(father), parentAtEnd(mother))
  }
  return { profile, planOf, fatherOf, pairings }
}

function joinText(data: Fe4Data, u: Fe4Unit): string {
  const where = chapterLabel(data, u.joinChapter)
  const j = u.join
  if (!j) return where
  if (j.how === 'talk') return `${where}: ${j.with?.length ? `talk to them with ${j.with.join(' or ')}` : 'by talking to them'}`
  if (j.how === 'event') return `${where}: joins ${j.turn ? `on turn ${j.turn}` : 'during the chapter'}`
  return `${where}: joins at the start`
}

const UNCONFIRMED_CHILD = "A child's stats, growths and holy blood follow Serenes Forest's formulas, worked out from the parents' planned stats (Unit Planner); not yet traced in the game's code."

function UnitDetail({ data, unit }: { data: Fe4Data; unit: Fe4Unit }) {
  const { profile, fatherOf } = useProfiles(data)
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const p = profile(unit)
  const cls = data.classes[unit.classId]
  const promo = unit.promotesTo ? data.classes[unit.promotesTo] : undefined
  const father = unit.role === 'child' ? fatherOf(unit) : undefined
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
            <span className="text-neutral-500">Joins: </span>
            {joinText(data, unit)}
          </div>
          {unit.join?.note && <div className="text-neutral-400">{unit.join.note}</div>}
          {unit.role === 'child' && unit.mother && (
            <div>
              <span className="text-neutral-500">Parents: </span>
              {father ? father.name : 'father not chosen (Pairings)'} and {byId.get(unit.mother)?.name}
            </div>
          )}
          {unit.role === 'substitute' && unit.substituteFor && (
            <div className="text-neutral-400">
              Joins instead of {byId.get(unit.substituteFor)?.name} when {byId.get(byId.get(unit.substituteFor)?.mother ?? '')?.name} has no children.
            </div>
          )}
          {p && p.blood.length > 0 && (
            <div>
              <span className="text-neutral-500">Holy blood: </span>
              {p.blood.map((b) => `${b.blood} (${b.level})`).join(', ')}
            </div>
          )}
          {unit.leadership ? (
            <div>
              <span className="text-neutral-500">Leadership: </span>
              {'★'.repeat(unit.leadership)}
            </div>
          ) : null}
        </div>
      </div>
      {p ? (
        <>
          <StatTable
            rows={[
              { label: 'Bases', values: p.bases },
              { label: 'Growths (with holy blood)', values: p.growths, suffix: '%' },
              ...(unit.growths ? [{ label: 'Own growths', values: unit.growths, suffix: '%' }] : []),
            ]}
          />
          <div className="flex flex-wrap gap-x-6 text-sm text-neutral-300">
            <span>
              <span className="text-neutral-500">Mov </span>
              {cls.mov}
            </span>
            <span>
              <span className="text-neutral-500">Gold </span>
              {p.gold}
            </span>
            {p.skills.length > 0 && (
              <span>
                <span className="text-neutral-500">Skills </span>
                {p.skills.join(', ')}
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-neutral-400">Pick {byId.get(unit.mother ?? '')?.name}'s husband in Pairings to see this child's stats.</p>
      )}
      {unit.role === 'child' && <p className="text-xs text-amber-300">Unconfirmed: {UNCONFIRMED_CHILD}</p>}
      {unit.unconfirmed && <p className="rounded-md border border-amber-800/60 bg-amber-950/30 p-2 text-xs text-amber-300">Unconfirmed: {unit.unconfirmed}</p>}
    </div>
  )
}

/** Every playable unit by the chapter they join; tapping one shows their data below the list. */
export function Fe4Roster({ data }: { data: Fe4Data }) {
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
                    {u.role === 'substitute' && <span className="text-xs text-neutral-500">sub</span>}
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

function UnitSelect({ data, value, onChange }: { data: Fe4Data; value: string; onChange: (id: string) => void }) {
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

/** One unit's average stats through promotion to the level cap. A parent's plan is what their children's stats come from. */
export function Fe4Planner({ data }: { data: Fe4Data }) {
  const [unitId, setUnitId] = useState(data.units[0]?.id ?? '')
  const unit = data.units.find((u) => u.id === unitId)
  useScreenshotUnit(unit)
  const { profile, planOf } = useProfiles(data)
  const plans = useFe4Store((s) => s.plans)
  const setPlan = useFe4Store((s) => s.setPlan)
  const p = unit ? profile(unit) : undefined
  return (
    <div className="space-y-4">
      <UnitSelect data={data} value={unitId} onChange={setUnitId} />
      {unit && !p && <p className="text-sm text-neutral-400">Pick this child's father in Pairings first.</p>}
      {unit && p && (() => {
        const plan = planOf(unit)
        const stages = project(data, p, plan)
        const promo = unit.promotesTo ? data.classes[unit.promotesTo] : undefined
        const update = (patch: Partial<Fe4Plan>) => setPlan(unit.id, { ...plan, ...patch })
        const levels = (from: number) => Array.from({ length: FE4_MAX_LEVEL - from + 1 }, (_, i) => from + i)
        return (
          <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex flex-wrap items-end gap-4 text-sm text-neutral-300">
              {promo && (
                <label className="space-y-1">
                  <span className="block text-xs text-neutral-500">Promote to {promo.name}</span>
                  <select value={plan.promoteAt ?? ''} onChange={(e) => update({ promoteAt: e.target.value === '' ? null : Number(e.target.value) })} className={selectClass}>
                    <option value="">Don't promote</option>
                    {levels(Math.max(FE4_PROMOTE_LEVEL, unit.level)).map((lv) => (
                      <option key={lv} value={lv}>
                        At Lv {lv}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="space-y-1">
                <span className="block text-xs text-neutral-500">Up to Lv</span>
                <select value={Math.max(plan.targetLevel, unit.level)} onChange={(e) => update({ targetLevel: Number(e.target.value) })} className={selectClass}>
                  {levels(unit.level).map((lv) => (
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
              Average stats: each level adds the growth rate (own + holy blood). Stats stop at the class's caps (green): HP 80, Luck 30,
              the rest the class's base + 15, as the game's level-up code holds them. Promoting (from Lv 20) adds the difference between the
              classes' bases and keeps the level (Serenes Forest). Units of the first generation pass these stats on to their children
              (Pairings).
            </p>
            <StatTable
              rows={stages.map((st, i) => ({
                label: `${data.classes[st.classId].name} Lv ${st.level}${i === 0 ? ' (joins)' : ''}`,
                values: st.stats,
                caps: st.caps,
              }))}
            />
          </div>
        )
      })()}
    </div>
  )
}

/** Pick each mother's husband; her two children (or, without one, the substitutes) and what they inherit. */
export function Fe4Pairings({ data }: { data: Fe4Data }) {
  const { mothers, fathers } = pairingChoices(data)
  const { profile, pairings } = useProfiles(data)
  const setFather = useFe4Store((s) => s.setFather)
  const byId = new Map(data.units.map((u) => [u.id, u]))
  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        Each mother's children take after their parents as they stand at the end of the first generation: their planned stats in
        the Unit Planner (by default promoted at Lv 20 and taken to 30). A mother left without a husband has no children; their
        substitutes join instead. A father can only be picked once.
      </p>
      {mothers.map((mother) => {
        const father = pairings[mother.id] ? byId.get(pairings[mother.id]) : undefined
        const children = data.units.filter((u) => u.role === 'child' && u.mother === mother.id)
        return (
          <div key={mother.id} className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <UnitPortrait data={data} unit={mother} size={48} />
              <span className="font-semibold text-neutral-100">{mother.name}</span>
              <span className="text-neutral-500">and</span>
              <select value={father?.id ?? ''} onChange={(e) => setFather(mother.id, e.target.value || null)} className={selectClass}>
                <option value="">No husband</option>
                {fathers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {Object.entries(pairings).some(([m, fid]) => fid === f.id && m !== mother.id) ? ' (taken)' : ''}
                  </option>
                ))}
              </select>
              {father && <UnitPortrait data={data} unit={father} size={48} />}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {children.map((child) => {
                const sub = data.units.find((u) => u.substituteFor === child.id)
                const shown = father ? child : sub
                if (!shown) return null
                const p = father ? profile(child) : profile(shown)
                return (
                  <div key={child.id} className="space-y-2 rounded-md border border-neutral-800 p-3">
                    <div className="flex items-center gap-2">
                      <UnitPortrait data={data} unit={shown} size={32} />
                      <span className="text-neutral-100">{shown.name}</span>
                      <span className="text-xs text-neutral-500">
                        {data.classes[shown.classId].name} Lv {shown.level}
                        {!father && ` (substitute for ${child.name})`}
                      </span>
                    </div>
                    {p && (
                      <>
                        {p.blood.length > 0 && <div className="text-xs text-neutral-400">{p.blood.map((b) => `${b.blood} (${b.level})`).join(', ')}</div>}
                        <StatTable
                          rows={[
                            { label: 'Bases', values: p.bases },
                            { label: 'Growths', values: p.growths, suffix: '%' },
                          ]}
                        />
                        {p.skills.length > 0 && <div className="text-xs text-neutral-400">Skills: {p.skills.join(', ')}</div>}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      <p className="text-xs text-amber-300">Unconfirmed: {UNCONFIRMED_CHILD} Luck adds a random 1-99, taken here as 50.</p>
    </div>
  )
}
