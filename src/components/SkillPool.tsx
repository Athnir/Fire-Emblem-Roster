import type { ReactNode } from 'react'

// The Skill Planner's parts, laid out as Fates' (src/components/SkillPlanner.tsx), for the games that keep their skills by name:
// each source's skills in a row (a class, a skill rank, an Emblem), the loadout above them, and the tickbox for every level.

/** A skill as a Skill Planner lists it: its icon, name, a short tag (the level or rank it's learned at, its cost) and what it does. */
export interface PoolSkill {
  name: string
  icon: ReactNode
  tag?: string
  help?: string
  /** How few units can learn it: ★ not standard, ★★ three units or fewer. */
  stars?: number
}

const buttonClass = (on: boolean) =>
  `flex min-w-[10rem] max-w-xs flex-col gap-0.5 rounded-md border px-2 py-1 text-left text-xs transition-colors disabled:opacity-40 ${
    on ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
  }`

/** A skill's stars, after its name. */
export function Stars({ n }: { n?: number }) {
  if (!n) return null
  return (
    <span className="shrink-0 text-amber-400" title={n > 1 ? 'Three units or fewer can learn it' : 'Not standard: half the units or fewer can learn it'}>
      {'★'.repeat(n)}
    </span>
  )
}

function SkillButton({ skill, on, disabled, onClick }: { skill: PoolSkill; on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={buttonClass(on)}>
      <span className="flex items-center gap-1.5">
        {skill.icon}
        <span className="min-w-0 break-words">{skill.name}</span>
        <Stars n={skill.stars} />
        {skill.tag && <span className="ml-auto shrink-0 text-neutral-500">{skill.tag}</span>}
      </span>
      {skill.help && <span className="text-[10px] leading-tight text-neutral-400">{skill.help}</span>}
    </button>
  )
}

/** One source's skills: its name and notes on the left, the skills to tap on the right (as Fates' class rows), or in tiers (a skill's
 * ranks), each under its label. A skill is greyed out once its loadout is full (`full`). */
export function SkillRow({
  title,
  icon,
  meta = [],
  skills,
  tiers,
  chosen,
  full,
  onToggle,
}: {
  title: ReactNode
  icon?: ReactNode
  meta?: string[]
  skills?: PoolSkill[]
  tiers?: { label: string; skills: PoolSkill[] }[]
  chosen: string[]
  full?: (name: string) => boolean
  onToggle: (name: string) => void
}) {
  const buttons = (list: PoolSkill[]) =>
    list.map((s) => {
      const on = chosen.includes(s.name)
      return <SkillButton key={s.name} skill={s} on={on} disabled={!on && full?.(s.name)} onClick={() => onToggle(s.name)} />
    })
  const shownTiers = tiers?.filter((t) => t.skills.length > 0)
  if (shownTiers ? shownTiers.length === 0 : !skills?.length) return null
  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-800 px-3 py-2 sm:flex-row sm:items-start sm:gap-3">
      <div className="flex shrink-0 items-start gap-2 sm:w-36">
        {icon}
        <div>
          <div className="text-sm text-neutral-300">{title}</div>
          <div className="text-[10px] leading-tight text-neutral-500">
            {meta.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      </div>
      {shownTiers ? (
        <div className="min-w-0 flex-1 space-y-1.5">
          {shownTiers.map((t) => (
            <div key={t.label} className="flex items-start gap-2">
              <span className="w-7 shrink-0 pt-1 text-right text-xs font-medium text-neutral-500">{t.label}</span>
              <div className="flex min-w-0 flex-1 flex-wrap gap-2">{buttons(t.skills)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">{buttons(skills ?? [])}</div>
      )}
    </div>
  )
}

/** The skills equipped, n of the slots; a tap takes one off (Fates' Loadout). */
export function Loadout({ title, max, skills, onRemove, children }: { title: string; max: number; skills: PoolSkill[]; onRemove: (name: string) => void; children?: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-neutral-100">
        {title} <span className={skills.length > max ? 'text-red-400' : 'text-neutral-400'}>({skills.length}/{max})</span>
      </h3>
      {children}
      {skills.length === 0 ? (
        <p className="text-sm text-neutral-500">None yet: tap a skill below to add it.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {skills.map((s) => (
            <li key={s.name}>
              <button
                type="button"
                onClick={() => onRemove(s.name)}
                className="flex min-w-[10rem] max-w-xs flex-col gap-0.5 rounded-md border border-violet-500 bg-violet-950/50 px-2 py-1 text-left text-xs text-violet-200 hover:border-red-400 hover:text-red-300"
              >
                <span className="flex items-center gap-1.5">
                  {s.icon}
                  <span className="min-w-0 break-words">{s.name}</span>
                  <Stars n={s.stars} />
                  <span className="ml-auto flex shrink-0 items-center gap-1">
                    {s.tag && <span className="text-violet-300/70">{s.tag}</span>}
                    <span>×</span>
                  </span>
                </span>
                {s.help && <span className="text-[10px] leading-tight text-violet-300/80">{s.help}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The tickbox that shows every level of a skill that comes in levels; off, only a chain's top level is listed. */
export function AllLevelsToggle({ on, onChange, example }: { on: boolean; onChange: (on: boolean) => void; example: string }) {
  return (
    <label className="flex items-center gap-2 text-xs text-neutral-300">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      Show every level ({example}); off, only the top level each source gives is listed
    </label>
  )
}
