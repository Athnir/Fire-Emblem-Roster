import { describe, expect, it } from 'vitest'
import { isPlanned } from '../planned'

describe('a plan worth showing in the Bulk Viewer', () => {
  it('is one that differs from the untouched plan, empty parts aside', () => {
    const untouched = { steps: [], targetLevel: 1 }
    expect(isPlanned(undefined, untouched)).toBe(false)
    expect(isPlanned({ steps: [], targetLevel: 1, inherited: [], bonds: {}, fixed: false }, untouched)).toBe(false)
    expect(isPlanned({ targetLevel: 1, steps: [] }, untouched)).toBe(false)
    expect(isPlanned({ steps: [], targetLevel: 5 }, untouched)).toBe(true)
    expect(isPlanned({ steps: [], targetLevel: 1, inherited: ['Speedtaker'] }, untouched)).toBe(true)
  })
})
