import { useRef, useState } from 'react'
import { chapterLabel, luckExtra, pairingChoices, selectClass, useArmy, useProfiles, useScreenshotUnit } from './hooks'
import { excludedUnits, FE4_MAX_LEVEL, loveFor, NO_HUSBAND, project, promoteLevelOf, ringBonus, skillsWith, type Fe4Data, type Fe4Plan } from './logic'
import { useFe4Store } from './store'
import { FE4_STATS, type Fe4Choice, type Fe4Unit } from './types'
import { HolyBloodWindow } from './HolyBlood'
import { StatTable, UnitPortrait, UnitSelect, WeaponsLine, WrapWarning } from './ui'

function joinText(data: Fe4Data, u: Fe4Unit): string {
  const where = chapterLabel(data, u.joinChapter)
  const j = u.join
  if (!j) return where
  if (j.how === 'talk') return `${where}: ${j.with?.length ? `talk to them with ${j.with.join(' or ')}` : 'by talking to them'}`
  if (j.how === 'event') return `${where}: joins ${j.turn ? `on turn ${j.turn}` : 'during the chapter'}`
  return `${where}: joins at the start`
}

const PROTECTION = {
  removed: "When defeated the story takes them off the map instead of letting them die, except in the Final Chapter ($84:B930).",
  retreats: 'When defeated they retreat instead of dying ($84:B927).',
}

const CHILD_RULES =
  "A child's growths are the parent of their own sex's plus half the other's (rounded down), plus their holy blood; each stat is (2 × that parent's + the other's) / 10 from what the game stores (Str to Res above the class's base), plus their levels' growth; HP adds 15, Luck 1 and a random 1 to 10. Holy blood and items come from the father for the sons but Leif and Febail, and for Altena and Patty; from the mother for the rest. From the game's code ($87:A869, $87:A6E6), run on every mother, father and child; the parents' stats are their Unit Planner plans, so these are averages."

/** Who the unit is, as Fates' Roster (user, 2026-11-05): their stats, growths, gold, weapons and class skills are in the Unit Planner;
 * how a child's come about, in Pairings. */
function UnitDetail({ data, unit }: { data: Fe4Data; unit: Fe4Unit }) {
  const { profile, fatherOf } = useProfiles(data)
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const p = profile(unit)
  const cls = data.classes[unit.classId]
  const promo = unit.promotesTo ? data.classes[unit.promotesTo] : undefined
  const father = unit.role === 'child' ? fatherOf(unit) : undefined
  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <UnitPortrait data={data} unit={unit} size={128} />
        <div className="min-w-0 space-y-1 text-sm text-neutral-300">
          <h3 className="text-lg font-semibold text-neutral-100">{unit.name}</h3>
          <div>
            {cls.name} · Lv {unit.level}
            {promo && <span className="text-neutral-500"> · promotes to {promo.name}</span>}
          </div>
          <div>
            <span className="text-neutral-500">Joins: </span>
            {joinText(data, unit)}
          </div>
          {unit.join?.note && <div className="text-neutral-400">{unit.join.note}</div>}
          {unit.role === 'child' && unit.mother && (
            <div>
              <span className="text-neutral-500">Parents: </span>
              {father ? father.name : 'father not chosen (Pairings)'} and {byId.get(unit.mother)?.name}
            </div>
          )}
          {unit.role === 'substitute' && unit.substituteFor && (
            <div className="text-neutral-400">
              Joins instead of {byId.get(unit.substituteFor)?.name} when {byId.get(byId.get(unit.substituteFor)?.mother ?? '')?.name} has no
              husband, or has died, by Ch.6 ($84:BAA1).
            </div>
          )}
          {p?.leadership ? (
            <div>
              <span className="text-neutral-500">Leadership: </span>
              {'★'.repeat(p.leadership)}
            </div>
          ) : null}
          {unit.protection && <div className="text-neutral-400">{PROTECTION[unit.protection]}</div>}
        </div>
      </div>
      {p && p.blood.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-neutral-200">Holy blood</h4>
          <HolyBloodWindow lines={data.bloods} blood={p.blood} />
        </div>
      )}
      {p ? (
        p.skills.length > 0 && (
          <div className="space-y-1 text-sm text-neutral-300">
            <h4 className="text-sm font-semibold text-neutral-200">Personal skills</h4>
            <div>{p.skills.join(', ')}</div>
          </div>
        )
      ) : (
        <p className="text-sm text-neutral-400">Pick {byId.get(unit.mother ?? '')?.name}'s husband in Pairings to see what this child inherits.</p>
      )}
      {unit.unconfirmed && <p className="rounded-md border border-amber-800/60 bg-amber-950/30 p-2 text-xs text-amber-300">Unconfirmed: {unit.unconfirmed}</p>}
    </div>
  )
}

