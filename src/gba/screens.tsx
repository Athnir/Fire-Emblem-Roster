import { capsTitle, StatBlocks } from '../components/StatBlocks'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ChapterBar } from '../components/ChapterBar'
import { Portrait } from '../components/Portrait'
import { useScreenshotContextStore } from '../state/screenshotContextStore'
import { useSpoilerStore } from '../state/spoilerStore'
import {
  GBA_GROWING,
  GBA_STATS,
  GBA_STAT_LABELS,
  type GbaAffinity,
  type GbaAvatar,
  type GbaAvatarAnswer,
  type GbaBaseTalk,
  type GbaBranch,
  type GbaJoinChoice,
  type GbaSlotSupport,
  type GbaSpellInfo,
  type GbaSpellList,
  type GbaClass,
  type GbaChapter,
  type GbaStats,
  type GbaStat,
  type GbaStory,
  type GbaSupport,
  type GbaRankedSupport,
  type GbaSupportBonus,
  type GbaUnit,
} from './types'
import { averageShown, joinState, levelUp } from './dynamicGrowth'

/** Everything a GBA game's screens need, passed in so the screens don't import a game's data. */
export interface GbaData {
  gameId: string
  /** A game in more than one story shows a switch; its chapters and units each belong to one. */
  stories?: GbaStory[]
  /** The story shown until one is picked (the first, unless set). */
  defaultStory?: string
  /** Splits in one story that the spoiler block asks for (The Binding Blade's 10A or 10B, Ilia or Sacae). */
  branches?: GbaBranch[]
  chapters: GbaChapter[]
  units: GbaUnit[]
  classes: Record<string, GbaClass>
  supports: GbaSupport[]
  /** The points C, B and A need. */
  supportLevels: number[]
  /** When a pair gains its points, where the game's code was read for it ("each turn the two are side by side"). */
  supportGain?: string
  affinities: GbaAffinity[]
  /** The stats the game has, in its order (the GBA games' when unset), the ones that grow, and labels of its own. */
  stats?: GbaStat[]
  growing?: GbaStat[]
  statLabels?: Partial<Record<GbaStat, string>>
  /** How promoting changes stats where the class data has no gains: the difference between the classes' bases for `difference`, and
   * `raise` lifted to the new class's bases where lower (Mystery of the Emblem). Unset: the difference for every stat but Luck. */
  promotion?: { difference: GbaStat[]; raise: GbaStat[]; noneRaised?: GbaStats }
  /** Fixed supports instead of support points (Mystery of the Emblem), and what they add, in words. */
  supportBonuses?: GbaSupportBonus[]
  supportBonusText?: string
  /** Shadow Dragon's stats and level-ups (arm9 0x203c6c0, 0x203d6dc): a stat is the unit's own base + the class's + the points gained,
   * read through the class's cap and floored at 0, and a level-up adds a catch-up bonus; averages worked out exactly, stat by stat
   * (`dynamicGrowth.ts`). */
  catchUp?: boolean
  /** New Mystery's stats (arm9 0x204efa4, 0x205092c): as Shadow Dragon's, the unit's own base + the class's + the points gained, read
   * through the class's cap, but with no catch-up bonus. */
  ownStats?: boolean
  /** Classes of a reclass set offered in turn (Shadow Dragon's Dracoknight and Falcoknight): the first, or the next once the unit has
   * been in it. */
  reclassSwap?: string[]
  /** Supports with a bonus per rank (Shadows of Valentia), and what to say about them. */
  rankedSupports?: GbaRankedSupport[]
  rankedSupportText?: string
  /** How a class change works, in the planner's note (the GBA games' promotion item when unset). */
  promotionText?: string
  /** The real chance per level of a listed growth, when the game's roll makes it differ (FE1: a random byte / 25 against the growth in
   * tenths, so 25G/256 of G tenths: 0.977 of the listed rate), and what to say about it. */
  growthScale?: { factor: number; text: string }
  /** The Avatar's creation (New Mystery's Kris), picked in the Unit Planner: the class from its list and the answers, which add to the
   * unit's own bases and growths. */
  avatar?: GbaAvatar
  /** Story choices that move when some units join (New Mystery's prologue questions): picked in the Roster, or under the spoiler block
   * as the chapter bar reaches them. */
  choices?: GbaJoinChoice[]
  /** One-way supports (New Mystery), what each level adds ([Hit, Avoid, Crit, Crit avoid] at no level, C, B and A) and the rule. */
  slotSupports?: GbaSlotSupport[]
  slotSupportBonus?: number[][]
  slotSupportText?: string
  /** Talks at the base, and what to say about them. */
  baseTalks?: GbaBaseTalk[]
  baseTalkText?: string
  /** The setting that opens every class of the unit's gender to reclassing (`GbaUnit.reclassAll`), as the Unit Planner words it. */
  reclassAllLabel?: string
  /** A unit's portrait where the game builds it from parts (New Mystery's Kris); the uploaded portrait otherwise. */
  portrait?: (unit: GbaUnit, size: number) => ReactNode
  /** More in the Roster under a unit (the Avatar's looks, by the portraits as Fates' Corrin's are). */
  rosterExtra?: (unit: GbaUnit) => ReactNode
  /** What the Roster calls a unit's `altName` ("In the translation"). */
  altNameLabel?: string
  /** Each unit's average gain per level of each stat, where the game's roll makes it differ from the growth (Gaiden: one random byte
   * for all six rolls, and 1 HP when every roll fails), and what to say about it. Used for the averages in place of the growth. */
  expectedGrowths?: Record<string, Partial<GbaStats>>
  expectedGrowthText?: string
  /** Spells learned by level (Gaiden): each unit's known on joining and learned at the game's count of levels, each class's spells
   * (a spell is learned only while the class has it), the spell a change into a class gives, and how the count goes: the class whose
   * level-ups don't count, and the class change that starts it again. */
  spells?: Record<string, { known: string[]; learn: { level: number; atLevel?: number; spell: string }[] }>
  classSpells?: Record<string, string[]>
  classChangeSpells?: Record<string, string>
  spellCount?: { skip: string; restart: { from: string; to: string } }
  spellText?: string
  /** Each unit's spell lists by class (Shadows of Valentia), for the Spells tab, and how they're learned. */
  spellBook?: Record<string, GbaSpellList[]>
  spellBookText?: string
  /** Every spell's numbers and what it does: the Spells tab's cards. */
  spellStats?: Record<string, GbaSpellInfo>
}

const statsOf = (data: GbaData) => data.stats ?? GBA_STATS
const growingOf = (data: GbaData) => data.growing ?? GBA_GROWING
const labelOf = (data: GbaData, s: GbaStat) => data.statLabels?.[s] ?? GBA_STAT_LABELS[s]

const MAX_LEVEL = 20
/** A promotion item works from level 10 and starts the new class at level 1 (Serenes Forest). */
const PROMOTE_LEVEL = 10

/** A unit's plan: up to two promotions (a trainee's at Lv 10, then a promotion item's), each into a class of its own picking. */
export interface GbaPlan {
  promoteAt: number | null
  targetLevel: number
  to?: string
  promoteAt2?: number | null
  to2?: string
  promoteAt3?: number | null
  to3?: string
  /** The Avatar's creation: the class (its index in the unit's list) and each question's answer (New Mystery's Kris). */
  avatarClass?: number
  answers?: number[]
  /** Class changes after the third, up to MAX_CHANGES (Gaiden's Dread Fighter goes back to a Villager and round again). */
  more?: { at: number | null; to?: string }[]
}

/** A planner keeps every class change the game allows, up to 30 (CLAUDE.md). */
const MAX_CHANGES = 30

interface GbaState {
  plans: Record<string, Record<string, GbaPlan>>
  /** The story picked in each game told in several, shared by its tabs. */
  stories: Record<string, string>
  /** A game's own switches, by name (New Mystery's every-class reclassing once Hard is cleared). */
  settings: Record<string, Record<string, boolean>>
  setPlan: (gameId: string, unitId: string, plan: GbaPlan | null) => void
  setStory: (gameId: string, storyId: string) => void
  setSetting: (gameId: string, key: string, on: boolean) => void
}

