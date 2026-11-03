import { ChapterBar } from '../components/ChapterBar'
import { useSpoilerStore } from '../state/spoilerStore'
import { walkOf, type Fe5Data } from './logic'
import { useFe5Store } from './store'

/** The spoiler block's bar for Thracia 776: Chapters 1 to 15, then the route by where Leif leaves Chapter 15 (asked there), then
 * that route's chapters and the rest. Going back before the split takes back the route picked there. */
export function Fe5SpoilerBar({ data }: { data: Fe5Data }) {
  const picks = useFe5Store((s) => s.picks)
  const setPick = useFe5Store((s) => s.setPick)
  const saved = useSpoilerStore((s) => s.progress[data.gameId])
  const setProgress = useSpoilerStore((s) => s.setProgress)
  const { steps, split, routeChoice } = walkOf(data, picks)
  const at = Math.min(saved ?? 0, Math.max(0, steps.length - 1))
  const routePick = routeChoice ? picks[routeChoice.id] : undefined
  const firstRoute = steps.findIndex((c) => c.route)
  const onChange = (i: number) => {
    if (routeChoice && routePick !== undefined && firstRoute >= 0 && i < firstRoute) setPick(routeChoice.id, null)
    setProgress(data.gameId, Math.max(0, i))
  }
  return (
    <ChapterBar
      steps={steps}
      at={at}
      onChange={onChange}
      picked={routeChoice && routePick !== undefined ? routeChoice.options[routePick]?.label : undefined}
      split={
        split && {
          question: split.question,
          choices: split.options.map((o, i) => ({ id: String(i), label: o.label, proceed: o.label })),
          onPick: (id) => {
            setPick(split.id, Number(id))
            setProgress(data.gameId, steps.length)
          },
        }
      }
    />
  )
}
