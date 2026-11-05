import { useState } from 'react'
import { useArmy, useScreenshotUnit, useUnitPlan } from './hooks'
import { learnable, MAX_ABILITIES, MAX_ARTS, type Fe16Data, type Fe16Source } from './logic'
import { SkillIcon, UnitSelect } from './ui'

function Picker({
  data,
  title,
  items,
  chosen,
  max,
  help,
  onChange,
}: {
  data: Fe16Data
  title: string
  items: Fe16Source[]
  chosen: string[]
  max: number
  help: (name: string) => string | undefined
  onChange: (next: string[]) => void
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-neutral-200">
        {title}{' '}
        <span className={`text-xs font-normal ${chosen.length > max ? 'text-red-400' : 'text-neutral-500'}`}>
          {chosen.length} / {max} equipped
        </span>
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => {
          const on = chosen.includes(it.name)
          return (
            <button
              key={it.name}
              type="button"
              disabled={!on && chosen.length >= max}
              onClick={() => onChange(on ? chosen.filter((x) => x !== it.name) : [...chosen, it.name])}
              title={help(it.name)}
              className={`flex min-w-[9rem] max-w-xs flex-col gap-0.5 rounded-md border px-2 py-1 text-left text-xs transition-colors disabled:opacity-40 ${
                on ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <SkillIcon data={data} skill={it.name} size={18} />
                {it.name}
              </span>
              <span className="text-[10px] leading-tight text-neutral-500">{it.from.join(', ')}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** The abilities and combat arts a unit equips, from everything they can learn. Saved with their plan. */
export function Fe16SkillPlanner({ data }: { data: Fe16Data }) {
  const { units, picks } = useArmy(data)
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const unit = units.find((u) => u.id === unitId) ?? units[0]
  useScreenshotUnit(unit)
  const { plan, update } = useUnitPlan(unit)
  if (!unit || !plan) return null
  const pool = learnable(data, unit)
  const abilities = pool.filter((p) => p.kind === 'ability')
  const arts = pool.filter((p) => p.kind === 'art')
  const chosenAbilities = plan.abilities ?? []
  const chosenArts = plan.arts ?? []
  return (
    <div className="space-y-4">
      <UnitSelect units={units} picks={picks} value={unit.id} onChange={setUnitId} />
      <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <p className="text-xs text-neutral-500">
          Everything {unit.name} can learn: at their skill ranks (every unit's, and their own), from a budding talent, and by mastering the
          classes they can be in. Equip up to five abilities and three combat arts; the personal ability ({unit.personal.join(', then ')})
          and the class's own abilities come on their own. Hover for what each does.
        </p>
        <Picker
          data={data}
          title="Abilities"
          items={abilities}
          chosen={chosenAbilities}
          max={MAX_ABILITIES}
          help={(n) => data.abilities[n]}
          onChange={(next) => update({ abilities: next })}
        />
        <Picker data={data} title="Combat arts" items={arts} chosen={chosenArts} max={MAX_ARTS} help={(n) => data.arts[n]} onChange={(next) => update({ arts: next })} />
        {(chosenAbilities.length > 0 || chosenArts.length > 0) && (
          <ul className="space-y-1 text-sm">
            {[...chosenAbilities.map((n) => [n, data.abilities[n]]), ...chosenArts.map((n) => [n, data.arts[n]])].map(([n, h]) => (
              <li key={n} className="flex items-start gap-2">
                <SkillIcon data={data} skill={n} />
                <span>
                  <span className="font-medium text-neutral-200">{n}</span>
                  {h && <span className="text-neutral-400">: {h}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
