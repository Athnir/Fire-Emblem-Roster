// Skills that come in levels (Three Houses' Sword Prowess Lv 1 to 5, Engage's Sword Agility 1 to 5, Unyielding to Unyielding++): the
// game's own groups, each chain lowest first. A higher level replaces a lower, so the lower ones are hidden beside it unless every
// level is asked for (user, 2026-11-04).

/** Each skill in a chain: the chain and where it stands in it. */
function chainIndex(chains: string[][]): Map<string, { chain: string[]; at: number }> {
  const out = new Map<string, { chain: string[]; at: number }>()
  for (const chain of chains) chain.forEach((name, at) => out.set(name, { chain, at }))
  return out
}

/** The list without the levels a higher level of the same chain in it replaces (Sword Prowess Lv 1 to 4 beside Lv 5). */
export function topLevels<T>(items: T[], nameOf: (item: T) => string, chains: string[][]): T[] {
  const index = chainIndex(chains)
  const names = new Set(items.map(nameOf))
  return items.filter((item) => {
    const c = index.get(nameOf(item))
    return !c || !c.chain.slice(c.at + 1).some((n) => names.has(n))
  })
}
