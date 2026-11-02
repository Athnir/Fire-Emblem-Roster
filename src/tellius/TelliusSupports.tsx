import { useState } from 'react'
import { useArmy } from './choiceStore'
import { bondsOf, chaptersNeeded, openSupportsOf, supportsOf } from './logic'
import { useTelliusPlanStore } from './planStore'
import { UnitPortrait, UnitSelect, useScreenshotUnit } from './shared'
import type { TelliusData, TelliusUnit } from './types'

function pace(bonus: number): string {
  return bonus > 0 ? `+${bonus}` : bonus < 0 ? String(bonus) : '±0'
}

/** Radiant Dawn: anyone in the support list can support anyone else in it, each pair at its own pace; bonds are fixed. */
function OpenSupports({ data, unit, onPick }: { data: TelliusData; unit: TelliusUnit; onPick: (id: string) => void }) {
  const open = data.openSupports!
  const plans = useTelliusPlanStore((s) => s.plans[data.gameId])
  const partners = openSupportsOf(data, unit.id).sort((a, b) => b.bonus - a.bonus || a.partner.name.localeCompare(b.partner.name))
  const bonds = bondsOf(data, unit.id, plans ?? {})
  return (
    <>
      {bonds.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-neutral-200">Bonds</h4>
          <p className="text-xs text-neutral-500">
            A bond adds its value to {unit.name}'s critical and dodge while the bonded unit is next to them (0x80112cd4). The game sets
            them, and a Path of Radiance save adds a +5 bond for each A support there (ticked in the Unit Planner); no support here
            makes one.
          </p>
          <div className="flex flex-wrap gap-2">
            {bonds.map(({ partner, bond, fromPor }) => (
              <button key={partner.id} type="button" onClick={() => onPick(partner.id)} className="flex items-center gap-2 rounded-md border border-neutral-800 px-2 py-1 text-sm text-neutral-200 hover:border-neutral-600">
                <UnitPortrait data={data} unit={partner} size={28} />
                {partner.name} <span className="text-xs text-neutral-500">+{bond.value}{fromPor ? ' (Path of Radiance)' : ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {partners.length === 0 ? (
        <p className="text-sm text-neutral-400">{unit.name} isn't in the support list.</p>
      ) : (
        <>
          <p className="text-xs text-neutral-500">
            Anyone in the support list can support anyone else in it. A support needs {open.levels.join(', ')} points in total
            for C, B and A. Each pair has a pace: every time the pair earns points, it gets this many more or fewer (never below
            none). Points stop at each level until its conversation is seen, which adds one (0x8012eab4).
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="py-1 text-left font-normal">Partner</th>
                <th className="py-1 text-left font-normal">Affinity</th>
                <th className="px-1 py-1 text-right font-normal">Pace</th>
              </tr>
            </thead>
            <tbody>
              {partners.map(({ partner, bonus }) => (
                <tr key={partner.id} className="border-t border-neutral-800">
                  <td className="py-1">
                    <button type="button" onClick={() => onPick(partner.id)} className="flex items-center gap-2 text-neutral-200 hover:text-violet-300">
                      <UnitPortrait data={data} unit={partner} size={28} />
                      {partner.name}
                    </button>
                  </td>
                  <td className="py-1 text-neutral-400">{partner.affinity}</td>
                  <td className={`px-1 py-1 text-right tabular-nums ${bonus > 0 ? 'text-emerald-400' : bonus < 0 ? 'text-amber-400' : 'text-neutral-400'}`}>
                    {pace(bonus)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  )
}

/** Who a unit can support, their affinity, and how many chapters fought together each level takes. */
export function TelliusSupports({ data }: { data: TelliusData }) {
  const army = useArmy(data)
  const [unitId, setUnitId] = useState(army[0]?.id ?? '')
  const unit = army.find((u) => u.id === unitId) ?? army[0]
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
          {data.openSupports ? (
            <OpenSupports data={data} unit={unit} onPick={setUnitId} />
          ) : partners.length === 0 ? (
            <p className="text-sm text-neutral-400">{unit.name} has no supports.</p>
          ) : (
            <>
              <p className="text-xs text-neutral-500">
                Chapters both units start deployed together, in total, before each support can be viewed at the base. Each such
                chapter gives the pair a point, and viewing a conversation gives both units one more; points stop while a
                conversation waits. A unit can hold at most five support levels (C counts one, B two, A three), and Ch.27-2 gives
                no points (0x80015234, 0x80036b20, 0x8017fc70).
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
