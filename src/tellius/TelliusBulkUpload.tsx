import { UploadSection } from '../components/BulkAssetUpload'
import { assetKeys } from '../data/assetStorage'
import { matchByStem, type MatchedFile, type MatchResult } from '../logic/bulkAssetImport'
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

const pathOf = (f: File) => ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name).replace(/\\/g, '/').toLowerCase().split('/')

/** A child's portrait in layers, for a game that tints children's hair (Awakening): children/<name>/base.png, the portrait without
 * hair, and children/<name>/raw.png, the hair as the game has it. */
function matchChildLayers(data: TelliusData, files: File[]): MatchResult {
  const names = new Set(portraitEntries(data).map((e) => e.id))
  const matched: MatchedFile[] = []
  const unmatched: File[] = []
  for (const file of files) {
    const parts = pathOf(file)
    const name = parts[parts.indexOf('children') + 1]
    const layer = parts[parts.length - 1].replace(/\.[^.]+$/, '')
    const id = `${data.gameId}/${name}`
    if (names.has(name) && layer === 'base') matched.push({ file, key: assetKeys.childPortraitBase(id), label: `${name} (base)` })
    else if (names.has(name) && layer === 'raw') matched.push({ file, key: assetKeys.childPortraitRaw(id), label: `${name} (hair)` })
    else unmatched.push(file)
  }
  return { matched, unmatched }
}

/** A whole folder: files under a "skills" folder are skill icons, under a "children" folder a child's layers, the rest portraits. */
function matchFolder(data: TelliusData, files: File[]): MatchResult {
  const isSkill = (f: File) => pathOf(f).includes('skills')
  const isLayer = (f: File) => pathOf(f).includes('children')
  const skills = matchSkills(data, files.filter(isSkill))
  const layers = matchChildLayers(data, files.filter((f) => !isSkill(f) && isLayer(f)))
  const portraits = matchPortraits(data, files.filter((f) => !isSkill(f) && !isLayer(f)))
  return {
    matched: [...portraits.matched, ...layers.matched, ...skills.matched],
    unmatched: [...portraits.unmatched, ...layers.unmatched, ...skills.unmatched],
  }
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
          hint={`Portraits named like "ike.png"; skill icons in a "skills" folder, named like "sol.png"; children's hair layers as children/<name>/base.png and raw.png.`}
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