/** Saved under `fe-roster-gba`, so the backup (src/logic/backup.ts) picks it up. */
const useGbaStore = create<GbaState>()(
  persist(
    (set) => ({
      plans: {},
      stories: {},
      settings: {},
      setPlan: (gameId, unitId, plan) =>
        set((state) => {
          const game = { ...state.plans[gameId] }
          if (plan) game[unitId] = plan
          else delete game[unitId]
          return { plans: { ...state.plans, [gameId]: game } }
        }),
      setStory: (gameId, storyId) => set((state) => ({ stories: { ...state.stories, [gameId]: storyId } })),
      setSetting: (gameId, key, on) =>
        set((state) => ({ settings: { ...state.settings, [gameId]: { ...state.settings?.[gameId], [key]: on } } })),
    }),
    { name: 'fe-roster-gba' },
  ),
)

/** A unit's saved plan, for a game's own parts: the Avatar's portrait wears the outfit of the class picked in the Unit Planner. */
export function useGbaPlan(gameId: string, unitId: string): GbaPlan | undefined {
  return useGbaStore((s) => s.plans[gameId]?.[unitId])
}

const ALL_CLASSES = 'reclassAll'

/** The Avatar as the Unit Planner's creation picks make them (New Mystery's Kris, arm9 0x2028b04 and 0x2028b60): the class picked, with
 * its reclass set and starting ranks (the starting weapon's kind higher), and each answer's bases and growths on top of the unit's own.
 * Any other unit as it is. */
export function avatarUnit(data: GbaData, unit: GbaUnit, plan?: Pick<GbaPlan, 'avatarClass' | 'answers'>): GbaUnit {
  const av = data.avatar
  const options = av?.classes[unit.id]
  if (!av || !options?.length) return unit
  const option = options[plan?.avatarClass ?? av.defaults.classIndex] ?? options[0]
  const from = data.classes[unit.classId]
  const to = data.classes[option.classId] ?? from
  const bases: GbaStats = {}
  for (const s of statsOf(data)) bases[s] = (unit.bases[s] ?? 0) - (from.bases[s] ?? 0) + (to.bases[s] ?? 0)
  const growths: GbaStats = { ...unit.growths }
  av.questions.forEach((q, i) => {
    const answer = q.answers[plan?.answers?.[i] ?? av.defaults.answers[i]]
    for (const [s, v] of Object.entries(answer?.bases ?? {}) as [GbaStat, number][]) bases[s] = (bases[s] ?? 0) + v
    for (const [s, v] of Object.entries(answer?.growths ?? {}) as [GbaStat, number][]) growths[s] = (growths[s] ?? 0) + v
  })
  const ranks =
    av.ranks && to.weapons
      ? Object.fromEntries(to.weapons.map((w) => [w.toLowerCase(), w === option.weapon ? av.ranks!.start : av.ranks!.other]))
      : unit.ranks
  return { ...unit, classId: to.id, bases, growths, ranks, reclass: option.reclass ?? unit.reclass }
}

/** An answer's bonuses in words: "Skl +2, Spd +2 · Skl +5%, Spd +5%". */
function answerText(data: GbaData, a: GbaAvatarAnswer): string {
  const part = (values: GbaStats | undefined, suffix: string) =>
    statsOf(data)
      .filter((s) => values?.[s])
      .map((s) => `${labelOf(data, s)} +${values![s]}${suffix}`)
      .join(', ')
  return [part(a.bases, ''), part(a.growths, '%')].filter(Boolean).join(' · ')
}

/** The units as the story choices picked so far make them join (New Mystery's prologue questions); a choice not picked keeps the data's
 * join, which names both answers. */
function withChoices(data: GbaData, picks: Record<string, string>): GbaData {
  if (!data.choices?.length) return data
  const moves = new Map<string, GbaJoinChoice['options'][number]['joins'][string]>()
  for (const c of data.choices) {
    const option = c.options.find((o) => o.id === picks[`${data.gameId}/${c.id}`])
    for (const [id, j] of Object.entries(option?.joins ?? {})) moves.set(id, j)
  }
  if (!moves.size) return data
  return {
    ...data,
    units: data.units.map((u) => {
      const j = moves.get(u.id)
      return j ? { ...u, joinChapter: j.joinChapter, join: j.join, away: j.away } : u
    }),
  }
}

/** A story choice as the spoiler block asks it: at the chapter after the one it ends, every answer carrying on there. */
function choiceBranches(data: GbaData): GbaBranch[] {
  return (data.choices ?? []).flatMap((c) => {
    const next = data.chapters[data.chapters.findIndex((ch) => ch.id === c.after) + 1]
    return next && c.after !== next.id
      ? [{ id: c.id, after: c.after, question: c.question, choices: c.options.map((o) => ({ id: o.id, label: o.label, chapters: [next.id] })) }]
      : []
  })
}

/** The story's splits as the spoiler block walks them: a game's own (The Binding Blade's), or for a game whose stories part after
 * shared chapters (The Sacred Stones) the stories themselves, after the last shared chapter. */
function branchesOf(data: GbaData): GbaBranch[] {
  return [...ownBranches(data), ...choiceBranches(data)]
}

function ownBranches(data: GbaData): GbaBranch[] {
  if (data.branches) return data.branches
  const first = data.chapters.findIndex((c) => c.story)
  if (!data.stories?.length || first <= 0) return []
  return [
    {
      id: 'route',
      after: data.chapters[first - 1].id,
      question: "The story splits here: pick the route you're playing to carry on.",
      choices: data.stories.map((st) => ({ id: st.id, label: st.label, chapters: data.chapters.filter((c) => c.story === st.id).map((c) => c.id) })),
    },
  ]
}

/** Stories told apart from the start, each its own army (Lyn's, Eliwood's and Hector's; the two Books; Alm's and Celica's). */
const separateStories = (data: GbaData) => !!data.stories?.length && data.chapters.every((c) => c.story)

/** The chapters the spoiler block walks with the routes picked so far: up to the first split not picked yet, which comes back. */
function walkOf(data: GbaData, chapters: GbaChapter[], picks: Record<string, string>) {
  const branches = branchesOf(data)
  const steps: GbaChapter[] = []
  const picked: string[] = []
  for (const ch of chapters) {
    const branch = branches.find((b) => b.choices.some((c) => c.chapters.includes(ch.id)))
    if (branch) {
      const pick = picks[`${data.gameId}/${branch.id}`]
      const choice = branch.choices.find((c) => c.id === pick)
      if (!choice) return { steps, picked, split: branch }
      if (!choice.chapters.includes(ch.id)) continue
      if (!picked.includes(choice.label)) picked.push(choice.label)
    }
    steps.push(ch)
  }
  return { steps, picked, split: undefined }
}

/** The game's data for the story picked (all of it for a game told in one), and the switch to pick another. With the spoiler block
 * on, the chapters you've reached and the units they've brought, and the bar that walks the story (asking at each split). */
export function useStory(game: GbaData): { view: GbaData; story?: GbaStory; picker: ReactNode } {
  const picked = useGbaStore((s) => s.stories?.[game.gameId])
  const setStory = useGbaStore((s) => s.setStory)
  const block = useSpoilerStore((s) => s.block)
  const progress = useSpoilerStore((s) => s.progress)
  const branchPicks = useSpoilerStore((s) => s.branches)
  const data = withChoices(game, branchPicks)
  const setProgress = useSpoilerStore((s) => s.setProgress)
  const setBranch = useSpoilerStore((s) => s.setBranch)
  if (block) return spoilerView(data, picked, setStory, { progress, branchPicks, setProgress, setBranch })
  if (!data.stories?.length) return { view: data, picker: null }
  const story = data.stories.find((s) => s.id === picked) ?? data.stories.find((s) => s.id === data.defaultStory) ?? data.stories[0]
  const view: GbaData = {
    ...data,
    chapters: data.chapters.filter((c) => !c.story || c.story === story.id),
    units: data.units.filter((u) => !u.story || u.story === story.id),
  }
  return { view, story, picker: <StoryPicker data={data} story={story} onPick={(id) => setStory(data.gameId, id)} /> }
}

interface SpoilerState {
  progress: Record<string, number>
  branchPicks: Record<string, string>
  setProgress: (key: string, at: number) => void
  setBranch: (key: string, choice: string | null) => void
}

/** The spoiler block's view: a game told in separate stories walks the one picked (each with its own place); any other walks its
 * chapters in order, asking at each split. A unit shows once the chapter they join in is reached. */
