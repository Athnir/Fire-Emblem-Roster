import { useState } from 'react'
import { useTelliusBuilds } from './buildSets'
import { useArmy } from './choiceStore'
import { formatStat, growthGain, hasBlossom, movementOf, project, weaponsText } from './logic'
import { useTelliusPlanStore, type TelliusUnitPlan } from './planStore'
import { SkillIcon } from './shared'
import { TELLIUS_STATS, TELLIUS_STAT_LABELS, type TelliusData, type TelliusStats } from './types'

const selectClass = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200'

/** Stats four to a row, fixed-width so "Save as image" keeps the spacing (as the Fates viewer does). */
function StatGrid({ values, mov, suffix = '' }: { values: TelliusStats; mov?: number; suffix?: string }) {
  return (
    <div className="grid grid-cols-[repeat(4,4.5rem)] whitespace-nowrap text-xs">
      {TELLIUS_STATS.map((s) => (
        <span key={s} className="pb-0.5 pr-2">
          <span className="text-neutral-500">{TELLIUS_STAT_LABELS[s]} </span>
          {formatStat(values[s])}
          {suffix}
        </span>
      ))}
      {mov !== undefined && (
        <span className="pb-0.5 pr-2">
          <span className="text-neutral-500">Mov </span>
          {mov}
        </span>
      )}
    </div>
  )
}

function SkillTags({ data, ids }: { data: TelliusData; ids: string[] }) {
  if (ids.length === 0) return <span className="text-neutral-600">—</span>
  return (
    <div className="flex max-w-[9rem] flex-wrap gap-1">
      {ids.map((id) => (
        <span key={id} className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-[11px] text-neutral-300">
          <SkillIcon data={data} skillId={id} size={12} />
          {data.skills[id]?.name ?? id}
        </span>
      ))}
    </div>
  )
}

/**
 * As Fates' Team Viewer: a saved set (or every unit with a plan) at once, one row per unit with their final class, weapons,
 * skills, growth rates and maximums. With Blossom, a growth shows as the chance it comes up.
 */
export function TelliusBulkViewer({ data }: { data: TelliusData }) {
  const sets = useTelliusBuilds((s) => s.sets).filter((s) => s.gameId === data.gameId)
  const current = useTelliusPlanStore((s) => s.plans[data.gameId])
  const army = useArmy(data)
  const [source, setSource] = useState('current')
  const set = sets.find((s) => s.id === source)
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const entries: { unitId: string; plan: TelliusUnitPlan }[] = set
    ? set.entries
    : army.filter((u) => current?.[u.id]).map((u) => ({ unitId: u.id, plan: current![u.id] }))

  const rows = entries
    .filter((e) => byId.has(e.unitId))
    .map(({ unitId, plan }) => {
      const unit = byId.get(unitId)!
      const stages = project(data, unit, plan)
      const final = stages[stages.length - 1]
      const cls = data.classes[final.classId]
      const blossom = hasBlossom(data, plan)
      const growths = { ...unit.growths }
      if (blossom) for (const s of TELLIUS_STATS) growths[s] = Math.round(growthGain(unit.growths[s], true) * 100)
      const form = cls.laguz && !cls.transformed && cls.transformsTo ? data.classes[cls.transformsTo] : undefined
      return {
        unit,
        cls,
        level: final.level,
        skills: plan.skills,
        growths,
        blossom,
        caps: cls.caps,
        formCaps: form?.caps,
        mov: movementOf(data, cls.id, plan.skills, false),
      }
    })

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="text-base font-semibold text-neutral-100">Team Viewer</h3>
        <p className="text-xs text-neutral-500">
          Every unit with a plan, or a set saved in the Unit Planner or the Skill Planner: their final class, weapons, skills, growth
          rates and maximum stats side by side. With Blossom, a growth shows as the chance it comes up. Mov counts Celerity, not Boots.
        </p>
        <label className="flex max-w-sm flex-col gap-1 text-xs text-neutral-400">
          Show
          <select value={source} onChange={(e) => setSource(e.target.value)} className={selectClass}>
            <option value="current">Every unit with a plan</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.entries.length})
              </option>
            ))}
          </select>
        </label>
        {rows.length === 0 && <p className="text-sm text-neutral-500">No plans yet: change a unit's plan in the Unit Planner, or save a set.</p>}
      </div>

      {rows.length > 0 && (
        <div>
          <div data-export-table className="hidden overflow-x-auto rounded-lg border border-neutral-800 sm:block">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Weapons</th>
                  <th className="px-3 py-2">Skills</th>
                  <th className="px-3 py-2">Growth %</th>
                  <th className="px-3 py-2">Max Stats</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.unit.id} className="border-b border-neutral-800/60 align-top last:border-0">
                    <td className="px-3 py-2 font-medium text-neutral-200">{r.unit.name}</td>
                    <td className="px-3 py-2 text-neutral-300">
                      {r.cls.name} <span className="text-neutral-500">Lv {r.level}</span>
                    </td>
                    <td className="max-w-[10rem] px-3 py-2 text-xs text-neutral-300">{weaponsText(data, r.cls.id) || '—'}</td>
                    <td className="px-3 py-2">
                      <SkillTags data={data} ids={r.skills} />
                    </td>
                    <td className="px-3 py-2 text-neutral-300">
                      <StatGrid values={r.growths} suffix="%" />
                      {r.blossom && <div className="text-[10px] text-violet-300">with Blossom</div>}
                    </td>
                    <td className="px-3 py-2 text-neutral-300">
                      <StatGrid values={r.caps} mov={r.mov} />
                      {r.formCaps && (
                        <div className="mt-1">
                          <div className="text-[10px] text-neutral-500">Transformed</div>
                          <StatGrid values={r.formCaps} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div data-export-cards className="space-y-3 sm:hidden">
            {rows.map((r) => (
              <div key={r.unit.id} className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm">
                <div className="font-medium text-neutral-200">
                  {r.unit.name} <span className="text-neutral-500">· {r.cls.name} Lv {r.level}</span>
                </div>
                <div className="text-xs text-neutral-300">
                  <span className="text-neutral-500">Weapons: </span>
                  {weaponsText(data, r.cls.id) || '—'}
                </div>
                <SkillTags data={data} ids={r.skills} />
                <div>
                  <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Growth %{r.blossom ? ' (with Blossom)' : ''}</div>
                  <StatGrid values={r.growths} suffix="%" />
                </div>
                <div>
                  <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Max Stats</div>
                  <StatGrid values={r.caps} mov={r.mov} />
                  {r.formCaps && (
                    <>
                      <div className="mt-1 text-[10px] text-neutral-500">Transformed</div>
                      <StatGrid values={r.formCaps} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
