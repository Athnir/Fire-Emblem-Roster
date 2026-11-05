import { artFolder, gameLabel, pickerList } from '../games'
import { useSpoilerStore } from '../state/spoilerStore'

/** What the app opens on with the spoiler block on (as the Armory does): no game yet, a few notes, and the art for every game at once. */
export function Home({ onPick, onUpload }: { onPick: (id: string) => void; onUpload: () => void }) {
  const block = useSpoilerStore((s) => s.block)
  const games = pickerList()
  const section = 'space-y-2 rounded-lg border border-neutral-800 bg-neutral-950/60 p-4'

  return (
    <div className="mx-auto max-w-3xl space-y-4 text-sm text-neutral-300">
      <section className={section}>
        <h2 className="text-base font-semibold text-neutral-100">What this is</h2>
        <p>
          A planner for your units: who joins and when, their bases, growths and caps, classes and promotions, skills, supports,
          marriages and children, and full builds you can save and compare. Each game's tools sit in its own tabs. Its partner app,
          the Fire Emblem Armory, covers weapons, forging, shops, maps and battle formulas.
        </p>
        <p>
          Most of the data is read from the games' own files. The planners estimate, and say where they can run a point off.
        </p>
      </section>

      <section className={section}>
        <h2 className="text-base font-semibold text-neutral-100">The spoiler block {block ? 'is on' : 'is off'}</h2>
        <p>
          {block
            ? "Pick a game and it starts from its first chapter: units show once they can have joined, and each chapter you reach on its bar opens up more. A story's split is asked for when you get there. Turn the block off at the top to see everything."
            : 'Everything in every game shows. Turn the block on at the top to play along chapter by chapter, with nothing shown before the chapter that reveals it.'}
        </p>
      </section>

      <section className={section}>
        <h2 className="text-base font-semibold text-neutral-100">The games</h2>
        <ul className="grid gap-1 sm:grid-cols-2">
          {games.map((e) =>
            e.game ? (
              <li key={e.game.id}>
                <button type="button" onClick={() => onPick(e.game.id)} className="w-full rounded-md px-2 py-1 text-left hover:bg-neutral-800">
                  <span className="text-neutral-100">{gameLabel(e.game)}</span> <span className="text-xs text-neutral-500">{artFolder(e.game)}</span>
                </button>
              </li>
            ) : (
              <li key={e.missing.title} className="px-2 py-1 text-neutral-600">
                {gameLabel(e.missing)} <span className="text-xs">({e.missing.why})</span>
              </li>
            ),
          )}
        </ul>
      </section>

      <section className={section}>
        <h2 className="text-base font-semibold text-neutral-100">Your saves and art</h2>
        <p>
          Everything you save stays on this device; Export Backup at the top keeps a copy you can move to another. The app doesn't come
          with the games' portraits or icons. If you have your own, load every game's at once from a folder or a .zip holding a folder
          for each game, named as above (fe14 for Fates).
        </p>
        <button type="button" onClick={onUpload} className="rounded-md bg-violet-600 px-3 py-1.5 font-medium text-white hover:bg-violet-500">
          Bulk Upload: every game
        </button>
      </section>
    </div>
  )
}
