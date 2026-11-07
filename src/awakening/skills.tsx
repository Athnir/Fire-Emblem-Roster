import { useMemo, useState } from 'react'
import { AssetIcon } from '../components/AssetIcon'
import { Fe13BuildSetManager } from './builds'
import type { Fe13BuildEntry } from './buildSets'
import { classesWith, classSetOf, dlcClassesFor, fixedShare, inheritableFrom, reachableClasses, reachableSkills, spousesOf, type Fe13Data } from './logic'
import { useFe13Store } from './store'
import { UnitSelect } from './screens'
import { panel, selectClass, useAvatarData, useScreenshotUnit } from './ui'
import type { Fe13Class, Fe13Unit } from './types'

const MAX_LOADOUT = 5

/** A skill's icon: the game's own, from the user's Bulk Upload ("skills" folder, named after the skill), else a blank. */
function SkillIcon({ name, size = 18 }: { name: string; size?: number }) {
  const id = `fe13/${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
  return <AssetIcon type="skill" iconId={id} label={name} size={size} />
}

/** The unit's classes in order: each class of their set followed by what it promotes to, then the rest. */
function ordered(data: Fe13Data, ids: string[], first: string[]): string[] {
  const out: string[] = []
  for (const id of first) {
    for (const x of [id, ...(data.classes[id]?.promotesTo ?? [])]) if (ids.includes(x) && !out.includes(x)) out.push(x)
  }
  for (const id of Object.keys(data.classes)) if (ids.includes(id) && !out.includes(id)) out.push(id)
  return out
}

function SkillButton({ data, name, level, selected, tag, onToggle }: { data: Fe13Data; name: string; level?: number; selected: boolean; tag?: string; onToggle: () => void }) {
  const help = data.skills?.[name]?.help
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex min-w-[10rem] max-w-xs flex-col gap-0.5 rounded-md border px-2 py-1 text-left text-xs transition-colors ${
        selected ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
      }`}
    >
      <span className="flex items-center gap-1.5">
        <SkillIcon name={name} />
        <span className="min-w-0 break-words">
          {name}
          {tag ? <span className="text-neutral-500"> ({tag})</span> : null}
        </span>
        {level !== undefined && <span className="ml-auto shrink-0 text-neutral-500">Lv{level}</span>}
      </span>
      {help && <span className="text-[10px] leading-tight text-neutral-400">{help}</span>}
    </button>
  )
}

