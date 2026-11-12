import { useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PartsPortrait } from '../components/PartsPortrait'
import { Portrait } from '../components/Portrait'
import { assetKeys } from '../data/assetStorage'
import {
  FE12_ALT_JOINS,
  FE12_AVATAR,
  FE12_AWAY,
  FE12_BASE_TALKS,
  FE12_CHAPTERS,
  FE12_CHOICES,
  FE12_CLASS_LIMITS,
  FE12_CLASSES,
  FE12_GAIDEN,
  FE12_RECLASS_FREE,
  FE12_RECLASS_SWAP,
  FE12_SUPPORT_BONUS,
  FE12_SUPPORTS,
  FE12_UNITS,
} from '../data/fe12/fe12Units'
import { GbaPlanner, GbaRoster, GbaSupports, useGbaPlan, type GbaData } from '../gba/screens'
import type { GbaAvatar, GbaJoinChoice, GbaStat, GbaStats, GbaUnit } from '../gba/types'
import type { GameArt, MatchResult, MatchedFile } from '../logic/bulkAssetImport'
import { telliusArt } from '../tellius/art'
import { TelliusBulkUpload } from '../tellius/TelliusBulkUpload'
import type { TelliusData } from '../tellius/types'
import type { GameParts } from './index'

// New Mystery of the Emblem on the shared screens, with what it adds: Kris made at the start (two units, a man and a woman, as Fates'
// Corrin; the class and answers in the Unit Planner, the looks in the Roster), the prologue's questions that move when some units join,
// one-way supports and the talks at the base, and every class opening for reclassing once Hard is cleared. The data is read from the
// user's own cartridge (scripts/build-fe12-units.py, data-raw/fe12/README.md).

const STAT_LABELS: Record<string, string> = { hp: 'HP', str: 'Str', mag: 'Mag', skl: 'Skl', spd: 'Spd', lck: 'Lck', def: 'Def', res: 'Res' }
const statsText = (values: GbaStats) =>
  (Object.entries(values) as [GbaStat, number][])
    .filter(([, v]) => v)
    .map(([s, v]) => `${STAT_LABELS[s] ?? s} +${v}`)
    .join(', ')

const MALE = FE12_AVATAR.units.male
const FEMALE = FE12_AVATAR.units.female
const isKris = (id: string) => id === MALE || id === FEMALE
const chapterName = (id: string) => FE12_CHAPTERS.find((c) => c.id === id)?.label ?? id

// Every class of a gender, both tiers: what a reclass offers once Hard or above has been cleared (arm9 0x205b334).
const ALL_MALE = [...FE12_RECLASS_FREE['male-base'], ...FE12_RECLASS_FREE['male-promoted']]
const ALL_FEMALE = [...FE12_RECLASS_FREE['female-base'], ...FE12_RECLASS_FREE['female-promoted']]
const FEMALE_CLASSES = new Set(ALL_FEMALE)

const units: GbaUnit[] = FE12_UNITS.map((u) => {
  const female = u.id === FEMALE || (u.reclass ?? []).some((id) => FEMALE_CLASSES.has(id))
  return {
    ...u,
    ...(FE12_AWAY[u.id] ? { away: FE12_AWAY[u.id] } : {}),
    ...(u.reclass || isKris(u.id) ? { reclassAll: female ? ALL_FEMALE : ALL_MALE } : {}),
  }
})
const byId = new Map(units.map((u) => [u.id, u]))
const names = (ids: string[]) => ids.map((id) => byId.get(id)?.name ?? id).join(' and ')

// The side chapters: what opens each (Serenes Forest's; the scripts that check them are blank in the cartridge image).
const chapters = FE12_CHAPTERS.map((c) => (FE12_GAIDEN[c.id] ? { ...c, note: `Opens only if: ${FE12_GAIDEN[c.id]}` } : c))

