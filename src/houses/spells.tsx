import { useState } from 'react'
import { SpellBook, type SpellCard, type SpellSection } from '../components/SpellBook'
import { useArmy, useScreenshotUnit } from './hooks'
import { labelOf, learnsOf, type Fe16Data } from './logic'
import { FE16_SKILL_LABELS } from './types'
import { UnitPortrait, UnitSelect } from './ui'

// Three Houses' Spells tab: the five Reason and five Faith spells each unit learns at their own ranks (fixed_persondata.bin section 4).

const USES = ['Black Magic Uses x2', 'Dark Magic Uses x2', 'White Magic Uses x2']

export function Fe16Spells({ data }: { data: Fe16Data }) {
  const { units, picks } = useArmy(data)
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const unit = units.find((u) => u.id === unitId) ?? units[0]
  useScreenshotUnit(unit)
  if (!unit) return null
  const spells = learnsOf(data, unit).filter((l) => l.kind === 'spell')
  const sections: SpellSection[] = (['reason', 'faith'] as const)
    .map((skill) => ({
      title: FE16_SKILL_LABELS[skill],
      ways: spells.filter((l) => l.skill === skill).map((l) => ({ spell: l.name, how: `${FE16_SKILL_LABELS[skill]} ${l.rank}` })),
    }))
    .filter((s) => s.ways.length > 0)
  const cardOf = (name: string): SpellCard | undefined => {
    const s = data.spellStats[name]
    if (!s) return undefined
    const short = !s.range.includes(' ')
    // A spell that neither hurts nor heals (Warp, Silence) shows no Mt, Crit or Wt: they're all 0.
    const strikes = s.heals || s.mt > 0 || s.crit > 0 || s.wt > 0
    return {
      kind: s.kind,
      numbers: [
        ...(strikes ? [{ label: s.heals ? 'Heal' : 'Mt', value: s.mt }] : []),
        { label: 'Hit', value: s.hit },
        ...(strikes ? [{ label: 'Crit', value: s.crit }, { label: 'Wt', value: s.wt }] : []),
        { label: 'Uses', value: s.uses },
        ...(short ? [{ label: 'Rng', value: s.range }] : []),
      ],
      range: short ? undefined : s.range,
      text: s.text,
      notes: [...(s.effective.length ? [`Effective against ${s.effective.join(' and ')}.`] : []), ...(s.notes ?? [])],
    }
  }
  // The classes whose own abilities double a kind's uses (each class's abilities, fixed_classdata.bin section 3).
  const doubling = USES.map((a) => ({ ability: a, classes: Object.values(data.classes).filter((c) => c.abilities.includes(a)).map((c) => c.name) })).filter(
    (x) => x.classes.length > 0,
  )
  return (
    <SpellBook
      picker={<UnitSelect units={units} picks={picks} value={unit.id} onChange={setUnitId} />}
      header={
        <div className="flex items-center gap-3">
          <UnitPortrait data={data} unit={unit} size={48} />
          <span className="text-lg font-semibold text-neutral-100">{labelOf(unit)}</span>
        </div>
      }
      sections={sections}
      cardOf={cardOf}
      rules={
        <>
          <p>
            Each unit learns their own Reason and Faith spells, up to five of each, on reaching the rank shown (fixed_persondata.bin section 4).
            Reason holds black and dark magic; Faith white magic.
          </p>
          <p>Uses are how many times it can be cast. {doubling.map((d) => `${d.ability}: ${d.classes.join(', ')}`).join('. ')}.</p>
        </>
      }
    />
  )
}
