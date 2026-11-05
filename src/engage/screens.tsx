import { useRef, useState } from 'react'
import { useReached } from '../state/spoilerStore'
import { chip, selectClass, useArmy, useScreenshotUnit } from './hooks'
import { capsOf, chapterLabel, isAlear, labelOf, PACT_RING_CHAPTER, pactPartners, supportsOf, type Fe17Data } from './logic'
import { useFe17Store } from './store'
import { FE17_STAT_LABELS, type Fe17BondRingSet, type Fe17StatsMov, type Fe17Unit } from './types'
import { EmblemFace, RingFace, SkillChips, SkillIcon, SkillList, StatTable, UnitPortrait, UnitSelect } from './ui'

function UnitDetail({ data, unit, reached }: { data: Fe17Data; unit: Fe17Unit; reached?: Set<string> }) {
  const ring = useFe17Store((s) => s.picks.pactRing)
  const cls = data.classes[unit.classId]
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const supports = supportsOf(data, unit.id).filter((s) => {
    const p = byId.get(s.partner)
    return p && (!reached || reached.has(p.joinChapter))
  })
  const ranks = cls.weapons.map((w) => `${w.weapon} ${w.rank}${w.plus ? (unit.innate.includes(w.weapon) ? ' (+1: innate)' : '') : ''}${w.use !== 'always' ? ` (${w.use})` : ''}`)
  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <UnitPortrait data={data} unit={unit} size={128} />
        <div className="min-w-0 space-y-1 text-sm text-neutral-300">
          <h3 className="text-lg font-semibold text-neutral-100">{labelOf(unit)}</h3>
          <div>
            {cls.name} · Lv {unit.level}
            {unit.internalLevel ? ` (internal Lv ${unit.internalLevel})` : ''}
            {unit.expansionPass ? ' · Expansion Pass' : ''}
          </div>
          <div>
            <span className="text-neutral-500">Joins: </span>
            {chapterLabel(data, unit.joinChapter)}. {unit.join.note}
          </div>
          {unit.protected && (
            <div className="text-neutral-400">
              {unit.protected === 'always' ? "Can't be lost: they retreat instead." : `Can't be lost ${unit.protected}: they retreat instead.`}
            </div>
          )}
          <div>
            <span className="text-neutral-500">Proficiency: </span>
            {unit.innate.join(', ')} (innate){unit.proficiencies.filter((w) => !unit.innate.includes(w)).length > 0 && `; also ${unit.proficiencies.filter((w) => !unit.innate.includes(w)).join(', ')}`}
          </div>
          <div>
            <span className="text-neutral-500">Weapons: </span>
            {ranks.join(', ')}
          </div>
          <div>
            <span className="text-neutral-500">SP: </span>
            {unit.sp} · <span className="text-neutral-500">Support type: </span>
            {unit.supportType}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-neutral-200">Personal skill</h4>
        <SkillList data={data} skills={unit.personal} />
      </div>
      <StatTable
        rows={[
          { label: `Joins (${cls.name})`, values: unit.joinStats, caps: capsOf(cls, unit) },
          { label: 'Growths', values: unit.growths, suffix: '%' },
          { label: 'Cap modifiers', values: unit.capMods },
          { label: `Caps (${cls.name})`, values: capsOf(cls, unit) },
        ]}
      />
      <p className="text-xs text-neutral-500">
        The game keeps a unit's own stats apart from the class: what shows is the class's base plus their own, held at the class's cap plus
        their modifier. So a class change moves every stat by the classes' bases.
      </p>
      {supports.length > 0 && (
        <div className="space-y-1 text-sm text-neutral-300">
          <h4 className="text-sm font-semibold text-neutral-200">Supports</h4>
          <div>
            {supports.map((s, i) => (
              <span key={s.partner}>
                {i > 0 && ', '}
                {labelOf(byId.get(s.partner)!)}{' '}
                <span className="text-neutral-500">
                  {ring && [ring.alear, ring.partner].includes(unit.id) && [ring.alear, ring.partner].includes(s.partner) ? 'S (Pact Ring)' : s.top}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Every unit by the chapter they join; tapping one shows their data below. */
export function Fe17Roster({ data }: { data: Fe17Data }) {
  const { units, reached } = useArmy(data)
  const [selectedId, setSelectedId] = useState(units[0]?.id ?? '')
  const detailRef = useRef<HTMLDivElement>(null)
  const selected = units.find((u) => u.id === selectedId) ?? units[0]
  useScreenshotUnit(selected)
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {data.chapters.map((ch) => {
          const here = units.filter((u) => u.joinChapter === ch.id)
          if (here.length === 0) return null
          return (
            <div key={ch.id}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{ch.label}</h3>
              <div className="flex flex-wrap gap-2">
                {here.map((u) => (
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
                    {labelOf(u)}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div ref={detailRef} className="scroll-mt-4">
        {selected && <UnitDetail data={data} unit={selected} reached={reached} />}
      </div>
    </div>
  )
}

const RANKS = ['C', 'B', 'A']

/** The Pact Ring planned, as Fates' Marriage Planner plans spouses: an Alear and one partner, saved with the plans. With the spoiler
 * block on, it shows once Paralogue "The Connector" is reached. */
function PactRing({ data, units, reached }: { data: Fe17Data; units: Fe17Unit[]; reached?: Set<string> }) {
  const ring = useFe17Store((s) => s.picks.pactRing)
  const setRing = useFe17Store((s) => s.setPactRing)
  const alears = units.filter(isAlear)
  const [alearId, setAlearId] = useState(ring?.alear ?? alears[0]?.id ?? '')
  const [partner, setPartner] = useState('')
  if ((reached && !reached.has(PACT_RING_CHAPTER)) || alears.length === 0) return null
  const byId = new Map(units.map((u) => [u.id, u]))
  const options = pactPartners(data, alearId).filter((id) => byId.has(id))
  const name = (id: string) => (byId.get(id) ? labelOf(byId.get(id)!) : id)
  return (
    <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="text-base font-semibold text-neutral-100">Pact Ring</h3>
      <p className="text-xs text-neutral-500">
        Alear's alone, with one partner, once Paralogue "The Connector" (after Chapter 22) is cleared: their support becomes S, and
        their bond with Emblem Alear can reach 21. The ring's text asks for an A support.
      </p>
      {ring ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="flex items-center gap-2 text-neutral-200">
            {byId.get(ring.alear) && <UnitPortrait data={data} unit={byId.get(ring.alear)!} size={28} />}
            {name(ring.alear)} <span className="text-violet-300">×</span>
            {byId.get(ring.partner) && <UnitPortrait data={data} unit={byId.get(ring.partner)!} size={28} />}
            {name(ring.partner)}
          </span>
          <button type="button" onClick={() => setRing(null)} className="text-xs text-neutral-400 hover:text-red-400">
            Remove
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select value={alearId} onChange={(e) => setAlearId(e.target.value)} className={selectClass}>
            {alears.map((a) => (
              <option key={a.id} value={a.id}>
                {labelOf(a)}
              </option>
            ))}
          </select>
          <span className="text-neutral-500">×</span>
          <select value={partner} onChange={(e) => setPartner(e.target.value)} className={selectClass}>
            <option value="">Partner…</option>
            {options.map((id) => (
              <option key={id} value={id}>
                {name(id)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!partner}
            onClick={() => {
              setRing({ alear: alearId, partner })
              setPartner('')
            }}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Give the ring
          </button>
        </div>
      )}
    </div>
  )
}

/** Who supports whom, up to which rank; the Pact Ring is Alear's alone. */
export function Fe17Supports({ data }: { data: Fe17Data }) {
  const { units, reached } = useArmy(data)
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const unit = units.find((u) => u.id === unitId) ?? units[0]
  useScreenshotUnit(unit)
  const ring = useFe17Store((s) => s.picks.pactRing)
  if (!unit) return null
  const byId = new Map(units.map((u) => [u.id, u]))
  const rows = supportsOf(data, unit.id).filter((s) => byId.has(s.partner))
  // The Pact Ring's pair reaches S (shown once the ring is planned above).
  const pact = (partner: string) => !!ring && ((ring.alear === unit.id && ring.partner === partner) || (ring.partner === unit.id && ring.alear === partner))
  const ranks = rows.some((s) => pact(s.partner)) ? [...RANKS, 'S'] : RANKS
  return (
    <div className="space-y-4">
      <PactRing data={data} units={units} reached={reached} />
      <UnitSelect data={data} units={units} value={unit.id} onChange={setUnitId} />
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <p className="text-xs text-neutral-500">
          Each pair's ranks, C to A, from the game's support table (reliance.xml); S is the Pact Ring's, planned above. What supports give
          in battle is in the Armory.
          {reached && ' With the spoiler block on, partners show once they join.'}
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">No supports.</p>
        ) : (
          <table className="w-full max-w-md text-sm">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="py-1 pr-2 text-left font-normal">Partner</th>
                {ranks.map((r) => (
                  <th key={r} className="px-1 py-1 text-center font-normal">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const p = byId.get(s.partner)!
                return (
                  <tr key={s.partner} className="border-t border-neutral-800">
                    <td className="py-1 pr-2">
                      <button type="button" onClick={() => setUnitId(p.id)} className="flex items-center gap-2 text-left text-neutral-200 hover:text-violet-300">
                        <UnitPortrait data={data} unit={p} size={24} />
                        {labelOf(p)}
                      </button>
                    </td>
                    {ranks.map((r) => (
                      <td key={r} className={`px-1 py-1 text-center ${r === 'S' ? 'text-violet-300' : 'text-emerald-400'}`}>
                        {r === 'S' ? (pact(s.partner) ? '●' : '') : RANKS.indexOf(r) <= RANKS.indexOf(s.top) ? '●' : <span className="text-neutral-700">·</span>}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/** Each emblem's bond levels: what syncing adds, the skills to inherit and their SP, and the proficiency each level grants. */
/** The tab's two kinds of ring, one at a time: the Emblems' own (major) and the bond rings (minor), a set for each game. With the
 * spoiler block on (user, 2026-11-03), an Emblem's ring and its world's bond rings show from the chapter the ring first comes in. */
export function Fe17Emblems({ data }: { data: Fe17Data }) {
  const [kind, setKind] = useState<'major' | 'minor'>('major')
  const reached = useReached(data.gameId, data.chapters)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setKind('major')} className={chip(kind === 'major')}>
          Major rings: Emblem Rings
        </button>
        <button type="button" onClick={() => setKind('minor')} className={chip(kind === 'minor')}>
          Minor rings: Bond Rings
        </button>
      </div>
      {kind === 'major' ? <EmblemRings data={data} reached={reached} /> : <BondRings data={data} reached={reached} />}
    </div>
  )
}

const RING_RANKS = ['C', 'B', 'A', 'S'] as const

/** A rank's stats, each kept on one line ("Spd +1"), the line breaking only between them. */
function RingStats({ stats }: { stats: Partial<Fe17StatsMov> }) {
  const parts = Object.entries(stats).map(([s, v]) => `${FE17_STAT_LABELS[s as keyof typeof FE17_STAT_LABELS]} +${v}`)
  return (
    <>
      {parts.map((p, i) => (
        <span key={p}>
          <span className="whitespace-nowrap">
            {p}
            {i < parts.length - 1 ? ',' : ''}
          </span>
          {i < parts.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  )
}

/** The bond rings by game, each game's set folded away until opened. The rules are the program's (data-raw/fe17/README.md, "Bond
 * rings"): forging RefineRingExecute.Do, merging SynthesisRingExecute.Do with RingMenuItem's costs, SP ExpToSkillPoint. */
function BondRings({ data, reached }: { data: Fe17Data; reached?: Set<string> }) {
  const sets: Fe17BondRingSet[] = data.bondRings.filter((s) => !reached || reached.has(s.joinChapter))
  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        A unit wears one ring, an Emblem Ring or a Bond Ring. A Bond Ring's stats and skill count while it's worn, and it earns SP at
        half an Emblem Ring's rate. They're forged at an Emblem's pedestal in the Somniel's Ring Chamber: 100 Bond Fragments for one of
        that Emblem's ten at random, at S 3%, A 7%, B 30% or C 60%. Merging raises a rank: 2 C rings of the same hero and 100 fragments
        make a B, 3 B and 1,000 an A, 4 A and 10,000 an S. Only S ranks carry a skill.
      </p>
      {reached && sets.length < data.bondRings.length && (
        <p className="text-xs text-emerald-400">
          {sets.length === 0 ? 'None yet: a' : 'More sets show as the story goes: a'} game's set shows from the chapter its Emblem's ring
          first comes in.
        </p>
      )}
      {sets.map((set) => (
        <RingSet key={set.game} data={data} set={set} />
      ))}
    </div>
  )
}

/** One game's Bond Rings, each with its hero's face. The table, and the faces read from storage, are made once the set is opened. */
function RingSet({ data, set }: { data: Fe17Data; set: Fe17BondRingSet }) {
  const [open, setOpen] = useState(false)
  const skills = data.skills
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)} className="rounded-lg border border-neutral-800 bg-neutral-900">
      <summary className="cursor-pointer px-4 py-2 text-sm">
        <span className="font-medium text-neutral-100">{set.game}</span>
        <span className="text-neutral-500">
          {' · '}
          {set.emblem ? `${set.world} (${set.emblem})` : 'Expansion Pass, S rank only, not forged'}
        </span>
      </summary>
      {open && (
        <div className="overflow-x-auto px-4 pb-3">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="py-1 pr-2 text-left font-normal">Ring</th>
                {RING_RANKS.map((r) => (
                  <th key={r} className="px-1 py-1 text-left font-normal">
                    {r}
                  </th>
                ))}
                <th className="px-1 py-1 text-left font-normal">Skill (S)</th>
              </tr>
            </thead>
            <tbody>
              {set.rings.map((ring) => {
                const ringSkills = ring.ranks.flatMap((r) => r.skills ?? [])
                return (
                  <tr key={ring.name} className="border-t border-neutral-800 align-top">
                    <td className="py-1 pr-2 text-neutral-100">
                      <div className="flex items-center gap-2">
                        <RingFace data={data} ring={ring.name} />
                        <span>{ring.name}</span>
                      </div>
                    </td>
                    {RING_RANKS.map((rank) => {
                      const r = ring.ranks.find((x) => x.rank === rank)
                      return (
                        <td key={rank} className="px-1 py-1 text-neutral-300 sm:whitespace-nowrap">
                          {r ? <RingStats stats={r.stats} /> : <span className="text-neutral-600">—</span>}
                        </td>
                      )
                    })}
                    <td className="px-1 py-1 text-neutral-300">
                      {ringSkills.length === 0 ? (
                        <span className="text-neutral-600">—</span>
                      ) : (
                        ringSkills.map((s) => (
                          <div key={s} className="flex items-start gap-1.5">
                            <SkillIcon data={data} skill={s} />
                            <span>
                              <span className="text-neutral-100">{s}</span>
                              {skills[s] && <span className="text-xs text-neutral-500">: {skills[s]}</span>}
                            </span>
                          </div>
                        ))
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </details>
  )
}

/** Each Emblem's ring: pick one, and its bond levels show. With the spoiler block on, those whose ring has come. */
function EmblemRings({ data, reached }: { data: Fe17Data; reached?: Set<string> }) {
  const emblems = data.emblems.filter(
    (e) => e.levels.some((l) => l.inherit.length || l.sync.length) && (!reached || reached.has(e.joinChapter)),
  )
  const [id, setId] = useState(emblems[0]?.id ?? '')
  const e = emblems.find((x) => x.id === id) ?? emblems[0]
  if (!e) return <p className="text-sm text-neutral-500">No Emblem Ring has come yet at this chapter.</p>
  return (
    <div className="space-y-4">
      <select value={e.id} onChange={(ev) => setId(ev.target.value)} className={`${selectClass} w-full max-w-xs`}>
        {emblems.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
            {x.expansionPass ? ' (Expansion Pass)' : ''}
          </option>
        ))}
      </select>
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex items-start gap-3">
          <EmblemFace data={data} emblem={e.name} />
          <div className="text-sm text-neutral-300">
            <div className="font-medium text-neutral-100">{e.name}</div>
            {e.ring && <div>{e.ring}</div>}
            <div className="text-neutral-500">From {chapterLabel(data, e.joinChapter)}</div>
            {e.engageAttack && (
              <div>
                <span className="text-neutral-500">Engage attack: </span>
                {e.engageAttack}
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-neutral-500">
          Bond levels 1-20 (a base game ring stops at 10 until its paralogue). Syncing adds the stats and sync skills of the bond level
          reached, on top of the caps; skills can be inherited from bond 5, for SP, two at a time; a level's proficiency is the unit's
          for good once the bond reaches it.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="py-1 pr-2 text-left font-normal">Bond</th>
                <th className="px-1 py-1 text-left font-normal">Sync stats</th>
                <th className="px-1 py-1 text-left font-normal">New skills</th>
                <th className="px-1 py-1 text-left font-normal">Inherit (SP)</th>
                <th className="px-1 py-1 text-left font-normal">Proficiency</th>
              </tr>
            </thead>
            <tbody>
              {e.levels.map((lv, i) => {
                const before = e.levels[i - 1]
                const fresh = [
                  ...lv.sync.filter((s) => !before?.sync.includes(s)).map((name) => ({ name })),
                  ...lv.engage.filter((s) => !before?.engage.includes(s)).map((name) => ({ name, note: '(engaged)' })),
                ]
                return (
                  <tr key={lv.level} className="border-t border-neutral-800 align-top">
                    <td className="py-1 pr-2 tabular-nums text-neutral-400">{lv.level}</td>
                    <td className="px-1 py-1 text-neutral-200">
                      {Object.entries(lv.stats)
                        .map(([s, v]) => `${FE17_STAT_LABELS[s as keyof typeof FE17_STAT_LABELS]} +${v}`)
                        .join(', ')}
                    </td>
                    <td className="px-1 py-1 text-neutral-300">
                      <SkillChips data={data} skills={fresh} />
                    </td>
                    <td className="px-1 py-1 text-neutral-300">
                      <SkillChips data={data} skills={lv.inherit.map((s) => ({ name: s.name, note: `(${s.sp})` }))} />
                    </td>
                    <td className="px-1 py-1 text-neutral-300">{lv.proficiency.join(', ')}</td>
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

/** Rules too long for the other tabs, from the game's code, for checking by hand. */
export function Fe17Info() {
  const section = (title: string, lines: string[]) => (
    <section className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="text-base font-semibold text-neutral-100">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </section>
  )
  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">The rules behind class changes, emblems and the rest, from the game's program (methods in data-raw/fe17/README.md).</p>
      {section('Class changes', [
        "A base class's promotions take a Master Seal from Lv 10. A Second Seal changes into any other class the unit may be in at any level (a special class's advanced ones from Lv 21), or the same class at its top level.",
        "The unit needs the class's weapons: every one it always uses, and enough of its choices. A unit's proficiencies are what they join with, plus each one an emblem bond grants. The Mage Cannoneer needs only the Mage Cannon; the Enchanter the Mystic Satchel, with Knife and Arts.",
        'Any class change starts the new class at Lv 1 (into a class that goes to Lv 40, at Lv 21 from an advanced class), with EXP 0. The levels so far go into the internal level, at most 30 on Normal, 40 on Hard, 50 on Maddening.',
        "The unit's own stats don't change: the shown ones move by the classes' bases, and a stat over a lower cap comes back under a higher one. A class skill is learned at Lv 5 (25 in a class to Lv 40) and lost on leaving the class.",
      ])}
      {section('Level-ups', [
        "Each stat's growth is the unit's own plus the class's (Jean's Expertise counts the class's twice; Tiki's Starsphere adds 15 to all). A point per full 100, then a roll at the rest; a stat at its cap gains nothing.",
        'A level with fewer than 2 points is rolled again, up to four tries, and the try with the most points is kept. In Fixed mode each stat keeps a running total that starts at the growth rate, and gains a point at every 100.',
        'Skill points: the EXP gained with an emblem ring on, half that with a bond ring, none without a ring; at most 9,999.',
      ])}
      {section('Emblems and the Pact Ring', [
        "A base game emblem's bond stops at 10 until its paralogue is cleared; the Expansion Pass's go to 20. Inheriting opens at bond 5, two skills at a time.",
        'The engage meter needs 7 (one less at bond 20); an engage lasts 3 turns (4 from bond 11).',
        "The Pact Ring is Alear's, with one partner, once Paralogue \"The Connector\" (after Chapter 22) is cleared; the partner's bond with Emblem Alear can then reach 21.",
      ])}
      {section('Stat boosters', [
        "Each adds its amount to the unit's own stat, but only while the stat is below its cap (a +2 one point short goes one over). Boots work twice at most.",
      ])}
    </div>
  )
}
