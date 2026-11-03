import { UploadSection } from '../components/BulkAssetUpload'
import { matchFolder, matchPortraits, matchSkills, portraitEntries } from './art'
import type { TelliusData } from './types'

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
          Images are matched by name and stored on this device only. Nothing is sent anywhere. To load every game at once, use Bulk
          Upload on the home screen.
        </p>
        <UploadSection
          title="Select an entire folder"
          hint={`Portraits named like "ike.png"; skill icons in a "skills" folder, named like "sol.png"; children's hair layers as children/<name>/base.png and raw.png, and an Avatar's as avatar/<body>/base.png and hair1.png to hair5.png.`}
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
