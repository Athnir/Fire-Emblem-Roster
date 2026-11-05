import { describe, expect, it } from 'vitest'
import { assetKeys } from '../../data/assetStorage'
import { FE17_BOND_RINGS, FE17_UNITS } from '../../data/fe17/fe17Units'
import fe17 from '../../games/fe17'
import { ringFaceId } from '../art'
import { artId } from '../hooks'

/** A file as a picked folder, or an unzipped .zip, gives it: its name, and its path in webkitRelativePath. */
function file(path: string): File {
  const f = new File([''], path.split('/').pop() ?? path)
  Object.defineProperty(f, 'webkitRelativePath', { value: path })
  return f
}

/** Where Engage's Bulk Upload keeps a file. */
const keyOf = (path: string) => fe17.art.match([file(path)]).matched[0]?.key

describe('Engage art', () => {
  it('keeps each portrait where the Roster looks it up, accents dropped (Céline: celine.png)', () => {
    for (const u of FE17_UNITS) {
      const id = artId('fe17', u.name)
      expect(keyOf(`${id}.png`), u.name).toBe(assetKeys.portrait(id))
    }
    expect(keyOf('fe17/celine.png')).toBe('portrait:fe17/celine')
    expect(keyOf('fe17/chloe.png')).toBe('portrait:fe17/chloe')
  })

  it("gives every Bond Ring a face of its own, in the folder's \"rings\", apart from the units' portraits", () => {
    const rings = FE17_BOND_RINGS.flatMap((s) => s.rings)
    const ids = rings.map((r) => ringFaceId('fe17', r.name))
    expect(new Set(ids).size).toBe(123)
    for (const [i, r] of rings.entries()) expect(keyOf(`${ids[i]}.png`), r.name).toBe(assetKeys.portrait(ids[i]))
    // The Heroes ring Anna and Engage's Anna: the folder decides.
    expect(keyOf('fe17/rings/anna.png')).toBe('portrait:fe17/rings/anna')
    expect(keyOf('fe17/anna.png')).toBe('portrait:fe17/anna')
    expect(keyOf('fe17/rings/black_knight.png')).toBe('portrait:fe17/rings/black_knight')
    expect(fe17.art.expected.filter((p) => p.startsWith('rings/'))).toHaveLength(123)
  })
})
