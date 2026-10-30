import type { RefObject } from 'react'
import { BulkAssetUpload } from '../components/BulkAssetUpload'
import { BulkViewer } from '../components/BulkViewer'
import { CorrinBuildPanel } from '../components/CorrinBuildPanel'
import { ExportImageButton } from '../components/ExportImageButton'
import { MarriagePlanner } from '../components/MarriagePlanner'
import { RosterBrowser } from '../components/RosterBrowser'
import { RouteBackground } from '../components/RouteBackground'
import { SkillPlanner } from '../components/SkillPlanner'
import { UnitPlanner } from '../components/UnitPlanner'
import { usePlannerStore } from '../state/plannerStore'
import type { GameParts } from './index'

function FatesBackground() {
  const activeRoute = usePlannerStore((state) => state.activeRoute)
  return <RouteBackground route={activeRoute} />
}

/** Fates' screenshots are named for the active saved plan and the route. */
function FatesExportButton({ targetRef, tabLabel }: { targetRef: RefObject<HTMLElement | null>; tabLabel: string }) {
  const activeRoute = usePlannerStore((state) => state.activeRoute)
  const activePlanId = usePlannerStore((state) => state.activePlanId)
  const plans = usePlannerStore((state) => state.plans)
  const planName = activePlanId ? (plans.find((p) => p.id === activePlanId)?.name ?? '') : ''
  return (
    <ExportImageButton
      targetRef={targetRef}
      tabLabel={tabLabel}
      group={planName}
      context={activeRoute === 'all' ? 'All Routes' : activeRoute}
    />
  )
}

const fates: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: RosterBrowser },
    { id: 'unit', label: 'Unit Planner', component: UnitPlanner },
    { id: 'planner', label: 'Marriage Planner', component: MarriagePlanner },
    { id: 'skills', label: 'Skill Planner', component: SkillPlanner },
    { id: 'viewer', label: 'Bulk Viewer', component: BulkViewer },
  ],
  banner: CorrinBuildPanel,
  background: FatesBackground,
  bulkUpload: BulkAssetUpload,
  exportButton: FatesExportButton,
}

export default fates