/** A picked class: its Mov and weapons, and the two skills it teaches with the levels they come at. */
function ClassRow({ data, cls, loadout, onToggle }: { data: Fe13Data; cls: Fe13Class; loadout: string[]; onToggle: (name: string) => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-800 px-3 py-2 sm:flex-row sm:items-start sm:gap-3">
      <div className="shrink-0 sm:w-36">
        <div className="text-sm text-neutral-300">
          {cls.name}
          {cls.dlc ? ' (DLC)' : ''}
        </div>
        <div className="text-[10px] leading-tight text-neutral-500">
          <div>Mov {cls.bases.mov}</div>
          {cls.weapons.map((w) => (
            <div key={w}>{data.weaponBonus?.[w] ? `${w} A` : w}</div>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
        {cls.skills.length === 0 && <span className="text-xs text-neutral-500">Teaches no skills.</span>}
        {cls.skills.map((s) => (
          <SkillButton key={s.skill} data={data} name={s.skill} level={s.level} selected={loadout.includes(s.skill)} onToggle={() => onToggle(s.skill)} />
        ))}
      </div>
    </div>
  )
}

/**
 * As Fates' Skill Planner, made for Awakening's wider class lists: every class the unit can be in some playthrough as chips, and each
 * picked class's skills; a five-skill loadout; and a general pool of every other skill the unit can have in some playthrough (a
 * child's inherited ones included, as the game allows them: no inheritance is worked out here, the skills are just picked).
 */
export function Fe13SkillPlanner({ data: raw }: { data: Fe13Data }) {
  const data = useAvatarData(raw)
  const [unitId, setUnitId] = useState(data.units[0]?.id ?? '')
  const unit: Fe13Unit = data.units.find((u) => u.id === unitId) ?? data.units[0]
  const [picked, setPicked] = useState<string[]>([])
  const [loadout, setLoadout] = useState<string[]>([])
  const [search, setSearch] = useState('')
  // For the Team Viewer: a unit only ever behind another, listed apart, in the class they give their bonus as.
  const [backpack, setBackpack] = useState(false)
  const [backpackClass, setBackpackClass] = useState('')
  // A child's other parent and the skill each parent passes on (user, 2026-11-07, as Fates' variable parent): the classes the other
  // parent gives show as their own row of chips, and the two inherited skills can go in the loadout.
  const spouses = useFe13Store((s) => s.spouses)
  const plans = useFe13Store((s) => s.plans)
  const [otherId, setOtherId] = useState('')
  const [inherit, setInherit] = useState<{ fixed: string; other: string }>({ fixed: '', other: '' })
  useScreenshotUnit(unit)

  const classes = useMemo(() => reachableClasses(data, unit), [data, unit])
  const reachable = useMemo(() => reachableSkills(data, unit), [data, unit])
  const dlc = dlcClassesFor(data, unit)
  // Theirs: their own set, and a child's fixed parent's, which they always have.
  const ownSet = fixedShare(data, unit)?.classes ?? classSetOf(unit)
  const own = ordered(data, classes, [unit.classId, ...ownSet]).filter((id) => {
    const set = new Set([unit.classId, ...ownSet])
    return !dlc.includes(id) && (set.has(id) || [...set].some((b) => data.classes[b]?.promotesTo.includes(id)))
  })
  const fixedParent = unit.parent ? data.units.find((u) => u.id === unit.parent) : undefined
  const others = fixedParent ? spousesOf(data, fixedParent).filter((u) => !u.maiden) : []
  const other = others.find((u) => u.id === otherId)
  const withOther = other ? classesWith(data, unit, other.id, spouses, plans) : null
  // With the other parent picked, the classes they give; without, every class some parent could.
  const fromParents = ordered(data, withOther ?? classes, []).filter((id) => !own.includes(id) && !dlc.includes(id))
  const childClasses = withOther ?? classes
  const fromFixed = fixedParent ? inheritableFrom(data, unit, fixedParent, childClasses) : []
  const fromOther = other ? inheritableFrom(data, unit, other, childClasses) : []
  const inherited = [
    { name: inherit.fixed, from: fixedParent, ok: fromFixed.includes(inherit.fixed) },
    { name: inherit.other, from: other, ok: fromOther.includes(inherit.other) },
  ].filter((x, i, all) => x.name && x.ok && all.findIndex((y) => y.name === x.name) === i)
  const classSkills = new Set(classes.flatMap((id) => data.classes[id]?.skills.map((s) => s.skill) ?? []))
  const inRows = new Set([...picked.flatMap((id) => data.classes[id]?.skills.map((s) => s.skill) ?? []), ...inherited.map((x) => x.name)])
  const order = Object.keys(data.skills ?? {})
  const pool = [...reachable]
    .filter((name) => !inRows.has(name))
    .filter((name) => name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
  const tagOf = (name: string): string | undefined => {
    const s = data.skills?.[name]
    if (s?.item) return 'DLC item'
    if (unit.skills?.includes(name) && !classSkills.has(name)) return 'their own'
    if (!classSkills.has(name)) return 'inherited'
    if (dlc.some((id) => data.classes[id].skills.some((x) => x.skill === name))) return 'DLC class'
    return undefined
  }

  const reset = (id = unit.id) => {
    const u = data.units.find((x) => x.id === id)
    setOtherId(u?.parent ? (spouses[u.parent] ?? '') : '')
    setInherit({ fixed: '', other: '' })
    setPicked([])
    setLoadout([])
    setBackpack(false)
    setBackpackClass('')
  }
  // Picking a unit in the list starts fresh; one loaded from a build set comes with what was saved.
  const loadEntry = (entry: Fe13BuildEntry) => {
    const d = entry.data
    setUnitId(entry.unitId)
    setPicked(Array.isArray(d.classes) ? (d.classes as string[]) : [])
    setLoadout(Array.isArray(d.loadout) ? (d.loadout as string[]) : [])
    setBackpack(Boolean(d.backpack))
    setBackpackClass(typeof d.backpackClass === 'string' ? d.backpackClass : '')
    setOtherId(typeof d.otherParent === 'string' ? d.otherParent : '')
    const inh = (d.inherit ?? {}) as { fixed?: unknown; other?: unknown }
    setInherit({ fixed: typeof inh.fixed === 'string' ? inh.fixed : '', other: typeof inh.other === 'string' ? inh.other : '' })
  }

  const toggleClass = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const toggleSkill = (name: string) =>
    setLoadout((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : prev.length >= MAX_LOADOUT ? prev : [...prev, name]))

  const chips = (title: string, ids: string[], note?: string) =>
    ids.length > 0 && (
      <div>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">{title}</h4>
        {note && <p className="mb-1.5 text-xs text-neutral-500">{note}</p>}
        <div className="flex flex-wrap gap-2">
          {ids.map((id) => {
            const on = picked.includes(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleClass(id)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  on ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
                }`}
              >
                {data.classes[id].name}
                {data.classes[id].dlc ? ' (DLC)' : ''}
              </button>
            )
          })}
        </div>
      </div>
    )

  return (
    <div className="space-y-6">
      <div className={panel}>
        <h3 className="text-base font-semibold text-neutral-100">Skill Planner</h3>
        <UnitSelect
          data={data}
          value={unit.id}
          onChange={(id) => {
            setUnitId(id)
            reset(id)
          }}
        />
        {fixedParent && (
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-neutral-400">
                {fixedParent.female ? 'Father' : 'Mother'} ({fixedParent.name}'s spouse)
                <select
                  value={other ? other.id : ''}
                  onChange={(e) => {
                    setOtherId(e.target.value)
                    setInherit((v) => ({ ...v, other: '' }))
                  }}
                  className={selectClass}
                >
                  <option value="">(none picked)</option>
                  {others.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { key: 'fixed' as const, parent: fixedParent, options: fromFixed },
                ...(other ? [{ key: 'other' as const, parent: other, options: fromOther }] : []),
              ].map(({ key, parent, options }) => (
                <label key={key} className="flex flex-col gap-1 text-xs text-neutral-400">
                  Skill inherited from {parent.name}
                  <select value={options.includes(inherit[key]) ? inherit[key] : ''} onChange={(e) => setInherit((v) => ({ ...v, [key]: e.target.value }))} className={selectClass}>
                    <option value="">(none picked)</option>
                    {options.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="text-xs text-neutral-500">
              A child inherits one skill from each parent: the last one that parent has equipped when the child is recruited, of any they
              can learn but the DLC's and the enemies' (Chrom and Lucina pass only Aether or Rightful King). From the game's program
              (0x27bc80).{!other && ' Pick the other parent to see the classes and the skill they pass on.'}
            </p>
          </div>
        )}
        {unit.skills && unit.skills.length > 0 && (
          <div className="text-sm text-neutral-300">
            <span className="text-neutral-500">Joins with: </span>
            {unit.skills.join(', ')}
          </div>
        )}
        <p className="text-xs text-neutral-500">
          Pick the classes you plan for {unit.name} to list their skills below; tap a skill to put it in the loadout.
        </p>
        {chips(`${unit.name}'s classes`, own)}
        {other
          ? chips(`From ${other.name} (${other.female ? 'Mother' : 'Father'})`, fromParents, `The classes ${other.name} passes on, and what they promote to.`)
          : chips(
              'With some parents',
              fromParents,
              `Classes ${unit.name} has only with some parents (with Robin as a parent, every regular class of their gender).`,
            )}
        {inherited.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">Inherited skills</h4>
            <div className="flex flex-wrap gap-2">
              {inherited.map(({ name, from }) => (
                <SkillButton
                  key={name}
                  data={data}
                  name={name}
                  tag={`from ${from?.name}`}
                  selected={loadout.includes(name)}
                  onToggle={() => toggleSkill(name)}
                />
              ))}
            </div>
          </div>
        )}
        {chips('DLC classes', dlc)}
        {picked.length > 0 ? (
          <div className="space-y-2">
            {ordered(data, picked, [...own, ...fromParents]).map((id) => (
              <ClassRow key={id} data={data} cls={data.classes[id]} loadout={loadout} onToggle={toggleSkill} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No classes picked yet.</p>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="text-base font-semibold text-neutral-100">
          Loadout ({loadout.length}/{MAX_LOADOUT})
        </h3>
        {loadout.some((name) => !inRows.has(name)) && (
          <p className="text-xs text-neutral-500">📖 marks a skill taken from the General Skill Pool, not from a class picked above.</p>
        )}
        {loadout.length === 0 ? (
          <p className="text-sm text-neutral-500">No skills selected yet: tap any skill above or in the pool to add it.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {loadout.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => toggleSkill(name)}
                  className="flex min-w-[10rem] max-w-xs flex-col gap-0.5 rounded-md border border-violet-500 bg-violet-950/50 px-2 py-1 text-left text-xs text-violet-200 hover:border-red-400 hover:text-red-300"
                >
                  <span className="flex items-center gap-1.5">
                    <SkillIcon name={name} />
                    <span className="min-w-0 break-words">{name}</span>
                    <span className="ml-auto flex shrink-0 items-center gap-1">
                      {!inRows.has(name) && <span title="From the General Skill Pool">📖</span>}
                      <span>×</span>
                    </span>
                  </span>
                  {data.skills?.[name]?.help && <span className="text-[10px] leading-tight text-violet-300/80">{data.skills[name].help}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-neutral-300">
        <input type="checkbox" checked={backpack} onChange={(e) => setBackpack(e.target.checked)} />
        Backpack unit (only ever behind another in a pair-up)
      </label>
      {backpack && (
        <div className="flex flex-wrap gap-1.5">
          {[...own, ...fromParents, ...dlc].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setBackpackClass(id)}
              className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                backpackClass === id ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
              }`}
            >
              {data.classes[id].name}
            </button>
          ))}
        </div>
      )}

      <div data-export-hide>
        <Fe13BuildSetManager
          tab="skills"
          unit={unit}
          data={{ classes: picked, loadout, backpack, backpackClass, otherParent: otherId, inherit }}
          nameOf={(id) => data.units.find((u) => u.id === id)?.name ?? id}
          onLoadEntry={loadEntry}
        />
      </div>

      <div data-export-hide className="space-y-3 rounded-lg border border-dashed border-neutral-800 bg-neutral-900/90 p-4">
        <h3 className="text-base font-semibold text-neutral-100">General Skill Pool (all legal skills)</h3>
        <p className="text-xs text-neutral-500">
          Every other skill {unit.name} can have in some playthrough: their classes' not picked above, the DLC's, and for a child what a
          parent could pass on (one skill each, from the last equipped; the DLC's and the enemies' skills never pass, and Chrom or Lucina
          only give Aether or Rightful King). From the game's program (0x27bc80) and skill table.
        </p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills…"
          className="w-full max-w-sm rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200 placeholder:text-neutral-500"
        />
        <div className="flex flex-wrap gap-2">
          {pool.map((name) => (
            <SkillButton key={name} data={data} name={name} selected={loadout.includes(name)} tag={tagOf(name)} onToggle={() => toggleSkill(name)} />
          ))}
        </div>
      </div>
    </div>
  )
}