function spoilerView(data: GbaData, picked: string | undefined, setStory: (gameId: string, id: string) => void, sp: SpoilerState) {
  const separate = separateStories(data)
  const story = separate ? (data.stories!.find((s) => s.id === picked) ?? data.stories!.find((s) => s.id === data.defaultStory) ?? data.stories![0]) : undefined
  const key = story ? `${data.gameId}/${story.id}` : data.gameId
  const { steps, picked: routes, split } = walkOf(data, story ? data.chapters.filter((c) => c.story === story.id) : data.chapters, sp.branchPicks)
  const at = Math.min(sp.progress[key] ?? 0, Math.max(0, steps.length - 1))
  const reached = steps.slice(0, at + 1)
  const ids = new Set(reached.map((c) => c.id))
  // The route a story-split game is on, once picked at its split: its own units come in with it.
  const route = !separate && data.stories?.length ? data.stories.find((s) => s.id === sp.branchPicks[`${data.gameId}/route`]) : undefined
  const view: GbaData = {
    ...data,
    chapters: reached,
    units: data.units.filter((u) => ids.has(u.joinChapter) && (!u.story || u.story === (story ?? route)?.id)),
  }
  const onChange = (i: number) => {
    // Going back before a split takes back the route picked there.
    for (const b of branchesOf(data)) {
      const pickedChoice = b.choices.find((c) => c.id === sp.branchPicks[`${data.gameId}/${b.id}`])
      const first = pickedChoice ? steps.findIndex((c) => pickedChoice.chapters.includes(c.id)) : -1
      if (first >= 0 && i < first) sp.setBranch(`${data.gameId}/${b.id}`, null)
    }
    sp.setProgress(key, Math.max(0, i))
  }
  const bar = (
    <ChapterBar
      steps={steps}
      at={at}
      onChange={onChange}
      picked={routes.join(', ') || undefined}
      split={
        split && {
          question: split.question,
          choices: split.choices.map((c) => ({ id: c.id, label: c.label, proceed: `Proceed: ${c.label}` })),
          onPick: (id) => {
            sp.setBranch(`${data.gameId}/${split.id}`, id)
            sp.setProgress(key, steps.length)
          },
        }
      }
    />
  )
  const picker = (
    <div className="space-y-2">
      {story && <StoryPicker data={data} story={story} onPick={(id) => setStory(data.gameId, id)} />}
      {bar}
    </div>
  )
  return { view, story: story ?? route, picker }
}

