import { useState } from 'react'
import { chaptersNeeded, supportsOf } from './logic'
import { UnitPortrait, UnitSelect, useScreenshotUnit } from './shared'
import type { TelliusData } from './types'

/** Who a unit can support, their affinity, and how many chapters fought together each level takes. */
export function TelliusSupports({ data }: { data: TelliusData }) {
  const [unitId, setUnitId] = useState(data.units[0]?.id ?? '')
  const unit = data.units.find((u) => u.id === unitId)
  useScreenshotUnit(unit)
  const partners = unit ? supportsOf(data, unit.id) : []

  return (
    <div className="space-y-4">
      <UnitSelect data={data} value={unitId} onChange={setUnitId} />
      {unit && (
        <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex items-center gap-3">
            <UnitPortrait data={data} unit={unit} size={48} />
            <div>
              <div className="font-semibold text-neutral-100">{unit.name}</div>
              <div className="text-xs text-neutral-400">Affinity: {unit.affinity}</div>
            </div>
          </div>
          {partners.length === 0 ? (
            <p className="text-sm text-neutral-400">{unit.name} has no supports.</p>
          ) : (
            <>
              <p className="text-xs text-neutral-500">
                Chapters both units fight in, in total, before each support can be viewed at the base.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-neutral-500">
                    <th className="py-1 text-left font-normal">Partner</th>
                    <th className="py-1 text-left font-normal">Affinity</th>
                    <th className="px-1 py-1 text-right font-normal">C</th>
                    <th className="px-1 py-1 text-right font-normal">B</th>
                    <th className="px-1 py-1 text-right font-normal">A</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map(({ partner, support }) => (
                    <tr key={partner.id} className="border-t border-neutral-800">
                      <td className="py-1">
                        <button type="button" onClick={() => setUnitId(partner.id)} className="flex items-center gap-2 text-neutral-200 hover:text-violet-300">
                          <UnitPortrait data={data} unit={partner} size={28} />
                          {partner.name}
                        </button>
                      </td>
                      <td className="py-1 text-neutral-400">{partner.affinity}</td>
                      {chaptersNeeded(support).map((n, i) => (
                        <td key={i} className="px-1 py-1 text-right tabular-nums text-neutral-200">
                          {n}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  )
}
