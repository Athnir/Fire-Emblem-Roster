import type { Fe4Blood, Fe4BloodLevel } from './types'

// The holy blood window (user, 2026-11-05): a round window with a slot for each of the 13 lines, always in the same spot. A line the
// unit has fills in: its whole glass for major blood, a ring of its colour for minor. Each slot shows an icon for the kind of weapon
// the line's holy weapon is (a lightning bolt, a longsword), not the holy weapon itself, and the colours go by element.
//
// The window drawn here is a stand-in until the user's own artwork arrives (they don't want a generated image shipped). Then
// `BASIS` points at it and `SLOTS` at its blanks, and the fills and icons land in them.

/** Where each line's slot is, as fractions of the window's width (x, y: the centre; r: the radius). */
export interface BloodSlot {
  x: number
  y: number
  r: number
}

/** The artwork the slots sit on, once there is one (an image under public/); undefined draws the stand-in. */
const BASIS: string | undefined = undefined

/** The stand-in's slots: the 13 lines around the ring in the game's own order (Baldr at the top), clockwise. */
function ringSlots(count: number): BloodSlot[] {
  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / count
    return { x: 0.5 + 0.36 * Math.cos(a), y: 0.5 + 0.36 * Math.sin(a), r: 0.072 }
  })
}

type Icon = 'longsword' | 'curved' | 'wavy' | 'spear' | 'trident' | 'axe' | 'bow' | 'flame' | 'bolt' | 'wind' | 'sun' | 'staff' | 'crescent'

/** Each line's colour (by element: fire red, thunder yellow, wind green, light gold, dark purple, staff white; the sword, lance, axe
 * and bow lines a colour each) and its weapon's icon, by the blood's id. */
export const BLOOD_LOOK: Record<string, { color: string; icon: Icon }> = {
  Baldr: { color: '#2f6fe4', icon: 'longsword' }, // Tyrfing
  Naga: { color: '#f2b705', icon: 'sun' }, // Naga, light
  Dáinn: { color: '#c0265e', icon: 'spear' }, // Gungnir
  Njörun: { color: '#0f9488', icon: 'trident' }, // Gáe Bolg
  Od: { color: '#2bc4e8', icon: 'curved' }, // Balmung
  Ullr: { color: '#7cb518', icon: 'bow' }, // Yewfelle
  Neir: { color: '#c06a12', icon: 'axe' }, // Helswath
  Fjalar: { color: '#dc2626', icon: 'flame' }, // Valflame, fire
  Thrud: { color: '#fde047', icon: 'bolt' }, // Mjölnir, thunder
  Forseti: { color: '#22c55e', icon: 'wind' }, // Forseti, wind
  Bragi: { color: '#e7e5e4', icon: 'staff' }, // Valkyrie Staff
  Hezul: { color: '#8b9bb4', icon: 'wavy' }, // Mystletainn
  Loptous: { color: '#8b2fc9', icon: 'crescent' }, // Loptous, dark
}

/** The icons, drawn in a 24-unit square: what's filled, and what's a line. */
const ICONS: Record<Icon, { fill?: string; line?: string }> = {
  longsword: { fill: 'M12 1.5L13.6 4V15H10.4V4Z', line: 'M7 15.5H17M12 16V20.5M12 21.2h0' },
  curved: { fill: 'M7 18.5C9 10.5 13.5 5.5 20 2.5C17 7 13 12.5 8.8 19.6Z', line: 'M5.2 16.4L10 20.6M7.4 19.4L4 22.4' },
  wavy: { fill: 'M12 1.5L13.7 4L12.9 6L13.7 8L12.9 10L13.7 12V15H10.3V12L11.1 10L10.3 8L11.1 6L10.3 4Z', line: 'M7 15.5H17M12 16V21' },
  spear: { fill: 'M21.5 2.5L15.2 5.4L18.6 8.8Z', line: 'M4 20L17 7M14.4 7.2L16.8 9.6' },
  trident: { line: 'M4 20L16 8M13.5 5.5L18.5 10.5M13.5 5.5L16 3M16 8L19.5 4.5M18.5 10.5L21 8' },
  axe: { fill: 'M12 6C7 4 3.8 7 3.8 11C3.8 14.5 7 15.5 12 13.5ZM12 6C17 4 20.2 7 20.2 11C20.2 14.5 17 15.5 12 13.5Z', line: 'M12 3.5V22' },
  bow: { line: 'M7.5 2C16.5 6 16.5 18 7.5 22M7.5 2V22M3 12H20.5M20.5 12L17.5 9.8M20.5 12L17.5 14.2' },
  flame: { fill: 'M12 2C14 6 18 8 18 14C18 18.5 15.3 21.5 12 21.5C8.7 21.5 6 18.5 6 14.5C6 11 8 9.5 9 7C10 9 10.5 10 11.5 10.5C11.5 7 11 4.5 12 2Z' },
  bolt: { fill: 'M14 1.5L5 13.5H11L9.5 22.5L19 9.5H13Z' },
  wind: { line: 'M3 9H14A3 3 0 1 0 11 6M3 13.5H18A3 3 0 1 1 15 16.5M3 18H10' },
  sun: {
    fill: 'M12 8A4 4 0 1 1 11.99 8Z',
    line: 'M12 1.5V4.5M12 19.5V22.5M1.5 12H4.5M19.5 12H22.5M4.6 4.6L6.7 6.7M17.3 17.3L19.4 19.4M4.6 19.4L6.7 17.3M17.3 6.7L19.4 4.6',
  },
  staff: { line: 'M12 8.5V22.5M12 2.5A3 3 0 1 1 11.99 2.5M9 5.5C6.5 3.5 4 4 2.5 6.5C5 6.5 7 7.5 9 8M15 5.5C17.5 3.5 20 4 21.5 6.5C19 6.5 17 7.5 15 8' },
  crescent: { fill: 'M15 2.5A9.5 9.5 0 1 0 21.5 15.5A7.5 7.5 0 1 1 15 2.5Z' },
}

