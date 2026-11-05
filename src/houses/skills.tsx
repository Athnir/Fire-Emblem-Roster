import { useState } from 'react'
import { AllLevelsToggle, Loadout, SkillRow, type PoolSkill } from '../components/SkillPool'
import { topLevels } from '../logic/skillChains'
import { useAllLevels } from '../state/allLevelsStore'
import { useArmy, useScreenshotUnit, useSpoiler, useUnitPlan } from './hooks'
import { canTake, classesFor, kindOf, labelOf, learnsOf, MAX_ABILITIES, MAX_ARTS, personalNow, type Fe16Data } from './logic'
import { FE16_SKILL_LABELS, FE16_SKILLS } from './types'
import { SkillIcon, UnitSelect } from './ui'

/** The abilities and combat arts a unit equips, laid out as Fates' Skill Planner: the personal ability, the loadouts, then everything
 * they can learn, a row for each skill's ranks, their budding talent and each class they can master. Saved with their plan. */
export function Fe16SkillPlanner({ data }: { data: Fe16Data }) {
  const { units, picks } = useArmy(data)
  const { chapter } = useSpoiler(data)
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const unit = units.find((u) => u.id === unitId) ?? units[0]
  useScreenshotUnit(unit)
  const { plan, update } = useUnitPlan(unit)
  const [allLevels, setAllLevels] = useAllLevels(data.gameId)
  if (!unit || !plan) return null

  const chosen = { ability: plan.abilities ?? [], art: plan.arts ?? [] }
  const max = { ability: MAX_ABILITIES, art: MAX_ARTS }
  const help = (name: string) => data.abilities[name] ?? data.arts[name]
  const skill = (name: string, tag?: string): PoolSkill => ({ name, tag, help: help(name), icon: <SkillIcon data={data} skill={name} size={18} /> })
  const shown = (items: PoolSkill[]) => (allLevels ? items : topLevels(items, (s) => s.name, data.chains))
  const toggle = (name: string) => {
    const kind = kindOf(data, name)
    const list = chosen[kind]
    const next = list.includes(name) ? list.filter((x) => x !== name) : [...list, name]
    update(kind === 'ability' ? { abilities: next } : { arts: next })
  }
  const full = (name: string) => {
    const kind = kindOf(data, name)
    return chosen[kind].length >= max[kind]
  }
  const all = [...chosen.ability, ...chosen.art]
  const learns = learnsOf(data, unit).filter((l) => l.kind !== 'spell')
  const classes = classesFor(data, unit).filter((c) => (canTake(c, unit) || c.id === unit.classId) && c.mastery.length > 0)

  return (
    <div className="space-y-4">
      <UnitSelect units={units} picks={picks} value={unit.id} onChange={setUnitId} />
      <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="space-y-1 text-sm text-neutral-300">
          {personalNow(unit, chapter).map((p) => (
            <div key={p.name} className="flex items-start gap-2">
              <SkillIcon data={data} skill={p.name} />
              <span>
                <span className="text-neutral-500">Personal ability{p.part ? ` (${p.part})` : ''}: </span>
                {p.name}
                {data.abilities[p.name] && <span className="block text-xs text-neutral-500">{data.abilities[p.name]}</span>}
              </span>
            </div>
          ))}
        </div>
        <Loadout title="Abilities" max={MAX_ABILITIES} skills={chosen.ability.map((n) => skill(n))} onRemove={toggle} />
        <Loadout title="Combat arts" max={MAX_ARTS} skills={chosen.art.map((n) => skill(n))} onRemove={toggle} />
        <p className="text-xs text-neutral-500">
          The personal ability and the class's own abilities come on their own. Tap a skill below to equip it, tap it above to take it off.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="text-base font-semibold text-neutral-100">What {labelOf(unit)} can learn</h3>
        <AllLevelsToggle on={allLevels} onChange={setAllLevels} example="Sword Prowess Lv 1 to 5" />
        {FE16_SKILLS.map((sk) => (
          <SkillRow
            key={sk}
            title={FE16_SKILL_LABELS[sk]}
            meta={[
              unit.strengths.includes(sk) ? '▲ a strength' : unit.weaknesses.includes(sk) ? '▼ a weakness' : 'skill ranks',
              ...(unit.budding?.skill === sk ? [`✦ budding talent: ${unit.budding.name}`] : []),
            ]}
            skills={shown(learns.filter((l) => l.skill === sk).map((l) => skill(l.name, l.rank)))}
            chosen={all}
            full={full}
            onToggle={toggle}
          />
        ))}
        {unit.budding && (
          <SkillRow
            title="Budding talent"
            meta={[FE16_SKILL_LABELS[unit.budding.skill], 'once the weakness is trained']}
            skills={[skill(unit.budding.name)]}
            chosen={all}
            full={full}
            onToggle={toggle}
          />
        )}
        {classes.map((c) => (
          <SkillRow
            key={c.id}
            title={c.name}
            meta={[`${c.tier}${c.level ? `, exam at Lv ${c.level}` : ''}`, 'mastering it teaches']}
            skills={c.mastery.map((n) => skill(n))}
            chosen={all}
            full={full}
            onToggle={toggle}
          />
        ))}
      </div>
    </div>
  )
}
