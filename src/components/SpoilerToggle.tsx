import { useSpoilerStore } from '../state/spoilerStore'

/** The spoiler block's switch, for every game. */
export function SpoilerToggle() {
  const block = useSpoilerStore((s) => s.block)
  const setBlock = useSpoilerStore((s) => s.setBlock)
  return (
    <button
      type="button"
      onClick={() => setBlock(!block)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        block ? 'bg-emerald-700 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
      }`}
      title="Play along chapter by chapter: nothing shows before the chapter that reveals it"
    >
      Spoiler block: {block ? 'ON' : 'OFF'}
    </button>
  )
}
