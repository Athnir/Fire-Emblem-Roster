import { useState } from 'react'
import { useArmy, useScreenshotUnit } from './hooks'
import { labelOf, type Fe16Data } from './logic'
import type { Fe16TeaLine } from './types'
import { UnitPortrait, UnitSelect } from './ui'

// Three Houses' Affection tab (user, 2026-11-06: "the support affection section"): what wins each unit over at the monastery. Their tea
// party (favorite teas, the topics they like, the right reactions to their final lines), the gifts they like and dislike, and their
// lost items. From fixed_lobby_common.bin, fixed_presentdata.bin and the monastery's lines (scripts/fe16_units.py).

const tag = (tone: 'good' | 'bad' | 'plain') =>
  `rounded-full border px-2.5 py-0.5 text-xs ${
    tone === 'good'
      ? 'border-emerald-700 bg-emerald-950/40 text-emerald-200'
      : tone === 'bad'
        ? 'border-rose-800 bg-rose-950/40 text-rose-200'
        : 'border-neutral-700 bg-neutral-800 text-neutral-300'
  }`

function Tags({ items, tone }: { items: string[]; tone: 'good' | 'bad' | 'plain' }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((x) => (
        <span key={x} className={tag(tone)}>
          {x}
        </span>
      ))}
    </div>
  )
}

function Heading({ children }: { children: string }) {
  return <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{children}</h4>
}

function Lines({ lines }: { lines: Fe16TeaLine[] }) {
  return (
    <ol className="space-y-2">
      {lines.map((l) => (
        <li key={l.text} className="space-y-1 rounded-md border border-neutral-800 bg-neutral-950/50 p-2.5">
          <p className="text-sm text-neutral-200">“{l.text}”</p>
          <Tags items={l.right} tone="good" />
        </li>
      ))}
    </ol>
  )
}

// Constance's two sets of lines: her bold self's and her gloomy self's.
const SETS = ['In the sun (her bold self)', 'In the shade (her gloomy self)']

export function Fe16Affection({ data }: { data: Fe16Data }) {
  const { units: army, picks } = useArmy(data)
  const units = army.filter((u) => data.affection[u.id])
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const unit = units.find((u) => u.id === unitId) ?? units[0]
  useScreenshotUnit(unit)
  if (!unit) return null
  const a = data.affection[unit.id]
  const sets = [...new Set(a.lines.map((l) => l.set ?? 0))]
  const likes = [...a.likes, ...(a.flower ? [a.flower] : []), ...data.tea.likedByAll.map((x) => `${x} (everyone)`)]
  return (
    <div className="space-y-4">
      <UnitSelect units={units} picks={picks} value={unit.id} onChange={setUnitId} />
      <div className="space-y-5 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex items-center gap-3">
          <UnitPortrait data={data} unit={unit} size={48} />
          <span className="text-lg font-semibold text-neutral-100">{labelOf(unit)}</span>
        </div>

        <section className="space-y-3">
          <Heading>Tea time</Heading>
          <div className="space-y-1">
            <p className="text-sm text-neutral-400">Favorite teas</p>
            <Tags items={a.teas} tone="good" />
          </div>
          <div className="space-y-1">
            <p className="text-sm text-neutral-400">
              Topics they like ({a.topics.length} of {data.tea.topics.length}, and their own)
            </p>
            <Tags items={[a.personalTopic]} tone="good" />
            <Tags items={a.topics} tone="plain" />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-neutral-400">The final lines, and the reactions right for each</p>
            {sets.map((set) => (
              <div key={set} className="space-y-1.5">
                {sets.length > 1 && <p className="text-xs font-medium text-neutral-300">{SETS[set]}</p>}
                <Lines lines={a.lines.filter((l) => (l.set ?? 0) === set)} />
              </div>
            ))}
            {sets.length > 1 && <p className="text-xs text-neutral-500">Which set a tea party draws on isn't traced.</p>}
          </div>
        </section>

        <section className="space-y-3">
          <Heading>Gifts</Heading>
          <div className="space-y-1">
            <p className="text-sm text-neutral-400">Liked</p>
            <Tags items={likes} tone="good" />
            {a.flower && <p className="text-xs text-neutral-500">{a.flower} is the flower they like.</p>}
          </div>
          {a.dislikes.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm text-neutral-400">Disliked</p>
              <Tags items={a.dislikes} tone="bad" />
            </div>
          )}
        </section>

        <section className="space-y-2">
          <Heading>Lost items</Heading>
          <ul className="space-y-1.5">
            {a.lostItems.map((x) => (
              <li key={x.name} className="text-sm">
                <span className="text-neutral-100">{x.name}</span>
                <span className="block text-xs text-neutral-500">{x.clue}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="space-y-1 text-xs text-neutral-500">
        <p>
          A topic they like makes the conversation lively and counts toward how the tea party goes; any other gets “They don't seem very
          interested” (0x238650, fixed_lobby_common.bin section 13). Each final line has its own right reactions, from Nod, Laugh, Commend,
          Disagree, Admonish, Sigh, Chat, Sip tea, Blush and Praise (section 11).
        </p>
        <p>
          A liked gift, their flower or the Owl Feather (liked by everyone) draws their pleased reply; a disliked one their displeased one;
          any other the plain one (0x209a30, fixed_presentdata.bin section 1). A lost item is theirs to return.
        </p>
      </div>
    </div>
  )
}
