import { useRef, useState } from 'react'
import { useSpoilerStore } from '../state/spoilerStore'
import { selectClass, useArmy, useScreenshotUnit } from './hooks'
import {
  groupOf,
  groupsFor,
  HOUSE_CHOICE,
  inArmy,
  joinText,
  LAST_CHAPTER,
  labelOf,
  personalNow,
  ROUTE_CHOICE,
  ROUTE_NAMES,
  routeOf,
  SPLIT_CHAPTER,
  supportsOf,
  topTalk,
  type Fe16Data,
  type Fe16Picks,
} from './logic'
import { useFe16Store } from './store'
import type { Fe16Unit } from './types'
import { ChoicePicker, SkillIcon, StatTable, UnitPortrait, UnitSelect } from './ui'

function UnitDetail({ data, unit, picks, chapter }: { data: Fe16Data; unit: Fe16Unit; picks: Fe16Picks; chapter?: number }) {
  const cls = data.classes[unit.classId]
  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <UnitPortrait data={data} unit={unit} size={128} />
        <div className="min-w-0 space-y-1 text-sm text-neutral-300">
          <h3 className="text-lg font-semibold text-neutral-100">{labelOf(unit)}</h3>
          <div>
            {cls?.name} · Lv {unit.level} · {unit.allegiance}
          </div>
          <div>
            <span className="text-neutral-500">Joins: </span>
            {joinText(unit, picks.house)}
          </div>
          {unit.notes?.map((n) => (
            <div key={n} className="text-neutral-400">
              {n}
            </div>
          ))}
          {unit.crests.length > 0 && (
            <div>
              <span className="text-neutral-500">Crests: </span>
              {unit.crests.map((c, i) => (
                <span key={c.name} title={data.crests[c.name]}>
                  {i > 0 && ', '}
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* When the unit leaves and comes back. These are spoilers: under the spoiler block, once the Roster has one, they stay blank
          (the user's rule, 2026-11-02). */}
      {unit.away && chapter === undefined && (
        <div className="space-y-1 text-sm">
          <h4 className="text-sm font-semibold text-neutral-200">Time away</h4>
          <ul className="list-disc space-y-0.5 pl-5 text-neutral-400">
            {unit.away.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-1 text-sm">
        <h4 className="text-sm font-semibold text-neutral-200">Personal ability</h4>
        {personalNow(unit, chapter).map((p) => (
          <div key={p.name} className="flex items-start gap-2">
            <SkillIcon data={data} skill={p.name} />
            <span>
              <span className="font-medium text-neutral-200">{p.name}</span>
              {p.part && <span className="text-neutral-500"> ({p.part})</span>}
              {data.abilities[p.name] && <span className="text-neutral-400">: {data.abilities[p.name]}</span>}
            </span>
          </div>
        ))}
      </div>
      {/* The Roster keeps to who the unit is (user, 2026-11-04): their skill ranks, growths, skills and supports are in the planners
          and the Supports tab. */}
      <StatTable
        rows={[
          { label: 'Bases (Lv 1)', values: unit.bases, mov: true },
          { label: 'Maximums', values: unit.caps },
        ]}
      />
      <p className="text-xs text-neutral-500">The maximums are the unit's own: in Three Houses classes have none.</p>
    </div>
  )
}

/** The spoiler block's bar for Three Houses, under the header on every tab: the chapter you're on, back and on, and at the split the
 * Black Eagles' route. */
export function Fe16SpoilerBar({ data }: { data: Fe16Data }) {
  const { picks, chapter = 0 } = useArmy(data)
  const setProgress = useSpoilerStore((s) => s.setProgress)
  const setPick = useFe16Store((s) => s.setPick)
  const route = routeOf(picks)
  const last = route ? LAST_CHAPTER[route] : SPLIT_CHAPTER - 1
  const go = (ch: number) => {
    // Going back before the split takes back the route picked there.
    if (ch < SPLIT_CHAPTER && picks.house === 'be' && picks.route) setPick('route', null)
    setProgress(data.gameId, ch)
  }
  if (!picks.house) return <p className="text-xs text-emerald-400">Pick the house you teach in the Roster to start at Chapter 1.</p>
  const atSplit = chapter === SPLIT_CHAPTER - 1 && !route
  const button = 'rounded border px-3 py-1 text-sm disabled:cursor-default disabled:opacity-40'
  const proceed = `${button} border-emerald-600 bg-emerald-900/60 text-emerald-100 hover:bg-emerald-800/60`
  return (
    <section aria-label="Spoiler block" className="space-y-2 rounded border border-emerald-900 bg-emerald-950/30 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-neutral-200">
          <span className="text-neutral-400">Opened up to </span>
          <strong className="text-neutral-100">Chapter {chapter}</strong>
          {route && chapter >= SPLIT_CHAPTER && <span className="text-neutral-500"> · {ROUTE_NAMES[route]}</span>}
        </p>
        <button type="button" onClick={() => go(chapter - 1)} disabled={chapter <= 1} className={`${button} border-neutral-700 text-neutral-300 hover:bg-neutral-800`}>
          ‹ Back
        </button>
        {atSplit && picks.house === 'be' ? (
          ROUTE_CHOICE.options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                setPick('route', o.value)
                setProgress(data.gameId, SPLIT_CHAPTER)
              }}
              className={proceed}
            >
              Proceed to Chapter {SPLIT_CHAPTER}: {o.label} ›
            </button>
          ))
        ) : (
          <button type="button" onClick={() => go(chapter + 1)} disabled={chapter >= last} className={proceed}>
            {chapter >= last && route ? 'End of the story' : `Proceed to Chapter ${chapter + 1} ›`}
          </button>
        )}
        <select value={chapter} onChange={(e) => go(Number(e.target.value))} aria-label="Jump to a chapter" className={selectClass}>
          {Array.from({ length: last }, (_, i) => i + 1).map((ch) => (
            <option key={ch} value={ch}>
              {ch === chapter ? `Jump to… (now Chapter ${ch})` : `Chapter ${ch}`}
            </option>
          ))}
        </select>
      </div>
      {atSplit && picks.house === 'be' && <p className="text-neutral-400">The story splits here: pick the route you're playing to carry on.</p>}
    </section>
  )
}

/** The house taught; the Black Eagles' route right away with the spoiler block off, at the split with it on. */
function Picks({ data, picks, chapter }: { data: Fe16Data; picks: Fe16Picks; chapter?: number }) {
  const setProgress = useSpoilerStore((s) => s.setProgress)
  const setPick = useFe16Store((s) => s.setPick)
  const route = routeOf(picks)
  return (
    <div className="space-y-2">
      <ChoicePicker
        choice={HOUSE_CHOICE}
        onPick={(house) => {
          if (house !== 'be') setPick('route', null)
          if (chapter !== undefined) setProgress(data.gameId, house ? Math.min(Math.max(chapter, 1), SPLIT_CHAPTER - 1) : 0)
        }}
      />
      {chapter === undefined && picks.house === 'be' && <ChoicePicker choice={ROUTE_CHOICE} />}
      {chapter === undefined && route && picks.house !== 'be' && (
        <p className="text-xs text-neutral-400">Their route from Chapter {SPLIT_CHAPTER}: {ROUTE_NAMES[route]}.</p>
      )}
      <p className="text-xs text-neutral-500">
        {chapter === undefined
          ? 'The units your picks rule out drop out of every tab.'
          : "The spoiler block is on: a unit shows once they can be yours by the chapter you're on, the route is asked at the split, and when units leave stays blank."}
      </p>
    </div>
  )
}

/** Every unit by house, with the picks on top (the house, the route); tapping one shows their data below. */
export function Fe16Roster({ data }: { data: Fe16Data }) {
  const { units, picks, chapter } = useArmy(data)
  const [selectedId, setSelectedId] = useState(units[0]?.id ?? '')
  const detailRef = useRef<HTMLDivElement>(null)
  const selected = units.find((u) => u.id === selectedId) ?? units[0]
  useScreenshotUnit(selected)
  return (
    <div className="space-y-6">
      <Picks data={data} picks={picks} chapter={chapter} />
      <div className="space-y-3">
        {groupsFor(picks.house).map((g) => {
          const here = units.filter((u) => groupOf(u) === g)
          if (here.length === 0) return null
          return (
            <div key={g}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{g}</h3>
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
        {selected && <UnitDetail data={data} unit={selected} picks={picks} chapter={chapter} />}
      </div>
    </div>
  )
}

const TALKS = ['C', 'C+', 'B', 'B+', 'A', 'A+', 'S']

/** Who supports whom, with every conversation the pair has (C to S), and the pairs with an ending together. */
export function Fe16Supports({ data }: { data: Fe16Data }) {
  const { units, picks, chapter } = useArmy(data)
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const unit = units.find((u) => u.id === unitId) ?? units[0]
  useScreenshotUnit(unit)
  if (!unit) return null
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const rows = supportsOf(data, unit.id).filter((s) => s.npc || (byId.get(s.partner) && inArmy(byId.get(s.partner)!, picks, chapter)))
  return (
    <div className="space-y-4">
      <UnitSelect units={units} picks={picks} value={unit.id} onChange={setUnitId} />
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <p className="text-xs text-neutral-500">
          Each pair's support levels, one per conversation in the game's support list. Besides C, B, A and S, some pairs have the half
          levels C+, B+ or A+ (Byleth and Edelgard: C, C+, B, A, S), and some stop at B. Only Byleth has S supports, each with the
          genders the list allows; a ♥ marks a pair with an ending together. What supports give in battle is in the Armory.
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">No supports.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[24rem] text-sm">
              <thead>
                <tr className="text-xs text-neutral-500">
                  <th className="py-1 pr-2 text-left font-normal">Partner</th>
                  <th className="px-1 py-1 text-left font-normal">Top</th>
                  {TALKS.map((t) => (
                    <th key={t} className="px-1 py-1 text-center font-normal">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const partner = byId.get(s.partner)
                  return (
                    <tr key={s.partner} className="border-t border-neutral-800">
                      <td className="py-1 pr-2">
                        {partner ? (
                          <button type="button" onClick={() => setUnitId(partner.id)} className="flex items-center gap-2 text-left text-neutral-200 hover:text-violet-300">
                            <UnitPortrait data={data} unit={partner} size={24} />
                            {labelOf(partner)}
                          </button>
                        ) : (
                          <span className="text-neutral-400">{s.npc} (not a unit)</span>
                        )}
                        {s.pairedEnding && <span className="ml-1 text-pink-400">♥</span>}
                      </td>
                      <td className="px-1 py-1 text-neutral-200">{topTalk(s.talks)}</td>
                      {TALKS.map((t) => (
                        <td key={t} className="px-1 py-1 text-center text-emerald-400">
                          {s.talks.includes(t) ? '●' : <span className="text-neutral-700">·</span>}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/** Rules too long for the other tabs: recruiting, the time skip and the rest, from the game's code, for checking by hand. */
export function Fe16Info() {
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
      <p className="text-xs text-neutral-500">The rules behind recruiting and the time skip, from the game's code (0x2423c0, 0x3d91b0), for checking by hand.</p>
      {section('Recruiting', [
        "A unit's requirements are a stat of Byleth's and a skill rank of Byleth's, or for the staff Byleth's level (the Roster lists each). They're Byleth's own: class boosts and abilities don't count.",
        "A support with Byleth cuts each requirement by a fifth of it per support level, the cut rounded down: C one fifth, C+ two fifths, B three, B+ four; at A there are none. A skill rank counts as its place from E (0) to S+ (11). The support level counted is the lower of the pair's points and their top level.",
        'A student who asks to join (the request a B support can bring) joins at once, and Sylvain joins a female Byleth with no requirement. The Ashen Wolves need Cindered Shadows cleared and its events, and Anna the Expansion Pass, beyond their requirements.',
        "A unit recruited joins at the chapter's level (2 × the chapter − 1 in Part I), in the class their record gives for it (the first from Lv 5, the second from Lv 10), with stats averaged the same way every time: the Unit Planner works them out.",
      ])}
      {section('The time skip', [
        'Every unit but Byleth gets a set number of random level-ups (none for Bernadetta, Flayn and Jeritza, up to four for Dedue). On Normal, anyone still below Lv 20 is then raised to 20.',
        'Ashe (Silver Snow and Verdant Wind) and Lorenz (Silver Snow and Azure Moon) leave if they were recruited, after three random level-ups; they come back in Chapters 15 and 16.',
        "The house leaders change class: Edelgard to the Armored Lord (with Aymr), Dimitri to the High Lord, Claude to the Wyvern Master (with Failnaught). Their last classes come in a ceremony: Crimson Flower's and Azure Moon's Chapter 16, Verdant Wind's 17; Byleth's Enlightened One in Chapter 11.",
        'Story joins: Flayn after Chapter 6 (Lv 11); on Silver Snow, Catherine, Cyril and Shamir (if not yours yet) at the Chapter 11 change, at Lv 21, as Edelgard and Hubert leave; Seteth on Silver Snow, or on Azure Moon and Verdant Wind with Flayn yours; Gilbert on Azure Moon; Jeritza on Crimson Flower with the Expansion Pass.',
      ])}
      {section('Level-ups', [
        "Each stat rolls 0-99 against the unit's growth plus the class's, from the unit's own seed (a reload doesn't change it). A growth over 100 gives a sure point per full 100.",
        'Most units get at least two points a level: when a level gains 0 or 1, the stats that missed by the least make it up to 2. Seteth, Hanneman, Manuela, Gilbert, Alois, Catherine and Shamir can level with fewer.',
        'Cyril\'s Aptitude adds 20 to every growth but Mov. Mov never grows. The level stops at 99; the maximums are each unit\'s own, and a Saint Statue at level 9 raises two of them by 5.',
      ])}
    </div>
  )
}
