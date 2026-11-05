import { StatBlocks } from '../components/StatBlocks'
import { useEffect } from 'react'
import { AssetIcon } from '../components/AssetIcon'
import { Portrait } from '../components/Portrait'
import { useScreenshotContextStore } from '../state/screenshotContextStore'
import { useArmy } from './choiceStore'
import { artId, formatStat, weaponsText } from './logic'
import { TELLIUS_STATS, TELLIUS_STAT_LABELS, type TelliusData, type TelliusStats, type TelliusUnit } from './types'

export function UnitPortrait({ data, unit, size = 64 }: { data: TelliusData; unit: TelliusUnit; size?: number }) {
  return <Portrait characterId={artId(data.gameId, unit.name)} isChild={false} size={size} />
}

export function SkillIcon({ data, skillId, size = 28 }: { data: TelliusData; skillId: string; size?: number }) {
  const skill = data.skills[skillId]
  if (!skill) return null
  return <AssetIcon type="skill" iconId={artId(data.gameId, skill.name)} label={skill.name} size={size} />
}

export function chapterLabel(data: TelliusData, chapterId: string): string {
  const ch = data.chapters.find((c) => c.id === chapterId)
  return ch ? ch.label : chapterId
}

/**
 * Chapters as short runs, one line per part: ['Part 1: Prologue–Ch.8, Endgame', 'Part 3: Ch.6, Ch.12–Ch.13']. Chapters
 * without a part (Path of Radiance) make one line.
 */
export function chapterRuns(data: TelliusData, chapterIds: string[]): string[] {
  const wanted = new Set(chapterIds)
  const lines: string[] = []
  let part: string | undefined
  let runs: string[] = []
  let run: string[] = []
  const closeRun = () => {
    if (run.length) runs.push(run.length === 1 ? run[0] : `${run[0]}–${run[run.length - 1]}`)
    run = []
  }
  const closePart = () => {
    closeRun()
    if (runs.length) lines.push(part ? `${part}: ${runs.join(', ')}` : runs.join(', '))
    runs = []
  }
  for (const ch of data.chapters) {
    if (ch.part !== part) {
      closePart()
      part = ch.part
    }
    if (wanted.has(ch.id)) run.push(ch.short ?? ch.label)
    else closeRun()
  }
  closePart()
  return lines
}

/** Keeps the screenshot file name on the unit being shown (ExportImageButton reads it). */
export function useScreenshotUnit(unit: TelliusUnit | undefined) {
  const setUnitLabel = useScreenshotContextStore((state) => state.setUnitLabel)
  useEffect(() => {
    setUnitLabel(unit?.name ?? '')
    return () => setUnitLabel('')
  }, [unit, setUnitLabel])
}

/** The units in join order, as a select: those in your army, by the story choices picked in the Roster. */
export function UnitSelect({ data, value, onChange }: { data: TelliusData; value: string; onChange: (id: string) => void }) {
  const army = useArmy(data)
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full max-w-xs rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm text-neutral-200"
    >
      {data.chapters.map((ch) => {
        const units = army.filter((u) => u.joinChapter === ch.id)
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

/** Rows of stats, each a block of stats four to a line (as Fates' planner); a stat at its cap is green. */
export function StatTable({ rows }: { rows: { label: string; values: TelliusStats; caps?: TelliusStats; suffix?: string }[] }) {
  return <StatBlocks stats={TELLIUS_STATS} labels={TELLIUS_STAT_LABELS} fmt={formatStat} rows={rows} />
}

export function WeaponsLine({ data, classId }: { data: TelliusData; classId: string }) {
  const text = weaponsText(data, classId)
  return (
    <div className="text-sm text-neutral-300">
      <span className="text-neutral-500">Weapons (as a {data.classes[classId]?.name}): </span>
      {text || 'none'}
    </div>
  )
}

/** The story's promotions, or why there are none ("Thief promotes only by the story, which never promotes Sothe"). */
export function StoryPromotions({ data, unit }: { data: TelliusData; unit: TelliusUnit }) {
  const cls = data.classes[unit.classId]
  if (unit.storyPromotions?.length) {
    return (
      <p className="text-xs text-neutral-400">
        Promoted by the story, not a Seal or Crown:{' '}
        {unit.storyPromotions
          .map((p) => `${p.when === 'end' ? 'at the end of' : 'at the start of'} ${chapterLabel(data, p.chapter)}${p.note ? `, ${p.note}` : ''}`)
          .join('; then ')}
        . Whatever level they've reached then.
      </p>
    )
  }
  if (cls?.storyPromotion && !cls.laguz) {
    return (
      <p className="text-xs text-neutral-400">
        {cls.name} promotes only by the story, and the story never promotes {unit.name}: no Seal works on the class.
      </p>
    )
  }
  return null
}
