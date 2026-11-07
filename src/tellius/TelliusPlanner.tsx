import { useState } from 'react'
import { capsTitle } from '../components/StatBlocks'
import { BandEditor } from './BandEditor'
import { TelliusBuildSetManager } from './builds'
import { useArmy } from './choiceStore'
import {
  bexpTotal,
  cannotAdd,
  capacityOf,
  capacityUsed,
  hasBlossom,
  learnableSkills,
  MASTER_SEAL_LEVEL,
  maxLevelOf,
  planSegments,
  project,
  promotionsOf,
  skillCount,
  skillOptions,
  transformedStats,
  type GrowthMode,
  type TransferPlan,
} from './logic'
import { useTelliusPlanStore, useUnitPlan, type TelliusUnitPlan } from './planStore'
import { SkillIcon, StatTable, StoryPromotions, UnitSelect, useScreenshotUnit, WeaponsLine } from './shared'
import { TELLIUS_RANK_LABELS, TELLIUS_STATS, TELLIUS_STAT_LABELS, type TelliusData, type TelliusRankType, type TelliusStat, type TelliusUnit } from './types'

const selectClass = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200'

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)
}

/** Radiant Dawn: what a Path of Radiance save brings: capped stats (or Sothe's stats there), and A supports as bonds. */
function TransferEditor({ data, unit, plan, update }: { data: TelliusData; unit: TelliusUnit; plan: TelliusUnitPlan; update: (patch: Partial<TelliusUnitPlan>) => void }) {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const plans = useTelliusPlanStore((s) => s.plans[data.gameId])
  const transfer: TransferPlan = plan.transfer ?? {}
  const set = (patch: Partial<TransferPlan>) => {
    const next = { ...transfer, ...patch }
    const empty = !next.capped?.length && !next.aSupports?.length && !Object.keys(next.stats ?? {}).length
    update({ transfer: empty ? undefined : next })
  }
  const copies = unit.id === data.rules.transferCopies
  const toggleStat = (s: TelliusStat) =>
    set({ capped: transfer.capped?.includes(s) ? transfer.capped.filter((x) => x !== s) : [...(transfer.capped ?? []), s] })
  const toggleSupport = (id: string) =>
    set({ aSupports: transfer.aSupports?.includes(id) ? transfer.aSupports.filter((x) => x !== id) : [...(transfer.aSupports ?? []), id] })
  return (
    <div className="space-y-2 border-t border-neutral-800 pt-3">
      <h4 className="text-sm font-semibold text-neutral-200">Path of Radiance save</h4>
      {copies ? (
        <>
          <p className="text-xs text-neutral-500">
            If {unit.name} finished Path of Radiance at Lv 20, his stats there replace his own, held at his class's caps (0x8011d978).
            Fill in the ones you had; blanks keep his own.
          </p>
          <div className="grid max-w-md grid-cols-4 gap-2">
            {TELLIUS_STATS.map((s) => (
              <label key={s} className="flex flex-col gap-0.5 text-xs text-neutral-400">
                {TELLIUS_STAT_LABELS[s]}
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={transfer.stats?.[s] ?? ''}
                  onChange={(e) => {
                    const stats = { ...transfer.stats }
                    if (e.target.value === '') delete stats[s]
                    else stats[s] = Math.max(0, Math.min(99, Number(e.target.value)))
                    set({ stats })
                  }}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200"
                />
              </label>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-neutral-500">
            Tick the stats that were at their cap at the end of Path of Radiance: +5 HP and +2 to any other, up to the caps here. It
            only counts if they finished there at Lv 20 in a promoted class (laguz count) (0x8011d580).
          </p>
          <div className="flex flex-wrap gap-3">
            {TELLIUS_STATS.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-xs text-neutral-300">
                <input type="checkbox" checked={transfer.capped?.includes(s) ?? false} onChange={() => toggleStat(s)} />
                {TELLIUS_STAT_LABELS[s]}
              </label>
            ))}
          </div>
        </>
      )}
      {unit.porSupports && unit.porSupports.length > 0 && (
        <>
          <p className="text-xs text-neutral-500">
            A supports there: each makes a +5 bond here (0x801130d4), unless the pair has one already. Ticking it on either unit counts.
          </p>
          <div className="flex flex-wrap gap-3">
            {unit.porSupports.map((id) => {
              const partner = byId.get(id)
              if (!partner) return null
              const theirs = plans?.[id]?.transfer?.aSupports?.includes(unit.id) ?? false
              return (
                <label key={id} className="flex items-center gap-1.5 text-xs text-neutral-300">
                  <input type="checkbox" checked={(transfer.aSupports?.includes(id) ?? false) || theirs} disabled={theirs} onChange={() => toggleSupport(id)} />
                  {partner.name}
                  {theirs && <span className="text-neutral-500">(ticked on {partner.name})</span>}
                </label>
              )
            })}
          </div>
        </>
      )}
      <p className="text-xs text-neutral-500">
        Their weapon ranks there add weapon EXP here too (C 40, B 80, A 120, S 160, up to the class's top rank); that isn't counted.
      </p>
      {unit.porShadowed && (
        <p className="text-xs text-amber-400">
          {unit.porShadowed.join(' and ')}'s Path of Radiance data also names {unit.name} in the game's table, but the game takes{' '}
          {unit.name}'s own first (0x8026d02c), so {unit.porShadowed.length > 1 ? 'theirs' : 'it'} never counts, nor does a support with{' '}
          {unit.porShadowed.join(' or ')}. Serenes Forest says {unit.name} gets both; the Fire Emblem Wiki and the program say not.
        </p>
      )}
    </div>
  )
}

/** Radiant Dawn: how many of each class's level-ups come from bonus EXP, and what they cost. */
function BexpEditor({ data, unit, plan, update }: { data: TelliusData; unit: TelliusUnit; plan: TelliusUnitPlan; update: (patch: Partial<TelliusUnitPlan>) => void }) {
  const segments = planSegments(data, unit, plan).filter((seg) => seg.to > seg.from)
  if (segments.length === 0) return null
  const all = planSegments(data, unit, plan)
  const total = bexpTotal(data, unit, plan)
  const setAt = (i: number, n: number) => {
    const bexp = all.map((_, k) => (k === i ? n : (plan.bexp?.[k] ?? 0)))
    update({ bexp: bexp.some(Boolean) ? bexp : undefined })
  }
  return (
    <div className="space-y-2 border-t border-neutral-800 pt-3">
      <h4 className="text-sm font-semibold text-neutral-200">Bonus EXP</h4>
      <div className="flex flex-wrap gap-4">
        {all.map((seg, i) => {
          const levels = seg.to - seg.from
          if (levels <= 0) return null
          return (
            <label key={i} className="space-y-1">
              <span className="block text-xs text-neutral-500">Level-ups by bonus EXP as {data.classes[seg.classId].name}</span>
              <select value={Math.min(plan.bexp?.[i] ?? 0, levels)} onChange={(e) => setAt(i, Number(e.target.value))} className={selectClass}>
                {range(0, levels).map((n) => (
                  <option key={n} value={n}>
                    {n} of {levels}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>
      {total.normal > 0 && (
        <p className="text-sm text-neutral-300">
          <span className="text-neutral-500">Bonus EXP needed: </span>
          {total.easy.toLocaleString()} on Easy, {total.normal.toLocaleString()} on Normal, {total.hard.toLocaleString()} on Hard
        </p>
      )}
      <p className="text-xs text-neutral-500">
        A level-up from bonus EXP gives exactly three stats: the level is rolled as usual (Blossom and Paragon don't count), then the
        risen stat with the lowest growth is dropped, or the highest growth that didn't rise is added, until there are three
        (0x8006d790). So it isn't always the same three. Counted as the class's first level-ups. A level costs 100 EXP at 1 + f × (L − 1)
        bonus EXP each, L being the level plus 20 in a second tier or 40 in a third, ×1.5 for laguz, and f ⅓ on Easy, ½ on Normal and 1 on
        Hard (0x80120524).
      </p>
    </div>
  )
}

function Planner({ data, unit, onShowUnit }: { data: TelliusData; unit: TelliusUnit; onShowUnit: (id: string) => void }) {
  const { plan, saved, update, clear } = useUnitPlan(data, unit)
  const [boots, setBoots] = useState(false)
  const [adding, setAdding] = useState('')
  const [capsPick, setCapsPick] = useState('')

  const chain = promotionsOf(data, unit)
  const segments = planSegments(data, unit, plan)
  const fixed = Boolean(data.fixedMode && plan.mode === 'fixed' && unit.fixedStart)
  const stages = project(data, unit, plan)
  const final = stages[stages.length - 1]
  const finalClass = data.classes[final.classId]
  const startClass = data.classes[unit.classId]
  const promoted = segments.length > 1
  const targetLevels = range(promoted ? 1 : unit.level, maxLevelOf(data, finalClass.id))
  const transformed = transformedStats(data, final.classId, final.stats)
  const halfParts = [...new Set((unit.halfTransformed ?? []).map((id) => data.chapters.find((c) => c.id === id)?.part).filter(Boolean))]
  const half = halfParts.length ? transformedStats(data, unit.classId, stages[0].stats, true) : undefined
  const blossom = hasBlossom(data, plan)
  const doubling = data.rules.transform === 'double'

  // One select per promotion: each is offered once the one before it is planned.
  const promotionAt = [plan.promoteAt, plan.promoteAt2 ?? null]
  const promotionSelects = chain.map((to, i) => {
    const from = i === 0 ? startClass : chain[i - 1]
    if (i > 0 && promotionAt[i - 1] === null) return null
    const firstLevel = i === 0 ? unit.level : 1
    // A class the story promotes can't use a Seal or Crown: any level the unit might be at when the story does it.
    const min = from.storyPromotion ? firstLevel : Math.max(MASTER_SEAL_LEVEL, firstLevel)
    const levels = range(min, maxLevelOf(data, from.id))
    const value = promotionAt[i]
    // A new promotion plan aims for the top level of whatever class it ends in.
    const change = (v: number | null) => {
      const next = i === 0 ? { ...plan, promoteAt: v, ...(v === null ? { promoteAt2: null } : {}) } : { ...plan, promoteAt2: v }
      const ends = planSegments(data, unit, next)
      update({ ...next, targetLevel: maxLevelOf(data, ends[ends.length - 1].classId) })
    }
    return (
      <label key={to.id} className="space-y-1">
        <span className="block text-xs text-neutral-500">Promote to {to.name}</span>
        <select value={value ?? ''} onChange={(e) => change(e.target.value === '' ? null : Number(e.target.value))} className={selectClass}>
          <option value="">Don't promote</option>
          {levels.map((lv) => (
            <option key={lv} value={lv}>
              At {from.name} Lv {lv}
            </option>
          ))}
        </select>
      </label>
    )
  })

  // Skills, in the plan's last class at its last level.
  const carried = plan.skills
  const capacity = capacityOf(data, finalClass.id, final.level)
  const used = capacityUsed(data, unit, finalClass.id, carried)
  const count = skillCount(data, finalClass.id, carried)
  const limit = data.rules.maxSkills
  const options = skillOptions(data, unit, finalClass.id, final.level, carried)
  const mastery = finalClass.mastery
  // Blossom as a tickbox: for a unit who can have it (Path of Radiance: Sothe's own; Radiant Dawn: anyone the scroll allows).
  const blossomId = data.rules.blossom
  const canBlossom =
    unit.skills.includes(blossomId) || segments.some((seg) => learnableSkills(data, unit, seg.classId, carried.filter((s) => s !== blossomId)).includes(blossomId))
  const blossomBlocked = !blossom ? cannotAdd(data, unit, finalClass.id, final.level, carried, blossomId) : undefined
  const toggleSkill = (id: string) => update({ skills: carried.includes(id) ? carried.filter((s) => s !== id) : [...carried, id] })
  const growthNote = data.rules.bexp
    ? "Average stats: each level adds the unit's own growth rate (Radiant Dawn never uses the class's), and a stat stops at its cap (green). A level where every roll fails gives +1 to the highest growth with room; that isn't counted, so the averages can run a little low (0x8006d380)."
    : fixed
      ? "Fixed mode: each stat has growth points, starting from the unit's own. A level's 100 EXP adds the growth rate (held between 0 and 255) and the level-up turns 100 points into +1, twice at most; promoting halves the points. The weapon used and the class fought shift the points a little, award by award; they aren't counted, so a stat can be a point off (0x800351fc, 0x80034ba8, 0x8003d464)."
      : 'Average stats: each level adds the growth rate, a sure point for each 100, and a stat stops at its cap (green); Luck stops at 40 (0x80034130).'

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex flex-wrap items-end gap-4 text-sm text-neutral-300">
          {promotionSelects}
          {data.fixedMode && unit.fixedStart && (
            <label className="space-y-1">
              <span className="block text-xs text-neutral-500">Growths</span>
              <select value={plan.mode ?? 'random'} onChange={(e) => update({ mode: e.target.value as GrowthMode })} className={selectClass}>
                <option value="random">Random (average)</option>
                <option value="fixed">Fixed</option>
              </select>
            </label>
          )}
          <label className="space-y-1">
            <span className="block text-xs text-neutral-500">Up to Lv (as {finalClass.name})</span>
            <select value={final.level} onChange={(e) => update({ targetLevel: Number(e.target.value) })} className={selectClass}>
              {targetLevels.map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
          </label>
          {saved && (
            <button type="button" onClick={clear} className="rounded-md bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700">
              Reset
            </button>
          )}
        </div>

        <StoryPromotions data={data} unit={unit} />

        {canBlossom && (
          <label className="flex items-center gap-2 text-xs text-neutral-300" title={blossomBlocked}>
            <input type="checkbox" checked={blossom} disabled={Boolean(blossomBlocked)} onChange={() => toggleSkill(blossomId)} />
            {data.skills[blossomId]?.name ?? 'Blossom'} equipped: a failed growth roll is rolled again
            {data.fixedMode ? ', and Fixed mode turns 90 points into a stat' : ''}; taken as kept on throughout
            {blossomBlocked && <span className="text-amber-400"> ({blossomBlocked})</span>}
          </label>
        )}

        <p className="text-xs text-neutral-500">
          {growthNote}
          {blossom ? ' With Blossom, a failed roll is rolled once more, so a 40% growth comes up 64% of the time.' : ''}
          {chain.length > 0 &&
            (data.rules.bexp
              ? " Promoting adds the new class's promotion gains and starts again at Lv 1 (0x8011ffd0)."
              : " Promoting switches to the new class's bases (the difference is the gain) and starts again at Lv 1 (0x8003d2c4).")}
        </p>
        {/* As Fates' Unit Planner: the growths and caps, then the stats (the first row is as they join). */}
        <StatTable
          rows={[
            { label: 'Growths', values: unit.growths, suffix: '%' },
            (() => {
              // One caps block, its class picked from those the unit can be in (user, 2026-11-07).
              const ids = [unit.classId, ...chain.map((c) => c.id)]
              const id = ids.includes(capsPick) ? capsPick : finalClass.id
              return {
                label: 'Caps',
                title: capsTitle({ options: ids.map((i) => ({ id: i, name: data.classes[i].name })), value: id, onChange: setCapsPick }),
                values: data.classes[id].caps,
              }
            })(),
          ]}
        />
        <StatTable
          rows={[
            ...stages.map((st, i) => ({
              label: `${data.classes[st.classId].name} Lv ${st.level}${i === 0 ? ' (joins)' : ''}${st.bexp ? ` (${st.bexp} by bonus EXP)` : ''}`,
              values: st.stats,
              caps: st.caps,
            })),
            ...(half ? [{ label: `Half-transformed (${halfParts.join(', ')})`, values: half.stats, caps: data.classes[half.classId].caps }] : []),
            ...(transformed
              ? [{ label: `Transformed (${data.classes[transformed.classId].name})`, values: transformed.stats, caps: data.classes[transformed.classId].caps }]
              : []),
            ...(fixed && final.points ? [{ label: 'Growth points left', values: final.points }] : []),
          ]}
        />
        {(transformed || half) && (
          <p className="text-xs text-neutral-500">
            {doubling
              ? 'Transformed: every stat but HP and Luck doubled, up to the transformed caps (0x80122770).'
              : "Transformed: the transformed class's bases take the place of the other form's, up to its caps (0x8003bbd4)."}
            {half && ` In ${halfParts.join(', ')} the maps keep ${unit.name} half-transformed: every stat but HP and Luck ×1.5, rounded down (his stats as he joins).`}
          </p>
        )}

        <WeaponsLine data={data} classId={finalClass.id} />
        {Object.keys(unit.ranks).length > 0 && (
          <div className="text-sm text-neutral-300">
            <span className="text-neutral-500">Weapon ranks as they join: </span>
            {(Object.entries(unit.ranks) as [TelliusRankType, string][]).map(([type, rank]) => `${TELLIUS_RANK_LABELS[type]} ${rank}`).join(', ')}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-300">
          <span>
            <span className="text-neutral-500">Mov </span>
            {finalClass.mov}
            {carried.includes(data.rules.celerity) && ` + 2 (${data.skills[data.rules.celerity]?.name ?? 'Celerity'})`}
            {boots && ' + 2 (Boots)'}
            {(carried.includes(data.rules.celerity) || boots) && ` = ${finalClass.mov + (carried.includes(data.rules.celerity) ? 2 : 0) + (boots ? 2 : 0)}`}
          </span>
          <span>
            <span className="text-neutral-500">Con </span>
            {unit.con}
            {final.con !== unit.con && ` → ${final.con}`}
          </span>
          <span>
            <span className="text-neutral-500">Wt </span>
            {unit.wt}
          </span>
          <label className="flex items-center gap-2 text-xs text-neutral-300">
            <input type="checkbox" checked={boots} onChange={(e) => setBoots(e.target.checked)} />
            Boots used (Mov +2)
          </label>
        </div>

        <BandEditor data={data} unit={unit} plan={plan} onChange={(bands) => update({ bands })} />
        {data.rules.bexp && <BexpEditor data={data} unit={unit} plan={plan} update={update} />}
        {unit.porUnit && <TransferEditor data={data} unit={unit} plan={plan} update={update} />}

        <div className="space-y-2 border-t border-neutral-800 pt-3">
          <h4 className="text-sm font-semibold text-neutral-200">
            Skills{' '}
            <span className={`text-xs font-normal ${used > capacity ? 'text-red-400' : 'text-neutral-500'}`}>
              Capacity {used} / {capacity} ({finalClass.name}
              {finalClass.laguz && data.rules.laguzCapacity ? ` Lv ${final.level}` : ''})
            </span>{' '}
            <span className={`text-xs font-normal ${count > limit.count ? 'text-red-400' : 'text-neutral-500'}`}>
              · {count} / {limit.count} skills{limit.withClassSkills ? '' : ' besides the class’s'}
            </span>
          </h4>
          {finalClass.skills.length > 0 && (
            <p className="text-xs text-neutral-500">
              {finalClass.name} skills: {finalClass.skills.map((id) => data.skills[id]?.name).filter(Boolean).join(', ')}
              {data.rules.capacity === 'allButOwn' && ' (they take capacity too)'}
            </p>
          )}
          {mastery && data.skills[mastery] && (
            <p className="text-xs text-neutral-500">
              Mastery skill: {data.skills[mastery].name}, learned with a Satori Sign ({data.skills[mastery].capacity} capacity).
            </p>
          )}
          {carried.map((id) => {
            const skill = data.skills[id]
            if (!skill) return null
            const free = data.rules.capacity === 'allButOwn' && unit.skills.includes(id)
            return (
              <div key={id} className="flex items-center gap-2 text-sm">
                <SkillIcon data={data} skillId={id} />
                <span className="text-neutral-200">{skill.name}</span>
                <span className="text-xs text-neutral-500">{free ? 'free (joins with it)' : skill.capacity}</span>
                {(skill.removable || id === mastery || unit.skills.includes(id)) && (
                  <button type="button" onClick={() => toggleSkill(id)} className="ml-auto text-xs text-neutral-500 hover:text-red-400">
                    Remove
                  </button>
                )}
              </div>
            )
          })}
          {options.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <select value={adding} onChange={(e) => setAdding(e.target.value)} className={selectClass}>
                <option value="">Add a skill…</option>
                {options.map(({ id, reason }) => (
                  <option key={id} value={id} disabled={Boolean(reason)}>
                    {data.skills[id].name} ({data.skills[id].capacity}){id === mastery ? ', mastery' : ''}
                    {reason ? `: ${reason}` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!adding || Boolean(options.find((o) => o.id === adding)?.reason)}
                onClick={() => {
                  update({ skills: [...carried, adding] })
                  setAdding('')
                }}
                className="rounded-md bg-violet-600 px-3 py-1 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          )}
          {adding && <p className="text-xs text-neutral-400">{data.skills[adding]?.description}</p>}
          <p className="text-xs text-neutral-500">
            {data.rules.maxSkills.withClassSkills
              ? "At most six skills, the class's included. Every skill takes capacity but those the unit joins with, the class's own too (0x802279c4, 0x8011b8a4). A laguz's capacity grows by 15 from Lv 15, and by 50 from Lv 30 (0x80127a90)."
              : "At most five skills besides the class's own, and every skill but the class's takes capacity, the unit's own included (0x801be92c, 0x8017c3c8). Smite needs Shove, which every class without Canto has (0x801058c4). A removed skill is gone for good."}{' '}
            The Skill Planner tab lays out every skill they can learn.
          </p>
        </div>
      </div>
      <div data-export-hide>
        <TelliusBuildSetManager
          data={data}
          unit={unit}
          plan={plan}
          onLoadEntry={(entry) => {
            // A saved entry's plan becomes the unit's plan again.
            useTelliusPlanStore.getState().setPlan(data.gameId, entry.unitId, entry.plan)
            onShowUnit(entry.unitId)
          }}
        />
      </div>
    </div>
  )
}

/** One unit's stats through their promotions, and the skills they carry within their class's capacity. Saved per unit. */
export function TelliusPlanner({ data }: { data: TelliusData }) {
  const army = useArmy(data)
  const [unitId, setUnitId] = useState(army[0]?.id ?? '')
  const unit = army.find((u) => u.id === unitId) ?? army[0]
  useScreenshotUnit(unit)
  return (
    <div className="space-y-4">
      <UnitSelect data={data} value={unit?.id ?? ''} onChange={setUnitId} />
      {unit && <Planner key={unit.id} data={data} unit={unit} onShowUnit={setUnitId} />}
    </div>
  )
}