/** A story choice of who joins, as buttons: picking one leaves the other out of every tab's lists. */
function ChoicePicker({ choice }: { choice: Fe4Choice }) {
  const picked = useFe4Store((s) => s.picks[choice.id])
  const setPick = useFe4Store((s) => s.setPick)
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-xs transition-colors ${
      on ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
    }`
  return (
    <div className="mb-2 space-y-1.5">
      <div className="text-xs text-neutral-400">{choice.question}</div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setPick(choice.id, null)} className={chip(picked === undefined)}>
          Not picked
        </button>
        {choice.options.map((opt, i) => (
          <button key={opt.label} type="button" onClick={() => setPick(choice.id, i)} className={chip(picked === i)}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Every playable unit by the chapter they join; tapping one shows their data below the list. Units the story picks or the
 * pairings leave out of your army drop out of the list. */
export function Fe4Roster({ data }: { data: Fe4Data }) {
  const [selectedId, setSelectedId] = useState(data.units[0]?.id ?? '')
  const detailRef = useRef<HTMLDivElement>(null)
  const picks = useFe4Store((s) => s.picks)
  const pairings = useFe4Store((s) => s.pairings)
  const left = excludedUnits(data, picks, pairings)
  const selected = data.units.find((u) => u.id === selectedId)
  useScreenshotUnit(selected)
  return (
    <div className="space-y-6">
      <p className="text-xs text-neutral-500">
        A child or their substitute shows once you pick their mother's husband in Pairings (or No husband); until then both show.
      </p>
      <div className="space-y-3">
        {data.chapters.map((ch) => {
          const choices = (data.choices ?? []).filter((c) => c.chapter === ch.id)
          const units = data.units.filter((u) => u.joinChapter === ch.id && !left.has(u.id))
          if (units.length === 0 && choices.length === 0) return null
          return (
            <div key={ch.id}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{ch.label}</h3>
              {choices.map((c) => (
                <ChoicePicker key={c.id} choice={c} />
              ))}
              <div className="flex flex-wrap gap-2">
                {units.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(u.id)
                      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
                    }}
                    className={`flex items-center gap-2 rounded-md border px-2 py-1 text-sm ${
                      u.id === selectedId ? 'border-violet-500 bg-violet-950/50 text-neutral-100' : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-600'
                    }`}
                  >
                    <UnitPortrait data={data} unit={u} size={32} />
                    {u.name}
                    {u.role === 'substitute' && <span className="text-xs text-neutral-500">sub</span>}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div ref={detailRef} className="scroll-mt-4">
        {selected && <UnitDetail data={data} unit={selected} />}
      </div>
    </div>
  )
}

/** One unit's average stats through promotion to the level cap, with rings. A parent's plan is what their children's stats come
 * from. */
export function Fe4Planner({ data }: { data: Fe4Data }) {
  const army = useArmy(data)
  const [unitId, setUnitId] = useState(army[0]?.id ?? '')
  const unit = army.find((u) => u.id === unitId) ?? army[0]
  useScreenshotUnit(unit)
  const { profile, planOf } = useProfiles(data)
  const plans = useFe4Store((s) => s.plans)
  const setPlan = useFe4Store((s) => s.setPlan)
  const [rings, setRings] = useState<string[]>([])
  const p = unit ? profile(unit) : undefined
  return (
    <div className="space-y-4">
      <UnitSelect data={data} units={army} value={unit?.id ?? ''} onChange={setUnitId} />
      {unit && !p && <p className="text-sm text-neutral-400">Pick this child's father in Pairings first.</p>}
      {unit &&
        p &&
        (() => {
          const plan = planOf(unit)
          const stages = project(data, p, plan)
          const final = stages[stages.length - 1]
          const promo = unit.promotesTo ? data.classes[unit.promotesTo] : undefined
          const update = (patch: Partial<Fe4Plan>) => setPlan(unit.id, { ...plan, ...patch })
          const levels = (from: number) => Array.from({ length: FE4_MAX_LEVEL - from + 1 }, (_, i) => from + i)
          const bonus = ringBonus(data, rings)
          const withRings = { ...final.stats }
          for (const s of FE4_STATS) withRings[s] += bonus.stats[s] ?? 0
          const finalClass = data.classes[final.classId]
          const toggleRing = (id: string) => setRings((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
          return (
            <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex flex-wrap items-end gap-4 text-sm text-neutral-300">
                {promo && (
                  <label className="space-y-1">
                    <span className="block text-xs text-neutral-500">Promote to {promo.name} (at the home castle)</span>
                    <select value={plan.promoteAt ?? ''} onChange={(e) => update({ promoteAt: e.target.value === '' ? null : Number(e.target.value) })} className={selectClass}>
                      <option value="">Don't promote</option>
                      {levels(Math.max(promoteLevelOf(promo), unit.level)).map((lv) => (
                        <option key={lv} value={lv}>
                          At Lv {lv}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="space-y-1">
                  <span className="block text-xs text-neutral-500">Up to Lv</span>
                  <select value={Math.max(plan.targetLevel, unit.level)} onChange={(e) => update({ targetLevel: Number(e.target.value) })} className={selectClass}>
                    {levels(unit.level).map((lv) => (
                      <option key={lv} value={lv}>
                        {lv}
                      </option>
                    ))}
                  </select>
                </label>
                {plans[unit.id] && (
                  <button type="button" onClick={() => setPlan(unit.id, null)} className="rounded-md bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700">
                    Reset
                  </button>
                )}
              </div>
              <p className="text-xs text-neutral-500">
                Average stats: each level adds the growth rate (own + holy blood), a sure point for each 100 and then one roll ($84:A464,
                $84:ACE7). Stats stop at the class's caps (green): HP 80, Luck 30, the rest the class's base + 15 ($84:AD00). Promotion is a
                home castle option from Lv 20: only the class changes, so the level and EXP stay, Str to Res rise by the difference in the
                classes' bases, and HP and Luck don't ($87:A438, $84:ABB0). Lv 30 is the cap. The first generation passes these stats on
                to their children (Pairings).
              </p>
              {/* As Fates' Unit Planner: the growths and caps, then the stats (the first row is as they join). */}
              <StatTable
                rows={[
                  { label: 'Growths (with holy blood)', values: p.growths, suffix: '%' },
                  ...(unit.growths ? [{ label: 'Own growths', values: unit.growths, suffix: '%' }] : []),
                  ...[...new Map(stages.map((st) => [st.classId, st.caps])).entries()].map(([id, caps]) => ({ label: `Caps (${data.classes[id].name})`, values: caps })),
                ]}
              />
              {unit.role === 'child' && (
                <p className="text-xs text-neutral-500">
                  A child's bases and growths come from their parents' plans (Pairings has how); Luck shows its average and, in brackets, its
                  range.
                </p>
              )}
              <StatTable
                rows={[
                  ...stages.map((st, i) => ({
                    label: `${data.classes[st.classId].name} Lv ${st.level}${i === 0 ? ' (joins)' : ''}`,
                    values: st.stats,
                    caps: st.caps,
                    ...(i === 0 ? { extra: luckExtra(p) } : {}),
                  })),
                  ...(Object.keys(bonus.stats).length ? [{ label: 'With the rings', values: withRings }] : []),
                ]}
              />
              {stages.length === 1 && <WrapWarning data={data} p={p} />}
              <WeaponsLine data={data} classId={finalClass.id} blood={p.blood} />
              <div className="text-sm text-neutral-300">
                <span className="text-neutral-500">Mov </span>
                {finalClass.mov}
                {bonus.mov ? ` + ${bonus.mov} (Leg Ring) = ${finalClass.mov + bonus.mov}` : ''}
                <span className="text-neutral-500"> · Skills </span>
                {skillsWith(data, p.skills, finalClass.id, rings).join(', ') || 'none'}
                <span className="text-neutral-500"> · Gold as they join </span>
                {p.gold}
              </div>
              {data.rings && data.rings.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs text-neutral-500">
                    Rings carried (anywhere in the inventory; a stat ring adds 5 after the caps, the Leg Ring 3 Mov; two of the same add nothing
                    more):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.rings.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleRing(r.id)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                          rings.includes(r.id) ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
                        }`}
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
    </div>
  )
}