// The prologue's three questions: each answer plays the next chapter's version with one unit, and the other joins later (FE12_ALT_JOINS).
const choices: GbaJoinChoice[] = FE12_CHOICES.map((c) => {
  const option = (id: 'first' | 'second', joiners: string[], others: string[]) => ({
    id,
    label: `${names(joiners)} (${id} answer)`,
    joins: Object.fromEntries([
      ...joiners.map((uid) => {
        const u = byId.get(uid)!
        return [
          uid,
          {
            joinChapter: u.joinChapter,
            join: { how: u.join.how, note: `With the ${id} answer at the end of ${chapterName(c.after)}.` },
            away: FE12_AWAY[uid],
          },
        ]
      }),
      ...others.map((uid) => {
        const alt = FE12_ALT_JOINS[uid]
        return [
          uid,
          {
            joinChapter: alt.chapter,
            join: { how: alt.how, note: `${chapterName(c.chapter)} brought ${names(joiners)} instead (the ${id} answer at the end of ${chapterName(c.after)}).` },
          },
        ]
      }),
    ]),
  })
  return {
    id: c.id,
    after: c.after,
    question: `${c.question.replace(/\.$/, '')}: who joins in ${chapterName(c.chapter)}?`,
    options: [option('first', c.first, c.second), option('second', c.second, c.first)],
  }
})

const weaponName = (kind: string) => kind[0].toUpperCase() + kind.slice(1)
const avatar: GbaAvatar = {
  name: 'Kris',
  classes: {
    [MALE]: FE12_AVATAR.classes.male.map((o) => ({ classId: o.classId, reclass: o.reclass, weapon: weaponName(o.weaponKind) })),
    [FEMALE]: FE12_AVATAR.classes.female.map((o) => ({ classId: o.classId, reclass: o.reclass, weapon: weaponName(o.weaponKind) })),
  },
  questions: FE12_AVATAR.questions.map((q) => ({
    question: q.question,
    answers: q.answers.map((a) => ({ label: a.label, bases: a.bases, growths: a.growths })),
  })),
  defaults: { classIndex: FE12_AVATAR.defaults.classIndex, answers: FE12_AVATAR.defaults.answers },
  ranks: { start: 'D', other: 'E' },
  text:
    "Picked when the game starts: a class from the list for Kris's gender, and an answer to each question, which add to Kris's own bases and growths (arm9 0x2028b04, 0x2028b60). The class also sets the reclass set: a man who starts as a Mercenary, Knight or Fighter has those classes' set, and a Cavalier, Archer or Mage the other; a woman has the women's set either way. The starting weapon's kind begins at D and the class's other weapons at E (0x204ce24). Until changed, these are what a new save starts on (0x2028a40).",
}

export const FE12_DATA: GbaData = {
  gameId: 'fe12',
  chapters,
  units,
  classes: FE12_CLASSES,
  // HP, Str, Mag, Skl, Spd, Lck, Def, Res and Mov; Mov doesn't grow.
  stats: ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res', 'mov'],
  growing: ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res'],
  statLabels: { str: 'Str' },
  ownStats: true,
  promotionText:
    "Growths are the unit's own plus the class's (and Kris's answers'); a total of 0 or less gives nothing, and each full 100 is a sure point (arm9 0x205092c). A stat is the unit's own base plus the class's plus what they've gained, held at the class's cap (0x204efa4), so a class change swaps one class's bases for the other's and a lower cap hides nothing for good. From Chapter 1, at the battle preparations, a unit can reclass within its set and tier, keeping its level and experience, while the chapter's limit for that class line allows (the Info tab); one promoted with the Elysian Whip is offered the Falcoknight in place of the Dracoknight. A Master Seal promotes from Lv 10, back to Lv 1 (0x2049ecc, 0x2050d7c). Classes that neither promote nor come from a promotion (Lord, Thief, Manakete, Dancer, Freelancer) go to Lv 30 and have no set. Level-ups at the Training Grounds share out the same points another way; these are a battle's.",
  reclassSwap: FE12_RECLASS_SWAP,
  reclassAllLabel: "Hard or above cleared: every class of the unit's gender opens for reclassing",
  supports: [],
  supportLevels: [],
  affinities: [],
  avatar,
  choices,
  slotSupports: FE12_SUPPORTS,
  slotSupportBonus: [0, 1, 2, 3].map((i) => [FE12_SUPPORT_BONUS.hit[i], FE12_SUPPORT_BONUS.avoid[i], FE12_SUPPORT_BONUS.crit[i], FE12_SUPPORT_BONUS.dodge[i]]),
  slotSupportText:
    "Supports go one way: each partner here gives this unit its bonus while within 3 tiles, and several partners' bonuses add up (overlay 00 0x21f2e0c). The pair's points start at the number shown (0 unless said) and rise by 1 each turn both are on the map, up to the last level it can reach (arm9 0x2050db0); the columns are the turns that takes, and – is a level the pair never reaches. An ally holding the Earth Orb also adds Crit +10.",
  baseTalks: FE12_BASE_TALKS.map((t) => ({
    a: t.a,
    b: t.b,
    avatar: t.withKris,
    level: t.level,
    reward: t.item ? `a ${t.item.name} (${statsText(t.item.bonus)}${t.item.chapterOnly ? ' for the rest of the chapter' : ''})` : undefined,
  })),
  baseTalkText:
    "Support talks at the base (FE12BaseTalk.bin), most of them with Kris. Each A talk gives a Bond. What opens each talk is in the chapters' scripts, which are blank in this cartridge image, so when each comes isn't shown.",
  portrait: (unit, size) => (isKris(unit.id) ? <KrisPortrait unit={unit} size={size} /> : undefined),
  rosterExtra: (unit) => (isKris(unit.id) ? <KrisLooks unit={unit} /> : null),
}

