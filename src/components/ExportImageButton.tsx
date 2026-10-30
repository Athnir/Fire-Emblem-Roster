import { useState } from 'react'
import { useScreenshotContextStore } from '../state/screenshotContextStore'

/** Windows/macOS/Linux all forbid these in filenames — strip rather than fail the download. */
function sanitizeFilenamePart(part: string): string {
  return part.replace(/[<>:"/\\|?*]/g, '').trim()
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

/**
 * Auto-generated name: (group) (unit) (tab) (context) (timestamp) — e.g. Fates' "Conquest run #1 Hana
 * Skill Planner Conquest 2026-08-06_14-30-22.png", where the group is the active saved plan and the
 * context the route (see FatesExportButton). Empty pieces (no plan loaded, no unit selected) are
 * omitted rather than left as empty tokens.
 */
function buildFilename(group: string, unitLabel: string, tabLabel: string, context: string): string {
  const parts = [group, unitLabel, tabLabel, context]
    .map(sanitizeFilenamePart)
    .filter(Boolean)
  return `${parts.join(' ')} ${formatTimestamp(new Date())}.png`
}

/** Resolves once every stylesheet `<link>` in the document has actually applied (`.sheet` is only
 * null before that) and web fonts have finished loading — capturing before either is done is what
 * produces an "unstyled" screenshot (plain black-on-white native form controls, no card borders/
 * backgrounds), since html2canvas only ever renders whatever's already been computed. Polls rather
 * than trusting a fixed delay, but still gives up after a couple seconds so a genuinely stuck
 * stylesheet (offline, blocked request) can't hang the export forever. */
function waitForStylesReady(): Promise<void> {
  const deadline = Date.now() + 3000
  return new Promise((resolve) => {
    function check() {
      const linksLoaded = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).every(
        (link) => (link as HTMLLinkElement).sheet !== null,
      )
      if ((linksLoaded && document.fonts.status === 'loaded') || Date.now() > deadline) {
        resolve()
      } else {
        setTimeout(check, 50)
      }
    }
    check()
  })
}

/** Captures the given element as a PNG and triggers a download, matching the prototype's "Save full page as image" feature. */
export interface ExportImageButtonProps {
  targetRef: React.RefObject<HTMLElement | null>
  tabLabel: string
  /** Leads the file name (Fates: the active saved plan). */
  group?: string
  /** Follows the tab (Fates: the route; other games: the game). */
  context?: string
}

export function ExportImageButton({ targetRef, tabLabel, group = '', context = '' }: ExportImageButtonProps) {
  const [status, setStatus] = useState<'idle' | 'capturing' | 'done' | 'failed'>('idle')
  const unitLabel = useScreenshotContextStore((state) => state.unitLabel)

  async function handleClick() {
    const target = targetRef.current
    if (!target) return
    setStatus('capturing')
    await waitForStylesReady()
    // Sections opted out via data-export-hide (e.g. the Skill Planner's full skill-pool browser)
    // are bulky and not worth including in the exported image — hide them just for the capture.
    const hiddenEls = Array.from(target.querySelectorAll<HTMLElement>('[data-export-hide]'))
    const previousDisplay = hiddenEls.map((el) => el.style.display)
    hiddenEls.forEach((el) => { el.style.display = 'none' })
    // Bulk Viewer/Parent Checker show a compact table at desktop widths and a much taller stacked
    // card per row on phones (see their own data-export-table/data-export-cards comments) — a phone
    // export should still use the compact table (dramatically shorter, and already proven to render
    // cleanly) rather than however many screens' worth of stacked cards. Force that swap for the
    // capture regardless of the real viewport, before the overflow-x-auto unfold below runs, since
    // an element that's still display:none measures a scrollWidth of 0.
    const tableEls = Array.from(target.querySelectorAll<HTMLElement>('[data-export-table]'))
    const previousTableDisplay = tableEls.map((el) => el.style.display)
    tableEls.forEach((el) => { el.style.display = 'block' })
    const cardEls = Array.from(target.querySelectorAll<HTMLElement>('[data-export-cards]'))
    const previousCardDisplay = cardEls.map((el) => el.style.display)
    cardEls.forEach((el) => { el.style.display = 'none' })
    // Native <select> elements (Backpack/Class pickers) render as a plain unstyled white box with
    // misaligned text in html2canvas's output — the browser draws a select's internals itself
    // (OS-native widget chrome), which html2canvas can't faithfully reproduce the way it can an
    // ordinary CSS box. Swap each one for a plain div carrying the exact same classes (so it's
    // styled identically) showing just the picked option's text, capture that instead, then put the
    // real interactive select back right after.
    const selectEls = Array.from(target.querySelectorAll<HTMLSelectElement>('select'))
    const selectReplacements = selectEls.map((select) => {
      const standIn = document.createElement('div')
      standIn.className = select.className
      standIn.textContent = select.options[select.selectedIndex]?.text ?? ''
      select.insertAdjacentElement('afterend', standIn)
      const previousSelectDisplay = select.style.display
      select.style.display = 'none'
      return { select, standIn, previousSelectDisplay }
    })
    // Wide content (e.g. Team Viewer's table) scrolls horizontally inside its own overflow-x-auto
    // container rather than the page — great for on-screen use, but html2canvas only ever captures
    // an element's own clipped box, so whatever's scrolled out of view at the moment of capture
    // would otherwise just be silently missing from the image. Unfold each one to its full content
    // width just for the capture, then restore it right after.
    const scrollEls = Array.from(target.querySelectorAll<HTMLElement>('.overflow-x-auto'))
    const previousScrollStyles = scrollEls.map((el) => ({ width: el.style.width, overflow: el.style.overflow }))
    scrollEls.forEach((el) => {
      el.style.width = `${el.scrollWidth}px`
      el.style.overflow = 'visible'
    })
    // html2canvas still renders as if constrained to the real browser viewport by default — a wider
    // unfolded child just gets clipped at that boundary rather than included. windowWidth tells it
    // to render into a virtual window wide enough for the unfolded content instead.
    const windowWidth = Math.max(window.innerWidth, target.scrollWidth)
    try {
      const html2canvas = (await import('html2canvas-pro')).default
      const canvas = await html2canvas(target, { backgroundColor: '#0a0a0a', useCORS: true, scale: 2, windowWidth })
      const filename = buildFilename(group, unitLabel, tabLabel, context)
      const link = document.createElement('a')
      // Forward slashes in `download` create subfolders inside the browser's downloads directory
      // (Chromium/Electron honor this) — keeps every tab's screenshots sorted into their own folder
      // instead of piling up loose in one place.
      link.download = `Fire Emblem Roster Screenshots/${sanitizeFilenamePart(tabLabel)}/${filename}`
      link.href = canvas.toDataURL('image/png')
      link.click()
      setStatus('done')
    } catch {
      setStatus('failed')
    } finally {
      hiddenEls.forEach((el, i) => { el.style.display = previousDisplay[i] })
      tableEls.forEach((el, i) => { el.style.display = previousTableDisplay[i] })
      cardEls.forEach((el, i) => { el.style.display = previousCardDisplay[i] })
      selectReplacements.forEach(({ select, standIn, previousSelectDisplay }) => {
        standIn.remove()
        select.style.display = previousSelectDisplay
      })
      scrollEls.forEach((el, i) => {
        el.style.width = previousScrollStyles[i].width
        el.style.overflow = previousScrollStyles[i].overflow
      })
      setTimeout(() => setStatus('idle'), 2000)
    }
  }

  const label = status === 'capturing' ? 'Capturing…' : status === 'done' ? 'Saved ✓' : status === 'failed' ? 'Failed' : 'Save as image'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === 'capturing'}
      title="Give the page a couple seconds to finish loading before saving — screenshots taken right on load can look unstyled."
      className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-300 hover:bg-neutral-700 disabled:opacity-60"
    >
      {label}
    </button>
  )
}
