import { useRef, useState } from 'react'
import { chaptersNeeded, supportsOf } from './logic'
import { chapterLabel, SkillIcon, StatTable, UnitPortrait, useScreenshotUnit } from './shared'
import { TELLIUS_RANK_LABELS, type TelliusData, type TelliusRankType, type TelliusUnit } from './types'

function joinText(data: TelliusData, unit: TelliusUnit): string {
  const where = chapterLabel(data, unit.joinChapter)
  if (unit.join.how === 'talk') return `${where}: talk to them with ${unit.join.with?.join(' or ') ?? 'another unit'}`
  if (unit.join.how === 'bonus') return where
  if (unit.join.how === 'base') return `${where}: joins at the base before it (an Info conversation)`
  if (unit.join.how === 'event') return `${where}: joins ${unit.join.turn ? `on turn ${unit.join.turn}` : 'during the chapter'}`
  return `${where}: joins at the start`
}

function UnitDetail({ data, unit }: { data: TelliusData; unit: TelliusUnit }) {
  const cls = data.classes[unit.classId]
  const supports = supportsOf(data, unit.id)
  const ranks = Object.entries(unit.ranks) as [TelliusRankType, string][]
  const classSkills = cls.skills.filter((s) => !unit.skills.includes(s))

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
        </div>
      </div>

      <StatTable
        rows={[
          { label: 'Bases', values: unit.bases },
          { label: 'Growths', values: unit.growths, suffix: '%' },
          { label: `Caps (${cls.name})`, values: cls.caps },
        ]}
      />

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
                  <div className="text-xs text-neutral-400">{skill.description}</div>
                </div>
              </div>
            )
          })}
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

/** Every playable unit, by the chapter they join; tapping one shows their data below the list. */
export function TelliusRoster({ data }: { data: TelliusData }) {
  const [selectedId, setSelectedId] = useState(data.units[0]?.id ?? '')
  const detailRef = useRef<HTMLDivElement>(null)
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
          const units = data.units.filter((u) => u.joinChapter === ch.id)
          if (units.length === 0) return null
          return (
            <div key={ch.id}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {ch.label}: {ch.title}
              </h3>
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
