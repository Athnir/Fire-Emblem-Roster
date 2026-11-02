import { useState } from 'react'
import { AssetIcon } from '../components/AssetIcon'
import { useFe13Builds, type Fe13BuildEntry, type Fe13BuildSet } from './buildSets'
import { capsOf, pairUpBonus, reachableClasses, statsIn, unitNow, type Fe13Data, type Fe13Plan, type Fe13Rank } from './logic'
import { Fe13ParentChecker } from './screens'
import { useFe13Store } from './store'
import { FE13_STATS, FE13_STAT_LABELS, type Fe13Stats } from './types'
import { selectClass, useAvatarData } from './ui'

function SkillTags({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-neutral-600">—</span>
  return (
    <div className="flex max-w-[8rem] flex-wrap gap-1">
      {names.map((name) => (
        <span key={name} className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-[11px] text-neutral-300">
          <AssetIcon type="skill" iconId={`fe13/${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`} label={name} size={12} />
          {name}
        </span>
      ))}
    </div>
  )
}

/** Stats four to a row, fixed-width so "Save as image" keeps the spacing (as the Fates viewer does). */
function StatGrid({ values, mov, suffix = '' }: { values: Fe13Stats; mov?: number; suffix?: string }) {
  const show = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
  return (
    <div className="grid grid-cols-[repeat(4,4.5rem)] whitespace-nowrap text-xs">
      {FE13_STATS.map((s) => (
        <span key={s} className="pb-0.5 pr-2">
          <span className="text-neutral-500">{FE13_STAT_LABELS[s]} </span>
          {show(values[s])}
          {suffix}
        </span>
      ))}
      {mov !== undefined && (
        <span className="pb-0.5 pr-2">
          <span className="text-neutral-500">Mov </span>
          {mov}
        </span>
      )}
    </div>
  )
}

const planOf = (entry: Fe13BuildEntry | undefined): Fe13Plan | undefined => {
  const p = entry?.data.plan as Fe13Plan | undefined
  return p && Array.isArray(p.steps) ? p : undefined
}

/**
 * As Fates' Team Viewer: a saved Skill Set and a saved Unit Set side by side, one row per unit with their backpack (the partner behind
 * them in a pair-up), final class, weapons, skills, growths and maximums with the backpack's pair-up bonus. Units marked as backpack
 * units in the Skill Planner are listed apart. A unit can be in only one place: in front, or behind one other unit.
 */
function Fe13TeamViewer({ data }: { data: Fe13Data }) {
  const sets = useFe13Builds((s) => s.sets)
  const patch = useFe13Builds((s) => s.patch)
  const spouses = useFe13Store((s) => s.spouses)
  const [skillSetId, setSkillSetId] = useState('')
  const [unitSetId, setUnitSetId] = useState('')
  const skillSets = sets.filter((s) => s.tab === 'skills')
  const unitSets = sets.filter((s) => s.tab === 'unit')
  const skillSet: Fe13BuildSet | undefined = skillSets.find((s) => s.id === skillSetId)
  const unitSet: Fe13BuildSet | undefined = unitSets.find((s) => s.id === unitSetId)
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const skillEntry = (id: string) => skillSet?.entries.find((e) => e.unitId === id)
  const unitEntry = (id: string) => unitSet?.entries.find((e) => e.unitId === id)
  const ids = [...new Set([...(unitSet?.entries ?? []), ...(skillSet?.entries ?? [])].map((e) => e.unitId))].filter((id) => byId.has(id))
  // The set's plans stand in for the units' own, so the set shows as it was saved.
  const plans: Record<string, Fe13Plan> = {}
  for (const e of unitSet?.entries ?? []) {
    const p = planOf(e)
    if (p) plans[e.unitId] = p
  }
  const isBackpack = (id: string) => Boolean(skillEntry(id)?.data.backpack)
  const backpackClass = (id: string) => {
    const c = skillEntry(id)?.data.backpackClass
    return typeof c === 'string' && data.classes[c] ? c : undefined
  }
  const pairOf = (id: string) => plans[id]?.pairUp
  const counts = new Map<string, number>()
  for (const id of ids) {
    const p = pairOf(id)?.partner
    if (p) counts.set(p, (counts.get(p) ?? 0) + 1)
  }
  // In front (a row of their own) and behind someone, or behind two: more places than there are of them.
  const overUsed = (id: string) => (ids.includes(id) && !isBackpack(id) ? 1 : 0) + (counts.get(id) ?? 0) > 1

  const row = (id: string) => {
    const unit = byId.get(id)!
    const now = unitNow(data, unit, spouses, plans)
    const cls = data.classes[now.classId]
    const plan = plans[id]
    const growths = {} as Fe13Stats
    for (const s of FE13_STATS) growths[s] = now.growths[s] + (cls.growths?.[s] ?? 0) + (plan?.aptitude ? 20 : 0)
    const caps = capsOf(cls, now.modifiers, now.limitBreaker)
    const pair = pairOf(id)
    const partner = pair?.partner ? byId.get(pair.partner) : undefined
    let bonus: ReturnType<typeof pairUpBonus> | undefined
    if (partner) {
      const theirs = unitNow(data, partner, spouses, plans)
      const as = backpackClass(partner.id) ?? pair?.partnerClass ?? theirs.classId
      bonus = pairUpBonus(data.classes[as] ?? data.classes[theirs.classId], statsIn(data, theirs, as), (pair?.rank ?? 0) as Fe13Rank)
    }
    const max = { ...caps }
    for (const s of FE13_STATS) if (s !== 'hp' && bonus) max[s] += bonus[s]
    const loadout = skillEntry(id)?.data.loadout
    return {
      unit,
      cls,
      level: now.level,
      skills: Array.isArray(loadout) ? (loadout as string[]) : [],
      growths,
      max,
      mov: cls.bases.mov + (bonus?.mov ?? 0),
      partner: pair?.partner ?? '',
    }
  }

  const setPartner = (id: string, partner: string) => {
    if (!unitSet) return
    const plan = planOf(unitEntry(id)) ?? { steps: [], targetLevel: 20 }
    const pairUp = partner ? { rank: 0 as Fe13Rank, ...plan.pairUp, partner, partnerClass: undefined } : undefined
    patch(unitSet.id, id, byId.get(id)?.name ?? id, { plan: { ...plan, pairUp } })
  }
  const setBackpackClass = (id: string, classId: string) => {
    if (skillSet) patch(skillSet.id, id, byId.get(id)?.name ?? id, { backpackClass: classId })
  }

  const partnerPicker = (id: string, value: string) => (
    <>
      <select
        value={value}
        onChange={(e) => setPartner(id, e.target.value)}
        disabled={!unitSet}
        className={`w-full max-w-[10rem] rounded-md border bg-neutral-800 px-2 py-1 text-xs text-neutral-200 ${value && overUsed(value) ? 'border-red-500' : 'border-neutral-700'}`}
      >
        <option value="">(none)</option>
        {data.units
          .filter((u) => u.id !== id)
          .map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
      </select>
      {value && overUsed(value) && <p className="mt-1 text-xs text-amber-400">{byId.get(value)?.name} is in two places.</p>}
    </>
  )
  const main = ids.filter((id) => !isBackpack(id))
  const behind = ids.filter((id) => isBackpack(id))

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="text-base font-semibold text-neutral-100">Team Viewer</h3>
        <p className="text-xs text-neutral-500">
          Pick a saved Skill Set and a saved Unit Set to see them as one team. Each unit's backpack is who's behind them in a pair-up (set in
          the Unit Planner, or changed here, which saves to the Unit Set). Tick "Backpack unit" in the Skill Planner to list a unit apart.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-neutral-400">
            Skill Set
            <select value={skillSetId} onChange={(e) => setSkillSetId(e.target.value)} className={selectClass}>
              <option value="">(none)</option>
              {skillSets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">
            Unit Set
            <select value={unitSetId} onChange={(e) => setUnitSetId(e.target.value)} className={selectClass}>
              <option value="">(none)</option>
              {unitSets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {sets.length === 0 && <p className="text-sm text-neutral-500">Save a set in the Skill Planner or the Unit Planner first.</p>}
      </div>

      {main.length > 0 && (
        <div>
          <div data-export-table className="hidden overflow-x-auto rounded-lg border border-neutral-800 sm:block">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Backpack</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Weapons</th>
                  <th className="px-3 py-2">Skills</th>
                  <th className="px-3 py-2">Growth %</th>
                  <th className="px-3 py-2">Max Stats</th>
                </tr>
              </thead>
              <tbody>
                {main.map((id) => {
                  const r = row(id)
                  return (
                    <tr key={id} className="border-b border-neutral-800/60 align-top last:border-0">
                      <td className="px-3 py-2 font-medium text-neutral-200">{r.unit.name}</td>
                      <td className="px-3 py-2">{partnerPicker(id, r.partner)}</td>
                      <td className="px-3 py-2 text-neutral-300">
                        {r.cls.name} <span className="text-neutral-500">Lv {r.level}</span>
                      </td>
                      <td className="px-3 py-2 text-neutral-300">{r.cls.weapons.join(', ') || '—'}</td>
                      <td className="px-3 py-2">
                        <SkillTags names={r.skills} />
                      </td>
                      <td className="px-3 py-2 text-neutral-300">
                        <StatGrid values={r.growths} />
                      </td>
                      <td className="px-3 py-2 text-neutral-300">
                        <StatGrid values={r.max} mov={r.mov} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div data-export-cards className="space-y-3 sm:hidden">
            {main.map((id) => {
              const r = row(id)
              return (
                <div key={id} className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm">
                  <div className="font-medium text-neutral-200">
                    {r.unit.name} <span className="text-neutral-500">· {r.cls.name} Lv {r.level}</span>
                  </div>
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Backpack</div>
                    {partnerPicker(id, r.partner)}
                  </div>
                  <div className="text-neutral-300">
                    <span className="text-neutral-500">Weapons: </span>
                    {r.cls.weapons.join(', ') || '—'}
                  </div>
                  <SkillTags names={r.skills} />
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Growth %</div>
                    <StatGrid values={r.growths} />
                  </div>
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Max Stats</div>
                    <StatGrid values={r.max} mov={r.mov} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {behind.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-neutral-300">Backpack Only</h4>
          <div className="space-y-3">
            {behind.map((id) => {
              const unit = byId.get(id)!
              const picked = backpackClass(id) ?? ''
              const loadout = skillEntry(id)?.data.loadout
              return (
                <div key={id} className="flex flex-wrap items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm">
                  <div className="w-32 font-medium text-neutral-200">
                    {unit.name}
                    {overUsed(id) && <p className="text-xs font-normal text-amber-400">Behind more than one unit.</p>}
                  </div>
                  <select value={picked} onChange={(e) => setBackpackClass(id, e.target.value)} className={`${selectClass} max-w-[10rem] text-xs`}>
                    <option value="">(pick a class)</option>
                    {reachableClasses(data, unit).map((c) => (
                      <option key={c} value={c}>
                        {data.classes[c].name}
                      </option>
                    ))}
                  </select>
                  <div className="text-neutral-300">{picked ? data.classes[picked].weapons.join(', ') : '—'}</div>
                  <SkillTags names={Array.isArray(loadout) ? (loadout as string[]) : []} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** As Fates' Bulk Viewer: the Team Viewer (a whole saved team at once) and the Parent Checker (one child against several candidates). */
export function Fe13BulkViewer({ data: raw }: { data: Fe13Data }) {
  const data = useAvatarData(raw)
  const [sub, setSub] = useState<'team' | 'parent'>('team')
  const tab = (id: 'team' | 'parent', label: string) => (
    <button
      type="button"
      onClick={() => setSub(id)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${sub === id ? 'bg-violet-600 text-white' : 'bg-neutral-800 text-neutral-300'}`}
    >
      {label}
    </button>
  )
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {tab('team', 'Team Viewer')}
        {tab('parent', 'Parent Checker')}
      </div>
      {sub === 'team' ? <Fe13TeamViewer data={data} /> : <Fe13ParentChecker data={raw} />}
    </div>
  )
}
