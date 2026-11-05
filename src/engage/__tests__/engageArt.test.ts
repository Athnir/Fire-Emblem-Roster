import { describe, expect, it } from 'vitest'
import { assetKeys } from '../../data/assetStorage'
import { FE17_BOND_RINGS, FE17_EMBLEMS, FE17_SKILLS, FE17_UNITS } from '../../data/fe17/fe17Units'
import fe17 from '../../games/fe17'
import { emblemFaceId, ringFaceId, skillIconId } from '../art'
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
    // The female Alear, a unit of her own, has a portrait of her own.
    expect(keyOf('fe17/alear_female.png')).toBe('portrait:fe17/alear_female')
    expect(fe17.art.expected).toContain('alear_female.png')
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

  it("gives every Emblem a face of its own, in the folder's \"emblems\", apart from the rings and units of the same name", () => {
    const ids = FE17_EMBLEMS.map((e) => emblemFaceId('fe17', e.name))
    expect(new Set(ids).size).toBe(24)
    for (const [i, e] of FE17_EMBLEMS.entries()) expect(keyOf(`${ids[i]}.png`), e.name).toBe(assetKeys.portrait(ids[i]))
    // The Emblem Chrom and the Bond Ring Chrom.
    expect(keyOf('fe17/emblems/chrom.png')).toBe('portrait:fe17/emblems/chrom')
    expect(keyOf('fe17/rings/chrom.png')).toBe('portrait:fe17/rings/chrom')
    // Every Emblem has one (Ephraim's drawn from his model), and the female Alear's Emblem too.
    expect(fe17.art.expected.filter((p) => p.startsWith('emblems/'))).toHaveLength(25)
    expect(fe17.art.expected).toContain('emblems/ephraim.png')
    expect(keyOf('fe17/emblems/alear_female.png')).toBe('portrait:fe17/emblems/alear_female')
  })

  it('gives every skill an icon of its own, a "+" spelled out so Lunar Brace and Lunar Brace+ stay apart', () => {
    const names = Object.keys(FE17_SKILLS)
    const ids = names.map((n) => skillIconId('fe17', n))
    expect(new Set(ids).size).toBe(names.length)
    for (const [i, n] of names.entries()) expect(keyOf(`fe17/skills/${ids[i].slice('fe17/'.length)}.png`), n).toBe(`icon:skill:${ids[i]}`)
    expect(skillIconId('fe17', 'Lunar Brace')).toBe('fe17/lunar_brace')
    expect(skillIconId('fe17', 'Lunar Brace+')).toBe('fe17/lunar_brace_plus')
    expect(skillIconId('fe17', 'Unyielding++')).toBe('fe17/unyielding_plus_plus')
    expect(fe17.art.expected.filter((p) => p.startsWith('skills/'))).toHaveLength(names.length)
  })
})
