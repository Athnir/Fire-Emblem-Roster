import { useRef, useState } from 'react'
import { Biorhythm } from './Biorhythm'
import { excludedUnits, useTelliusChoices } from './choiceStore'
import { chapterLabel, chapterRuns, StoryPromotions, UnitPortrait, useScreenshotUnit } from './shared'
import type { TelliusChoice, TelliusData, TelliusUnit } from './types'

function joinText(data: TelliusData, unit: TelliusUnit): string {
  const where = chapterLabel(data, unit.joinChapter)
  if (unit.join.how === 'talk') return `${where}: talk to them with ${unit.join.with?.join(' or ') ?? 'another unit'}`
  if (unit.join.how === 'bonus') return where
  if (unit.join.how === 'base') return `${where}: joins at the base before it (an Info conversation)`
  if (unit.join.how === 'event') return `${where}: joins ${unit.join.turn ? `on turn ${unit.join.turn}` : 'during the chapter'}`
  return `${where}: joins at the start`
}

/** Who the unit is, as Fates' Roster (user, 2026-11-05): their stats, growths and caps, weapon ranks, Con and Wt are in the Unit
 * Planner, their skills in the Skill Planner, their supports in the Supports tab. */
function UnitDetail({ data, unit }: { data: TelliusData; unit: TelliusUnit }) {
  const cls = data.classes[unit.classId]
  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <UnitPortrait data={data} unit={unit} size={128} />
        <div className="min-w-0 space-y-1 text-sm text-neutral-300">
          <h3 className="text-lg font-semibold text-neutral-100">{unit.name}</h3>
          <div>
            {cls.name} · Lv {unit.level}
          </div>
          <div>
            <span className="text-neutral-500">Affinity: </span>
            {unit.affinity}
          </div>
          <div>
            <span className="text-neutral-500">Joins: </span>
            {joinText(data, unit)}
          </div>
          {unit.join.note && <div className="text-neutral-400">{unit.join.note}</div>}
          {unit.talkedBack?.map((t) => (
            <div key={t.chapter} className="text-neutral-400">
              {chapterLabel(data, t.chapter)}: fighting for the other side, {t.with.join(' or ')} can talk them back
              {t.porA?.length ? ` (${t.porA.join(' and ')} only with an A support between them in Path of Radiance)` : ''}.
            </div>
          ))}
          {unit.porNotes?.map((n) => (
            <div key={n} className="text-neutral-400">
              {n}
            </div>
          ))}
          {unit.leadership !== undefined && (
            <div>
              <span className="text-neutral-500">Leadership: </span>
              {'★'.repeat(unit.leadership)}
            </div>
          )}
        </div>
      </div>
      <Biorhythm data={data} unit={unit} />
      <StoryPromotions data={data} unit={unit} />

      {unit.available && (
        <div className="space-y-1 text-sm text-neutral-300">
          <h4 className="text-sm font-semibold text-neutral-200">In your army</h4>
          {chapterRuns(data, unit.available).map((line) => (
            <div key={line}>{line}</div>
          ))}
          {unit.heldBack && (
            <div className="text-xs text-neutral-500">
              With the army but kept off the field: {chapterRuns(data, unit.heldBack).join('; ')}.
            </div>
          )}
          <p className="text-xs text-neutral-500">
            Read from the scripts' moves between armies, taking every recruit and the story's default path; not yet
            checked in-game.
          </p>
        </div>
      )}

      {unit.unconfirmed && (
        <p className="rounded-md border border-amber-800/60 bg-amber-950/30 p-2 text-xs text-amber-300">
          Unconfirmed: {unit.unconfirmed}
        </p>
      )}
    </div>
  )
}

/** A story choice of who joins, as buttons: picking one leaves the others out of every tab's unit lists. */
function ChoicePicker({ data, choice }: { data: TelliusData; choice: TelliusChoice }) {
  const picked = useTelliusChoices((s) => s.picks[data.gameId]?.[choice.id])
  const setPick = useTelliusChoices((s) => s.setPick)
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-xs transition-colors ${
      on ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
    }`
  return (
    <div className="mb-2 space-y-1.5">
      <div className="text-xs text-neutral-400">{choice.question}</div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setPick(data.gameId, choice.id, null)} className={chip(picked === undefined)}>
          Not picked
        </button>
        {choice.options.map((opt, i) => (
          <button key={opt.label} type="button" onClick={() => setPick(data.gameId, choice.id, i)} className={chip(picked === i)}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Every playable unit, by the chapter they join; tapping one shows their data below the list. */
export function TelliusRoster({ data }: { data: TelliusData }) {
  const [selectedId, setSelectedId] = useState(data.units[0]?.id ?? '')
  const detailRef = useRef<HTMLDivElement>(null)
  const picks = useTelliusChoices((s) => s.picks[data.gameId])
  const left = excludedUnits(data, picks)
  const selected = data.units.find((u) => u.id === selectedId)
  useScreenshotUnit(selected)

  function select(id: string) {
    setSelectedId(id)
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {data.chapters.map((ch) => {
          const choices = (data.choices ?? []).filter((c) => c.chapter === ch.id)
          const units = data.units.filter((u) => u.joinChapter === ch.id && !left.has(u.id))
          if (units.length === 0 && choices.length === 0) return null
          return (
            <div key={ch.id}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {ch.label}: {ch.title}
              </h3>
              {choices.map((c) => (
                <ChoicePicker key={c.id} data={data} choice={c} />
              ))}
              <div className="flex flex-wrap gap-2">
                {units.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => select(u.id)}
                    className={`flex items-center gap-2 rounded-md border px-2 py-1 text-sm ${
                      u.id === selectedId
                        ? 'border-violet-500 bg-violet-950/50 text-neutral-100'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-600'
                    }`}
                  >
                    <UnitPortrait data={data} unit={u} size={32} />
                    {u.name}
                  </button>
                ))}
                {units.length === 0 && <span className="text-xs text-neutral-500">No one joins here with this pick.</span>}
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
