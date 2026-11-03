import { useEffect, useRef, useState } from 'react'
import { fileToDataUrl, putAllAssetEntries } from '../data/assetStorage'
import { GAMES } from '../games'
import { expandZips, type MatchedFile } from '../logic/bulkAssetImport'
import { useEditSessionStore } from '../state/editSessionStore'

interface GameResult {
  id: string
  title: string
  matched: MatchedFile[]
  unmatched: number
  /** Files the game's folder can hold that weren't in the upload. */
  missing: number
  expected: number
}

interface Sorted {
  games: GameResult[]
  /** Files outside any game's folder. */
  loose: string[]
}

const pathOf = (f: File) => ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name).replace(/\\/g, '/').toLowerCase().split('/')

/** Each file goes to the game whose id names a folder on its path ("art/fe9/ike.png" is Path of Radiance's), so the same name in
 * two games (Ike, Marth) can't land in the wrong one; each game's own matcher then reads its folder. */
async function sortFiles(files: File[]): Promise<Sorted> {
  const ids = new Set(GAMES.map((g) => g.id))
  const byGame = new Map<string, { file: File; rel: string }[]>()
  const loose: string[] = []
  for (const file of files) {
    const parts = pathOf(file)
    const at = parts.findIndex((p) => ids.has(p))
    if (at === -1 || at === parts.length - 1) {
      if (!/^\.|thumbs\.db$|desktop\.ini$/.test(parts[parts.length - 1])) loose.push(parts.join('/'))
      continue
    }
    const list = byGame.get(parts[at]) ?? []
    list.push({ file, rel: parts.slice(at + 1).join('/') })
    byGame.set(parts[at], list)
  }
  const games: GameResult[] = []
  for (const game of GAMES) {
    const list = byGame.get(game.id)
    if (!list) continue
    const { art } = await game.load()
    const result = art.match(list.map((f) => f.file))
    const present = new Set(list.map((f) => f.rel))
    games.push({
      id: game.id,
      title: game.title,
      matched: result.matched,
      unmatched: result.unmatched.length,
      missing: art.expected.filter((p) => !present.has(p.toLowerCase())).length,
      expected: art.expected.length,
    })
  }
  return { games, loose }
}

/** How many images go to storage in one transaction: few enough that a phone isn't holding hundreds of images at once. */
const BATCH = 40

/** The home screen's Bulk Upload: every game's art in one folder or .zip, a folder per game named by its id. */
export function AllGamesBulkUpload({ onClose }: { onClose: () => void }) {
  const [sorted, setSorted] = useState<Sorted | null>(null)
  const [status, setStatus] = useState<'idle' | 'reading' | 'failed' | 'uploading' | 'done'>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const bumpAssetEpoch = useEditSessionStore((state) => state.bumpAssetEpoch)
  const folderRef = useRef<HTMLInputElement>(null)
  const zipRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    folderRef.current?.setAttribute('webkitdirectory', '')
  }, [])

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (picked.length === 0) return
    setStatus('reading')
    setSorted(null)
    try {
      setSorted(await sortFiles(await expandZips(picked)))
      setStatus('idle')
    } catch {
      setStatus('failed')
    }
  }

  async function handleUpload() {
    const matched = sorted?.games.flatMap((g) => g.matched) ?? []
    if (matched.length === 0) return
    setStatus('uploading')
    setProgress({ done: 0, total: matched.length })
    for (let i = 0; i < matched.length; i += BATCH) {
      const batch = matched.slice(i, i + BATCH)
      const entries: Record<string, string> = {}
      for (const { file, key } of batch) entries[key] = await fileToDataUrl(file)
      await putAllAssetEntries(entries)
      setProgress({ done: i + batch.length, total: matched.length })
    }
    bumpAssetEpoch()
    setStatus('done')
  }

  const total = sorted?.games.reduce((n, g) => n + g.matched.length, 0) ?? 0
  const button = 'rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-40'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[85vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-100">Bulk Upload: every game</h3>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-neutral-400 hover:text-neutral-200">
            ✕
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Pick one folder, or a .zip of it, holding a folder for each game named by the game's id (listed on the home screen):
          fates, fe9, fe10 and so on. Inside each, the files are laid out as that game's own Bulk Upload takes them. A name two games
          share, like Ike or Marth, goes to the game whose folder it's in. Everything is stored on this device only.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => folderRef.current?.click()} disabled={status === 'reading' || status === 'uploading'} className={button}>
            Pick a folder
          </button>
          <button type="button" onClick={() => zipRef.current?.click()} disabled={status === 'reading' || status === 'uploading'} className={button}>
            Pick a .zip
          </button>
          <input ref={folderRef} type="file" multiple onChange={handleFiles} className="hidden" />
          <input ref={zipRef} type="file" onChange={handleFiles} className="hidden" />
        </div>
        {status === 'reading' && <p className="text-xs text-neutral-400">Reading…</p>}
        {status === 'failed' && <p className="text-xs text-red-400">That couldn't be read. Is it a folder of images, or a .zip of one?</p>}
        {sorted && (
          <div className="space-y-2 text-xs">
            {sorted.games.length === 0 && <p className="text-amber-400">No game folders found (fates, fe9, fe10…).</p>}
            <ul className="space-y-1">
              {sorted.games.map((g) => (
                <li key={g.id} className="flex flex-wrap justify-between gap-x-3 border-b border-neutral-800 pb-1">
                  <span className="text-neutral-200">{g.title}</span>
                  <span className="text-neutral-400">
                    <span className="text-emerald-400">{g.matched.length} matched</span>
                    {g.missing > 0 && <span className="text-amber-400"> · {g.missing} of {g.expected} not in it</span>}
                    {g.unmatched > 0 && <span className="text-amber-400"> · {g.unmatched} not recognised</span>}
                  </span>
                </li>
              ))}
            </ul>
            {sorted.loose.length > 0 && (
              <p className="text-amber-400">
                {sorted.loose.length} file{sorted.loose.length === 1 ? ' is' : 's are'} outside any game's folder and will be skipped.
              </p>
            )}
            {total > 0 && status !== 'done' && (
              <button
                type="button"
                onClick={handleUpload}
                disabled={status === 'uploading'}
                className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {status === 'uploading' ? `Uploading ${progress.done}/${progress.total}…` : `Upload ${total} images`}
              </button>
            )}
          </div>
        )}
        {status === 'done' && <p className="text-xs text-emerald-400">Done: every game shows its art now, no reload needed.</p>}
      </div>
    </div>
  )
}