export const WINDOW_NOTE = "A full glass is major blood, a ring minor. Each line keeps its spot: Baldr at the top, then the game's order clockwise."

/** Dark ink on a light glass, white on a dark one. */
function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.6 ? '#1c1917' : '#fafaf9'
}

function GlyphAt({ icon, cx, cy, size, color }: { icon: Icon; cx: number; cy: number; size: number; color: string }) {
  const s = ICONS[icon]
  const k = size / 24
  return (
    <g transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${k})`}>
      {s.fill && <path d={s.fill} fill={color} />}
      {s.line && <path d={s.line} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
    </g>
  )
}

/** The stand-in window: a stone rim, dark glass, lead lines from the middle to each blank, and a plain rose in the middle. */
function StandIn({ slots, size }: { slots: BloodSlot[]; size: number }) {
  const c = size / 2
  return (
    <g>
      <circle cx={c} cy={c} r={size * 0.49} fill="#57524b" />
      <circle cx={c} cy={c} r={size * 0.465} fill="#2a1416" stroke="#1c1917" strokeWidth={3} />
      {slots.map((s, i) => (
        <line key={i} x1={c} y1={c} x2={s.x * size} y2={s.y * size} stroke="#1e3a8a" strokeWidth={size * 0.012} opacity={0.6} />
      ))}
      <circle cx={c} cy={c} r={size * 0.15} fill="#3b2a12" stroke="#1c1917" strokeWidth={3} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6
        return <circle key={i} cx={c + size * 0.1 * Math.cos(a)} cy={c + size * 0.1 * Math.sin(a)} r={size * 0.032} fill="#7a5a1c" stroke="#1c1917" strokeWidth={2} />
      })}
      <circle cx={c} cy={c} r={size * 0.06} fill="#8a6a24" stroke="#1c1917" strokeWidth={2} />
    </g>
  )
}

/** The window with the unit's holy blood filled in, and a line under it for each blood they have. `compact` is the smaller one in a
 * Pairings card (its note is on the page once); `sources` says which parents each line comes from. */
export function HolyBloodWindow({
  lines,
  blood,
  compact = false,
  sources,
}: {
  lines: Fe4Blood[]
  blood: Fe4BloodLevel[]
  compact?: boolean
  sources?: Record<string, string>
}) {
  const size = 400
  const slots = ringSlots(lines.length)
  const held = new Map(blood.map((b) => [b.blood, b.level]))
  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className={`block aspect-square w-full ${compact ? 'max-w-[200px]' : 'max-w-[320px]'}`}
        role="img"
        aria-label="Holy blood"
      >
        <defs>
          {lines.map((line) => {
            const color = BLOOD_LOOK[line.id]?.color ?? '#a8a29e'
            return (
              <radialGradient key={line.id} id={`glass-${line.id}`} cx="38%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
                <stop offset="25%" stopColor={color} />
                <stop offset="100%" stopColor={color} stopOpacity={0.75} />
              </radialGradient>
            )
          })}
        </defs>
        {BASIS ? <image href={BASIS} x={0} y={0} width={size} height={size} /> : <StandIn slots={slots} size={size} />}
        {lines.map((line, i) => {
          const slot = slots[i]
          const look = BLOOD_LOOK[line.id] ?? { color: '#a8a29e', icon: 'sun' as Icon }
          const level = held.get(line.id)
          const cx = slot.x * size
          const cy = slot.y * size
          const r = slot.r * size
          return (
            <g key={line.id}>
              <title>{`${line.name}${level ? ` (${level})` : ''}: ${line.weapon}`}</title>
              {/* A blank's dark glass (the stand-in's; the artwork has its own). */}
              {!BASIS && <circle cx={cx} cy={cy} r={r} fill="#1c1917" stroke="#0c0a09" strokeWidth={3} />}
              {level === 'major' && <circle cx={cx} cy={cy} r={r} fill={`url(#glass-${line.id})`} stroke="#0c0a09" strokeWidth={3} />}
              {level === 'minor' && <circle cx={cx} cy={cy} r={r * 0.86} fill="none" stroke={look.color} strokeWidth={r * 0.24} />}
              <GlyphAt
                icon={look.icon}
                cx={cx}
                cy={cy}
                size={r * 1.15}
                color={level === 'major' ? inkOn(look.color) : level === 'minor' ? look.color : '#57534e'}
              />
            </g>
          )
        })}
      </svg>
      <ul className={`space-y-0.5 text-neutral-300 ${compact ? 'text-xs' : 'text-sm'}`}>
        {blood.map((b) => {
          const line = lines.find((l) => l.id === b.blood)
          const color = BLOOD_LOOK[b.blood]?.color ?? '#a8a29e'
          return (
            <li key={b.blood} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={b.level === 'major' ? { backgroundColor: color } : { boxShadow: `inset 0 0 0 2px ${color}` }}
              />
              <span>
                <span className="text-neutral-100">{line?.name ?? b.blood}</span> ({b.level})
                {line && (
                  <span className="text-neutral-500">
                    {b.level === 'major' ? `: can wield ${line.weapon}` : `: ${line.weapon}'s line`}
                  </span>
                )}
                {sources?.[b.blood] && <span className="block text-neutral-500">from {sources[b.blood]}</span>}
              </span>
            </li>
          )
        })}
      </ul>
      {!compact && <p className="text-xs text-neutral-500">{WINDOW_NOTE}</p>}
    </div>
  )
}