// ---- Kris's looks, as the creation offers them (overlay 19, pcmake): kept for each gender, shown with the portraits as Fates' Corrin's.

type Gender = 'm' | 'f'
interface Looks {
  hair: number
  hairColor: number
  eyes: number
}
const DEFAULT_LOOKS: Looks = { hair: FE12_AVATAR.defaults.hair, hairColor: FE12_AVATAR.defaults.hairColor, eyes: FE12_AVATAR.defaults.eyes }

/** Saved under `fe-roster-fe12-avatar`, so the backup (src/logic/backup.ts) picks it up. */
const useKrisLooks = create<{ looks: Partial<Record<Gender, Looks>>; setLooks: (g: Gender, patch: Partial<Looks>) => void }>()(
  persist(
    (set) => ({
      looks: {},
      setLooks: (g, patch) => set((s) => ({ looks: { ...s.looks, [g]: { ...DEFAULT_LOOKS, ...s.looks[g], ...patch } } })),
    }),
    { name: 'fe-roster-fe12-avatar' },
  ),
)

const genderOf = (unit: GbaUnit): Gender => (unit.id === FEMALE ? 'f' : 'm')
/** A part's upload id (Bulk Upload: avatar/<m|f>/<file>) and the static file behind it. */
const part = (g: Gender, stem: string) => ({
  id: `fe12/avatar/${g}/${stem.toLowerCase()}`,
  url: `${import.meta.env.BASE_URL}art/portraits/fe12-avatar/${g}/${stem}.png`,
})

/** Kris as the game draws them (AvatarBuilder, arm9 0x200bd18): the body in the outfit of the class picked in the Unit Planner, the eyes,
 * then the hair turned round the colour wheel by its colour's 36 degrees a step (0x200d494). Until the parts are uploaded, the portrait
 * of the creation's defaults. */
function KrisPortrait({ unit, size }: { unit: GbaUnit; size: number }) {
  const g = genderOf(unit)
  const looks = useKrisLooks((s) => s.looks[g]) ?? DEFAULT_LOOKS
  const plan = useGbaPlan('fe12', unit.id)
  const options = g === 'f' ? FE12_AVATAR.classes.female : FE12_AVATAR.classes.male
  const outfit = (options[plan?.avatarClass ?? FE12_AVATAR.defaults.classIndex] ?? options[0]).outfit
  const eyes = FE12_AVATAR.looks.eyes[looks.eyes] ?? FE12_AVATAR.looks.eyes[0]
  const hair = String(looks.hair).padStart(2, '0')
  const plain = g === 'm' && looks.hair === FE12_AVATAR.looks.noColorHair.male
  return (
    <PartsPortrait
      parts={[part(g, `body_${outfit}`), part(g, `eyes_${eyes}`), part(g, `hair_${hair}`)]}
      hue={{ part: 2, degrees: plain ? 0 : looks.hairColor * FE12_AVATAR.looks.hueStep }}
      size={size}
      fallback={<Portrait characterId={`fe12/kris_${g}`} isChild={false} size={size} />}
    />
  )
}

