import type { ReactNode } from 'react'

// The Spells tab of the games where spells are a unit's own, learned rather than carried (Gaiden, Shadows of Valentia, Three Houses;
// user, 2026-11-06: "more abilities than items", so they're here and not in the Armory's weapons). A unit is picked; every spell they
// can get is listed by the way they get it, each with its numbers four to a line (as the stat tables are) and what it does. Each game
// builds its sections from its own data.

/** A spell's numbers and words, as a game gives them. */
export interface SpellCard {
  /** Black magic, white magic, Reason... */
  kind?: string
  /** Short numbers, four to a line: Mt, Hit, Crit, Rng, HP or Uses. */
  numbers: { label: string; value: ReactNode }[]
  /** A range too long for the grid ("1 to a range from Mag"). */
  range?: string
  /** The game's help text, or what the spell does. */
  text?: string
  /** Rules the help text doesn't give (effective against, follow-ups). */
  notes?: string[]
}

/** One spell a unit gets, and how. */
export interface SpellWay {
  spell: string
  how: string
}

/** A group of a unit's spells: the class list or skill they come from. */
export interface SpellSection {
  title: string
  note?: ReactNode
  ways: SpellWay[]
}

export function SpellBook({
  picker,
  header,
  sections,
  cardOf,
  rules,
}: {
  picker: ReactNode
  /** The unit's portrait and name. */
  header: ReactNode
  sections: SpellSection[]
  cardOf: (spell: string) => SpellCard | undefined
  /** How spells are learned and counted, in the game's terms. */
  rules?: ReactNode
}) {
  return (
    <div className="space-y-4">
      {picker}
      <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        {header}
        {sections.length === 0 && <p className="text-sm text-neutral-500">No spells.</p>}
        {sections.map((s) => (
          <section key={s.title} className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{s.title}</h4>
            {s.note && <p className="text-xs text-neutral-500">{s.note}</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {s.ways.map((w, i) => (
                <SpellCardView key={`${w.spell}-${i}`} name={w.spell} how={w.how} card={cardOf(w.spell)} />
              ))}
            </div>
          </section>
        ))}
      </div>
      {rules && <div className="space-y-1 text-xs text-neutral-500">{rules}</div>}
    </div>
  )
}

function SpellCardView({ name, how, card }: { name: string; how: string; card?: SpellCard }) {
  return (
    <div className="space-y-1.5 rounded-md border border-neutral-800 bg-neutral-950/50 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="font-medium text-neutral-100">{name}</span>
        <span className="text-xs text-violet-300">{how}</span>
      </div>
      {card?.kind && <div className="text-xs text-neutral-500">{card.kind}</div>}
      {card && card.numbers.length > 0 && (
        <div className="grid max-w-md grid-cols-4 gap-x-3 gap-y-1 text-sm">
          {card.numbers.map((n) => (
            <div key={n.label} className="flex justify-between gap-1">
              <span className="text-neutral-500">{n.label}</span>
              <span className="text-right tabular-nums text-neutral-100">{n.value}</span>
            </div>
          ))}
        </div>
      )}
      {card?.range && (
        <p className="text-sm">
          <span className="text-neutral-500">Rng </span>
          <span className="text-neutral-100">{card.range}</span>
        </p>
      )}
      {card?.text && <p className="text-xs text-neutral-400">{card.text}</p>}
      {card?.notes?.map((n) => (
        <p key={n} className="text-xs text-neutral-400">
          {n}
        </p>
      ))}
    </div>
  )
}
