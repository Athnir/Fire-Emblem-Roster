import { useRef, useState } from 'react'
import { useArmy, useScreenshotUnit } from './hooks'
import {
  BYLETH_CHOICE,
  groupOf,
  groupsFor,
  inArmy,
  joinText,
  labelOf,
  ROUTE_CHOICE,
  supportsOf,
  topTalk,
  type Fe16Data,
  type Fe16Picks,
} from './logic'
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

function UnitDetail({ data, unit, picks }: { data: Fe16Data; unit: Fe16Unit; picks: Fe16Picks }) {
  const [everyone, setEveryone] = useState(false)
  const cls = data.classes[unit.classId]
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const supports = supportsOf(data, unit.id).filter((s) => s.npc || (byId.get(s.partner) && inArmy(byId.get(s.partner)!, picks)))
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
            {joinText(unit, picks.route)}
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
      {unit.away && (
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
          <div>
            {supports.map((s, i) => (
              <span key={`${s.partner}`}>
                {i > 0 && ', '}
                {s.npc ?? labelOf(byId.get(s.partner)!)} <span className="text-neutral-500">{topTalk(s.talks)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Every unit by house, with the two picks on top (Byleth's gender, the route); tapping one shows their data below. */
export function Fe16Roster({ data }: { data: Fe16Data }) {
  const { units, picks } = useArmy(data)
  const [selectedId, setSelectedId] = useState(units[0]?.id ?? '')
  const detailRef = useRef<HTMLDivElement>(null)
  const selected = units.find((u) => u.id === selectedId) ?? units[0]
  useScreenshotUnit(selected)
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <ChoicePicker choice={BYLETH_CHOICE} />
        <ChoicePicker choice={ROUTE_CHOICE} />
        <p className="text-xs text-neutral-500">The units your picks rule out drop out of every tab.</p>
      </div>
      <div className="space-y-3">
        {groupsFor(picks.route).map((g) => {
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
        {selected && <UnitDetail data={data} unit={selected} picks={picks} />}
      </div>
    </div>
  )
}

const TALKS = ['C', 'C+', 'B', 'B+', 'A', 'A+', 'S']

/** Who supports whom, with every conversation the pair has (C to S), and the pairs with an ending together. */
export function Fe16Supports({ data }: { data: Fe16Data }) {
  const { units, picks } = useArmy(data)
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const unit = units.find((u) => u.id === unitId) ?? units[0]
  useScreenshotUnit(unit)
  if (!unit) return null
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const rows = supportsOf(data, unit.id).filter((s) => s.npc || (byId.get(s.partner) && inArmy(byId.get(s.partner)!, picks)))
  return (
    <div className="space-y-4">
      <UnitSelect units={units} picks={picks} value={unit.id} onChange={setUnitId} />
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <p className="text-xs text-neutral-500">
          Every conversation the pair has, from the game's support list. Only Byleth has S supports, each with the genders the list allows;
          a ♥ marks a pair with an ending together. What supports give in battle is in the Armory.
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">No supports.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[24rem] text-sm">
              <thead>
                <tr className="text-xs text-neutral-500">
                  <th className="py-1 pr-2 text-left font-normal">Partner</th>
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
