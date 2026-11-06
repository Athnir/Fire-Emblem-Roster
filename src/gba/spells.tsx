import { useState } from 'react'
import { SpellBook, type SpellCard, type SpellSection } from '../components/SpellBook'
import { UnitPortrait, UnitSelect, useScreenshotUnit, useStory, type GbaData } from './screens'
import type { GbaClass, GbaSpellList, GbaUnit } from './types'

// The Spells tab of the games on the shared screens whose spells are the units' own (Gaiden, Shadows of Valentia): each unit's spells,
// how they get them and what each does. Shadows of Valentia's come in lists by class (`spellBook`); Gaiden's by the game's count of
// levels (`spells`, with each class's spells).

/** The classes a unit can be in: their own and every class change on from it. */
function reachable(data: GbaData, unit: GbaUnit): GbaClass[] {
  const seen = new Map<string, GbaClass>()
  const todo = [unit.classId]
  while (todo.length) {
    const id = todo.pop()!
    const c = data.classes[id]
    if (!c || seen.has(id)) continue
    seen.set(id, c)
    todo.push(...(c.promotions ?? (c.promotesTo ? [c.promotesTo] : [])))
  }
  return [...seen.values()]
}

/** Shadows of Valentia: a section per list, each spell known on entering a class that uses it or learned at its level. */
function bookSections(data: GbaData, unit: GbaUnit, lists: GbaSpellList[]): SpellSection[] {
  const joinsIn = data.classes[unit.classId]?.name ?? ''
  const isIn = (names: string) => !!names && names.split(' or ').includes(joinsIn)
  return lists.map((list) => {
    const [first, promoted] = list.classes
    const how = (rank: number, level: number) => {
      if (rank === 0) return level ? `Lv ${level}` : isIn(first) || isIn(promoted) ? 'Known as they join' : `On becoming a ${first || promoted}`
      return level ? `${promoted} Lv ${level}` : isIn(promoted) ? 'Known as they join' : `On becoming a ${promoted}`
    }
    return {
      title: `${list.kind}, as a ${[first, promoted].filter(Boolean).join(' or ')}`,
      note: list.via ? `Reached through ${list.via}.` : undefined,
      ways: list.entries.map((e) => ({ spell: e.spell, how: how(e.rank, e.level) })),
    }
  })
}

/** Gaiden: the spells known on joining, those learned at the game's count of levels, and those a class change gives. */
function countSections(data: GbaData, unit: GbaUnit): SpellSection[] {
  const own = data.spells?.[unit.id]
  if (!own) return []
  const classes = reachable(data, unit)
  const casters = classes.filter((c) => data.classSpells?.[c.id])
  const joinsAsCaster = !!data.classSpells?.[unit.classId]
  const out: SpellSection[] = []
  if (own.known.length) out.push({ title: 'Known as they join', ways: own.known.map((spell) => ({ spell, how: 'Known' })) })
  if (own.learn.length) {
    out.push({
      title: 'Learned',
      note: joinsAsCaster
        ? undefined
        : 'Their count starts again on becoming a Mage from a Villager, so each comes at that Mage level, if they get there.',
      ways: own.learn.map((x) => {
        const teach = [...new Set(casters.filter((c) => data.classSpells![c.id].includes(x.spell)).map((c) => c.name))]
        const at = x.atLevel ? `Lv ${x.atLevel}` : joinsAsCaster ? `Count ${x.level}` : `Mage Lv ${x.level}`
        return { spell: x.spell, how: teach.length ? `${at} · in a ${teach.join(' or ')}` : at }
      }),
    })
  }
  // The spell a class change gives (a Sage's or Priestess's Recover, a Saint's Angel), where the unit can make that change.
  const given = classes
    .filter((c) => c.id !== unit.classId && data.classChangeSpells?.[c.id])
    .map((c) => ({ spell: data.classChangeSpells![c.id], how: `On becoming a ${c.name}` }))
    .filter((g, i, all) => all.findIndex((x) => x.spell === g.spell && x.how === g.how) === i)
  if (given.length) out.push({ title: 'On a class change', ways: given })
  return out
}

export function GbaSpells({ data: game }: { data: GbaData }) {
  const { view: data, picker } = useStory(game)
  const units = data.units.filter((u) => data.spellBook?.[u.id] || data.spells?.[u.id])
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const unit = units.find((u) => u.id === unitId) ?? units[0]
  useScreenshotUnit(unit)
  if (!unit) return <div className="space-y-4">{picker}<p className="text-sm text-neutral-500">No one with spells has joined yet.</p></div>
  const book = data.spellBook?.[unit.id]
  const sections = book ? bookSections(data, unit, book) : countSections(data, unit)
  const cardOf = (name: string): SpellCard | undefined => {
    const s = data.spellStats?.[name]
    if (!s) return undefined
    const short = !!s.range && !s.range.includes(' ')
    return {
      kind: s.kind,
      numbers: [
        ...(s.mt !== undefined ? [{ label: s.heals ? 'Heal' : 'Mt', value: s.mt }] : []),
        ...(s.hit !== undefined ? [{ label: 'Hit', value: s.hit }] : []),
        ...(s.crit !== undefined ? [{ label: 'Crit', value: s.crit }] : []),
        { label: 'HP', value: s.hp },
        ...(short ? [{ label: 'Rng', value: s.range }] : []),
      ],
      range: short ? undefined : s.range || undefined,
      text: s.text,
      notes: s.notes,
    }
  }
  return (
    <SpellBook
      picker={
        <div className="space-y-3">
          {picker}
          <UnitSelect data={{ ...data, units }} value={unit.id} onChange={setUnitId} />
        </div>
      }
      header={
        <div className="flex items-center gap-3">
          <UnitPortrait data={data} unit={unit} size={48} />
          <span className="text-lg font-semibold text-neutral-100">{unit.name}</span>
        </div>
      }
      sections={sections}
      cardOf={cardOf}
      rules={
        <>
          {(data.spellBookText ?? data.spellText) && <p>{data.spellBookText ?? data.spellText}</p>}
          <p>HP: what casting it costs.</p>
        </>
      }
    />
  )
}
