import { useRef, useState } from 'react'
import { excludedUnits, useTelliusChoices } from './choiceStore'
import { bondsOf, chaptersNeeded, openSupportsOf, supportsOf, transformedStats } from './logic'
import { useTelliusPlanStore } from './planStore'
import { chapterLabel, chapterRuns, SkillIcon, StatTable, StoryPromotions, UnitPortrait, useScreenshotUnit } from './shared'
import { TELLIUS_RANK_LABELS, type TelliusChoice, type TelliusData, type TelliusRankType, type TelliusUnit } from './types'

function joinText(data: TelliusData, unit: TelliusUnit): string {
  const where = chapterLabel(data, unit.joinChapter)
  if (unit.join.how === 'talk') return `${where}: talk to them with ${unit.join.with?.join(' or ') ?? 'another unit'}`
  if (unit.join.how === 'bonus') return where
  if (unit.join.how === 'base') return `${where}: joins at the base before it (an Info conversation)`
  if (unit.join.how === 'event') return `${where}: joins ${unit.join.turn ? `on turn ${unit.join.turn}` : 'during the chapter'}`
  return `${where}: joins at the start`
}

function UnitDetail({ data, unit }: { data: TelliusData; unit: TelliusUnit }) {
  const plans = useTelliusPlanStore((s) => s.plans[data.gameId])
  const cls = data.classes[unit.classId]
  const supports = supportsOf(data, unit.id)
  const ranks = Object.entries(unit.ranks) as [TelliusRankType, string][]
  const classSkills = cls.skills.filter((s) => !unit.skills.includes(s))
  const transformed = transformedStats(data, unit.classId, unit.bases)
  const halfParts = [...new Set((unit.halfTransformed ?? []).map((id) => data.chapters.find((c) => c.id === id)?.part).filter(Boolean))]
  const half = halfParts.length ? transformedStats(data, unit.classId, unit.bases, true) : undefined
  const open = openSupportsOf(data, unit.id)
  const bonds = bondsOf(data, unit.id, plans ?? {})
  const faster = open.filter((p) => p.bonus > 0)
  const slower = open.filter((p) => p.bonus < 0)
  const doubling = data.rules.transform === 'double'

  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <UnitPortrait data={data} unit={unit} size={128} />
        <div className="space-y-1 text-sm text-neutral-300">
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

      <StatTable
        rows={[
          { label: 'Bases', values: unit.bases },
          { label: 'Growths', values: unit.growths, suffix: '%' },
          { label: `Caps (${cls.name})`, values: cls.caps },
          ...(half ? [{ label: `Half-transformed (${halfParts.join(', ')})`, values: half.stats }] : []),
          ...(transformed
            ? [
                { label: `Transformed (${data.classes[transformed.classId].name})`, values: transformed.stats },
                { label: `Caps (${data.classes[transformed.classId].name})`, values: data.classes[transformed.classId].caps },
              ]
            : []),
        ]}
      />
      {(transformed || half) && (
        <p className="text-xs text-neutral-500">
          {doubling
            ? 'Transformed: every stat but HP and Luck doubled (0x80122770).'
            : "Transformed: the transformed class's bases take the place of the other form's (0x8003bbd4)."}
          {half && ` In ${halfParts.join(', ')} the maps keep ${unit.name} half-transformed: every stat but HP and Luck ×1.5, rounded down.`}
        </p>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-300">
        <span>
          <span className="text-neutral-500">Mov </span>
          {cls.mov}
        </span>
        <span>
          <span className="text-neutral-500">Con </span>
          {unit.con}
        </span>
        <span>
          <span className="text-neutral-500">Wt </span>
          {unit.wt}
        </span>
        <span>
          <span className="text-neutral-500">Capacity </span>
          {cls.capacity}
        </span>
        {ranks.length > 0 && (
          <span>
            <span className="text-neutral-500">Weapons </span>
            {ranks.map(([type, rank]) => `${TELLIUS_RANK_LABELS[type]} ${rank}`).join(', ')}
          </span>
        )}
      </div>

      {(unit.skills.length > 0 || classSkills.length > 0) && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-neutral-200">Skills</h4>
          {[...unit.skills, ...classSkills].map((id) => {
            const skill = data.skills[id]
            if (!skill) return null
            return (
              <div key={id} className="flex items-start gap-2 text-sm">
                <SkillIcon data={data} skillId={id} />
                <div>
                  <div className="text-neutral-200">
                    {skill.name}
                    <span className="ml-2 text-xs text-neutral-500">
                      {unit.skills.includes(id) ? `Capacity ${skill.capacity}` : `${cls.name} skill`}
                    </span>
                  </div>
                  {skill.description && <div className="text-xs text-neutral-400">{skill.description}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {cls.mastery && data.skills[cls.mastery] && (
        <p className="text-sm text-neutral-300">
          <span className="text-neutral-500">Mastery skill: </span>
          {data.skills[cls.mastery].name} (with a Satori Sign)
        </p>
      )}

      {(open.length > 0 || bonds.length > 0) && (
        <div className="space-y-1 text-sm text-neutral-300">
          <h4 className="text-sm font-semibold text-neutral-200">Supports</h4>
          {open.length > 0 && <p className="text-xs text-neutral-500">Can support any of the {open.length} other units in the support list.</p>}
          {faster.length > 0 && (
            <div>
              <span className="text-neutral-500">Faster with: </span>
              {faster.map((p) => p.partner.name).join(', ')}
            </div>
          )}
          {slower.length > 0 && (
            <div>
              <span className="text-neutral-500">Slower with: </span>
              {slower.map((p) => p.partner.name).join(', ')}
            </div>
          )}
          {bonds.length > 0 && (
            <div>
              <span className="text-neutral-500">Bonds: </span>
              {bonds.map((b) => `${b.partner.name}${b.fromPor ? ' (Path of Radiance A support)' : ''}`).join(', ')}
            </div>
          )}
        </div>
      )}

      {supports.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-neutral-200">Supports</h4>
          <p className="text-xs text-neutral-500">Chapters fought together for C / B / A.</p>
          <ul className="text-sm text-neutral-300">
            {supports.map(({ partner, support }) => (
              <li key={partner.id}>
                {partner.name} <span className="text-neutral-500">({partner.affinity})</span>{' '}
                <span className="tabular-nums">{chaptersNeeded(support).join(' / ')}</span>
              </li>
            ))}
          </ul>
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
