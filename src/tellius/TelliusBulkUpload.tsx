import { UploadSection } from '../components/BulkAssetUpload'
import { assetKeys } from '../data/assetStorage'
import { matchByStem, type MatchResult } from '../logic/bulkAssetImport'
import { artId } from './logic'
import type { TelliusData } from './types'

/** The file name each image is matched by: the unit's or skill's name ("ike.png", "sol.png"). */
function stemOf(gameId: string, name: string): string {
  return artId(gameId, name).slice(gameId.length + 1)
}

function portraitEntries(data: TelliusData) {
  return data.units.map((u) => ({ id: stemOf(data.gameId, u.name), label: u.name }))
}

function skillEntries(data: TelliusData) {
  return Object.values(data.skills).map((s) => ({ id: stemOf(data.gameId, s.name), label: s.name }))
}

function matchPortraits(data: TelliusData, files: File[]): MatchResult {
  return matchByStem(files, portraitEntries(data), (stem) => assetKeys.portrait(`${data.gameId}/${stem}`))
}

function matchSkills(data: TelliusData, files: File[]): MatchResult {
  return matchByStem(files, skillEntries(data), (stem) => assetKeys.skillIcon(`${data.gameId}/${stem}`))
}

/** A whole folder: files under a "skills" folder are skill icons, the rest are portraits. */
function matchFolder(data: TelliusData, files: File[]): MatchResult {
  const isSkill = (f: File) =>
    ((f as File & { webkitRelativePath?: string }).webkitRelativePath || '').replace(/\\/g, '/').toLowerCase().split('/').includes('skills')
  const skills = matchSkills(data, files.filter(isSkill))
  const portraits = matchPortraits(data, files.filter((f) => !isSkill(f)))
  return { matched: [...portraits.matched, ...skills.matched], unmatched: [...portraits.unmatched, ...skills.unmatched] }
}

export function TelliusBulkUpload({ data, title, onClose }: { data: TelliusData; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[85vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-100">Bulk Upload: {title}</h3>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-neutral-400 hover:text-neutral-200">
            ✕
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Images are matched by name and stored on this device only. Nothing is sent anywhere.
        </p>
        <UploadSection
          title="Select an entire folder"
          hint='Portraits named like "ike.png"; skill icons in a "skills" folder, named like "sol.png".'
          match={(files) => matchFolder(data, files)}
          directory
        />
        <p className="text-center text-xs text-neutral-600">— or, upload by category —</p>
        <UploadSection
          title="Portraits"
          hint={`Files named after each unit, like "${portraitEntries(data)[0]?.id ?? 'ike'}.png" (${data.units.length} units).`}
          match={(files) => matchPortraits(data, files)}
        />
        <UploadSection
          title="Skill icons"
          hint={`Files named after each skill, like "sol.png" (${Object.keys(data.skills).length} skills).`}
          match={(files) => matchSkills(data, files)}
        />
      </div>
    </div>
  )
}
