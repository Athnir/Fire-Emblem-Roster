// Whether a unit has a plan worth showing in the Bulk Viewer: one that differs from the plan they'd have untouched (user, 2026-11-05:
// a unit opened in a planner and left as it was, or with a skill picked and taken off again, isn't in the test plan).

/** A plan with its empty parts dropped (no value, an empty list or object, false), keys sorted, so two plans compare by what's in
 * them. */
function trimmed(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(trimmed)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v).sort()) {
      const x = trimmed((v as Record<string, unknown>)[k])
      const empty = x === undefined || x === null || x === false || (Array.isArray(x) && x.length === 0) || (typeof x === 'object' && x !== null && !Array.isArray(x) && Object.keys(x).length === 0)
      if (!empty) out[k] = x
    }
    return out
  }
  return v
}

/** Whether `plan` (saved, or none) differs from the unit's untouched plan. */
export function isPlanned(plan: unknown, untouched: unknown): boolean {
  return plan !== undefined && JSON.stringify(trimmed(plan)) !== JSON.stringify(trimmed(untouched))
}