/** Hair colour 1's middle shade, turned as the game turns the hair, for the swatches. */
function swatch(step: number): string {
  const [r, g, b] = [0x34, 0x56, 0xb8]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  const hue = ((max === r ? ((g - b) / chroma + 6) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4) + (step * FE12_AVATAR.looks.hueStep) / 60) % 6
  const x = chroma * (1 - Math.abs((hue % 2) - 1))
  const rgb = hue < 1 ? [chroma, x, 0] : hue < 2 ? [x, chroma, 0] : hue < 3 ? [0, chroma, x] : hue < 4 ? [0, x, chroma] : hue < 5 ? [x, 0, chroma] : [chroma, 0, x]
  return `#${rgb.map((v) => Math.round(v + min).toString(16).padStart(2, '0')).join('')}`
}

const selectClass = 'rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200'

/** The looks the creation offers for Kris: 13 hair styles, 10 hair colours and 10 eyes (0x2230024, 0x222ffcc, 0x222ff74). */
function KrisLooks({ unit }: { unit: GbaUnit }) {
  const g = genderOf(unit)
  const looks = useKrisLooks((s) => s.looks[g]) ?? DEFAULT_LOOKS
  const setLooks = useKrisLooks((s) => s.setLooks)
  const L = FE12_AVATAR.looks
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Looks</h4>
      <div className="flex flex-wrap items-end gap-3 text-sm text-neutral-300">
        <label className="space-y-1">
          <span className="block text-xs text-neutral-500">Hair</span>
          <select value={looks.hair} onChange={(e) => setLooks(g, { hair: Number(e.target.value) })} className={selectClass}>
            {Array.from({ length: L.menuHair }, (_, i) => (
              <option key={i} value={i}>
                Style {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-neutral-500">Eyes</span>
          <select value={looks.eyes} onChange={(e) => setLooks(g, { eyes: Number(e.target.value) })} className={selectClass}>
            {Array.from({ length: L.menuEyes }, (_, i) => (
              <option key={i} value={i}>
                Eyes {i + 1}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="space-y-1">
        <span className="block text-xs text-neutral-500">Hair colour</span>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: L.hairColors }, (_, k) => (
            <button
              key={k}
              type="button"
              aria-label={`Hair colour ${k + 1}`}
              title={`Hair colour ${k + 1}`}
              onClick={() => setLooks(g, { hairColor: k })}
              className={`h-6 w-6 rounded border ${looks.hairColor === k ? 'border-2 border-violet-400' : 'border-neutral-700'}`}
              style={{ backgroundColor: swatch(k) }}
            />
          ))}
        </div>
      </div>
      <p className="text-xs text-neutral-500">
        As the creation offers them; the outfit goes with the class picked in the Unit Planner. Each hair colour turns the hair&apos;s own colours a
        tenth of the way round the colour wheel. Kris&apos;s portrait is built from parts, uploaded as avatar/m/ and avatar/f/ (Bulk Upload).
      </p>
    </div>
  )
}

// ---- Info: the reclassing limits.

/** Each chapter's limits on the class lines (MapTable +0x1c-0x27, checked at overlay 10 0x223cb18), for planning reclasses. */
function Fe12Info() {
  const open = FE12_CHAPTERS.filter((c) => FE12_CLASS_LIMITS.byChapter[c.id]?.some(Boolean))
  const [at, setAt] = useState(open[0]?.id ?? '')
  const limits = FE12_CLASS_LIMITS.byChapter[at] ?? []
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="text-sm font-semibold text-neutral-100">Reclassing limits</h3>
        <p className="text-xs text-neutral-500">
          From Chapter 1, at the battle preparations, a unit can change to another class of its set and tier (Unit Planner). Each chapter limits how
          many of your units each class line can have, a line being a class and its promotions (a Cavalier and a Paladin count together): the
          preparations refuse a change into a line that&apos;s at its limit (overlay 10 0x223cb18). Serenes Forest reads each limit as 1 plus the units
          of that line you could have recruited by then.
        </p>
        <label className="block space-y-1 text-sm">
          <span className="block text-xs text-neutral-500">Chapter</span>
          <select value={at} onChange={(e) => setAt(e.target.value)} className={selectClass}>
            {open.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid max-w-md grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {FE12_CLASS_LIMITS.columns.map((line, i) => (
            <div key={line} className="flex justify-between gap-2">
              <span className="text-neutral-400">{line}</span>
              <span className="tabular-nums text-neutral-100">{limits[i]}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ---- Art: the portraits by unit name, and Kris's parts by gender (avatar/m/body_A.png, eyes_A.png, hair_00.png...).

const UPLOAD_DATA = { gameId: 'fe12', units, skills: {} } as unknown as TelliusData
const BASE_ART = telliusArt(UPLOAD_DATA)
const PART_NAME = /^(body_[a-e]|eyes_[a-k]|hair_\d{2})$/
const pathOf = (f: File) => ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name).replace(/\\/g, '/').toLowerCase().split('/')
const isPart = (f: File) => pathOf(f).includes('avatar')

function matchKrisParts(files: File[]): MatchResult {
  const matched: MatchedFile[] = []
  const unmatched: File[] = []
  for (const file of files) {
    const parts = pathOf(file)
    const g = parts[parts.indexOf('avatar') + 1]
    const stem = parts[parts.length - 1].replace(/\.[^.]+$/, '')
    if ((g === 'm' || g === 'f') && parts.length >= 3 && PART_NAME.test(stem)) {
      matched.push({ file, key: assetKeys.portrait(`fe12/avatar/${g}/${stem}`), label: `Kris (${g.toUpperCase()}): ${stem}` })
    } else unmatched.push(file)
  }
  return { matched, unmatched }
}

function matchFe12(files: File[]): MatchResult {
  const portraits = BASE_ART.match(files.filter((f) => !isPart(f)))
  const kris = matchKrisParts(files.filter(isPart))
  return { matched: [...portraits.matched, ...kris.matched], unmatched: [...portraits.unmatched, ...kris.unmatched] }
}

const PART_FILES = (['m', 'f'] as const).flatMap((g) => [
  // The woman has no fifth outfit.
  ...FE12_AVATAR.looks.outfits.filter((o) => g === 'm' || o !== 'E').map((o) => `avatar/${g}/body_${o}.png`),
  ...FE12_AVATAR.looks.eyes.map((e) => `avatar/${g}/eyes_${e}.png`),
  ...FE12_AVATAR.looks.hair.map((_, i) => `avatar/${g}/hair_${String(i).padStart(2, '0')}.png`),
])

const ART: GameArt = { match: matchFe12, expected: [...BASE_ART.expected, ...PART_FILES] }

const fe12: GameParts = {
  tabs: [
    { id: 'roster', label: 'Roster', component: () => <GbaRoster data={FE12_DATA} /> },
    { id: 'unit', label: 'Unit Planner', component: () => <GbaPlanner data={FE12_DATA} /> },
    { id: 'supports', label: 'Supports', component: () => <GbaSupports data={FE12_DATA} /> },
    { id: 'info', label: 'Info', component: () => <Fe12Info /> },
  ],
  spoiler: "Each tab follows the chapter you're on: units show once they join, and the prologue's three questions are asked as the bar reaches them.",
  bulkUpload: ({ onClose }) => (
    <TelliusBulkUpload
      data={UPLOAD_DATA}
      title="New Mystery of the Emblem"
      onClose={onClose}
      folder={{
        hint: 'Portraits named like "marth.png" (Kris: kris_m.png and kris_f.png), and Kris\'s parts in avatar/m/ and avatar/f/: body_A.png to body_E.png, eyes_A.png to eyes_K.png and hair_00.png to hair_17.png.',
        match: matchFe12,
      }}
    />
  ),
  art: ART,
}

export default fe12
