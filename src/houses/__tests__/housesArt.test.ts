import { describe, expect, it } from 'vitest'
import { assetKeys } from '../../data/assetStorage'
import { FE16_ABILITIES, FE16_ARTS, FE16_CLASSES, FE16_UNITS } from '../../data/fe16/fe16Units'
import fe16 from '../../games/fe16'
import { skillIconId } from '../../tellius/art'
import { artId } from '../hooks'
import { labelOf } from '../logic'

/** A file as a picked folder, or an unzipped .zip, gives it: its name, and its path in webkitRelativePath. */
function file(path: string): File {
  const f = new File([''], path.split('/').pop() ?? path)
  Object.defineProperty(f, 'webkitRelativePath', { value: path })
  return f
}

/** Where Three Houses' Bulk Upload keeps a file. */
const keyOf = (path: string) => fe16.art.match([file(path)]).matched[0]?.key

describe('Three Houses art', () => {
  it('keeps each portrait where the Roster looks it up', () => {
    for (const u of FE16_UNITS) {
      const id = artId('fe16', labelOf(u))
      expect(keyOf(`${id}.png`), u.name).toBe(assetKeys.portrait(id))
    }
    expect(keyOf('fe16/byleth_female.png')).toBe('portrait:fe16/byleth_female')
  })

  it('gives every ability and combat art an icon of its own, a "+" spelled out so Alert Stance and Alert Stance+ stay apart', () => {
    const names = [...Object.keys(FE16_ABILITIES), ...Object.keys(FE16_ARTS)]
    // The game's 251 named abilities and 80 combat arts, none sharing a name.
    expect([Object.keys(FE16_ABILITIES).length, Object.keys(FE16_ARTS).length, new Set(names).size]).toEqual([251, 80, 331])
    const ids = names.map((n) => skillIconId('fe16', n))
    expect(new Set(ids).size).toBe(names.length)
    for (const [i, n] of names.entries()) expect(keyOf(`fe16/skills/${ids[i].slice('fe16/'.length)}.png`), n).toBe(`icon:skill:${ids[i]}`)
    expect(skillIconId('fe16', 'Alert Stance+')).toBe('fe16/alert_stance_plus')
    expect(skillIconId('fe16', 'HP +5')).toBe('fe16/hp_plus5')
    expect(keyOf('fe16/skills/alert_stance.png')).toBe('icon:skill:fe16/alert_stance')
    expect(fe16.art.expected.filter((p) => p.startsWith('skills/'))).toHaveLength(331)
  })

  it('has an icon for every ability and combat art a unit or class shows', () => {
    const names = new Set([...Object.keys(FE16_ABILITIES), ...Object.keys(FE16_ARTS)])
    const shown = [
      ...FE16_UNITS.flatMap((u) => [...u.personal, ...u.learns.filter((l) => l.kind !== 'spell').map((l) => l.name), ...(u.budding ? [u.budding.name] : [])]),
      ...Object.values(FE16_CLASSES).flatMap((c) => [...c.abilities, ...c.mastery]),
    ]
    expect(shown.filter((n) => !names.has(n))).toEqual([])
  })
})
