import type { TelliusBioCurve, TelliusBioState, TelliusData, TelliusUnit } from './types'

// The biorhythm, in the Roster where Fates shows a personal skill (user, 2026-11-05): the unit's wave with a point for each step it
// moves (Radiant Dawn: each turn; Path of Radiance: each of its 30 points), coloured by state, and what each state adds or takes at
// those points; Path of Radiance's with a note on Tempest and Serenity, not the chapters. Read from the game's code
// (scripts/tellius_biorhythm.py).

const STATE_COLOR: Record<TelliusBioState, string> = {
  Best: '#34d399',
  Good: '#a3e635',
  Normal: '#a3a3a3',
  Bad: '#fb923c',
  Worst: '#f87171',
}
const BANDS: { state: TelliusBioState; from: number; to: number }[] = [
  { state: 'Best', from: 0.8, to: Infinity },
  { state: 'Good', from: 0.4, to: 0.8 },
  { state: 'Normal', from: -0.4, to: 0.4 },
  { state: 'Bad', from: -0.8, to: -0.4 },
  { state: 'Worst', from: -Infinity, to: -0.8 },
]
const EFFECT_LABELS = { hit: 'Hit', avoid: 'Avoid', crit: 'Crit', skill: 'skill activation', treasure: 'buried treasure chance' } as const

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

/** "3–5, 16–17" from [3, 4, 5, 16, 17]. */
function runs(nums: number[]): string {
  const out: string[] = []
  for (let i = 0; i < nums.length; i++) {
    let j = i
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++
    out.push(j > i ? `${nums[i]}–${nums[j]}` : String(nums[i]))
    i = j
  }
  return out.join(', ')
}

function Chart({ curve, top, axis }: { curve: TelliusBioCurve; top: number; axis: string }) {
  const W = 320
  const H = 150
  const left = 40
  const right = 8
  const pad = 10
  const n = curve.points.length
  const x = (i: number) => left + (i * (W - left - right)) / (n - 1)
  const y = (v: number) => pad + ((top - v) * (H - 2 * pad - 14)) / (2 * top)
  const value = (i: number) => curve.amplitude * Math.sin((2 * Math.PI * curve.frequency * i) / curve.period) + curve.offset
  const line = Array.from({ length: (n - 1) * 8 + 1 }, (_, k) => {
    const i = k / 8
    return `${k ? 'L' : 'M'}${x(i).toFixed(1)} ${y(value(i)).toFixed(1)}`
  }).join(' ')
  const ticks = [...new Set([0, ...Array.from({ length: Math.floor(n / 5) }, (_, k) => (k + 1) * 5 - 1), n - 1])]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full max-w-md" role="img" aria-label="Biorhythm curve">
      {BANDS.map((b) => {
        const y1 = y(Math.min(top, b.to))
        const y2 = y(Math.max(-top, b.from))
        if (y2 <= y1) return null
        return (
          <g key={b.state}>
            <rect x={left} y={y1} width={W - left - right} height={y2 - y1} fill={STATE_COLOR[b.state]} opacity={0.1} />
            <text x={left - 4} y={(y1 + y2) / 2 + 3} textAnchor="end" fontSize={9} fill={STATE_COLOR[b.state]}>
              {b.state}
            </text>
          </g>
        )
      })}
      <path d={line} fill="none" stroke="#d4d4d4" strokeWidth={1.5} />
      {curve.points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={3} fill={STATE_COLOR[p.state]} stroke="#171717" strokeWidth={1}>
          <title>{`${axis} ${i + 1}: ${p.state} (${p.value >= 0 ? '+' : ''}${p.value.toFixed(2)})`}</title>
        </circle>
      ))}
      {ticks.map((i) => (
        <text key={i} x={x(i)} y={H - 3} textAnchor="middle" fontSize={9} fill="#737373">
          {i + 1}
        </text>
      ))}
    </svg>
  )
}

export function Biorhythm({ data, unit }: { data: TelliusData; unit: TelliusUnit }) {
  const bio = data.biorhythm
  const curve = bio && unit.biorhythm ? bio.curves[unit.biorhythm.curve] : undefined
  if (!bio || !curve || !unit.biorhythm) return null
  // The highest any wave of the game reaches, so every unit's chart has the same scale.
  const top = Math.max(1, ...Object.values(bio.curves).map((c) => Math.abs(c.amplitude) + Math.abs(c.offset))) * 1.1
  const byChapter = bio.moves === 'chapter'
  const effectText = (e: (typeof bio.effects)[number], scale = (v: number) => v) =>
    (Object.keys(EFFECT_LABELS) as (keyof typeof EFFECT_LABELS)[])
      .filter((k) => e[k])
      .map((k) => `${EFFECT_LABELS[k]} ${signed(scale(e[k]!))}`)
      .join(', ') || 'nothing'
  const when = (state: TelliusBioState) => {
    const steps = curve.points.flatMap((p, i) => (p.state === state ? [i + 1] : []))
    return steps.length ? `${byChapter ? 'Points' : 'Turns'} ${runs(steps)}` : ''
  }
  // Path of Radiance: Tempest doubles every effect, then Serenity halves it toward zero (0x80165fbc, 0x8016600c).
  const best = bio.effects.find((e) => e.state === 'Best')
  const tempestNote =
    byChapter && best
      ? ` Tempest doubles every effect (±${(best.hit ?? 0) * 2}) and Serenity halves it, dropping the half (±${Math.trunc((best.hit ?? 0) / 2)}); with both, it stays at ±${best.hit ?? 0} (0x80165fbc, 0x8016600c). Either counts only while the unit has it.`
      : ''
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-neutral-200">Biorhythm</h4>
      <Chart curve={curve} top={top} axis={byChapter ? 'Point' : 'Turn'} />
      <ul className="space-y-1 text-sm">
        {bio.effects.map((e) => {
          const at = when(e.state)
          if (!at && !curve.points.some((p) => p.state === e.state)) return null
          return (
            <li key={e.state} className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATE_COLOR[e.state] }} />
              <span>
                <span className="font-medium text-neutral-100">{e.state}</span>
                <span className="text-neutral-300">: {effectText(e)}</span>
                {at && <span className="block text-xs text-neutral-500">{at}</span>}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-neutral-500">
        {byChapter
          ? `The wave moves ${bio.perChapter} points each chapter, for every unit whether deployed or not, and 1 more for every ${bio.battlesPerPoint} battles the unit fights; the map's turns don't move it (0x801660c4).${tempestNote}`
          : "Turn 1 is their first turn on the map. Each of their army's phases moves them a turn on, and the count carries into the next chapter (it's saved with them), so the wave repeats every 25 turns of theirs. Matrona and the herons' Bliss move them to the wave's peak, Sorrow to its trough (0x801072e4)."}
      </p>
    </div>
  )
}
