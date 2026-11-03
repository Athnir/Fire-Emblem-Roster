/** A chapter of the story as the spoiler block walks it. */
export interface BarStep {
  id: string
  label: string
}

/** A split waiting after the last chapter walked so far: the bar asks for it once you're there. */
export interface BarSplit {
  question: string
  choices: { id: string; label: string; proceed: string }[]
  onPick: (id: string) => void
}

const button = 'rounded border px-3 py-1 text-sm disabled:cursor-default disabled:opacity-40'
const proceedClass = `${button} border-emerald-600 bg-emerald-900/60 text-emerald-100 hover:bg-emerald-800/60`

/**
 * The spoiler block's bar for one game (as the Armory's): the chapter you're on, back and on, a jump, and at a split the routes to
 * go on with. `steps` is the story walked so far: up to a split not picked yet, or to the end of the routes picked.
 */
export function ChapterBar({
  steps,
  at,
  onChange,
  split,
  picked,
}: {
  steps: BarStep[]
  at: number
  onChange: (index: number) => void
  split?: BarSplit
  /** The routes picked so far, shown after the chapter. */
  picked?: string
}) {
  const here = steps[at]
  const next = steps[at + 1]
  const choosing = !!split && !next
  return (
    <section aria-label="Spoiler block" className="space-y-2 rounded border border-emerald-900 bg-emerald-950/30 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-neutral-200">
          <span className="text-neutral-400">Opened up to </span>
          <strong className="text-neutral-100">{here?.label ?? 'the start'}</strong>
          {picked && <span className="text-neutral-500"> · {picked}</span>}
        </p>
        <button
          type="button"
          onClick={() => onChange(at - 1)}
          disabled={at <= 0}
          className={`${button} border-neutral-700 text-neutral-300 hover:bg-neutral-800`}
        >
          ‹ Back
        </button>
        {choosing ? (
          split.choices.map((c) => (
            <button key={c.id} type="button" onClick={() => split.onPick(c.id)} className={proceedClass}>
              {c.proceed} ›
            </button>
          ))
        ) : (
          <button type="button" onClick={() => onChange(at + 1)} disabled={!next} className={proceedClass}>
            {next ? `Proceed to ${next.label} ›` : 'End of the story'}
          </button>
        )}
        <select
          value={at}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Jump to a chapter"
          className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200"
        >
          {steps.map((s, i) => (
            <option key={`${s.id}-${i}`} value={i}>
              {i === at ? `Jump to… (now ${s.label})` : s.label}
            </option>
          ))}
        </select>
      </div>
      {choosing && <p className="text-neutral-400">{split.question}</p>}
    </section>
  )
}
