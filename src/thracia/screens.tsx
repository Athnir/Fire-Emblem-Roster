import { useRef, useState } from 'react'
import { useArmy, useScreenshotUnit } from './hooks'
import { CAP, HP_CAP, joinOf, joinText, onRoute, skillsAt, type Fe5Data } from './logic'
import { FE5_STATS, type Fe5Stats, type Fe5Unit } from './types'
import { ChoicePicker, SkillList, StatTable, UnitPortrait, UnitSelect, WeaponsLine } from './ui'

const CAPS = Object.fromEntries(FE5_STATS.map((s) => [s, s === 'hp' ? HP_CAP : CAP])) as Fe5Stats

function supportLines(data: Fe5Data, unitId: string) {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const gets = data.supports.filter((s) => s.gets === unitId).map((s) => ({ unit: byId.get(s.gives), note: s.giverNote, bonus: s.bonus }))
  const gives = data.supports.filter((s) => s.gives === unitId).map((s) => ({ unit: byId.get(s.gets), note: undefined, bonus: s.bonus }))
  return { gets, gives }
}

/** Leadership, movement stars and the pursuit critical coefficient, each with what it does. */
function Stars({ unit }: { unit: Fe5Unit }) {
  const row = (label: string, value: string, what: string) => (
    <div>
      <span className="text-neutral-500">{label} </span>
      <span className="text-neutral-200">{value}</span>
      <div className="text-xs text-neutral-500">{what}</div>
    </div>
  )
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-3">
      {row(
        'Leadership',
        unit.leadership ? '★'.repeat(unit.leadership) : 'none',
        `${unit.leadershipNote ? `${unit.leadershipNote} ` : ''}Each star gives every unit Leif leads +3 hit and avoid, anywhere on the map; everyone's stars add up ($83:E414).`,
      )}
      {row('Movement stars', unit.moveStars ? '★'.repeat(unit.moveStars) : 'none', 'A 5% chance a star, once a turn, to move and act again after acting ($83:A8D2).')}
      {row('Pursuit critical', `×${unit.pcc}`, "A follow-up attack's crit is multiplied by it, up to 100; every other attack's crit is held at 25 ($83:D805).")}
    </div>
  )
}

