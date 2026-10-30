import { useEffect, useRef, useState } from 'react'
import { BackupControls } from './components/BackupControls'
import { EditModeToggle } from './components/EditModeToggle'
import { ExportImageButton } from './components/ExportImageButton'
import { IosInstallBanner } from './components/IosInstallBanner'
import { LocalDataWarningBanner } from './components/LocalDataWarningBanner'
import { GAMES, type GameParts } from './games'
import { usePlannerStore } from './state/plannerStore'

/** The picked game, kept on the device. Under the 'fe-roster-' prefix so it's in the backup. */
const GAME_KEY = 'fe-roster-game'

function storedGameId(): string {
  try {
    const id = localStorage.getItem(GAME_KEY)
    if (id && GAMES.some((g) => g.id === id)) return id
  } catch {
    // Storage can be off (private windows); the first game is the default.
  }
  return GAMES[0].id
}

function App() {
  const [gameId, setGameId] = useState(storedGameId)
  const [parts, setParts] = useState<{ id: string; parts: GameParts } | null>(null)
  const [tabId, setTabId] = useState('roster')
  const editModeEnabled = usePlannerStore((state) => state.editModeEnabled)
  const mainRef = useRef<HTMLElement>(null)
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false)
  const game = GAMES.find((g) => g.id === gameId) ?? GAMES[0]

  useEffect(() => {
    // Best-effort request not to have this site's storage evicted under disk pressure — Chrome
    // honors this fairly reliably for an installed PWA, Safari's support is weaker/inconsistent,
    // but it's a no-op cost either way (see BackupControls for the platform-independent fallback).
    if (navigator.storage?.persist) void navigator.storage.persist()
  }, [])

  useEffect(() => {
    let cancelled = false
    game.load().then((loaded) => {
      if (!cancelled) setParts({ id: game.id, parts: loaded })
    })
    return () => {
      cancelled = true
    }
  }, [game])

  function pickGame(id: string) {
    setGameId(id)
    try {
      localStorage.setItem(GAME_KEY, id)
    } catch {
      // Not kept; still switches for this visit.
    }
  }

  const current = parts?.id === game.id ? parts.parts : undefined
  const tab = current?.tabs.find((t) => t.id === tabId) ?? current?.tabs[0]
  const Background = current?.background
  const Banner = current?.banner
  const BulkUpload = current?.bulkUpload
  const ExportButton = current?.exportButton
  const TabComponent = tab?.component

  return (
    <div
      className={`isolate min-h-screen text-neutral-100 ${
        editModeEnabled ? 'ring-4 ring-inset ring-amber-500' : ''
      }`}
    >
      {Background && <Background />}
      <LocalDataWarningBanner />
      <IosInstallBanner />
      <header className="border-b border-neutral-800/80 bg-neutral-950/90 px-6 py-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">Fire Emblem Roster</h1>
            <select
              value={game.id}
              onChange={(e) => pickGame(e.target.value)}
              aria-label="Game"
              className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm text-neutral-200"
            >
              {GAMES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tab &&
              (ExportButton ? (
                <ExportButton targetRef={mainRef} tabLabel={tab.label} />
              ) : (
                <ExportImageButton targetRef={mainRef} tabLabel={tab.label} context={game.short} />
              ))}
            <BackupControls />
            <EditModeToggle />
            {editModeEnabled && BulkUpload && (
              <button
                type="button"
                onClick={() => setBulkUploadOpen(true)}
                className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-300 hover:bg-neutral-700"
              >
                Bulk Upload
              </button>
            )}
          </div>
        </div>
        <nav className="mt-3 flex flex-wrap gap-2">
          {current?.tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTabId(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                t.id === tab?.id ? 'bg-violet-600 text-white' : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        {editModeEnabled && (
          <p className="mt-2 text-xs text-amber-400">
            Edit Mode is on — click any skill icon to upload your own image.
          </p>
        )}
      </header>

      {Banner && <Banner />}

      {bulkUploadOpen && BulkUpload && <BulkUpload onClose={() => setBulkUploadOpen(false)} />}

      <main ref={mainRef} className="p-6">
        {TabComponent ? <TabComponent key={`${game.id}-${tab?.id}`} /> : <p className="text-sm text-neutral-500">Loading…</p>}
      </main>
    </div>
  )
}

export default App
