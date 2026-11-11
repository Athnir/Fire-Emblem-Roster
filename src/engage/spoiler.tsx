import { ChapterBar } from '../components/ChapterBar'
import { isMainChapter, useEngageProgress, useSetEngageProgress } from './hooks'
import type { Fe17Data } from './logic'
import { useFe17Store } from './store'

/** The spoiler block's bar: the Prologue and the chapters, no paralogues (user, 2026-11-11; each counts from the chapter after the one
 * that opens it). */
export function Fe17SpoilerBar({ chapters }: { chapters: { id: string; label: string }[] }) {
  const steps = chapters.filter((c) => isMainChapter(c.id))
  const at = useEngageProgress(chapters)
  const setAt = useSetEngageProgress()
  return <ChapterBar steps={steps} at={at} onChange={setAt} />
}

/** The data with the Expansion Pass's content (its units, Emblems, Bond Rings and classes, flagged in the game's data) left out when
 * it's turned off, its chapters too. Shown, it follows the spoiler block as the paralogues do. */
export function useFe17View(data: Fe17Data): Fe17Data {
  const show = useFe17Store((s) => s.showExpansion ?? true)
  if (show) return data
  const units = data.units.filter((u) => !u.expansionPass)
  const ids = new Set(units.map((u) => u.id))
  return {
    ...data,
    chapters: data.chapters.filter((c) => !/^CID_[GE]/.test(c.id)),
    units,
    emblems: data.emblems.filter((e) => !e.expansionPass),
    bondRings: data.bondRings.filter((r) => !r.expansionPass),
    classes: Object.fromEntries(Object.entries(data.classes).filter(([, c]) => !c.expansionPass)),
    supports: data.supports.filter((s) => ids.has(s.a) && ids.has(s.b)),
  }
}

/** The tick box above every tab: whether the Expansion Pass's content shows at all. */
export function Fe17ExpansionBox() {
  const show = useFe17Store((s) => s.showExpansion ?? true)
  const setShow = useFe17Store((s) => s.setShowExpansion)
  return (
    <div className="border-b border-neutral-800 bg-neutral-900/90 px-6 py-2">
      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        Show the Expansion Pass (the Divine Paralogues' Emblems, the Fell Xenologue's units, its classes and rings)
      </label>
    </div>
  )
}
