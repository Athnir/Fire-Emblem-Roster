import { useState } from 'react'
import { AllLevelsToggle, Loadout, SkillRow, type PoolSkill } from '../components/SkillPool'
import { topLevels } from '../logic/skillChains'
import { useAllLevels } from '../state/allLevelsStore'
import { useArmy, useScreenshotUnit, useUnitPlan } from './hooks'
import { inheritable, labelOf, type Fe17Data } from './logic'
import { EmblemFace, SkillIcon, UnitSelect } from './ui'

/** The skill slots inheriting fills (Unit.EquipSkillMax). */
const SLOTS = 2

/** The skills a unit inherits from the Emblems, laid out as Fates' Skill Planner: the personal skill, the two slots, then a row for
 * each Emblem with what it teaches, from the bond level it opens at, for its SP. With the spoiler block on, an Emblem's row shows
 * once its ring has come. Saved per unit. */
export function Fe17SkillPlanner({ data }: { data: Fe17Data }) {
  const { units, reached } = useArmy(data)
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const unit = units.find((u) => u.id === unitId) ?? units[0]
  useScreenshotUnit(unit)
  const { plan, update } = useUnitPlan(unit)
  const [allLevels, setAllLevels] = useAllLevels(data.gameId)
  if (!unit || !plan) return null

  const chosen = plan.inherited ?? []
  const sp = new Map(inheritable(data).map((s) => [s.name, s.sp]))
  const skill = (name: string, tag?: string): PoolSkill => ({ name, tag, help: data.skills[name], icon: <SkillIcon data={data} skill={name} size={18} /> })
  const toggle = (name: string) => update({ inherited: chosen.includes(name) ? chosen.filter((x) => x !== name) : [...chosen, name] })
  const total = chosen.reduce((sum, n) => sum + (sp.get(n) ?? 0), 0)
  const emblems = data.emblems.filter((e) => !reached || reached.has(e.joinChapter))

  return (
    <div className="space-y-4">
      <UnitSelect data={data} units={units} value={unit.id} onChange={setUnitId} />
      <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="space-y-1 text-sm text-neutral-300">
          {unit.personal.map((p) => (
            <div key={p} className="flex items-start gap-2">
              <SkillIcon data={data} skill={p} />
              <span>
                <span className="text-neutral-500">Personal skill: </span>
                {p}
                {data.skills[p] && <span className="block text-xs text-neutral-500">{data.skills[p]}</span>}
              </span>
            </div>
          ))}
        </div>
        <Loadout title="Inherited skills" max={SLOTS} skills={chosen.map((n) => skill(n, `${sp.get(n) ?? 0} SP`))} onRemove={toggle}>
          <p className="text-xs text-neutral-500">
            {total} SP in all. {labelOf(unit)} starts with {unit.sp} SP; SP comes from EXP earned with an Emblem Ring on (half with a Bond
            Ring).
          </p>
        </Loadout>
      </div>

      <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="text-base font-semibold text-neutral-100">What the Emblems teach</h3>
        <p className="text-xs text-neutral-500">Each skill once the bond with its Emblem reaches the level shown, for its SP.</p>
        <AllLevelsToggle on={allLevels} onChange={setAllLevels} example="Sword Agility 1 to 5" />
        {emblems.map((e) => {
          const items = e.levels.flatMap((lv) => lv.inherit.map((s) => skill(s.name, `Bond ${lv.level} · ${s.sp} SP`)))
          return (
            <SkillRow
              key={e.id}
              title={e.name}
              icon={<EmblemFace data={data} emblem={e.name} size={28} />}
              meta={[e.expansionPass ? 'Expansion Pass' : 'Emblem Ring']}
              skills={allLevels ? items : topLevels(items, (s) => s.name, data.chains)}
              chosen={chosen}
              full={() => chosen.length >= SLOTS}
              onToggle={toggle}
            />
          )
        })}
      </div>
    </div>
  )
}
