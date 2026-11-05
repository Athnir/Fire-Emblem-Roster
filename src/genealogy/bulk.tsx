import { useState } from 'react'
import { isPlanned } from '../logic/planned'
import { defaultPlan, luckExtra, pairingChoices, profilesWith, selectClass } from './hooks'
import { capsOf, excludedUnits, loveFor, project, weaponRanks, type Fe4Data } from './logic'
import { useFe4Builds, useFe4Store } from './store'
import { StatGrid, UnitPortrait, WrapWarning } from './ui'

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1 text-xs transition-colors ${
    on ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
  }`

/** As Fates' Parent Checker: one mother's child with every father she can have, side by side, from the fathers' plans. */
function ParentChecker({ data }: { data: Fe4Data }) {
  const { mothers, fathers } = pairingChoices(data)
  const pairings = useFe4Store((s) => s.pairings)
  const plans = useFe4Store((s) => s.plans)
  const [motherId, setMotherId] = useState(mothers[0]?.id ?? '')
  const children = data.units.filter((u) => u.role === 'child' && u.mother === motherId)
  const [childId, setChildId] = useState('')
  const child = children.find((c) => c.id === childId) ?? children[0]
  const { childWith } = profilesWith(data, pairings, plans)
  const love = new Map(loveFor(data, motherId).map((l) => [l.man, l]))
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="text-base font-semibold text-neutral-100">Parent Checker</h3>
        <p className="text-xs text-neutral-500">
          A mother's child with each father she can have, from the fathers' and her Unit Planner plans. Turns to 500 is her love with
          him from the start, the gains each turn and the talks.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {mothers.map((m) => (
            <button key={m.id} type="button" onClick={() => setMotherId(m.id)} className={chip(m.id === motherId)}>
              {m.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {children.map((c) => (
            <button key={c.id} type="button" onClick={() => setChildId(c.id)} className={chip(c.id === child?.id)}>
              {c.name}
            </button>
          ))}
        </div>
      </div>
      {child && (
        <div className="grid gap-3 lg:grid-cols-2">
          {fathers.map((f) => {
            const p = childWith(child, f)
            if (!p) return null
            const l = love.get(f.id)
            const holy = weaponRanks(data, child.classId, p.blood).flatMap((r) => (r.holy ? [r.holy] : []))
            return (
              <div key={f.id} className={`space-y-2 rounded-lg border p-3 text-sm ${pairings[motherId] === f.id ? 'border-violet-500' : 'border-neutral-800'} bg-neutral-900`}>
                <div className="flex items-center gap-2">
                  <UnitPortrait data={data} unit={f} size={32} />
                  <span className="font-medium text-neutral-200">{f.name}</span>
                  {l && <span className="ml-auto text-xs text-neutral-500">{l.turns !== undefined ? `${l.turns} turns to 500` : 'no gain'}</span>}
                </div>
                <div className="text-xs text-neutral-400">
                  {p.blood.length ? p.blood.map((b) => `${b.blood} (${b.level})`).join(', ') : 'No holy blood'}
                  {holy.length ? ` · ${holy.join(', ')}` : ''}
                </div>
                <div>
                  <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Bases</div>
                  <StatGrid values={p.bases} extra={luckExtra(p)} />
                </div>
                <div>
                  <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Growth %</div>
                  <StatGrid values={p.growths} suffix="%" />
                </div>
                {p.skills.length > 0 && <div className="text-xs text-neutral-400">Skills: {p.skills.join(', ')}</div>}
                <WrapWarning data={data} p={p} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** As Fates' Team Viewer: the pairings and plans, now or in a saved set, with every unit's final class, weapons, skills, growths and
 * caps at once; and the saved sets themselves. */
function TeamViewer({ data }: { data: Fe4Data }) {
  const current = { pairings: useFe4Store((s) => s.pairings), plans: useFe4Store((s) => s.plans) }
  const picks = useFe4Store((s) => s.picks)
  const loadSet = useFe4Store((s) => s.load)
  const sets = useFe4Builds((s) => s.sets)
  const save = useFe4Builds((s) => s.save)
  const rename = useFe4Builds((s) => s.rename)
  const deleteSet = useFe4Builds((s) => s.deleteSet)
  const [source, setSource] = useState('current')
  const [name, setName] = useState('')
  const [gen, setGen] = useState<1 | 2>(1)
  const set = sets.find((s) => s.id === source)
  const { pairings, plans } = set ?? current
  const { profile, planOf } = profilesWith(data, pairings, plans)
  const left = excludedUnits(data, picks, pairings)
  // Only the units with a plan, as Fates' Team Viewer shows only the units in its sets (user, 2026-11-05).
  const rows = data.units
    .filter((u) => u.generation === gen && !left.has(u.id) && isPlanned(plans[u.id], defaultPlan(data, u)))
    .flatMap((u) => {
      const p = profile(u)
      if (!p) return []
      const stages = project(data, p, planOf(u))
      const final = stages[stages.length - 1]
      const cls = data.classes[final.classId]
      return [{ unit: u, p, cls, level: final.level, caps: capsOf(cls) }]
    })
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="text-base font-semibold text-neutral-100">Team Viewer</h3>
        <p className="text-xs text-neutral-500">
          Everyone's final class, weapons, skills, growths and caps under the current pairings and plans, or a saved set. Save the
          current pairings and plans as a set to keep a playthrough, and load one back into Pairings and the Unit Planner.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-400">
            Show
            <select value={source} onChange={(e) => setSource(e.target.value)} className={selectClass}>
              <option value="current">The current pairings and plans</option>
              {sets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setGen(1)} className={chip(gen === 1)}>
              First generation
            </button>
            <button type="button" onClick={() => setGen(2)} className={chip(gen === 2)}>
              Second generation
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Save the current as… (e.g. Lex x Ayra run)"
            className="min-w-[12rem] flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200"
          />
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => {
              save(name.trim(), current.pairings, current.plans)
              setName('')
            }}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save set
          </button>
        </div>
        {set && (
          <div className="flex flex-wrap gap-3 text-xs">
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Replace the current pairings and plans with "${set.name}"?`)) {
                  loadSet(set.pairings, set.plans)
                  setSource('current')
                }
              }}
              className="text-violet-300 hover:text-violet-200"
            >
              Load into Pairings and the Unit Planner
            </button>
            <button
              type="button"
              onClick={() => {
                const next = window.prompt('Rename set', set.name)
                if (next && next.trim()) rename(set.id, next.trim())
              }}
              className="text-neutral-400 hover:text-neutral-200"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                deleteSet(set.id)
                setSource('current')
              }}
              className="text-neutral-400 hover:text-red-400"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.unit.id} className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm">
            <div className="flex items-center gap-2">
              <UnitPortrait data={data} unit={r.unit} size={28} />
              <span className="font-medium text-neutral-200">{r.unit.name}</span>
              <span className="text-neutral-500">
                · {r.cls.name} Lv {r.level}
              </span>
            </div>
            <div className="text-xs text-neutral-400">
              {weaponRanks(data, r.cls.id, r.p.blood)
                .map((w) => `${w.type[0].toUpperCase()}${w.type.slice(1)} ${w.rank}${w.holy ? ` + ${w.holy}` : ''}`)
                .join(', ') || 'No weapons'}
              {r.p.skills.length || r.cls.skills?.length ? ` · ${[...r.p.skills, ...(r.cls.skills ?? [])].join(', ')}` : ''}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Growth %</div>
                <StatGrid values={r.p.growths} suffix="%" />
              </div>
              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Caps</div>
                <StatGrid values={r.caps} mov={r.cls.mov} />
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-neutral-500">No plans yet: a unit shows here once it has a plan (change anything for them in the Unit or Skill Planner), as in Fates' Team Viewer. A child shows once their mother's husband is picked in Pairings.</p>}
      </div>
    </div>
  )
}

/** As Fates' Bulk Viewer: the Parent Checker and the Team Viewer. */
export function Fe4BulkViewer({ data }: { data: Fe4Data }) {
  const [sub, setSub] = useState<'parent' | 'team'>('parent')
  const tab = (id: 'parent' | 'team', label: string) => (
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
        {tab('parent', 'Parent Checker')}
        {tab('team', 'Team Viewer')}
      </div>
      {sub === 'parent' ? <ParentChecker data={data} /> : <TeamViewer data={data} />}
    </div>
  )
}
