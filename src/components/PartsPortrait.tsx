import { useEffect, useRef, useState, type ReactNode } from 'react'
import { assetKeys, getAsset } from '../data/assetStorage'
import { loadImage } from '../logic/portraitColorize'
import { useEditSessionStore } from '../state/editSessionStore'

/** One part of a portrait: the id it's uploaded under (Bulk Upload, kept as a portrait asset) and the static public/art/ file behind it. */
export interface PortraitPart {
  id: string
  url: string
}

/** The image with every colour turned round the colour wheel by `degrees`, keeping each colour's brightness and greyness (its highest
 * and lowest channel), as the game turns a palette's hue. */
function turned(img: HTMLImageElement, degrees: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = data.data
  const turn = (((degrees % 360) + 360) % 360) / 60
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue
    const r = px[i]
    const g = px[i + 1]
    const b = px[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const chroma = max - min
    // A grey has no hue to turn.
    if (!chroma) continue
    const hue = (max === r ? ((g - b) / chroma + 6) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4) + turn
    const h = hue % 6
    const x = chroma * (1 - Math.abs((h % 2) - 1))
    const [r1, g1, b1] = h < 1 ? [chroma, x, 0] : h < 2 ? [x, chroma, 0] : h < 3 ? [0, chroma, x] : h < 4 ? [0, x, chroma] : h < 5 ? [x, 0, chroma] : [chroma, 0, x]
    px[i] = Math.round(r1 + min)
    px[i + 1] = Math.round(g1 + min)
    px[i + 2] = Math.round(b1 + min)
  }
  ctx.putImageData(data, 0, 0)
  return canvas
}

/** A portrait the game builds from parts, drawn in order (New Mystery's Kris: the body in its outfit, the eyes, the hair). `hue` turns one
 * part's colours by that many degrees, as the game turns the hair's palette (arm9 0x200d494). Until every part is supplied, `fallback`
 * shows instead. */
export function PartsPortrait({
  parts,
  hue,
  size = 96,
  fallback,
}: {
  parts: PortraitPart[]
  hue?: { part: number; degrees: number }
  size?: number
  fallback: ReactNode
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading')
  const assetEpoch = useEditSessionStore((state) => state.assetEpoch)
  const key = JSON.stringify(parts)
  const huePart = hue?.part
  const hueDegrees = hue?.degrees ?? 0
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    const list = JSON.parse(key) as PortraitPart[]
    Promise.all(list.map(async (p) => loadImage((await getAsset(assetKeys.portrait(p.id))) ?? p.url)))
      .then((images) => {
        const canvas = canvasRef.current
        if (cancelled || !canvas) return
        canvas.width = images[0].width
        canvas.height = images[0].height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        images.forEach((img, i) => ctx.drawImage(i === huePart && hueDegrees % 360 ? turned(img, hueDegrees) : img, 0, 0))
        setStatus('ok')
      })
      .catch(() => !cancelled && setStatus('missing'))
    return () => {
      cancelled = true
    }
  }, [key, huePart, hueDegrees, assetEpoch])
  if (status === 'missing') return <>{fallback}</>
  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900"
      style={{ width: size, height: size }}
    >
      <canvas ref={canvasRef} className="h-full w-full object-contain" style={{ display: status === 'ok' ? undefined : 'none' }} />
    </div>
  )
}
