import { useState } from 'react'

type Status = 'idle' | 'checking' | 'latest' | 'updating' | 'offline' | 'unavailable'

const LABELS: Record<Status, string> = {
  idle: 'Check for update',
  checking: 'Checking…',
  latest: 'Up to date',
  updating: 'Updating…',
  offline: "Can't reach the site",
  unavailable: 'Reload for the latest',
}

/** When this build was made, shown on hover so it's clear which version is open. */
const BUILT = new Date(__BUILD_TIME__).toLocaleString()

/**
 * Asks the service worker to look for a newer deploy straight away, rather than waiting for the next time the app is
 * opened. The worker skips waiting (registerType 'autoUpdate'), so once a new one activates the page reloads into it.
 * Saved data lives in localStorage and IndexedDB, so the reload keeps it.
 */
export function UpdateButton() {
  const [status, setStatus] = useState<Status>('idle')

  function settle(next: Status) {
    setStatus(next)
    setTimeout(() => setStatus('idle'), 2500)
  }

  async function check() {
    setStatus('checking')
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    // No worker (the dev server, or a browser without them): a plain reload is the only way to the latest.
    if (!registration) return settle('unavailable')
    try {
      await registration.update()
    } catch {
      return settle('offline')
    }
    const worker = registration.installing ?? registration.waiting
    if (!worker) return settle('latest')
    setStatus('updating')
    const reload = () => window.location.reload()
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true })
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') reload()
    })
    worker.postMessage({ type: 'SKIP_WAITING' })
    // In case neither event comes (a worker stuck behind another tab), reload anyway.
    setTimeout(reload, 15000)
  }

  return (
    <button
      type="button"
      onClick={check}
      disabled={status === 'checking' || status === 'updating'}
      className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-300 hover:bg-neutral-700 disabled:opacity-70"
      title={`Look for a newer version of the app now. This one was built ${BUILT}.`}
    >
      {LABELS[status]}
    </button>
  )
}
