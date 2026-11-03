import { useRef, useState } from 'react'
import { useSpoilerStore } from '../state/spoilerStore'
import { selectClass, useArmy, useScreenshotUnit } from './hooks'
import {
  BYLETH_CHOICE,
  groupOf,
  groupsFor,
  HOUSE_CHOICE,
  inArmy,
  joinText,
  LAST_CHAPTER,
  labelOf,
  levelsText,
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
import { FE16_SKILL_LABELS, FE16_SKILLS, type Fe16Unit } from './types'
import { ChoicePicker, LearnTable, StatTable, UnitPortrait, UnitSelect } from './ui'

/** The ranks a unit starts with, their strengths and weaknesses, and a budding talent. */
function SkillRanks({ data, unit }: { data: Fe16Data; unit: Fe16Unit }) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-4">
        {FE16_SKILLS.map((sk) => {
          const strong = unit.strengths.includes(sk)
          const weak = unit.weaknesses.includes(sk)
          const bud = unit.budding?.skill === sk
          return (
            <div key={sk} className="flex justify-between gap-2">
              <span className={strong ? 'text-emerald-400' : weak ? 'text-red-400' : 'text-neutral-400'}>
                {FE16_SKILL_LABELS[sk]}
                {strong ? ' ▲' : weak ? ' ▼' : ''}
                {bud ? ' ✦' : ''}
              </span>
              <span className="tabular-nums text-neutral-200">{unit.ranks[sk] ?? 'E'}</span>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-neutral-500">
        ▲ a strength, ▼ a weakness (skill EXP comes faster or slower).
        {unit.budding && (
          <>
            {' '}
            ✦ a budding talent: {FE16_SKILL_LABELS[unit.budding.skill]}, which teaches {unit.budding.name}
            {data.abilities[unit.budding.name] || data.arts[unit.budding.name] ? ` (${data.abilities[unit.budding.name] ?? data.arts[unit.budding.name]})` : ''}.
          </>
        )}
      </p>
    </div>
  )
}

function UnitDetail({ data, unit, picks, chapter }: { data: Fe16Data; unit: Fe16Unit; picks: Fe16Picks; chapter?: number }) {
  const [everyone, setEveryone] = useState(false)
  const cls = data.classes[unit.classId]
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const supports = supportsOf(data, unit.id).filter((s) => s.npc || (byId.get(s.partner) && inArmy(byId.get(s.partner)!, picks, chapter)))
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
        {unit.personal.map((p, i) => (
          <div key={p}>
            <span className="font-medium text-neutral-200">{p}</span>
            {unit.personal.length > 1 && <span className="text-neutral-500"> ({i === 0 ? 'Part I' : 'Part II'})</span>}
            {data.abilities[p] && <span className="text-neutral-400">: {data.abilities[p]}</span>}
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-neutral-200">Skill levels</h4>
        <SkillRanks data={data} unit={unit} />
      </div>
      <StatTable
        rows={[
          { label: 'Bases (Lv 1)', values: unit.bases, mov: true },
          { label: 'Growths', values: unit.growths, suffix: '%' },
          { label: 'Maximums', values: unit.caps },
        ]}
      />
      <p className="text-xs text-neutral-500">The maximums are the unit's own: in Three Houses classes have none.</p>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-neutral-200">Learned at skill levels</h4>
        <LearnTable data={data} unit={unit} everyone={everyone} />
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} />
          Also what every unit learns (theirs alone stay violet)
        </label>
        <p className="text-xs text-neutral-500">Hover for what each does.</p>
      </div>
      {supports.length > 0 && (
        <div className="space-y-1 text-sm text-neutral-300">
          <h4 className="text-sm font-semibold text-neutral-200">Supports</h4>
          <p className="text-xs text-neutral-500">Each pair's levels, from their conversations: some have the half levels (C+, B+, A+), some stop at B.</p>
          <div>
            {supports.map((s, i) => (
              <span key={`${s.partner}`}>
                {i > 0 && ', '}
                {s.npc ?? labelOf(byId.get(s.partner)!)} <span className="text-neutral-500">{levelsText(s.talks)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** The spoiler block's bar for Three Houses: the chapter you're on, back and on, and at the split the Black Eagles' route. */
function ChapterBar({ data, picks, chapter }: { data: Fe16Data; picks: Fe16Picks; chapter: number }) {
  const setProgress = useSpoilerStore((s) => s.setProgress)
  const setPick = useFe16Store((s) => s.setPick)
  const route = routeOf(picks)
  const last = route ? LAST_CHAPTER[route] : SPLIT_CHAPTER - 1
  const go = (ch: number) => {
    // Going back before the split takes back the route picked there.
    if (ch < SPLIT_CHAPTER && picks.house === 'be' && picks.route) setPick('route', null)
    setProgress(data.gameId, ch)
  }
  if (!picks.house) return <p className="text-xs text-emerald-400">Pick the house you teach to start at Chapter 1.</p>
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

/** Byleth's gender and the house taught; the Black Eagles' route right away with the spoiler block off, at the split with it on. */
function Picks({ data, picks, chapter }: { data: Fe16Data; picks: Fe16Picks; chapter?: number }) {
  const setProgress = useSpoilerStore((s) => s.setProgress)
  const setPick = useFe16Store((s) => s.setPick)
  const route = routeOf(picks)
  return (
    <div className="space-y-2">
      <ChoicePicker choice={BYLETH_CHOICE} />
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
      {chapter !== undefined && <ChapterBar data={data} picks={picks} chapter={chapter} />}
      <p className="text-xs text-neutral-500">
        {chapter === undefined
          ? 'The units your picks rule out drop out of every tab.'
          : "The spoiler block is on: a unit shows once they can be yours by the chapter you're on, the route is asked at the split, and when units leave stays blank."}
      </p>
    </div>
  )
}

/** Every unit by house, with the picks on top (Byleth's gender, the house, the route); tapping one shows their data below. */
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