/** The switch between a game's stories. */
function StoryPicker({ data, story, onPick }: { data: GbaData; story: GbaStory; onPick: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Story">
      {(data.stories ?? []).map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={s.id === story.id}
          onClick={() => onPick(s.id)}
          className={`rounded-md border px-3 py-1 text-sm ${
            s.id === story.id ? 'border-violet-500 bg-violet-950/50 text-neutral-100' : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-600'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

const selectClass = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200'

function artId(gameId: string, name: string): string {
  return `${gameId}/${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
}

export function UnitPortrait({ data, unit, size = 64 }: { data: GbaData; unit: GbaUnit; size?: number }) {
  return data.portrait?.(unit, size) ?? <Portrait characterId={artId(data.gameId, unit.name)} isChild={false} size={size} />
}

/** A story choice that moves when units join, as buttons (block off; the chapter bar asks it under the spoiler block). */
function JoinChoicePicker({ data, choice }: { data: GbaData; choice: GbaJoinChoice }) {
  const key = `${data.gameId}/${choice.id}`
  const picked = useSpoilerStore((s) => s.branches[key])
  const setBranch = useSpoilerStore((s) => s.setBranch)
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-xs transition-colors ${
      on ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
    }`
  return (
    <div className="mb-2 space-y-1.5">
      <div className="text-xs text-neutral-400">{choice.question}</div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setBranch(key, null)} className={chip(!picked)}>
          Not picked
        </button>
        {choice.options.map((o) => (
          <button key={o.id} type="button" onClick={() => setBranch(key, o.id)} className={chip(picked === o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function fmt(v: number | undefined): string {
  if (v === undefined) return '–'
  return String(Math.trunc(v))
}

/** Rows of stats, each a block of stats four to a line (as Fates' planner); a stat at its cap is green. */
function StatTable({ data, rows }: { data: GbaData; rows: { label: string; title?: ReactNode; values: GbaStats; caps?: GbaStats; suffix?: string }[] }) {
  const stats = statsOf(data)
  const labels = Object.fromEntries(stats.map((s) => [s, labelOf(data, s)])) as Record<(typeof stats)[number], string>
  return <StatBlocks stats={stats} labels={labels} fmt={fmt} rows={rows} />
}

export function useScreenshotUnit(unit: GbaUnit | undefined) {
  const setUnitLabel = useScreenshotContextStore((state) => state.setUnitLabel)
  useEffect(() => {
    setUnitLabel(unit?.name ?? '')
    return () => setUnitLabel('')
  }, [unit, setUnitLabel])
}

function chapterLabel(data: GbaData, id: string): string {
  return data.chapters.find((c) => c.id === id)?.label ?? id
}

function joinText(data: GbaData, u: GbaUnit): string {
  const where = chapterLabel(data, u.joinChapter)
  const j = u.join
  if (j.how === 'talk') return `${where}: talk to them with ${j.with?.join(' or ') ?? 'another unit'}`
  if (j.how === 'visit') return `${where}: visit their village${j.with?.length ? ` with ${j.with.join(' or ')}` : ''}`
  if (j.how === 'event') return `${where}: joins ${j.turn ? `on turn ${j.turn}` : 'during the chapter'}`
  if (j.how === 'unlock') return `${where}: unlocked`
  if (j.how === 'end') return `${where}: joins at the end of the chapter${j.with?.length ? ` if ${j.with.join(' or ')} talked to them` : ''}`
  return `${where}: joins at the start`
}

export function UnitSelect({ data, value, onChange }: { data: GbaData; value: string; onChange: (id: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${selectClass} w-full max-w-xs`}>
      {data.chapters.map((ch) => {
        const units = data.units.filter((u) => u.joinChapter === ch.id)
        if (units.length === 0) return null
        return (
          <optgroup key={ch.id} label={ch.label}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}

/** A unit's supports: each partner with the pair's starting points and gain per turn. */
function supportsOf(data: GbaData, unitId: string) {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  return data.supports
    .filter((s) => s.a === unitId || s.b === unitId)
    .map((s) => ({ partner: byId.get(s.a === unitId ? s.b : s.a)!, support: s }))
    .filter((x) => x.partner)
}

/** A unit's fixed supports: who gives it a bonus, and whom it gives one. */
function bonusesOf(data: GbaData, unitId: string) {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const all = data.supportBonuses ?? []
  return {
    gets: all.filter((b) => b.receiver === unitId).map((b) => ({ partner: byId.get(b.giver)!, bonus: b.bonus })).filter((x) => x.partner),
    gives: all.filter((b) => b.giver === unitId).map((b) => ({ partner: byId.get(b.receiver)!, bonus: b.bonus })).filter((x) => x.partner),
  }
}

/** A unit's ranked supports: each partner, what the unit gets and gives at each rank, and the points and acts. */
function rankedOf(data: GbaData, unitId: string) {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  return (data.rankedSupports ?? [])
    .filter((p) => p.a === unitId || p.b === unitId)
    .map((p) => {
      const mine = p.a === unitId
      return { partner: byId.get(mine ? p.b : p.a)!, gets: mine ? p.aGets : p.bGets, gives: mine ? p.bGets : p.aGets, points: p.points, acts: p.acts }
    })
    .filter((x) => x.partner)
}

/** Turns of building up for each level: points needed less the start, over the gain per turn, rounded up. */
function turnsFor(levels: number[], s: GbaSupport): (number | null)[] {
  return levels.map((need) => (s.perTurn ? Math.max(0, Math.ceil((need - s.start) / s.perTurn)) : null))
}

/** Who the unit is, as Fates' Roster (user, 2026-11-05): their stats, growths, maximums and weapon ranks are in the Unit Planner, their
 * supports in the Supports tab. */
function UnitDetail({ data, unit: joined }: { data: GbaData; unit: GbaUnit }) {
  const plan = useGbaStore((s) => s.plans[data.gameId]?.[joined.id])
  const block = useSpoilerStore((s) => s.block)
  // The Avatar in the class and with the answers picked in the Unit Planner.
  const unit = avatarUnit(data, joined, plan)
  const cls = data.classes[unit.classId]
  const promo = optionsOf(data, cls)
  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <UnitPortrait data={data} unit={unit} size={128} />
        <div className="min-w-0 space-y-1 text-sm text-neutral-300">
          <h3 className="text-lg font-semibold text-neutral-100">{unit.name}</h3>
          {unit.altName && (
            <div className="text-neutral-500">
              {data.altNameLabel ?? 'Also called'}: {unit.altName}
            </div>
          )}
          <div>
            {cls.name} · Lv {unit.level}
            {promo.length > 0 && <span className="text-neutral-500"> · promotes to {promo.map((c) => c.name).join(' or ')}</span>}
          </div>
          {cls.storyPromotion && <div className="text-neutral-400">{cls.storyPromotion}</div>}
          {unit.reclass && (
            <div>
              <span className="text-neutral-500">Reclass set: </span>
              {unit.reclass.map((id) => data.classes[id]?.name ?? id).join(', ')}
            </div>
          )}
          {unit.affinity && (
            <div>
              <span className="text-neutral-500">Affinity: </span>
              {unit.affinity}
            </div>
          )}
          <div>
            <span className="text-neutral-500">Joins: </span>
            {joinText(data, unit)}
          </div>
          {unit.join.note && <div className="text-neutral-400">{unit.join.note}</div>}
          {unit.traits?.map((t) => (
            <div key={t}>
              <span className="text-neutral-500">Special: </span>
              {t}
            </div>
          ))}
          {data.avatar?.classes[unit.id] && <div className="text-neutral-500">The class and the creation's answers are picked in the Unit Planner.</div>}
          {/* When they leave and come back: blank under the spoiler block (CLAUDE.md). */}
          {!block &&
            unit.away?.map((line) => (
              <div key={line} className="text-neutral-400">
                {line}
              </div>
            ))}
        </div>
      </div>
      {data.rosterExtra?.(unit)}
    </div>
  )
}

/** Every playable unit by the chapter they join; tapping one shows their data below the list. */
export function GbaRoster({ data: game }: { data: GbaData }) {
  const { view: data, picker } = useStory(game)
  const block = useSpoilerStore((s) => s.block)
  const [selectedId, setSelectedId] = useState(data.units[0]?.id ?? '')
  const detailRef = useRef<HTMLDivElement>(null)
  const selected = data.units.find((u) => u.id === selectedId) ?? data.units[0]
  useScreenshotUnit(selected)
  return (
    <div className="space-y-6">
      {picker}
      <div className="space-y-3">
        {data.chapters.map((ch, i) => {
          const units = data.units.filter((u) => u.joinChapter === ch.id)
          // A story choice made at the end of the chapter before, picked here with the block off (the chapter bar asks it with it on).
          const choices = block ? [] : (data.choices ?? []).filter((c) => i > 0 && c.after === data.chapters[i - 1].id)
          if (units.length === 0 && choices.length === 0) return null
          return (
            <div key={ch.id}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{ch.label}</h3>
              {ch.note && <p className="mb-1 text-xs text-neutral-500">{ch.note}</p>}
              {choices.map((c) => (
                <JoinChoicePicker key={c.id} data={data} choice={c} />
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
        {selected && <UnitDetail data={data} unit={selected} />}
      </div>
    </div>
  )
}

interface Stage {
  classId: string
  level: number
  stats: GbaStats
}

/** Average stats: each level adds the growth rate, held at the class's caps. Promoting adds the difference between the classes'
 * bases (Con and Mov too) and starts again at level 1. */
const maxLevelOf = (cls: GbaClass) => cls.maxLevel ?? MAX_LEVEL
/** The level a class must reach before it can change (a promotion item's 10, unless the class says). */
const minLevelOf = (cls: GbaClass) => cls.promoteLevel ?? PROMOTE_LEVEL
/** A unit's maximums: their own where the game keeps them per character (Shadows of Valentia), else the class's. */
const capsFor = (unit: GbaUnit, cls: GbaClass): GbaStats => unit.caps ?? cls.caps
const optionsOf = (data: GbaData, cls: GbaClass) =>
  (cls.promotions ?? (cls.promotesTo ? [cls.promotesTo] : [])).map((id) => data.classes[id]).filter(Boolean)
/** Every change on offer from a class: its promotions, then (Shadow Dragon) the unit's reclass set's classes of the same tier. `been`:
 * the classes the unit has been in, for the swap (the Falcoknight replaces the Dracoknight once the unit has been one). */
const changesOf = (data: GbaData, unit: GbaUnit, cls: GbaClass, been: string[] = [cls.id]) => {
  const promos = optionsOf(data, cls)
  const [first, second] = data.reclassSwap ?? []
  const hidden = second && been.includes(second) ? first : second
  const reclass = (unit.reclass ?? [])
    .map((id) => data.classes[id])
    .filter((c) => c && c.id !== cls.id && c.id !== hidden && !!c.promoted === !!cls.promoted && !promos.includes(c))
  return [...promos, ...reclass]
}
/** A unit's growth in a class: their own plus what the class adds (Shadow Dragon), never below 0 (Serenes Forest's full growths: Marth's
 * Magic as a Lord, 5 - 10, is 0). */
const growthIn = (unit: GbaUnit, cls: GbaClass, s: GbaStat) => Math.max(0, (unit.growths[s] ?? 0) + (cls.growths?.[s] ?? 0))
function withClassGrowths(data: GbaData, unit: GbaUnit, cls: GbaClass): GbaStats {
  const out: GbaStats = {}
  for (const s of growingOf(data)) out[s] = growthIn(unit, cls, s)
  return out
}
/** The kinds of weapon a class can use, or none (a Dancer, a Transporter). */
const weaponsText = (cls: GbaClass) => (cls.weapons?.length ? cls.weapons.join(', ') : 'none')
const isPromotion = (data: GbaData, from: GbaClass, to: GbaClass) => optionsOf(data, from).some((c) => c.id === to.id)

interface Step {
  from: GbaClass
  options: GbaClass[]
  to: GbaClass
  /** The level it's taken at; a trainee class's is its last level, and it can't be declined. */
  at: number
  forced: boolean
  /** A promotion starts again at Lv 1; a reclass (Shadow Dragon) keeps the level. */
  promotion: boolean
}

/** The promotions a plan takes: the first from the class the unit joins in, a second from the class that one leads to. */
function stepsOf(data: GbaData, unit: GbaUnit, plan: GbaPlan): Step[] {
  const steps: Step[] = []
  let cls = data.classes[unit.classId]
  let level = unit.level
  const wanted: [number | null, string | undefined][] = [
    [plan.promoteAt, plan.to],
    [plan.promoteAt2 ?? null, plan.to2],
    [plan.promoteAt3 ?? null, plan.to3],
    ...(plan.more ?? []).map((m): [number | null, string | undefined] => [m.at, m.to]),
  ].slice(0, MAX_CHANGES) as [number | null, string | undefined][]
  const been = [cls.id]
  for (const [at, to] of wanted) {
    const options = changesOf(data, unit, cls, been)
    if (!options.length) break
    const forced = !!cls.autoPromote
    if (!forced && at === null) break
    const max = maxLevelOf(cls)
    const next = options.find((o) => o.id === to) ?? options[0]
    const promotion = isPromotion(data, cls, next)
    const taken = forced ? max : Math.max(level, promotion ? minLevelOf(cls) : level, Math.min(max, at!))
    steps.push({ from: cls, options, to: next, at: taken, forced, promotion })
    been.push(next.id)
    cls = next
    level = promotion ? 1 : taken
  }
  return steps
}

/** Shadow Dragon's averages with the catch-up bonus: each stat a distribution of [points gained, running total] through every level-up
 * of the plan, shown as the average of the stat as the game reads it (the unit's own base + the class's + the points, 0 below 0, held at
 * the cap). A class change keeps the points and running totals and swaps the class's bases, caps and growths. */
function projectCatchUp(data: GbaData, unit: GbaUnit, plan: GbaPlan): Stage[] {
  const start = data.classes[unit.classId]
  const own: GbaStats = {}
  for (const s of statsOf(data)) own[s] = (unit.bases[s] ?? 0) - (start.bases[s] ?? 0)
  const growing = new Set(growingOf(data))
  const states = new Map(growingOf(data).map((s) => [s, joinState()]))
  const shown = (cls: GbaClass): GbaStats => {
    const caps = capsFor(unit, cls)
    const out: GbaStats = {}
    for (const s of statsOf(data)) {
      const base = (own[s] ?? 0) + (cls.bases[s] ?? 0)
      out[s] = growing.has(s) ? averageShown(states.get(s)!, base, caps[s]) : Math.max(0, base)
    }
    return out
  }
  const levelUps = (cls: GbaClass, count: number) => {
    const caps = capsFor(unit, cls)
    for (let i = 0; i < count; i++)
      for (const s of growing)
        states.set(s, levelUp(states.get(s)!, (unit.growths[s] ?? 0) + (cls.growths?.[s] ?? 0), (own[s] ?? 0) + (cls.bases[s] ?? 0), caps[s], !!data.catchUp))
  }
  let cls = start
  let level = unit.level
  const stages: Stage[] = [{ classId: cls.id, level, stats: shown(cls) }]
  for (const step of stepsOf(data, unit, plan)) {
    levelUps(cls, step.at - level)
    if (step.at > level) stages.push({ classId: cls.id, level: step.at, stats: shown(cls) })
    cls = step.to
    level = step.promotion ? 1 : step.at
    stages.push({ classId: cls.id, level, stats: shown(cls) })
  }
  const target = Math.max(level, Math.min(maxLevelOf(cls), plan.targetLevel))
  if (target > level) {
    levelUps(cls, target - level)
    stages.push({ classId: cls.id, level: target, stats: shown(cls) })
  }
  return stages
}

/** Average stats: each level adds the growth rate, held at the class's caps. Promoting adds the new class's gains where the game keeps
 * them (Con and Mov from the class), otherwise the difference between the classes' bases, and starts again at level 1. */
function project(data: GbaData, unit: GbaUnit, plan: GbaPlan): Stage[] {
  if (data.catchUp || data.ownStats) return projectCatchUp(data, unit, plan)
  const capped = (stats: GbaStats, cls: GbaClass) => {
    const out = { ...stats }
    const caps = capsFor(unit, cls)
    for (const s of statsOf(data)) if (caps[s] !== undefined && out[s] !== undefined) out[s] = Math.min(out[s]!, caps[s]!)
    return out
  }
  const grow = (stats: GbaStats, levels: number, cls: GbaClass) => {
    const out = { ...stats }
    const expected = data.expectedGrowths?.[unit.id]
    for (const s of growingOf(data))
      out[s] = (out[s] ?? 0) + ((expected?.[s] ?? growthIn(unit, cls, s) * (data.growthScale?.factor ?? 1)) / 100) * Math.max(0, levels)
    return capped(out, cls)
  }
  let cls = data.classes[unit.classId]
  let level = unit.level
  let stats: GbaStats = { ...unit.bases }
  const stages: Stage[] = [{ classId: cls.id, level, stats }]
  for (const step of stepsOf(data, unit, plan)) {
    stats = grow(stats, step.at - level, cls)
    if (step.at > level) stages.push({ classId: cls.id, level: step.at, stats })
    stats = { ...stats }
    // The game's own gains when its class data has them (The Blazing Blade 0x08029818, The Sacred Stones 0x0802BC20: added, held at
    // the new caps; Con and Mov come from the class); otherwise the difference between the two classes' bases.
    const gains = step.to.gains
    const diff = (s: GbaStat) => (step.to.bases[s] ?? 0) - (cls.bases[s] ?? 0)
    if (gains) {
      for (const s of statsOf(data)) if (s !== 'lck') stats[s] = (stats[s] ?? 0) + (s !== 'con' && s !== 'mov' ? (gains[s] ?? 0) : diff(s))
    } else if (step.to.keepsStats) {
      // Only the level changes (Gaiden's Princess: Celica's scene, 13:$97D8).
    } else if (data.promotion) {
      // Mystery of the Emblem ($83:FD2B): the old class's bases come off and the new class's go on ($93:D9FF, $93:D951); HP and the
      // weapon level are lifted to the new class's where lower ($83:FD76). Gaiden (8:$A96C): each lifted to the new class's bases, and
      // max HP + 1 when none is (`noneRaised`; worked on the averages).
      const lifted = data.promotion.raise.some((s) => (stats[s] ?? 0) < (step.to.bases[s] ?? 0))
      for (const s of data.promotion.difference) stats[s] = (stats[s] ?? 0) + diff(s)
      for (const s of data.promotion.raise) stats[s] = Math.max(stats[s] ?? 0, step.to.bases[s] ?? 0)
      if (!lifted) for (const [s, v] of Object.entries(data.promotion.noneRaised ?? {}) as [GbaStat, number][]) stats[s] = (stats[s] ?? 0) + v
    } else {
      for (const s of statsOf(data)) if (s !== 'lck') stats[s] = (stats[s] ?? 0) + diff(s)
    }
    stats = capped(stats, step.to)
    cls = step.to
    level = step.promotion ? 1 : step.at
    stages.push({ classId: cls.id, level, stats })
  }
  const target = Math.max(level, Math.min(maxLevelOf(cls), plan.targetLevel))
  if (target > level) stages.push({ classId: cls.id, level: target, stats: grow(stats, target - level, cls) })
  return stages
}

/** The spells a plan gives (Gaiden, 1:$ADDE): those known on joining, the one a class change gives (a Sage's Recover), and each
 * learned spell at the level-up where the game's count reaches it, if the class has the spell then. The count goes up with every
 * level-up but in the skipped class (the Villager), and starts again on the change that restarts it (a Villager becoming a Mage). */
function spellsAlong(data: GbaData, unit: GbaUnit, plan: GbaPlan, steps: Step[]) {
  const own = data.spells?.[unit.id]
  const got: { spell: string; how: string }[] = (own?.known ?? []).map((spell) => ({ spell, how: 'known on joining' }))
  const has = (spell: string) => got.some((g) => g.spell === spell)
  let count = 0
  let cls = data.classes[unit.classId]
  let level = unit.level
  const levelUps = (to: number) => {
    for (let l = level + 1; l <= to; l++) {
      if (cls.id !== data.spellCount?.skip) count++
      for (const x of own?.learn ?? [])
        if (x.level - 1 === count && (data.classSpells?.[cls.id] ?? []).includes(x.spell) && !has(x.spell)) got.push({ spell: x.spell, how: `${cls.name} Lv ${l}` })
    }
    level = Math.max(level, to)
  }
  for (const step of steps) {
    levelUps(step.at)
    const from = cls
    cls = step.to
    level = step.promotion ? 1 : step.at
    if (from.id === data.spellCount?.restart.from && cls.id === data.spellCount.restart.to) count = 0
    const given = data.classChangeSpells?.[cls.id]
    if (given && !has(given)) got.push({ spell: given, how: `becoming a ${cls.name}` })
  }
  levelUps(Math.max(level, Math.min(maxLevelOf(cls), plan.targetLevel)))
  const missed = (own?.learn ?? []).filter((x) => !has(x.spell)).map((x) => x.spell)
  return { got, missed: [...new Set(missed)] }
}

function SpellsLine({ data, unit, plan, steps }: { data: GbaData; unit: GbaUnit; plan: GbaPlan; steps: Step[] }) {
  if (!data.spells) return null
  const { got, missed } = spellsAlong(data, unit, plan, steps)
  if (!got.length && !missed.length) return null
  return (
    <div className="space-y-1">
      <p className="text-sm text-neutral-300">
        <span className="text-neutral-500">Spells on this plan: </span>
        {got.length ? got.map((g) => `${g.spell} (${g.how})`).join(', ') : 'none'}
        {missed.length > 0 && <span className="text-neutral-500"> · not learned on it: {missed.join(', ')}</span>}
      </p>
      {data.spellText && <p className="text-xs text-neutral-500">{data.spellText}</p>}
    </div>
  )
}

/** One unit's average stats through a promotion. Saved per unit. */
export function GbaPlanner({ data: game }: { data: GbaData }) {
  const { view: data, picker } = useStory(game)
  const [unitId, setUnitId] = useState(data.units[0]?.id ?? '')
  const joined = data.units.find((u) => u.id === unitId) ?? data.units[0]
  useScreenshotUnit(joined)
  const saved = useGbaStore((s) => (joined ? s.plans[data.gameId]?.[joined.id] : undefined))
  const setPlan = useGbaStore((s) => s.setPlan)
  const allClasses = useGbaStore((s) => !!s.settings?.[data.gameId]?.[ALL_CLASSES])
  const setSetting = useGbaStore((s) => s.setSetting)
  const [capsPick, setCapsPick] = useState('')
  if (!joined) return null
  // The Avatar as created (New Mystery's Kris), and every class of the unit's gender once the setting opens them all.
  const made = avatarUnit(data, joined, saved)
  const unit = allClasses && made.reclassAll ? { ...made, reclass: made.reclassAll } : made
  const avatarOptions = data.avatar?.classes[unit.id]
  const start = data.classes[unit.classId]
  const first = changesOf(data, unit, start)
  const plan: GbaPlan = saved ?? {
    promoteAt: first.length ? maxLevelOf(start) : null,
    targetLevel: MAX_LEVEL,
    // A second promotion by default only where there is one (a trainee's), never a reclass.
    promoteAt2: first.length && isPromotion(data, start, first[0]) && optionsOf(data, first[0]).length ? MAX_LEVEL : null,
  }
  const atOf = [plan.promoteAt, plan.promoteAt2 ?? null, plan.promoteAt3 ?? null, ...(plan.more ?? []).map((m) => m.at)]
  // A change past the third is kept in `more`.
  const withMore = (k: number, patch: Partial<NonNullable<GbaPlan['more']>[number]>) => {
    const more = [...(plan.more ?? [])]
    while (more.length <= k) more.push({ at: null })
    more[k] = { ...more[k], ...patch }
    return { more }
  }
  const patchAt = (i: number, v: number | null): Partial<GbaPlan> =>
    i === 0 ? { promoteAt: v } : i === 1 ? { promoteAt2: v } : i === 2 ? { promoteAt3: v } : withMore(i - 3, { at: v })
  const patchTo = (i: number, v: string): Partial<GbaPlan> => (i === 0 ? { to: v } : i === 1 ? { to2: v } : i === 2 ? { to3: v } : withMore(i - 3, { to: v }))
  const update = (patch: Partial<GbaPlan>) => setPlan(data.gameId, unit.id, { ...plan, ...patch })
  const steps = stepsOf(data, unit, plan)
  const stages = project(data, unit, plan)
  const levels = (from: number, to = MAX_LEVEL) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)
  const finalClass = data.classes[stages[stages.length - 1].classId]
  const classIds = [...new Set(stages.map((st) => st.classId))]
  // Every class the unit can be in, for the caps' dropdown: the plan's first, then whatever the class changes lead to.
  const reachable = [...classIds]
  for (let i = 0; i < reachable.length; i++)
    for (const c of changesOf(data, unit, data.classes[reachable[i]])) if (!reachable.includes(c.id)) reachable.push(c.id)
  const capsId = reachable.includes(capsPick) ? capsPick : finalClass.id
  const last = steps[steps.length - 1]
  const lastLevel = last ? (last.promotion ? 1 : last.at) : unit.level
  // The promotions offered: the first from the class the unit joins in, then one from wherever that leads.
  const offers: { index: number; from: GbaClass; options: GbaClass[]; fromLevel: number }[] = []
  if (first.length) offers.push({ index: 0, from: start, options: first, fromLevel: unit.level })
  for (let i = 1; i < MAX_CHANGES; i++) {
    const prev = steps[i - 1]
    const next = prev ? changesOf(data, unit, prev.to, [unit.classId, ...steps.slice(0, i).map((s) => s.to.id)]) : []
    if (!prev || !next.length) break
    offers.push({ index: i, from: prev.to, options: next, fromLevel: prev.promotion ? 1 : prev.at })
  }
  const reclassing = !!unit.reclass
  const avatar = avatarOptions ? data.avatar : undefined
  const answers = avatar ? avatar.questions.map((_, i) => plan.answers?.[i] ?? avatar.defaults.answers[i]) : []
  return (
    <div className="space-y-4">
      {picker}
      <UnitSelect data={data} value={unit.id} onChange={setUnitId} />
      <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        {/* The Avatar's creation, as Fates' Corrin's boon and bane: what changes their stats (their looks are in the Roster). */}
        {avatar && avatarOptions && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Creation</h4>
            <div className="flex flex-wrap items-end gap-3 text-sm text-neutral-300">
              <label className="space-y-1">
                <span className="block text-xs text-neutral-500">Class</span>
                <select
                  value={plan.avatarClass ?? avatar.defaults.classIndex}
                  onChange={(e) => update({ avatarClass: Number(e.target.value), to: undefined, to2: undefined, to3: undefined })}
                  className={selectClass}
                >
                  {avatarOptions.map((o, i) => (
                    <option key={o.classId} value={i}>
                      {data.classes[o.classId]?.name}
                      {o.weapon ? ` (${o.weapon})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {avatar.questions.map((q, qi) => (
                <label key={q.question} className="min-w-0 space-y-1">
                  <span className="block text-xs text-neutral-500">{q.question}</span>
                  <select
                    value={answers[qi]}
                    onChange={(e) => update({ answers: answers.map((a, i) => (i === qi ? Number(e.target.value) : a)) })}
                    className={`${selectClass} max-w-full`}
                  >
                    {q.answers.map((a, ai) => (
                      <option key={a.label} value={ai}>
                        {a.label}: {answerText(data, a)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {avatar.text && <p className="text-xs text-neutral-500">{avatar.text}</p>}
          </div>
        )}
        {data.reclassAllLabel && made.reclassAll && (
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input type="checkbox" checked={allClasses} onChange={(e) => setSetting(data.gameId, ALL_CLASSES, e.target.checked)} />
            {data.reclassAllLabel}
          </label>
        )}
        <div className="flex flex-wrap items-end gap-4 text-sm text-neutral-300">
          {offers.map(({ index, from, options, fromLevel }) => {
            const step = steps[index]
            const at = atOf[index]
            const to = step?.to.id ?? options[0].id
            const promoting = isPromotion(data, from, data.classes[to])
            return (
              <div key={index} className="flex flex-wrap items-end gap-2">
                {options.length > 1 ? (
                  <label className="space-y-1">
                    <span className="block text-xs text-neutral-500">
                      {from.name} {reclassing ? 'changes' : 'promotes'} to
                    </span>
                    <select value={to} onChange={(e) => update(patchTo(index, e.target.value))} className={selectClass}>
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                          {reclassing ? (isPromotion(data, from, o) ? ' (promotion)' : ' (reclass)') : ''}
                          {o.weapons ? `: ${weaponsText(o)}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="space-y-1">
                  <span className="block text-xs text-neutral-500">
                    {options.length > 1 ? 'When' : `Promote to ${options[0].name}`}
                    {from.storyPromotion ? ' (by the story)' : ''}
                  </span>
                  {from.autoPromote ? (
                    <span className="block py-1 text-neutral-400">At Lv {maxLevelOf(from)} (automatic)</span>
                  ) : (
                    <select
                      value={at ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : Number(e.target.value)
                        update(patchAt(index, v))
                      }}
                      className={selectClass}
                    >
                      <option value="">{reclassing ? "Don't change" : "Don't promote"}</option>
                      {levels(Math.max(promoting && !from.storyPromotion ? minLevelOf(from) : fromLevel, fromLevel), maxLevelOf(from)).map((lv) => (
                        <option key={lv} value={lv}>
                          At Lv {lv}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              </div>
            )
          })}
          <label className="space-y-1">
            <span className="block text-xs text-neutral-500">Up to Lv (as {finalClass.name})</span>
            <select value={Math.max(lastLevel, Math.min(maxLevelOf(finalClass), plan.targetLevel))} onChange={(e) => update({ targetLevel: Number(e.target.value) })} className={selectClass}>
              {levels(lastLevel, maxLevelOf(finalClass)).map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
          </label>
          {saved && (
            <button type="button" onClick={() => setPlan(data.gameId, unit.id, null)} className="rounded-md bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700">
              Reset
            </button>
          )}
        </div>
        {[...new Map(offers.map(({ from }) => [from.id, from])).values()].map(
          (from) =>
            (from.storyPromotion || from.changeNote) && (
              <p key={from.id} className="text-xs text-neutral-400">
                {from.name}: {from.storyPromotion ?? from.changeNote}
              </p>
            ),
        )}
        <p className="text-xs text-neutral-500">
          {data.catchUp ? 'Average stats, from the level-up rule below.' : 'Average stats: each level adds the growth rate.'}{' '}
          {data.growthScale ? `${data.growthScale.text} ` : ''}Stats stop at the{' '}
          {unit.caps ? "unit's own maximums" : "class's caps"} (green).{' '}
          {data.promotionText ?? 'A promotion item works from Lv 10 and starts again at Lv 1 (Serenes Forest).'}{' '}
          {data.promotionText
            ? ''
            : (steps[0]?.to ?? first[0])?.gains
            ? "Promoting adds the new class's promotion gains from the game's class data, and Con and Mov become the new class's."
            : data.promotion
              ? "Promoting adds the difference between the classes' bases, and lifts HP and the weapon level to the new class's where lower (the game's code)."
              : "Promoting adds the difference between the classes' bases (Serenes Forest; not yet traced in the game's code)."}
          {start.autoPromote ? ` A trainee promotes on reaching Lv ${maxLevelOf(start)} (Serenes Forest).` : ''}
        </p>
        {/* As Fates' Unit Planner: the growths and maximums, then the stats (the first row is as they join). */}
        <StatTable
          data={data}
          rows={[
            { label: classIds.some((id) => data.classes[id].growths) ? 'Personal growths' : 'Growths', values: unit.growths, suffix: '%' },
            ...(data.expectedGrowths?.[unit.id] ? [{ label: "Average gain per level (the game's roll)", values: data.expectedGrowths[unit.id], suffix: '%' }] : []),
            ...classIds
              .filter((id) => data.classes[id].growths)
              .map((id) => ({ label: `Growths as a ${data.classes[id].name}`, values: withClassGrowths(data, unit, data.classes[id]), suffix: '%' })),
            unit.caps
              ? { label: 'Maximums (their own)', values: unit.caps }
              : {
                  label: 'Caps',
                  title: capsTitle({ options: reachable.map((id) => ({ id, name: data.classes[id].name })), value: capsId, onChange: setCapsPick }),
                  values: data.classes[capsId].caps,
                },
          ]}
        />
        {classIds.some((id) => data.classes[id].weapons) && (
          <p className="text-sm text-neutral-300">
            <span className="text-neutral-500">Weapons: </span>
            {classIds.map((id) => `${data.classes[id].name}: ${weaponsText(data.classes[id])}`).join(' · ')}
            {[...new Set(classIds.map((id) => data.classes[id].weaponsNote).filter(Boolean))].map((note) => (
              <span key={note} className="text-neutral-500"> ({note})</span>
            ))}
          </p>
        )}
        {Object.keys(unit.ranks).length > 0 && (
          <p className="text-sm text-neutral-300">
            <span className="text-neutral-500">Weapon ranks as they join: </span>
            {Object.entries(unit.ranks)
              .map(([w, r]) => `${w[0].toUpperCase()}${w.slice(1)} ${r}`)
              .join(', ')}
          </p>
        )}
        {data.expectedGrowthText && data.expectedGrowths?.[unit.id] && <p className="text-xs text-neutral-500">{data.expectedGrowthText}</p>}
        <SpellsLine data={data} unit={unit} plan={plan} steps={steps} />
        <StatTable
          data={data}
          rows={stages.map((st, i) => ({
            label: `${data.classes[st.classId].name} Lv ${st.level}${i === 0 ? ' (joins)' : ''}`,
            values: st.stats,
            caps: capsFor(unit, data.classes[st.classId]),
          }))}
        />
      </div>
    </div>
  )
}

/** Each partner: affinity, starting points and gain per turn, the turns to each level, and what the pair gives per level. */
export function GbaSupports({ data: game }: { data: GbaData }) {
  const { view: data, story, picker } = useStory(game)
  // Partners from every story: Alm's and Celica's armies meet.
  const everyone = { ...data, units: game.units }
  const [unitId, setUnitId] = useState(data.units[0]?.id ?? '')
  const unit = data.units.find((u) => u.id === unitId) ?? data.units[0]
  useScreenshotUnit(unit)
  const partners = unit ? supportsOf(data, unit.id) : []
  const fixed = unit && data.supportBonuses ? bonusesOf(data, unit.id) : null
  // Each affinity's bonus for one support level, as the wikis give it: the game's table holds twice that (a pair's is both rows summed,
  // times the level, halved, rounded down). Shown per affinity, not worked out per pair (user, 2026-11-07): a unit holds five support
  // levels at most, so the player picks which, and adds them up.
  const AFFINITY_KEYS = ['atk', 'def', 'hit', 'avoid', 'crit', 'dodge'] as const
  const AFFINITY_LABELS = { atk: 'Atk', def: 'Def', hit: 'Hit', avoid: 'Avo', crit: 'Crit', dodge: 'Dodge' }
  const affinityRows = data.affinities.map((a) => ({
    label: a.name === unit?.affinity ? `${a.name} (${unit.name}'s)` : a.name,
    values: Object.fromEntries(AFFINITY_KEYS.map((k) => [k, (a[k] as number) / 2])) as Record<(typeof AFFINITY_KEYS)[number], number>,
    signed: true,
  }))
  return (
    <div className="space-y-4">
      {picker}
      {story?.noSupports && <p className="text-sm text-neutral-400">Supports can't be built in {story.label} (the game's support code skips it).</p>}
      {!story?.noSupports && <UnitSelect data={data} value={unit?.id ?? ''} onChange={setUnitId} />}
      {unit && !story?.noSupports && (
        <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex items-center gap-3">
            <UnitPortrait data={data} unit={unit} size={48} />
            <div>
              <div className="font-semibold text-neutral-100">{unit.name}</div>
              {unit.affinity && <div className="text-xs text-neutral-400">Affinity: {unit.affinity}</div>}
            </div>
          </div>
          {data.slotSupports ? (
            <SlotSupports data={data} unit={unit} onPick={(id) => data.units.some((u) => u.id === id) && setUnitId(id)} />
          ) : data.rankedSupports ? (
            <RankedSupports data={everyone} unit={unit} onPick={(id) => data.units.some((u) => u.id === id) && setUnitId(id)} />
          ) : fixed ? (
            <FixedSupports data={data} unit={unit} fixed={fixed} onPick={setUnitId} />
          ) : partners.length === 0 ? (
            <p className="text-sm text-neutral-400">{unit.name} has no supports.</p>
          ) : (
            <>
              <p className="text-xs text-neutral-500">
                A pair starts with some points and gains more {data.supportGain ?? 'each turn it ends within reach'}; C, B and A need {data.supportLevels.join(', ')}{' '}
                points. Turns are counted from the start. A unit can hold five support levels at most.

              </p>
              {/* C, B and A in view on a phone, no sideways scroll (user, 2026-11-05): the affinity, the points and the bonus go under
                  the partner's name. */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-neutral-500">
                    <th className="py-1 text-left font-normal">Partner (affinity, points: start + a turn)</th>
                    <th className="w-9 py-1 text-right font-normal">C</th>
                    <th className="w-9 py-1 text-right font-normal">B</th>
                    <th className="w-9 py-1 text-right font-normal">A</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map(({ partner, support }) => (
                    <tr key={partner.id} className="border-t border-neutral-800 align-top">
                      <td className="py-1 pr-1">
                        <button type="button" onClick={() => setUnitId(partner.id)} className="flex items-center gap-1.5 text-left text-neutral-200 hover:text-violet-300">
                          <UnitPortrait data={data} unit={partner} size={24} />
                          {partner.name}
                        </button>
                        <div className="text-xs text-neutral-500">
                          {partner.affinity} · {support.start} + {support.perTurn} a turn
                        </div>
                      </td>
                      {turnsFor(data.supportLevels, support).map((t, i) => (
                        <td key={i} className="w-9 py-1 text-right tabular-nums text-neutral-200">
                          {t ?? '–'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">What each affinity gives, per support level</h4>
                <p className="text-xs text-neutral-500">
                  With the partner within 3 tiles, each support level adds the unit's affinity row and the partner's together: a C is one
                  level, a B two, an A three. Both units get it, and the bonuses of several partners in reach add up (Serenes Forest). The
                  game's table holds each value doubled: it adds the two rows, multiplies by the level and halves, rounding down.
                </p>
                <StatBlocks stats={AFFINITY_KEYS} labels={AFFINITY_LABELS} rows={affinityRows} fmt={(n) => String(n)} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Fixed supports: who gives this unit a bonus when in reach, and whom it gives one. */
function FixedSupports({
  data,
  unit,
  fixed,
  onPick,
}: {
  data: GbaData
  unit: GbaUnit
  fixed: ReturnType<typeof bonusesOf>
  onPick: (id: string) => void
}) {
  if (!fixed.gets.length && !fixed.gives.length) return <p className="text-sm text-neutral-400">{unit.name} has no supports.</p>
  const list = (title: string, rows: { partner: GbaUnit; bonus: number }[]) =>
    rows.length > 0 && (
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h4>
        <ul className="space-y-1">
          {rows.map(({ partner, bonus }) => (
            <li key={partner.id} className="flex items-center gap-2 text-sm">
              <button type="button" onClick={() => onPick(partner.id)} className="flex items-center gap-2 text-neutral-200 hover:text-violet-300">
                <UnitPortrait data={data} unit={partner} size={28} />
                {partner.name}
              </button>
              <span className="tabular-nums text-neutral-400">+{bonus}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  return (
    <>
      {data.supportBonusText && <p className="text-xs text-neutral-500">{data.supportBonusText}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {list(`${unit.name} gets`, fixed.gets)}
        {list(`${unit.name} gives`, fixed.gives)}
      </div>
    </>
  )
}

const SLOT_LABELS = ['Hit', 'Avoid', 'Crit', 'Crit avoid']
const SLOT_LEVELS = ['C', 'B', 'A']

/** One-way supports (New Mystery): the partners whose nearness gives this unit a bonus, with the turns both must spend on the map for each
 * level, the units it gives a bonus to, and its talks at the base. The Avatar's two units show as one partner. */
function SlotSupports({ data, unit, onPick }: { data: GbaData; unit: GbaUnit; onPick: (id: string) => void }) {
  const byId = new Map(data.units.map((u) => [u.id, u]))
  const avatarIds = Object.keys(data.avatar?.classes ?? {})
  const isAvatar = (id: string) => avatarIds.includes(id)
  // One row for the Avatar: the first of its units in the list stands for both.
  const once = (rows: GbaSlotSupport[], key: (s: GbaSlotSupport) => string) =>
    rows.filter((s, i) => !isAvatar(key(s)) || rows.findIndex((t) => isAvatar(key(t))) === i)
  const nameOf = (id: string) => (isAvatar(id) && !isAvatar(unit.id) ? (data.avatar?.name ?? byId.get(id)?.name) : byId.get(id)?.name) ?? id
  const gets = once((data.slotSupports ?? []).filter((s) => s.unit === unit.id && byId.has(s.partner)), (s) => s.partner)
  const gives = once((data.slotSupports ?? []).filter((s) => s.partner === unit.id && byId.has(s.unit)), (s) => s.unit)
  const bonus = data.slotSupportBonus ?? []
  const levelText = (i: number) =>
    (bonus[i] ?? [])
      .map((v, k) => (v ? `${SLOT_LABELS[k]} +${v}` : ''))
      .filter(Boolean)
      .join(', ')
  const top = (s: GbaSlotSupport) => SLOT_LEVELS.filter((_, i) => s.levels[i] !== null).pop()
  // The talks at the base: the Avatar's are with either of its units.
  const talks = (data.baseTalks ?? []).flatMap((t) => {
    const partner = isAvatar(unit.id) ? (t.avatar ? t.a : null) : t.a === unit.id ? t.b : t.b === unit.id && !t.avatar ? t.a : null
    return partner && byId.has(partner) ? [{ ...t, partner }] : []
  })
  const talkPartners = [...new Set(talks.map((t) => t.partner))]
  return (
    <>
      {data.slotSupportText && <p className="text-xs text-neutral-500">{data.slotSupportText}</p>}
      {bonus.length > 0 && (
        <p className="text-xs text-neutral-400">
          {SLOT_LEVELS.map((l, i) => `${l}: ${levelText(i + 1)}`).join(' · ')}
        </p>
      )}
      {gets.length === 0 ? (
        <p className="text-sm text-neutral-400">No one gives {unit.name} a support bonus.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-neutral-500">
              <th className="py-1 text-left font-normal">{unit.name} gets a bonus near (turns on the map together)</th>
              {SLOT_LEVELS.map((l) => (
                <th key={l} className="w-9 py-1 text-right font-normal">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gets.map((s) => (
              <tr key={s.partner} className="border-t border-neutral-800 align-top">
                <td className="py-1 pr-1">
                  <button type="button" onClick={() => onPick(s.partner)} className="flex items-center gap-1.5 text-left text-neutral-200 hover:text-violet-300">
                    <UnitPortrait data={data} unit={byId.get(s.partner)!} size={24} />
                    {nameOf(s.partner)}
                  </button>
                  {s.start > 0 && <div className="text-xs text-neutral-500">starts with {s.start} points</div>}
                </td>
                {s.levels.map((need, i) => (
                  <td key={i} className="w-9 py-1 text-right tabular-nums text-neutral-200">
                    {need === null ? '–' : Math.max(0, need - s.start)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {gives.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{unit.name} gives a bonus to</h4>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {gives.map((s) => (
              <button key={s.unit} type="button" onClick={() => onPick(s.unit)} className="flex items-center gap-1.5 text-neutral-200 hover:text-violet-300">
                <UnitPortrait data={data} unit={byId.get(s.unit)!} size={24} />
                {nameOf(s.unit)} <span className="text-xs text-neutral-500">(to {top(s) ?? '–'})</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {talkPartners.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Talks at the base</h4>
          {data.baseTalkText && <p className="text-xs text-neutral-500">{data.baseTalkText}</p>}
          <ul className="space-y-1 text-sm">
            {talkPartners.map((id) => {
              const mine = talks.filter((t) => t.partner === id)
              const rewards = mine.filter((t) => t.reward)
              return (
                <li key={id} className="flex flex-wrap items-center gap-x-2">
                  <button type="button" onClick={() => onPick(id)} className="flex items-center gap-1.5 text-neutral-200 hover:text-violet-300">
                    <UnitPortrait data={data} unit={byId.get(id)!} size={24} />
                    {nameOf(id)}
                  </button>
                  <span className="text-neutral-400">{mine.map((t) => t.level).join(', ')}</span>
                  {rewards.map((t) => (
                    <span key={t.level} className="text-xs text-neutral-500">
                      {t.level} gives {t.reward}
                    </span>
                  ))}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}

const RANKS = ['No rank', 'C', 'B', 'A']
const BONUS_LABELS = ['Hit', 'Crit', 'Avo', 'CEv']

function bonusText(b: number[]): string {
  return (
    b
      .map((v, i) => (v ? `${BONUS_LABELS[i]} ${v > 0 ? '+' : ''}${v}` : ''))
      .filter(Boolean)
      .join(', ') || '–'
  )
}

/** Ranked supports: per partner, each rank's points and act, and what each side gets. */
function RankedSupports({ data, unit, onPick }: { data: GbaData; unit: GbaUnit; onPick: (id: string) => void }) {
  const partners = rankedOf(data, unit.id)
  if (!partners.length) return <p className="text-sm text-neutral-400">{unit.name} has no supports.</p>
  return (
    <>
      {data.rankedSupportText && <p className="text-xs text-neutral-500">{data.rankedSupportText}</p>}
      <div className="space-y-3">
        {partners.map(({ partner, gets, gives, points, acts }) => {
          // No rank shows when it adds something; C, B and A when the pair has conversations.
          const ranks = RANKS.map((label, i) => ({ label, i })).filter(({ i }) => (i === 0 ? gets[0].some(Boolean) || gives[0].some(Boolean) : !!points))
          return (
            <div key={partner.id} className="rounded-md border border-neutral-800 p-2">
              <button type="button" onClick={() => onPick(partner.id)} className="mb-1 flex items-center gap-2 text-sm text-neutral-200 hover:text-violet-300">
                <UnitPortrait data={data} unit={partner} size={28} />
                {partner.name}
                {!points && <span className="text-xs text-neutral-500">(fixed bonus, no conversations)</span>}
              </button>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-neutral-500">
                      <th className="py-0.5 pr-2 text-left font-normal">Rank</th>
                      {points && <th className="px-1 py-0.5 text-right font-normal">Points</th>}
                      {acts && <th className="px-1 py-0.5 text-right font-normal">Act</th>}
                      <th className="py-0.5 pl-2 text-left font-normal">{unit.name} gets</th>
                      <th className="py-0.5 pl-2 text-left font-normal">{partner.name} gets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranks.map(({ label, i }) => (
                      <tr key={label} className="border-t border-neutral-800">
                        <td className="whitespace-nowrap py-0.5 pr-2 text-neutral-400">{label}</td>
                        {points && <td className="px-1 py-0.5 text-right tabular-nums text-neutral-300">{i ? points[i - 1] : ''}</td>}
                        {acts && <td className="px-1 py-0.5 text-right tabular-nums text-neutral-300">{i ? acts[i - 1] : ''}</td>}
                        <td className="py-0.5 pl-2 text-neutral-200">{bonusText(gets[i])}</td>
                        <td className="py-0.5 pl-2 text-neutral-200">{bonusText(gives[i])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