function UnitDetail({ data, unit, picks }: { data: Fe5Data; unit: Fe5Unit; picks: Record<string, number> }) {
  const cls = data.classes[unit.classId]
  const { joinChapter, join } = joinOf(unit, picks)
  const { gets, gives } = supportLines(data, unit.id)
  const promo = unit.promotion ? data.classes[unit.promotion.classId] : undefined
  const step = unit.storyStep ? data.classes[unit.storyStep.classId] : undefined
  const supportList = (title: string, items: { unit?: Fe5Unit; note?: string; bonus: number }[]) =>
    items.length > 0 && (
      <div>
        <span className="text-neutral-500">{title}: </span>
        {items.map((g) => `${g.unit?.name ?? g.note} (+${g.bonus})`).join(', ')}
      </div>
    )
  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <UnitPortrait data={data} unit={unit} size={128} />
        <div className="min-w-0 space-y-1 text-sm text-neutral-300">
          <h3 className="text-lg font-semibold text-neutral-100">{unit.name}</h3>
          <div>
            {cls.name} · Lv {unit.level}
          </div>
          {promo && unit.promotion && (
            <div className="text-neutral-400">
              {unit.promotion.by === 'seal' ? `Promotes to ${promo.name} with a Master Seal, from Lv 10.` : `Becomes a ${promo.name}. ${unit.promotion.note ?? ''}`}
            </div>
          )}
          {step && unit.storyStep && (
            <div className="text-neutral-400">
              Can become a {step.name}. {unit.storyStep.note}
            </div>
          )}
          <div>
            <span className="text-neutral-500">Joins: </span>
            {joinText(data, joinChapter, join)}
          </div>
          {join.note && <div className="text-neutral-400">{join.note}</div>}
          {unit.notes?.map((n) => (
            <div key={n} className="text-neutral-400">
              {n}
            </div>
          ))}
        </div>
      </div>
      {/* When the unit leaves and comes back. These are spoilers: under the spoiler block, once the Roster has one, they stay blank
          (the user's rule, 2026-11-02). */}
      {unit.away && (
        <div className="space-y-1 text-sm">
          <h4 className="text-sm font-semibold text-neutral-200">Time away</h4>
          <ul className="list-disc space-y-0.5 pl-5 text-neutral-400">
            {unit.away.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      <Stars unit={unit} />
      <div className="space-y-1 text-sm text-neutral-300">
        <div>
          <span className="text-neutral-500">Weapons: </span>
          <WeaponsLine cls={cls} unit={unit} />
        </div>
        {cls.dismounted && (
          <div>
            <span className="text-neutral-500">On foot (indoors): </span>
            <WeaponsLine cls={data.classes[cls.dismounted]} unit={unit} />
          </div>
        )}
        <p className="text-xs text-neutral-500">
          A rank is the class's points plus the unit's own, a letter every 50 (E 50 to A 250). Each attack adds a point.
        </p>
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-neutral-200">Skills</h4>
        <SkillList data={data} skills={skillsAt(data, unit, unit.classId)} />
        {unit.storySkill && (
          <p className="text-sm text-neutral-400">
            Can learn {unit.storySkill.skill}: {unit.storySkill.note}
          </p>
        )}
      </div>
      <StatTable
        rows={[
          { label: 'Bases', values: unit.bases, caps: CAPS },
          { label: 'Growths', values: unit.growths, suffix: '%' },
        ]}
      />
      {(gets.length > 0 || gives.length > 0) && (
        <div className="space-y-1 text-sm text-neutral-300">
          <h4 className="text-sm font-semibold text-neutral-200">Supports</h4>
          {supportList('Gets from', gets)}
          {supportList('Gives to', gives)}
        </div>
      )}
    </div>
  )
}

/** Every unit of the army by the chapter they join; tapping one shows their data below the list. The story's picks sit under their
 * chapters; the units of an option not picked drop out of every tab. */
export function Fe5Roster({ data }: { data: Fe5Data }) {
  const { units, chapterOf, picks } = useArmy(data)
  const [selectedId, setSelectedId] = useState(units[0]?.id ?? '')
  const detailRef = useRef<HTMLDivElement>(null)
  const selected = units.find((u) => u.id === selectedId) ?? units[0]
  useScreenshotUnit(selected)
  return (
    <div className="space-y-6">
      <p className="text-xs text-neutral-500">
        The route and two either-or joins are picked under their chapters. The units of an option you don't pick drop out of every tab.
      </p>
      <div className="space-y-3">
        {data.chapters.map((ch) => {
          if (!onRoute(data, ch.id, picks)) return null
          const here = units.filter((u) => chapterOf(u) === ch.id)
          const choices = data.choices.filter((c) => c.chapter === ch.id)
          if (here.length === 0 && choices.length === 0) return null
          return (
            <div key={ch.id}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{ch.label}</h3>
              {choices.map((c) => (
                <ChoicePicker key={c.id} choice={c} />
              ))}
              <div className="flex flex-wrap gap-2">
                {here.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(u.id)
                      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
                    }}
                    className={`flex items-center gap-2 rounded-md border px-2 py-1 text-sm ${
                      u.id === selected?.id ? 'border-violet-500 bg-violet-950/50 text-neutral-100' : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-600'
                    }`}
                  >
                    <UnitPortrait data={data} unit={u} size={32} />
                    {u.name}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div ref={detailRef} className="scroll-mt-4">
        {selected && <UnitDetail data={data} unit={selected} picks={picks} />}
      </div>
    </div>
  )
}

/** Who gives whom a bonus. The table goes one way per entry, so a unit's gets and gives are listed apart. */
export function Fe5Supports({ data }: { data: Fe5Data }) {
  const { units, chapterOf } = useArmy(data)
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const unit = units.find((u) => u.id === unitId) ?? units[0]
  useScreenshotUnit(unit)
  const lines = unit ? supportLines(data, unit.id) : { gets: [], gives: [] }
  const list = (title: string, items: { unit?: Fe5Unit; note?: string; bonus: number }[]) => (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold text-neutral-200">{title}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">No one.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((it) =>
            it.unit ? (
              <button
                key={it.unit.id}
                type="button"
                onClick={() => setUnitId(it.unit!.id)}
                className="flex items-center gap-2 rounded-md border border-neutral-800 px-2 py-1 text-sm text-neutral-200 hover:border-neutral-600"
              >
                <UnitPortrait data={data} unit={it.unit} size={28} />
                {it.unit.name} <span className="text-emerald-400">+{it.bonus}</span>
              </button>
            ) : (
              <span key={it.note} className="rounded-md border border-neutral-800 px-2 py-1 text-sm text-neutral-400">
                {it.note} <span className="text-emerald-400">+{it.bonus}</span>
              </span>
            ),
          )}
        </div>
      )}
    </div>
  )
  return (
    <div className="space-y-4">
      <UnitSelect data={data} units={units} chapterOf={chapterOf} value={unit?.id ?? ''} onChange={setUnitId} />
      {unit && (
        <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <div className="space-y-1 text-xs text-neutral-500">
            <p>
              Thracia 776 has no support levels. A unit gets their giver's bonus to hit, avoid, crit and crit avoid while the giver is within
              3 tiles ($83:E5A5). The table goes one way per entry.
            </p>
            <p>
              The giver can be in any army. They count unless dead, not deployed, set aside or captured; being carried doesn't stop it.
              Bonuses from several givers add up. A unit attacked by their own giver doesn't counter.
            </p>
          </div>
          {list(`${unit.name} gets a bonus from`, lines.gets)}
          {list(`${unit.name} gives a bonus to`, lines.gives)}
        </div>
      )}
    </div>
  )
}

/** Rules too long for the other tabs: rescue and capture, captured units, and fatigue. */
export function Fe5Info() {
  const section = (title: string, lines: string[]) => (
    <section className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="text-base font-semibold text-neutral-100">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </section>
  )
  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">The rules behind rescuing, capturing and fatigue, from the game's code, for checking by hand.</p>
      {section('Rescue and capture', [
        "Effective Con: mounted units count as 20. Everyone else uses their class's Con plus their own, held at 20, with no item bonuses ($83:A855).",
        "A unit can rescue an adjacent ally, or capture an adjacent enemy, whose effective Con is lower than theirs ($87:9800, $87:9AA3). So no one can take a mounted unit unless it dismounts.",
        "Neither unit can already be carrying or carried, and some story units can't be captured at all.",
        "While carrying, Str, Mag, Skl, Spd and Def are halved. Mov is halved too if the carried unit's Con is more than half the carrier's effective Con ($83:9148, $83:8830).",
        'A capture attack halves the same five stats ($83:E470).',
      ])}
      {section('Captured units', [
        'A unit of yours captured in Ch.11 comes back as a prisoner in 11x; one captured before 21x comes back there. Anyone captured from Ch.22 on is gone.',
        'Units left on the map when you escape a chapter count as captured.',
      ])}
      {section('Fatigue', [
        'Fatigue rises by 1 for every battle, attacking or defending, and for dancing and the arena. A staff adds 1 to 5 by its rank, E to A ($83:DB85, $83:EA2B). It stops at 99.',
        "At the preparations, a unit whose fatigue is above their max HP can't deploy; equal still can ($85:F51B). Serenes Forest says \"at or above\". Holding a Stamina Drink lets them deploy anyway.",
        'It goes back to 0 when they sit a chapter out, drink a Stamina Drink, or are rescued from capture.',
        'Leif never tires: events in Ch.1 and Ch.4 set it so.',
      ])}
    </div>
  )
}
