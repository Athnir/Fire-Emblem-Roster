import { useEffect, useRef, useState } from 'react'
import { useScreenshotContextStore } from '../state/screenshotContextStore'
import { chip } from './hooks'
import { CLASS_TIERS, labelOf, type Fe16Data } from './logic'
import { FE16_SKILL_LABELS, type Fe16Class, type Fe16Skill } from './types'
import { ExamCalculator } from './exam'
import { SkillChips, StatTable } from './ui'

/** A class's name, with its women's name where it has one (War Monk / War Cleric). */
const nameOf = (cls: Fe16Class) => (cls.nameFemale ? `${cls.name} / ${cls.nameFemale}` : cls.name)

/** One class's fixed things: who can be in it, its exam (the level, the seal and the skill ranks it asks for) with the pass chance
 * for the ranks put in, its abilities and what mastering it teaches, and its bases (the least a unit has in it), growths and boosts. */
function ClassDetail({ data, cls }: { data: Fe16Data; cls: Fe16Class }) {
  const who = cls.who?.map((id) => data.units.find((u) => u.id === id)).filter((u) => u !== undefined)
  const ranks = Object.entries(cls.exam?.ranks ?? {}) as [Fe16Skill, string][]
  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="space-y-1 text-sm text-neutral-300">
        <h3 className="text-lg font-semibold text-neutral-100">{nameOf(cls)}</h3>
        <div>
          {cls.tier}
          {cls.types.length > 0 && ` · ${cls.types.join(', ')}`}
          {cls.gender !== 'any' && ` · ${cls.gender === 'female' ? 'women' : 'men'} only`}
          {cls.dlc && ' · DLC'}
        </div>
        {who && who.length > 0 && (
          <div>
            <span className="text-neutral-500">Who: </span>
            {who.map(labelOf).join(', ')}
          </div>
        )}
        {cls.given && <div className="text-neutral-400">{cls.given}</div>}
        {cls.requires && (
          <div>
            <span className="text-neutral-500">Needs certified first: </span>
            {data.classes[cls.requires]?.name}
          </div>
        )}
      </div>
      {cls.exam && ranks.length > 0 && (
        <div className="space-y-2 text-sm text-neutral-300">
          <h4 className="text-sm font-semibold text-neutral-200">Exam</h4>
          <div>
            <span className="text-neutral-500">Needs: </span>
            Lv {cls.level}
            {cls.exam.seal && `, ${/^[AEIOU]/.test(cls.exam.seal) ? 'an' : 'a'} ${cls.exam.seal}`}, {ranks.map(([sk, r]) => `${FE16_SKILL_LABELS[sk]} ${r}`).join(' and ')}
          </div>
          <ExamCalculator key={cls.id} cls={cls} />
        </div>
      )}
      {(cls.abilities.length > 0 || cls.mastery.length > 0 || cls.alsoTeaches) && (
        <div className="space-y-1 text-sm text-neutral-300">
          {cls.abilities.length > 0 && (
            <div>
              <span className="text-neutral-500">Class abilities: </span>
              <SkillChips data={data} skills={cls.abilities} />
            </div>
          )}
          {cls.alsoTeaches && (
            <div>
              <span className="text-neutral-500">Winning the White Heron Cup teaches: </span>
              <SkillChips data={data} skills={cls.alsoTeaches} />
            </div>
          )}
          {cls.mastery.length > 0 && (
            <div>
              <span className="text-neutral-500">Mastering it teaches: </span>
              <SkillChips data={data} skills={cls.mastery} />
            </div>
          )}
        </div>
      )}
      <StatTable
        rows={[
          { label: 'Bases (the least in it)', values: cls.bases },
          { label: 'Growths (added)', values: cls.growths, suffix: '%', mov: true },
          { label: 'Boosts while in it', values: cls.boosts, mov: true },
          ...(cls.mount ? [{ label: 'Mounted, more', values: cls.mount, mov: true }] : []),
        ]}
      />
      <p className="text-xs text-neutral-500">
        Changing into the class, or passing its exam, lifts any stat below its base to it for good; its growths add to the unit's own;
        its boosts show on top while in it (and its mount's while mounted). Classes have no maximums of their own.
      </p>
    </div>
  )
}

/** Every class a unit can be in, by tier, and one's fixed things below. */
export function Fe16Classes({ data }: { data: Fe16Data }) {
  const classes = Object.values(data.classes)
  const [id, setId] = useState(classes[0]?.id ?? '')
  const cls = data.classes[id] ?? classes[0]
  const detailRef = useRef<HTMLDivElement>(null)
  const setUnitLabel = useScreenshotContextStore((s) => s.setUnitLabel)
  // Screenshots are named after the class shown.
  useEffect(() => {
    setUnitLabel(cls?.name ?? '')
    return () => setUnitLabel('')
  }, [cls, setUnitLabel])
  if (!cls) return null
  return (
    <div className="space-y-6">
      {CLASS_TIERS.filter((t) => classes.some((c) => c.tier === t)).map((t) => (
        <div key={t} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t} classes</h3>
          <div className="flex flex-wrap gap-1.5">
            {classes
              .filter((c) => c.tier === t)
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
                  {nameOf(c)}
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
