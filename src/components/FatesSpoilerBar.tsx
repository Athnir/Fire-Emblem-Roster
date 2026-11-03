import { FATES_SPLIT, fatesSteps, useFatesSpoiler } from '../logic/fatesSpoiler'
import { usePlannerStore } from '../state/plannerStore'
import { useSpoilerStore } from '../state/spoilerStore'
import { ChapterBar } from './ChapterBar'

const ROUTES = ['Birthright', 'Conquest', 'Revelation'] as const

/** The spoiler block's bar for Fates: the Prologue and Chapters 1-5, then the route asked at the split (it becomes the route the
 * tabs show), then that route's chapters to the Endgame. Going back before the split hides the route again without changing it. */
export function FatesSpoilerBar() {
  const { chapter, route } = useFatesSpoiler()
  const setProgress = useSpoilerStore((s) => s.setProgress)
  const setActiveRoute = usePlannerStore((s) => s.setActiveRoute)
  const steps = fatesSteps(!!route)
  return (
    <ChapterBar
      steps={steps}
      at={Math.min(chapter, steps.length - 1)}
      onChange={(i) => setProgress('fates', Math.max(0, i))}
      picked={route}
      split={
        route
          ? undefined
          : {
              question: 'The story splits as Chapter 5 ends: pick the route you\'re playing to carry on (it becomes the route every tab shows).',
              choices: ROUTES.map((r) => ({ id: r, label: r, proceed: `Proceed to Chapter ${FATES_SPLIT}: ${r}` })),
              onPick: (r) => {
                setActiveRoute(r as (typeof ROUTES)[number])
                setProgress('fates', FATES_SPLIT)
              },
            }
      }
    />
  )
}
