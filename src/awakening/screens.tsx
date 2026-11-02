import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Portrait } from '../components/Portrait'
import {
  MAX_LEVEL,
  MAX_STEPS,
  maxLevelOf,
  capsOf,
  childOf,
  childrenOf,
  classChanges,
  classSetOf,
  dlcClassesFor,
  familyOf,
  fixedShare,
  hairOf,
  isFamilyBlocked,
  isMorgan,
  legalSteps,
  pairUpBonus,
  project,
  reachableClasses,
  reachableSkills,
  statsIn,
  unitNow,
  sameUnit,
  skillsOf,
  spousesOf,
  unitsOf,
  type Fe13Child,
  type Fe13Data,
  type Fe13Parent,
  type Fe13Plan,
  type Fe13Rank,
  type Fe13Stage,
} from './logic'
import { Fe13BuildSetManager } from './builds'
import { useFe13Store } from './store'
import { button, names, panel, primaryButton, selectClass, useAvatarData, useScreenshotUnit } from './ui'
import { FE13_STATS, FE13_STAT_LABELS, type Fe13Class, type Fe13Stat, type Fe13Stats, type Fe13Unit } from './types'

function artId(name: string): string {
  return `fe13/${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
}

/** A unit's portrait. A child whose hair the game tints (all but Lucina) is drawn from their uploaded layers, the hair in `hairHex` (by
 * default their own colour), as Fates draws its children; without the layers, their flat portrait. */
export function UnitPortrait({ unit, size = 64, hairHex }: { unit: Fe13Unit; size?: number; hairHex?: string }) {
  const layered = !!unit.parent && unit.id !== 'fe13-lucina'
  return <Portrait characterId={artId(unit.name)} isChild={layered} hairHex={layered ? (hairHex ?? unit.hair) : undefined} flatFallback size={size} />
}

/** A hair colour as a swatch. */
function Swatch({ hex }: { hex?: string }) {
  if (!hex) return null
  return <span className="inline-block h-3 w-3 rounded-sm border border-neutral-600 align-middle" style={{ backgroundColor: hex }} title={hex} />
}

/** Where a child's hair comes from, with the colour. */
function HairLine({ data, child, spouses }: { data: Fe13Data; child: Fe13Unit; spouses: Record<string, string> }) {
  const avatar = useFe13Store((s) => s.avatar)
  const hair = hairOf(data, child, spouses, avatar.hair)
  const fromAvatar = hair.from?.id.startsWith('fe13-avatar')
  return (
    <div className="flex items-center gap-1.5 text-xs text-neutral-500">
      <span>
        {hair.from ? `Hair from ${hair.from.name}` : child.id === 'fe13-lucina' ? 'Hair: always her own' : 'Hair: their own'}
        {fromAvatar && !hair.hex ? " (pick the Avatar's hair colour above)" : ''}
      </span>
      <Swatch hex={hair.hex} />
    </div>
  )
}

const STAT_NAMES: Record<Fe13Stat, string> = {
  hp: 'HP',
  str: 'Strength',
  mag: 'Magic',
  skl: 'Skill',
  spd: 'Speed',
  lck: 'Luck',
  def: 'Defence',
  res: 'Resistance',
}

/** The Avatar's asset and flaw, for both Avatars, and their hair colour from the game's own palette. */
export function AvatarBuild({ palette }: { palette?: string[] }) {
  const avatar = useFe13Store((s) => s.avatar)
  const setAvatar = useFe13Store((s) => s.setAvatar)
  const pick = (label: string, key: 'asset' | 'flaw', other: Fe13Stat | null) => (
    <label className="space-y-1">
      <span className="block text-xs text-neutral-500">{label}</span>
      <select
        value={avatar[key] ?? ''}
        onChange={(e) => setAvatar({ ...avatar, [key]: (e.target.value || null) as Fe13Stat | null })}
        className={selectClass}
      >
        <option value="">None</option>
        {FE13_STATS.filter((s) => s !== other).map((s) => (
          <option key={s} value={s}>
            {STAT_NAMES[s]}
          </option>
        ))}
      </select>
    </label>
  )
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-end gap-2">
        <span className="pb-1 text-sm font-semibold text-neutral-200">Avatar</span>
        {pick('Asset', 'asset', avatar.flaw)}
        {pick('Flaw', 'flaw', avatar.asset)}
      </div>
      <p className="text-xs text-neutral-500">
        Changes both Avatars' bases, growths and modifiers, and so what Morgan and the Avatar's other children inherit (the game's
        PersonalityData table). None is the person record's own numbers.
      </p>
      {palette && palette.length > 0 && (
        <div className="space-y-1">
          <span className="block text-xs text-neutral-500">Hair colour (a child whose other parent is the Avatar takes it)</span>
          <div className="grid w-fit grid-cols-10 gap-1">
            {palette.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => setAvatar({ ...avatar, hair: avatar.hair === hex ? undefined : hex })}
                title={hex}
                className={`h-5 w-5 rounded border ${avatar.hair === hex ? 'border-2 border-violet-400' : 'border-neutral-700'}`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function fmt(v: number | undefined): string {
  if (v === undefined) return '–'
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

type Row = {
  label: string
  values: Partial<Fe13Stats & { mov: number }>
  caps?: Partial<Fe13Stats>
  /** Before the maximums: a stat held at one shows the points it keeps beyond it. */
  raw?: Partial<Fe13Stats>
  suffix?: string
  signed?: boolean
}

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
          {rows.map((row, i) => (
            // A plan can pass through the same class and level more than once.
            <tr key={`${i}-${row.label}`} className="border-t border-neutral-800">
              <td className="whitespace-nowrap py-1 pr-2 text-xs text-neutral-400">{row.label}</td>
              {cols.map((s) => {
                const v = row.values[s]
                const cap = s === 'mov' ? undefined : row.caps?.[s]
                const kept = s === 'mov' || v === undefined ? 0 : (row.raw?.[s] ?? v) - v
                return (
                  <td key={s} className={`px-1 py-1 text-right tabular-nums ${v !== undefined && cap !== undefined && v >= cap ? 'text-emerald-400' : 'text-neutral-200'}`}>
                    {row.signed && v !== undefined && v > 0 ? '+' : ''}
                    {fmt(v)}
                    {v !== undefined ? (row.suffix ?? '') : ''}
                    {kept > 0.05 && <sup className="ml-0.5 text-[10px] text-neutral-500">+{fmt(kept)}</sup>}
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
  if (j.how === 'end') return `${where}: joins at the end of the ${where.startsWith('DLC') ? 'episode' : 'chapter'}`
  return `${where}: joins at the start`
}

export function UnitSelect({ data, value, onChange }: { data: Fe13Data; value: string; onChange: (id: string) => void }) {
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

function UnitDetail({ data, unit }: { data: Fe13Data; unit: Fe13Unit }) {
  const cls = data.classes[unit.classId]
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const total = {} as Fe13Stats
  for (const s of FE13_STATS) total[s] = unit.growths[s] + (cls.growths?.[s] ?? 0)
  const spouses = spousesOf(data, unit)
  // A child always has their fixed parent's classes and modifiers, and the +1; the other parent adds theirs.
  const share = fixedShare(data, unit)
  const modifiers = share?.modifiers ?? unit.modifiers
  // The hair: from the parent picked below, else the plan's, else their own (0x2cdfd8).
  const planSpouses = useFe13Store((s) => s.spouses)
  const avatar = useFe13Store((s) => s.avatar)
  const picked = useFe13Store((s) => s.hairParents[unit.id])
  const setHairParent = useFe13Store((s) => s.setHairParent)
  const setAvatar = useFe13Store((s) => s.setAvatar)
  const setAvatarHair = (hex: string) => setAvatar({ ...avatar, hair: hex })
  const fixedParent = share?.parent
  const sources = fixedParent ? spousesOf(data, fixedParent).filter((u) => !u.maiden) : []
  const source = picked && sources.some((u) => u.id === picked) ? picked : undefined
  const hairSpouses = source && fixedParent ? { ...planSpouses, [fixedParent.id]: source, [source]: fixedParent.id } : planSpouses
  const hair = hairOf(data, unit, hairSpouses, avatar.hair)
  return (
    <div className={panel}>
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <UnitPortrait unit={unit} size={unit.parent ? 256 : 128} hairHex={hair.hex}/>
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
          {unit.skills && unit.skills.length > 0 && (
            <div>
              <span className="text-neutral-500">Skills: </span>
              {unit.skills.join(', ')}
            </div>
          )}
          <div>
            <span className="text-neutral-500">Classes (Second Seal): </span>
            {names(data, share?.classes ?? classSetOf(unit))}
            {share && <span className="text-neutral-500"> (theirs and {share.parent.name}'s; the other parent adds theirs)</span>}
          </div>
          {spouses.length > 0 && (
            <div>
              <span className="text-neutral-500">Can marry: </span>
              {spouses.map((u) => u.name).join(', ')}
            </div>
          )}
        </div>
      </div>
      {unit.id.startsWith('fe13-avatar') && <AvatarBuild palette={data.avatarHair} />}
      {unit.parent && unit.id === 'fe13-lucina' && (
        <p className="border-t border-neutral-800 pt-3 text-xs text-neutral-500">Hair: always her own (fixed, whoever her mother is).</p>
      )}
      {unit.parent && unit.id !== 'fe13-lucina' && fixedParent && (
        <div className="space-y-2 border-t border-neutral-800 pt-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Hair source ({fixedParent.female ? 'Dad' : 'Mom'})</span>
          <div className="flex flex-wrap items-center gap-2">
            <select value={source ?? ''} onChange={(e) => setHairParent(unit.id, e.target.value || null)} className={`${selectClass} w-full max-w-xs`}>
              <option value="">{planSpouses[fixedParent.id] ? `(the Marriage Planner's: ${data.units.find((u) => u.id === planSpouses[fixedParent.id])?.name ?? 'their spouse'})` : '(none: their own colour)'}</option>
              {sources.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <Swatch hex={hair.hex} />
          </div>
          {hair.from?.id.startsWith('fe13-avatar') && data.avatarHair && (
            <div className="space-y-1">
              <span className="text-xs text-neutral-400">The Avatar's hair colour (whatever this playthrough's Avatar picked)</span>
              <div className="grid w-fit grid-cols-10 gap-1">
                {data.avatarHair.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setAvatarHair(hex)}
                    title={hex}
                    className={`h-6 w-6 rounded border ${avatar.hair === hex ? 'border-2 border-violet-400' : 'border-neutral-700'}`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-neutral-500">
            A quick look at their hair with another parent, separate from the Marriage Planner's plan. In the game a child takes the hair of
            their {fixedParent.female ? 'father' : 'mother'}, as the portrait shows: the program's 0x2cdfd8.
          </p>
        </div>
      )}
      <StatTable
        mov
        rows={[
          { label: unit.parent ? 'Bases (own part)' : 'Bases', values: unit.bases },
          { label: 'Personal growths', values: unit.growths, suffix: '%' },
          { label: `Growths as a ${cls.name}`, values: total, suffix: '%' },
          { label: share ? `Modifiers (${share.parent.name}'s, +1)` : 'Modifiers', values: modifiers, signed: true },
          { label: `Maximums (${cls.name})`, values: capsOf(cls, modifiers) },
        ]}
      />
      {share && (
        <p className="text-xs text-neutral-500">
          A child joins with at least these bases, the class's plus their own: each parent above them in a stat adds a third of the
          difference. Their growths are their own and both parents' averaged, and their modifiers and maximums also take the other
          parent's modifiers. Their hair is their other parent's (Lucina's is always her own). The Marriage Planner shows them with
          both parents.
        </p>
      )}
    </div>
  )
}

/** Everyone by the chapter they join; tapping one shows their data below the list. */
export function Fe13Roster({ data: raw }: { data: Fe13Data }) {
  const data = useAvatarData(raw)
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

const RANKS: { value: Fe13Rank; label: string }[] = [
  { value: 0, label: 'No support' },
  { value: 1, label: 'C' },
  { value: 2, label: 'B' },
  { value: 3, label: 'A' },
  { value: 4, label: 'S' },
]
const PAIR_STATS = FE13_STATS.slice(1) as Exclude<Fe13Stat, 'hp'>[]

function chip(on: boolean): string {
  return `rounded-md border px-2 py-1 text-xs transition-colors ${
    on ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
  }`
}

/** What a weapon rank adds, as text (GameData's WeaponBonusData; a staff's Atk is its recovery). */
function rankBonusText(bonus: Fe13Data['weaponBonus'], weapon: string, rank: string): string {
  const b = bonus?.[weapon]?.[rank]
  if (!b) return ''
  return [b.atk ? `${weapon === 'Staff' ? 'Recovery' : 'Atk'} +${b.atk}` : '', b.hit ? `Hit +${b.hit}` : ''].filter(Boolean).join(', ')
}

function BonusGrid({ values, mov }: { values?: Partial<Fe13Stats>; mov?: number }) {
  const show = (v: number | undefined) => (v === undefined ? '–' : v > 0 ? `+${v}` : String(v))
  return (
    <div className="grid max-w-sm grid-cols-4 gap-x-3 gap-y-1 text-sm">
      {PAIR_STATS.map((s) => (
        <div key={s} className="flex justify-between gap-2">
          <span className="text-neutral-500">{FE13_STAT_LABELS[s]}</span>
          <span className="font-mono text-neutral-100">{show(values?.[s])}</span>
        </div>
      ))}
      <div className="flex justify-between gap-2">
        <span className="text-neutral-500">Mov</span>
        <span className="font-mono text-neutral-100">{show(mov)}</span>
      </div>
    </div>
  )
}

/** As Fates' Unit Planner: the class's weapons and Movement, and the pair-up bonus the unit gives and gets (0x2b2c8c, 0x2cd408). */
function Fe13Mechanics({
  data,
  unit,
  plan,
  update,
  last,
  modifiers,
}: {
  data: Fe13Data
  unit: Fe13Unit
  plan: Fe13Plan
  update: (patch: Partial<Fe13Plan>) => void
  last: Fe13Stage
  modifiers: Partial<Fe13Stats>
}) {
  const spouses = useFe13Store((s) => s.spouses)
  const plans = useFe13Store((s) => s.plans)
  const [movement, setMovement] = useState(false)
  const [boots, setBoots] = useState(false)
  const [defender, setDefender] = useState(false)
  const [deliverer, setDeliverer] = useState(false)
  const [givenRank, setGivenRank] = useState<Fe13Rank>(0)
  const cls: Fe13Class = data.classes[last.classId]
  const pair = plan.pairUp
  const rank = pair?.rank ?? 0
  const family = familyOf(data, unit.id, spouses)
  const supported = new Set(unit.supports.map((s) => s.partner))
  // No support: anyone. C to A: their support partners and their family in the plan. S: whom they can marry, family aside.
  const partners = data.units.filter((u) => {
    if (u.id === unit.id || sameUnit(u.id, unit.id)) return false
    if (rank === 0) return true
    if (rank === 4) return spousesOf(data, unit).some((p) => p.id === u.id) && !family.includes(u.id)
    return supported.has(u.id) || family.includes(u.id)
  })
  const partner = pair?.partner ? data.units.find((u) => u.id === pair.partner) : undefined
  const now = partner ? unitNow(data, partner, spouses, plans) : undefined
  const partnerClasses = partner && now ? [...new Set([now.classId, ...reachableClasses(data, partner)])].filter((id) => data.classes[id]) : []
  const partnerClass = partner && now ? (pair?.partnerClass && partnerClasses.includes(pair.partnerClass) ? pair.partnerClass : now.classId) : undefined
  const received = partner && now && partnerClass ? pairUpBonus(data.classes[partnerClass], statsIn(data, now, partnerClass), rank, { defender, deliverer }) : undefined
  const given = pairUpBonus(cls, last.stats, givenRank)
  const movBonus = (movement ? 1 : 0) + (boots ? 2 : 0)
  const mov = cls.bases.mov + movBonus
  const caps = capsOf(cls, modifiers, plan.limitBreaker)
  const setPair = (patch: Partial<NonNullable<Fe13Plan['pairUp']>>) => {
    const next = { partner: '', rank: 0 as Fe13Rank, ...pair, ...patch }
    update({ pairUp: next.partner || next.rank ? next : undefined })
  }
  return (
    <div className="space-y-3 border-t border-neutral-800 pt-3">
      <div className="text-sm text-neutral-300">
        <span className="text-neutral-500">Weapons (as a {cls.name}): </span>
        {cls.weapons.length
          ? cls.weapons
              .map((w) => {
                const bonus = rankBonusText(data.weaponBonus, w, 'A')
                return data.weaponBonus?.[w] ? `${w} up to A${bonus ? ` (${bonus})` : ''}` : `${w} (no rank)`
              })
              .join(', ')
          : 'none'}
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-xs text-neutral-300">
          <input type="checkbox" checked={movement} onChange={(e) => setMovement(e.target.checked)} />
          Movement +1 equipped
        </label>
        <label className="flex items-center gap-2 text-xs text-neutral-300">
          <input type="checkbox" checked={boots} onChange={(e) => setBoots(e.target.checked)} />
          Boots used (+2; a second adds nothing)
        </label>
      </div>
      <div className="text-sm text-neutral-300">
        <span className="text-neutral-500">Movement: </span>
        {cls.bases.mov}
        {movBonus > 0 ? ` + ${movBonus} = ${mov}` : ''}
      </div>

      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Pair-up bonus given (as the one behind)</h4>
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {RANKS.map((r) => (
            <button key={r.value} type="button" onClick={() => setGivenRank(r.value)} className={chip(givenRank === r.value)}>
              {r.label}
            </button>
          ))}
        </div>
        <BonusGrid values={given} mov={given.mov} />
      </div>

      <div className="flex flex-col gap-1 text-xs text-neutral-400">
        Pair-up bonus received from
        <div className="flex flex-wrap gap-1.5">
          {RANKS.map((r) => (
            <button key={r.value} type="button" onClick={() => setPair({ rank: r.value, partner: '', partnerClass: undefined })} className={chip(rank === r.value)}>
              {r.label}
            </button>
          ))}
        </div>
        <select
          value={partner?.id ?? ''}
          onChange={(e) => setPair({ partner: e.target.value, partnerClass: undefined })}
          className={`${selectClass} w-full max-w-sm`}
        >
          <option value="">(none selected)</option>
          {partners.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {family.includes(u.id) ? ' (family)' : ''}
            </option>
          ))}
        </select>
      </div>
      {partner && now && partnerClass && received && (
        <div className="space-y-2">
          <label className="flex flex-col gap-1 text-xs text-neutral-400">
            {partner.name}'s class
            <select value={partnerClass} onChange={(e) => setPair({ partnerClass: e.target.value })} className={`${selectClass} w-full max-w-sm`}>
              {partnerClasses.map((id) => (
                <option key={id} value={id}>
                  {data.classes[id].name}
                  {id === now.classId ? (now.planned ? ' (their plan)' : ' (as they join)') : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs text-neutral-300">
              <input type="checkbox" checked={defender} onChange={(e) => setDefender(e.target.checked)} />
              {unit.name} has Defender equipped (+1 to each)
            </label>
            <label className="flex items-center gap-2 text-xs text-neutral-300">
              <input type="checkbox" checked={deliverer} onChange={(e) => setDeliverer(e.target.checked)} />
              {unit.name} has Deliverer equipped (Mov +2)
            </label>
          </div>
          <BonusGrid values={received} mov={received.mov} />
          <p className="text-xs text-neutral-500">
            From {partner.name}'s stats {now.planned ? `in their Unit Planner plan (Lv ${now.level})` : 'as they join'}, as a {data.classes[partnerClass].name}.
          </p>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Technical max (maximums + pair-up from {partner.name})</h4>
          <div className="grid max-w-sm grid-cols-4 gap-x-3 gap-y-1 text-sm">
            {FE13_STATS.map((s) => (
              <div key={s} className="flex justify-between gap-2">
                <span className="text-neutral-500">{FE13_STAT_LABELS[s]}</span>
                <span className="font-mono text-neutral-100">{s === 'hp' ? caps.hp : caps[s] + received[s]}</span>
              </div>
            ))}
            <div className="flex justify-between gap-2">
              <span className="text-neutral-500">Mov</span>
              <span className="font-mono text-neutral-100">{mov + received.mov}</span>
            </div>
          </div>
        </div>
      )}
      <p className="text-xs text-neutral-500">
        The one behind gives the lead a tenth of their own stat (before any boost), at most 3, on every stat but HP; on the stats their
        class boosts, the class's part plus 1 at C or B and 2 at A or S. The lead's own Defender adds 1 to each, and their Deliverer 2
        Mov. The bonus can go past a maximum. Family supports (parent and child, siblings) go up to A. Every class's weapons go up to A;
        there's no S. From the game's program (0x2b2c8c, 0x2de238, 0x2cd408) and GameData (JobData, WeaponBonusData); Serenes Forest's
        and the Fire Emblem Wiki's class tables match it.
      </p>
    </div>
  )
}

/** One unit's average stats through Master and Second Seals. Saved per unit. */
export function Fe13Planner({ data: raw }: { data: Fe13Data }) {
  const data = useAvatarData(raw)
  const [unitId, setUnitId] = useState(data.units[0]?.id ?? '')
  const unit = data.units.find((u) => u.id === unitId) ?? data.units[0]
  useScreenshotUnit(unit)
  const saved = useFe13Store((s) => s.plans[unit.id])
  const spouses = useFe13Store((s) => s.spouses)
  const plans = useFe13Store((s) => s.plans)
  const setPlan = useFe13Store((s) => s.setPlan)
  const stored: Fe13Plan = saved ?? { steps: [], targetLevel: maxLevelOf(data.classes[unit.classId]) }
  const update = (patch: Partial<Fe13Plan>) => setPlan(unit.id, { ...stored, ...patch })
  // Aptitude only for a unit who can have it in some playthrough (Donnel's Villager, or inherited from a parent who can).
  const canAptitude = useMemo(() => reachableSkills(data, unit).has('Aptitude'), [data, unit])
  const plan: Fe13Plan = { ...stored, aptitude: !!stored.aptitude && canAptitude }
  const dlcClasses = dlcClassesFor(data, unit)
  const toggleDlc = (id: string) => {
    const on = plan.dlc?.includes(id)
    const dlc = on ? (plan.dlc ?? []).filter((x) => x !== id) : [...(plan.dlc ?? []), id]
    // Locking a class again drops the class changes from the first one into it.
    const cut = on ? plan.steps.findIndex((st) => st.to === id) : -1
    update({ dlc, steps: cut >= 0 ? plan.steps.slice(0, cut) : plan.steps })
  }
  // A child whose parent is married in the Marriage Planner joins with what they inherit (Morgan in the other parent's class).
  const child = unit.parent ? childOf(data, unit, spouses, plans) : null
  const start = child ? { ...unit, classId: child.startClass } : unit
  const set = child ? child.classes : classSetOf(unit)
  const growths = child ? child.growths : unit.growths
  const modifiers = child ? child.modifiers : unit.modifiers
  const stages = project(data, start, plan, { start: child ? child.raw : unit.bases, growths, modifiers, set })
  // A step the game doesn't allow (from a plan saved before the seal rules were traced) and those after it are left out.
  const { steps, dropped } = legalSteps(data, start.classId, unit.level, plan, set)
  let current = start.classId
  let fromLevel = unit.level
  const rows = steps.map((step, i) => {
    const options = classChanges(data, current, set, plan.dlc)
    const row = { i, step, from: current, fromLevel, options }
    current = step.to
    fromLevel = 1
    return row
  })
  const finalClass = data.classes[current]
  const levels = (from: number, to = MAX_LEVEL) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)
  const setStep = (i: number, patch: Partial<{ at: number; to: string }>) => {
    const row = rows[i]
    const next = { ...row.step, ...patch }
    // A change has its own lowest level (a Second Seal into a promoted class needs Lv 10, the unit's own class its top level).
    const min = Math.max(row.fromLevel, row.options.find((c) => c.to === next.to)?.minLevel ?? 1)
    next.at = Math.min(maxLevelOf(data.classes[row.from]), Math.max(min, next.at))
    const kept = steps.slice(0, i + 1).map((s, k) => (k === i ? next : s))
    // Changing a step's class drops the steps after it: their choices may not be open any more.
    update({ steps: patch.to ? kept : [...kept, ...steps.slice(i + 1)] })
  }
  const nextOptions = classChanges(data, current, set, plan.dlc)
  return (
    <div className="space-y-4">
      <UnitSelect data={data} value={unit.id} onChange={setUnitId} />
      <div className={panel}>
        {(unit.id.startsWith('fe13-avatar') || isMorgan(unit)) && <AvatarBuild palette={data.avatarHair} />}
        <div className="space-y-2 text-sm text-neutral-300">
          {rows.map(({ i, step, from, fromLevel: lv, options }) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <label className="space-y-1">
                <span className="block text-xs text-neutral-500">{data.classes[from].name} changes to</span>
                <select value={step.to} onChange={(e) => setStep(i, { to: e.target.value })} className={selectClass}>
                  {options.map((c) => (
                    <option key={c.to} value={c.to}>
                      {data.classes[c.to].name}
                      {c.seal === 'master' ? ' (Master Seal)' : c.seal === 'dlc' ? ' (DLC)' : c.to === from ? ' (again, from Lv 1)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="block text-xs text-neutral-500">At Lv</span>
                <select value={step.at} onChange={(e) => setStep(i, { at: Number(e.target.value) })} className={selectClass}>
                  {levels(Math.max(lv, options.find((c) => c.to === step.to)?.minLevel ?? 1), maxLevelOf(data.classes[from])).map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => update({ steps: steps.slice(0, i) })} className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700">
                Remove
              </button>
            </div>
          ))}
          {dropped && (
            <p className="text-xs text-amber-400">
              This plan had {data.classes[current]?.name ?? 'a class'} changing to {data.classes[dropped.to]?.name ?? dropped.to}, which the game's seals
              don't allow; it and anything after it are left out.{' '}
              <button type="button" onClick={() => update({ steps })} className="underline hover:text-amber-300">
                Remove them
              </button>
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            {steps.length < MAX_STEPS && nextOptions.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  update({ steps: [...steps, { at: maxLevelOf(finalClass), to: (nextOptions.find((c) => c.seal === 'master') ?? nextOptions[0]).to }] })
                }
                className="rounded-md bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700"
              >
                Add a class change
              </button>
            )}
            <label className="space-y-1">
              <span className="block text-xs text-neutral-500">Up to Lv (as {finalClass.name})</span>
              <select
                value={Math.min(maxLevelOf(finalClass), Math.max(rows.length ? 1 : unit.level, plan.targetLevel))}
                onChange={(e) => update({ targetLevel: Number(e.target.value) })}
                className={selectClass}
              >
                {levels(rows.length ? 1 : unit.level, maxLevelOf(finalClass)).map((l) => (
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
          {dlcClasses.length > 0 && (
            <div>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">DLC classes unlocked for {unit.name}</h4>
              <div className="flex flex-wrap gap-2">
                {dlcClasses.map((id) => {
                  const on = !!plan.dlc?.includes(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleDlc(id)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        on ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
                      }`}
                    >
                      {data.classes[id].name} (DLC)
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-4">
            {canAptitude && (
              <label className="flex items-center gap-2 text-xs text-neutral-300">
                <input type="checkbox" checked={!!plan.aptitude} onChange={(e) => update({ aptitude: e.target.checked })} />
                Aptitude equipped (+20 to every growth)
              </label>
            )}
            <label className="flex items-center gap-2 text-xs text-neutral-300">
              <input type="checkbox" checked={!!plan.limitBreaker} onChange={(e) => update({ limitBreaker: e.target.checked })} />
              Limit Breaker equipped (+10 to every maximum but HP; DLC)
            </label>
          </div>
        </div>
        <p className="text-xs text-neutral-500">
          Average stats: each level adds the personal growth and the class's, and a level that gains nothing is rolled once more, so the
          averages run a little above the growths. A stat stops growing at the class's maximum plus the unit's modifiers (green). A
          Master Seal promotes from Lv 10. A Second Seal changes to a class of the unit's set once promoted, or from Lv 10; into what
          those classes promote to only once promoted and at Lv 10, or at Lv 30 in a special class; and into the unit's own class at its
          top level. The new class starts at Lv 1 with its own bases, and every point gained is kept: a stat over the new class's maximum
          shows held there (the small number is what's kept) and comes back in a class with higher ones. A DLC class's own seal works
          once promoted, or from Lv 10. Aptitude adds 20 to every growth and Limit Breaker 10 to every maximum but HP. From the game's
          program (level-ups 0x2cef88, growths 0x27d230, maximums 0x2c48f8, seals 0x2d4d3c, 0x2cff38 and 0x214278, the class change
          0x2d0fb8).
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
            raw: st.raw,
            caps: capsOf(data.classes[st.classId], modifiers, plan.limitBreaker),
          }))}
        />
        <p className="text-sm text-neutral-300">
          <span className="text-neutral-500">Skills learned: </span>
          {skillsOf(data, stages).join(', ') || 'none'}
        </p>
        <Fe13Mechanics data={data} unit={unit} plan={plan} update={update} last={stages[stages.length - 1]} modifiers={modifiers} />
      </div>
      <div data-export-hide>
        <Fe13BuildSetManager
          tab="unit"
          unit={unit}
          data={{ plan: stored }}
          nameOf={(id) => data.units.find((u) => u.id === id)?.name ?? id}
          onLoadEntry={(entry) => {
            // A saved entry's plan becomes the unit's plan again.
            setUnitId(entry.unitId)
            const p = entry.data.plan as Fe13Plan | undefined
            if (p && Array.isArray(p.steps)) setPlan(entry.unitId, p)
          }}
        />
      </div>
    </div>
  )
}

/** Each partner and the points C, B, A and S need. */
export function Fe13Supports({ data: raw }: { data: Fe13Data }) {
  const data = useAvatarData(raw)
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

const INHERITANCE_NOTE =
  "A child's growths are their own, their mother's and their father's added and divided by 3, rounded down. Their maximums take both parents' modifiers, plus 1 on every stat but HP (a Morgan whose other parent is a child gets that child's own +1, not a second). They join with their own stats plus a third of how far each parent is above them in each stat, rounded down; a parent below them adds nothing, so a child never joins below their own. A parent's stats are their Unit Planner plan's last row, or as they join, counting every point gained even past a maximum. A child takes both parents' classes for their gender (Olivia's son gets Mercenary and Barbarian for her Dancer and Pegasus Knight), but never Lord, which only Lucina has, or Dancer; Taguel and Manakete reach only Morgan. A child with the Avatar as a parent gets every regular class of their gender. Morgan starts in the other parent's first class, or as a Tactician after a Lord or Dancer. A child parent of Morgan's passes on what they inherited themselves. All from the game's program: growths 0x27d230, maximums 0x2c48f8, the join 0x3a44d0, the parents 0x27c0a8, classes 0x2cff38 and 0x214098, Morgan's class 0x27c150."

function sourceText(data: Fe13Data, p: Fe13Parent): string {
  if (p.unit.maiden) return "the village maiden, all zeros (the game's PID_ダミー)"
  const at = `${data.classes[p.from.classId].name} Lv ${p.from.level}`
  return `${p.unit.name} ${p.from.planned ? `from their Unit Planner plan (${at})` : `as they join (${at})`}`
}

/** A child's inheritance: what they join with, their growths, modifiers and classes, and where their parents' numbers come from. */
function ChildCard({ data, result, spouses }: { data: Fe13Data; result: Fe13Child; spouses: Record<string, string> }) {
  const { child, fixed, other } = result
  const cls = data.classes[result.startClass]
  const avatarHair = useFe13Store((s) => s.avatar.hair)
  const total = {} as Fe13Stats
  for (const s of FE13_STATS) total[s] = result.growths[s] + (cls.growths?.[s] ?? 0)
  return (
    <div className={panel}>
      <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-300">
        <UnitPortrait unit={child} size={96} hairHex={hairOf(data, child, spouses, avatarHair).hex} />
        <div>
          <div className="font-semibold text-neutral-100">{child.name}</div>
          <div className="text-xs text-neutral-500">
            {fixed.unit.name} and {other.unit.name} · joins as a {cls.name}
          </div>
          <HairLine data={data} child={child} spouses={spouses} />
        </div>
      </div>
      {other.via && (
        <p className="text-xs text-neutral-400">
          {other.unit.name} passes on what they inherited from {other.via.fixed.unit.name} and {other.via.other.unit.name}.
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
  const byId = new Map(unitsOf(data).map((u) => [u.id, u]))
  const order = new Map(unitsOf(data).map((u, i) => [u.id, i]))
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
export function Fe13MarriagePlanner({ data: raw }: { data: Fe13Data }) {
  const data = useAvatarData(raw)
  const spouses = useFe13Store((s) => s.spouses)
  const plans = useFe13Store((s) => s.plans)
  const marry = useFe13Store((s) => s.marry)
  const clearSpouses = useFe13Store((s) => s.clearSpouses)
  const [primaryId, setPrimaryId] = useState('')
  const [spouseId, setSpouseId] = useState('')
  const byId = new Map(unitsOf(data).map((u) => [u.id, u]))
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
        <AvatarBuild palette={data.avatarHair} />
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
                return r ? <ChildCard key={c.id} data={data} result={r} spouses={preview} /> : null
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
            At the end of Chapter 11 Chrom marries whoever he has the highest support with (C or above), or the village maiden if he has
            no one. Pick her as his wife to see that Lucina: the maiden is a person record of zeros, so Lucina takes only Chrom's side
            (ev::HeroMarrige, 0x3b2700).
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Children in the plan</h3>
        {planned.length === 0 && <p className="text-sm text-neutral-500">Add a marriage to see the children it gives.</p>}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {planned.map((r) => (
            <ChildCard key={r.child.id} data={data} result={r} spouses={spouses} />
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
export function Fe13ParentChecker({ data: raw }: { data: Fe13Data }) {
  const data = useAvatarData(raw)
  const plans = useFe13Store((s) => s.plans)
  const [childId, setChildId] = useState('')
  const [ids, setIds] = useState<string[]>([])
  const [add, setAdd] = useState('')
  const [nested, setNested] = useState<Record<string, string>>({})
  const byId = new Map(unitsOf(data).map((u) => [u.id, u]))
  const child = byId.get(childId)
  useScreenshotUnit(child)
  const fixed = child?.parent ? byId.get(child.parent) : undefined
  const options = fixed && child ? spousesOf(data, fixed).filter((p) => !ids.includes(p.id) && (!p.parent || isMorgan(child))) : []
  const nestedOptions = (c: Fe13Unit) => {
    const f = c.parent ? byId.get(c.parent) : undefined
    // The Avatar is marrying this candidate, so isn't their parent's spouse.
    return f ? spousesOf(data, f).filter((p) => !p.parent && !p.id.startsWith('fe13-avatar')) : []
  }
  const spousesFor = (id: string): Record<string, string> => {
    const cand = byId.get(id)!
    const n = nested[id]
    return fixed ? { [fixed.id]: id, [id]: fixed.id, ...(n && cand.parent ? { [cand.parent]: n, [n]: cand.parent } : {}) } : {}
  }
  const resultFor = (id: string) => (child && fixed ? childOf(data, child, spousesFor(id), plans) : null)
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
        {child && isMorgan(child) && <AvatarBuild palette={data.avatarHair} />}
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
                  {child && <HairLine data={data} child={child} spouses={spousesFor(id)} />}
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
