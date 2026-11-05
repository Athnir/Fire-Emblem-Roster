import { useEffect, useRef, useState } from 'react'
import { useScreenshotContextStore } from '../state/screenshotContextStore'
import { chip } from './hooks'
import { labelOf, type Fe17Data } from './logic'
import type { Fe17Class } from './types'
import { SkillChips, StatTable } from './ui'

const TIERS: { tier: Fe17Class['tier']; label: string }[] = [
  { tier: 'base', label: 'Base classes' },
  { tier: 'special', label: 'Special classes' },
  { tier: 'advanced', label: 'Advanced classes' },
]

/** A class's name, with whose it is where two share a name (Alfred's Noble and Céline's, the Fell Childs). */
export function classLabel(data: Fe17Data, cls: Fe17Class): string {
  const shared = Object.values(data.classes).some((c) => c.id !== cls.id && c.name === cls.name)
  if (!shared || !cls.uniqueTo?.length) return cls.name
  const who = cls.uniqueTo.map((id) => data.units.find((u) => u.id === id)).filter((u) => u !== undefined)
  return `${cls.name} (${[...new Set(who.map((u) => u.name))].join(', ')})`
}

const weaponText = (w: Fe17Class['weapons'][number]) => `${w.weapon} ${w.rank}${w.use !== 'always' ? ` (${w.use})` : ''}`

/** One class's fixed things: who can be in it, its weapons, what it needs to change into, its skills, and its bases (the least a unit
 * shows in it), growths and caps. */
function ClassDetail({ data, cls }: { data: Fe17Data; cls: Fe17Class }) {
  const names = (ids: string[]) => ids.map((id) => data.classes[id]?.name ?? id).join(', ')
  const who = cls.uniqueTo?.map((id) => data.units.find((u) => u.id === id)).filter((u) => u !== undefined)
  const needs = [...cls.needs.all, ...(cls.needs.choose ? [`${cls.needs.choose} of ${cls.needs.from.join(', ')}`] : [])]
  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="space-y-1 text-sm text-neutral-300">
        <h3 className="text-lg font-semibold text-neutral-100">{classLabel(data, cls)}</h3>
        <p className="text-neutral-400">{cls.help}</p>
        <div>
          {TIERS.find((t) => t.tier === cls.tier)?.label.replace(' classes', '')} · to Lv {cls.maxLevel} · {cls.moveType} · {cls.style}
          {cls.expansionPass && ' · Expansion Pass'}
        </div>
        {(who?.length || cls.femaleOnly) && (
          <div>
            <span className="text-neutral-500">Who: </span>
            {who?.length ? who.map(labelOf).join(', ') : 'women only'}
          </div>
        )}
        <div>
          <span className="text-neutral-500">Weapons: </span>
          {cls.weapons.map(weaponText).join(', ')}
        </div>
        {cls.items?.length ? (
          <div>
            <span className="text-neutral-500">Changed into with: </span>
            {cls.items.join(', ')}
          </div>
        ) : (
          needs.length > 0 && (
            <div>
              <span className="text-neutral-500">Proficiency needed to change into it: </span>
              {needs.join(', ')}
            </div>
          )
        )}
        {cls.promotesFrom.length > 0 && (
          <div>
            <span className="text-neutral-500">Promotes from: </span>
            {names(cls.promotesFrom)}
          </div>
        )}
        {cls.promotesTo.length > 0 && (
          <div>
            <span className="text-neutral-500">Promotes to: </span>
            {names(cls.promotesTo)}
          </div>
        )}
      </div>
      {(cls.skills.length > 0 || cls.learns) && (
        <div className="space-y-1 text-sm text-neutral-300">
          <h4 className="text-sm font-semibold text-neutral-200">Skills</h4>
          <SkillChips
            data={data}
            skills={[...cls.skills.map((name) => ({ name })), ...(cls.learns ? [{ name: cls.learns.skill, note: `(Lv ${cls.learns.level})` }] : [])]}
          />
        </div>
      )}
      <StatTable
        rows={[
          { label: 'Bases (the least shown)', values: cls.bases },
          { label: 'Growths (added)', values: cls.growths, suffix: '%' },
          { label: 'Caps (before the unit’s modifiers)', values: cls.caps },
        ]}
      />
      <p className="text-xs text-neutral-500">
        A unit shows the class's bases plus their own stats, so the bases are the least anyone shows in it; the growths add to the unit's
        own; a unit's caps are the class's plus their modifiers.
      </p>
    </div>
  )
}

/** Every class a unit can be in, by tier, and one's fixed things below. */
export function Fe17Classes({ data }: { data: Fe17Data }) {
  const classes = Object.values(data.classes)
  const [id, setId] = useState(classes[0]?.id ?? '')
  const cls = data.classes[id] ?? classes[0]
  const detailRef = useRef<HTMLDivElement>(null)
  const setUnitLabel = useScreenshotContextStore((s) => s.setUnitLabel)
  // Screenshots are named after the class shown.
  useEffect(() => {
    setUnitLabel(cls ? classLabel(data, cls) : '')
    return () => setUnitLabel('')
  }, [data, cls, setUnitLabel])
  if (!cls) return null
  return (
    <div className="space-y-6">
      {TIERS.map((t) => (
        <div key={t.tier} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t.label}</h3>
          <div className="flex flex-wrap gap-1.5">
            {classes
              .filter((c) => c.tier === t.tier)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setId(c.id)
                    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
                  }}
                  className={chip(c.id === cls.id)}
                >
                  {classLabel(data, c)}
                </button>
              ))}
          </div>
        </div>
      ))}
      <div ref={detailRef}>
        <ClassDetail data={data} cls={cls} />
      </div>
    </div>
  )
}