/** Pick each mother's husband: her children (or, with none, the substitutes), what they inherit, and her love with each man. */
export function Fe4Pairings({ data }: { data: Fe4Data }) {
  const { mothers, fathers } = pairingChoices(data)
  const { profile, pairings } = useProfiles(data)
  const setFather = useFe4Store((s) => s.setFather)
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const [openLove, setOpenLove] = useState<string | null>(null)
  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        Each mother's children take after their parents as they stand when Ch.6 starts: their plans in the Unit Planner (by default
        promoted at Lv 20 and taken to 30). With no husband, or if she has died, her children's substitutes join instead ($84:BAA1); a
        father who died still counts, with his stats then. A father can only be picked once. Children also get the items of the parent
        their holy blood comes from, if their class can use them (rings always; Yewfelle, Forseti and the Valkyrie Staff are the only
        holy weapons that pass), and gold: a tenth of both parents', + 2000. Seliph starts with 2 leadership stars and Altena with 3
        ($87:AA39, $84:835E).
      </p>
      {mothers.map((mother) => {
        const pick = pairings[mother.id]
        const father = pick && pick !== NO_HUSBAND ? byId.get(pick) : undefined
        const children = data.units.filter((u) => u.role === 'child' && u.mother === mother.id)
        const love = loveFor(data, mother.id)
        return (
          <div key={mother.id} className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <UnitPortrait data={data} unit={mother} size={48} />
              <span className="font-semibold text-neutral-100">{mother.name}</span>
              <span className="text-neutral-500">and</span>
              <select value={pick ?? ''} onChange={(e) => setFather(mother.id, e.target.value || null)} className={selectClass}>
                <option value="">Not picked yet</option>
                <option value={NO_HUSBAND}>No husband (substitutes join)</option>
                {fathers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {Object.entries(pairings).some(([m, fid]) => fid === f.id && m !== mother.id) ? ' (taken)' : ''}
                  </option>
                ))}
              </select>
              {father && <UnitPortrait data={data} unit={father} size={48} />}
            </div>
            {love.length > 0 && (
              <div>
                <button type="button" onClick={() => setOpenLove(openLove === mother.id ? null : mother.id)} className="text-xs text-violet-300 hover:text-violet-200">
                  {openLove === mother.id ? 'Hide' : 'Show'} {mother.name}'s love with each man
                </button>
                {openLove === mother.id && (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-neutral-500">
                          <th className="py-1 text-left font-normal">Man</th>
                          <th className="px-1 py-1 text-right font-normal">Start</th>
                          <th className="px-1 py-1 text-right font-normal">/turn</th>
                          <th className="px-1 py-1 text-right font-normal">Talks</th>
                          <th className="px-1 py-1 text-right font-normal">To 500</th>
                        </tr>
                      </thead>
                      <tbody>
                        {love
                          .filter((l) => fathers.some((f) => f.id === l.man))
                          .sort((a, b) => (a.turns ?? 999) - (b.turns ?? 999))
                          .map((l) => (
                            <tr key={l.man} className={`border-t border-neutral-800 ${l.man === father?.id ? 'text-violet-200' : 'text-neutral-300'}`}>
                              <td className="py-1">{byId.get(l.man)?.name}</td>
                              <td className="px-1 py-1 text-right tabular-nums">{l.start}</td>
                              <td className="px-1 py-1 text-right tabular-nums">+{l.growth}</td>
                              <td className="px-1 py-1 text-right tabular-nums">{l.talks.length ? l.talks.map((t) => `+${t}`).join(', ') : '—'}</td>
                              <td className="px-1 py-1 text-right tabular-nums">{l.turns ?? '—'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    <p className="mt-1 text-[11px] leading-snug text-neutral-500">
                      Every player phase to turn 50, each pair in your army gains its amount wherever they are, and a man standing next to her
                      adds 5 ($84:C33D); some talks add more ($86:9519). At 500 they become lovers on their own, unless he has a lover already;
                      after that she gains no more ($87:AE05). To 500 is the player phases it takes from the start, the gains and the talks, not counting standing together.
                      Jealousy is a bug in the +5: if another woman stands next to her too, the game can lose track of whom it's crediting and
                      give his 5 to the other woman instead ($84:C3C1). Which one takes it follows the order units were put on the map, so it
                      changes after a reload: keep other women away from a pair you're building.
                    </p>
                  </div>
                )}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {children.map((child) => {
                const sub = data.units.find((u) => u.substituteFor === child.id)
                const shown = father ? child : pick === NO_HUSBAND ? sub : undefined
                if (!shown) return null
                const p = profile(shown)
                return (
                  <div key={child.id} className="space-y-2 rounded-md border border-neutral-800 p-3">
                    <div className="flex items-center gap-2">
                      <UnitPortrait data={data} unit={shown} size={32} />
                      <span className="text-neutral-100">{shown.name}</span>
                      <span className="text-xs text-neutral-500">
                        {data.classes[shown.classId].name} Lv {shown.level}
                        {!father && ` (substitute for ${child.name})`}
                      </span>
                    </div>
                    {p && (
                      <>
                        {p.blood.length > 0 && <div className="text-xs text-neutral-400">{p.blood.map((b) => `${b.blood} (${b.level})`).join(', ')}</div>}
                        <StatTable
                          rows={[
                            { label: 'Bases', values: p.bases, extra: luckExtra(p) },
                            { label: 'Growths', values: p.growths, suffix: '%' },
                          ]}
                        />
                        <WrapWarning data={data} p={p} />
                        {p.skills.length > 0 && <div className="text-xs text-neutral-400">Skills: {p.skills.join(', ')}</div>}
                      </>
                    )}
                  </div>
                )
              })}
              {!father && pick !== NO_HUSBAND && <p className="text-sm text-neutral-500">Pick her husband, or No husband, to see who joins.</p>}
            </div>
          </div>
        )
      })}
      <p className="text-xs text-neutral-500">{CHILD_RULES} Luck shows its average and, in brackets, its range.</p>
    </div>
  )
}
