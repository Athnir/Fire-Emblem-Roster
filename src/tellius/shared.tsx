import { useEffect } from 'react'
import { AssetIcon } from '../components/AssetIcon'
import { Portrait } from '../components/Portrait'
import { useScreenshotContextStore } from '../state/screenshotContextStore'
import { artId, formatStat } from './logic'
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

/** The units in join order, as a select. */
export function UnitSelect({ data, value, onChange }: { data: TelliusData; value: string; onChange: (id: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full max-w-xs rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm text-neutral-200"
    >
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

/** Rows of stats: one row per entry, a column per stat. Wraps on a phone. */
export function StatTable({ rows }: { rows: { label: string; values: TelliusStats; caps?: TelliusStats; suffix?: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="text-xs text-neutral-500">
            <th className="py-1 pr-2 text-left font-normal" />
            {TELLIUS_STATS.map((s) => (
              <th key={s} className="px-1 py-1 text-right font-normal">
                {TELLIUS_STAT_LABELS[s]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-neutral-800">
              <td className="whitespace-nowrap py-1 pr-2 text-xs text-neutral-400">{row.label}</td>
              {TELLIUS_STATS.map((s) => {
                const atCap = row.caps && row.values[s] >= row.caps[s]
                return (
                  <td key={s} className={`px-1 py-1 text-right tabular-nums ${atCap ? 'text-emerald-400' : 'text-neutral-200'}`}>
                    {formatStat(row.values[s])}
                    {row.suffix ?? ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
