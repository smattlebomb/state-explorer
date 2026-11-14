import type { Layer, Screen } from '../App';
import type { SavedData } from '../lib/storage';
import { displayStreak, playedToday, toDayKey } from '../lib/streak';
import { masteryOf } from '../lib/srs';
import { ALL_ABBRS } from '../data/states';
import { Mascot } from '../components/Mascot';
import { regionChoices, suggestRegion } from '../lib/regionProgress';
import { getRegion, type Region } from '../data/regions';
import { BigButton } from '../components/ui';
import { emptyLayerProgress, testKey, type LayerProgress } from '../lib/layerProgress';

const MODES = [
  { key: 'learn', emoji: '🔍', title: 'Learn', sub: 'Tap states to hear their names', next: null, color: 'bg-sky-500 shadow-[0_8px_0_#0369a1]' },
  { key: 'find', emoji: '👆', title: 'Find It', sub: 'Can you find the state?', next: 'Choose your states ➜', color: 'bg-orange-500 shadow-[0_8px_0_#c2410c]' },
  { key: 'name', emoji: '🔤', title: 'Name It', sub: 'What state is glowing?', next: 'Choose your states ➜', color: 'bg-violet-500 shadow-[0_8px_0_#6d28d9]' },
] as const;

/** Screen for "start Find It in this region now", using the current Quiz/Practice choice. */
export function findItIn(region: Region['id'], practice: boolean, game = Date.now()): Screen {
  return { name: 'quiz', mode: 'find', region, practice, game };
}

/**
 * "Practice next" card. The big default button is the auto-suggested region
 * (smallest share mastered); the chip row below starts Find It in any other
 * region or All 50.
 */
function SuggestionCard({ data, go }: { data: SavedData; go: (s: Screen) => void }) {
  const id = suggestRegion(data.records);
  const region = getRegion(id);
  const practice = data.settings.practice;
  const flavor = practice ? '🎈 Practice' : '🏆 Quiz';
  const choices = regionChoices(data.records);
  const suggestedChoice = choices.find((c) => c.id === id)!;

  return (
    <section className="mt-6 w-full max-w-4xl rounded-[2rem] bg-white/80 p-4" aria-label="Practice next">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="text-lg font-bold text-slate-500">{id === 'all' ? '🏆 You mastered every region! Mix them all up:' : 'Practice next'}</div>
          <div className="text-3xl font-black text-slate-800">
            {region.emoji} {region.label}
            <span className="ml-3 text-xl font-bold text-slate-500">
              🏆 {suggestedChoice.mastered} / {suggestedChoice.total}
            </span>
          </div>
        </div>
        {id !== 'all' && (
          <BigButton variant="secondary" onClick={() => go({ name: 'learn', tour: id })}>
            🧭 Tour
          </BigButton>
        )}
        <BigButton variant="success" className="text-3xl" aria-label={`Find It: ${region.label} (suggested)`} onClick={() => go(findItIn(id, practice))}>
          👆 Find It
        </BigButton>
      </div>

      <div className="mt-4 border-t-2 border-dashed border-slate-200 pt-3">
        <div className="mb-2 text-center text-xl font-extrabold text-slate-600 sm:text-left">
          Or pick a different region <span className="font-bold text-slate-500">· starts Find It · {flavor}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 landscape:grid-cols-6">
          {choices.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={`Find It: ${c.label}`}
              onClick={() => go(findItIn(c.id, practice))}
              className={`flex min-h-20 flex-col items-center justify-center rounded-3xl px-2 py-2 text-white shadow-[0_5px_0_rgba(0,0,0,0.25)] transition active:translate-y-1 active:shadow-none ${c.color} ${
                c.suggested ? 'ring-4 ring-yellow-300' : ''
              }`}
            >
              <span className="text-2xl font-black leading-tight">
                {c.emoji} {c.label}
              </span>
              <span className="text-lg font-bold opacity-95">
                🏆 {c.mastered} / {c.total}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

const LAYERS: readonly { id: Layer; emoji: string; label: string; color: string }[] = [
  { id: 'usa', emoji: '🇺🇸', label: 'USA', color: 'bg-sky-600 shadow-[0_6px_0_#075985]' },
  { id: 'canada', emoji: '🇨🇦', label: 'Canada', color: 'bg-red-600 shadow-[0_6px_0_#991b1b]' },
  { id: 'world', emoji: '🌍', label: 'World', color: 'bg-emerald-600 shadow-[0_6px_0_#065f46]' },
];

/** Big "which map?" switcher at the top of Home. */
function LayerSwitcher({ layer, onLayer }: { layer: Layer; onLayer: (l: Layer) => void }) {
  return (
    <div className="mt-4 grid w-full max-w-4xl grid-cols-3 gap-3" role="group" aria-label="Choose a map">
      {LAYERS.map((l) => {
        const on = l.id === layer;
        return (
          <button
            key={l.id}
            type="button"
            aria-pressed={on}
            aria-label={`${l.label} map`}
            onClick={() => onLayer(l.id)}
            className={`flex min-h-20 items-center justify-center gap-2 rounded-3xl px-3 text-3xl font-black transition active:translate-y-1 active:shadow-none ${
              on ? `${l.color} text-white ring-4 ring-yellow-300` : 'bg-white text-slate-700 shadow-[0_6px_0_#94a3b8]'
            }`}
          >
            <span className="text-4xl">{l.emoji}</span> {l.label}
          </button>
        );
      })}
    </div>
  );
}

const LAYER_TOTAL: Record<'canada' | 'world', number> = { world: 195, canada: 13 };

/** Home for the Canada and World layers: the same big cards as the US home, with that layer's own progress. */
function OtherLayerHome({ layer, go, progress }: { layer: 'canada' | 'world'; go: (s: Screen) => void; progress: LayerProgress }) {
  const canada = layer === 'canada';
  const total = LAYER_TOTAL[layer];
  const today = toDayKey(new Date());
  const streak = displayStreak(progress.streak, today);
  const mastered = Object.values(progress.records).filter((r) => masteryOf(r) === 'mastered').length;
  const things = canada ? 'provinces and territories' : 'countries';
  const bestFind = progress.bestTests[testKey('all', 'find')];
  const bestName = progress.bestTests[testKey('all', 'name')];
  const cards = [
    { key: 'learn', emoji: canada ? '🍁' : '🔍', title: 'Learn', sub: canada ? 'Tap the provinces and territories' : 'Zoom from continents to countries', next: null, color: 'bg-sky-500 shadow-[0_8px_0_#0369a1]', to: (canada ? { name: 'canada' } : { name: 'world' }) as Screen },
    { key: 'find', emoji: '👆', title: 'Find It', sub: canada ? 'Can you find it on the map?' : 'Can you find the country?', next: canada ? 'Start ➜' : 'Choose your countries ➜', color: 'bg-orange-500 shadow-[0_8px_0_#c2410c]', to: { name: 'layer-setup', layer, kind: 'find' } as Screen },
    { key: 'name', emoji: '🔤', title: 'Name It', sub: canada ? 'What is glowing?' : 'What country is glowing?', next: canada ? 'Start ➜' : 'Choose your countries ➜', color: 'bg-violet-500 shadow-[0_8px_0_#6d28d9]', to: { name: 'layer-setup', layer, kind: 'name' } as Screen },
  ];
  return (
    <>
      <div className="mt-5 flex flex-wrap justify-center gap-3 text-2xl font-extrabold">
        <span className={`rounded-full px-5 py-2 ${streak > 0 ? 'bg-orange-100 text-orange-700' : 'bg-white/70 text-slate-500'}`}>
          🔥 {streak} day{streak === 1 ? '' : 's'}
        </span>
        <span className="rounded-full bg-yellow-100 px-5 py-2 text-yellow-700">⭐ {progress.totalStars}</span>
        <span className="rounded-full bg-green-100 px-5 py-2 text-green-700">
          🏆 {mastered} / {total}
        </span>
      </div>

      <div className="mt-6 grid w-full max-w-4xl gap-5 landscape:grid-cols-3 portrait:grid-cols-1">
        {cards.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-label={`${canada ? 'Canada' : 'World'} ${m.title}`}
            onClick={() => go(m.to)}
            className={`flex min-h-32 items-center gap-4 rounded-[2rem] px-6 py-5 text-left text-white transition active:translate-y-1.5 active:shadow-none landscape:flex-col landscape:text-center ${m.color}`}
          >
            <span className="text-6xl">{m.emoji}</span>
            <span>
              <span className="block text-4xl font-black">{m.title}</span>
              <span className="block text-xl font-bold opacity-90">{m.sub}</span>
              {m.next && <span className="mt-2 inline-block rounded-full bg-white/25 px-3 py-1 text-lg font-extrabold">{m.next}</span>}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        aria-label={`${canada ? 'Canada' : 'World'} Test`}
        onClick={() => go({ name: 'layer-setup', layer, kind: 'test' })}
        className="mt-5 flex min-h-32 w-full max-w-4xl items-center gap-5 rounded-[2rem] bg-rose-500 px-6 py-5 text-left text-white shadow-[0_8px_0_#be123c] transition active:translate-y-1.5 active:shadow-none"
      >
        <span className="text-6xl">📝</span>
        <span>
          <span className="block text-4xl font-black">Test</span>
          <span className="block text-xl font-bold opacity-90">
            {canada ? 'All 13, one try each.' : 'All 195 countries, a continent or a region. One try each.'} Find It or Name It.
          </span>
          {(bestFind || bestName) && (
            <span className="mt-2 inline-block rounded-full bg-white/25 px-3 py-1 text-lg font-extrabold">
              Best (all {total}){bestFind ? ` · Find It ${bestFind.correct}/${bestFind.total}` : ''}
              {bestName ? ` · Name It ${bestName.correct}/${bestName.total}` : ''}
            </span>
          )}
        </span>
      </button>

      <div className="mt-8 flex w-full max-w-4xl flex-wrap justify-center gap-4">
        <button
          type="button"
          aria-label={`${canada ? 'Canada' : 'World'} My Map`}
          onClick={() => go({ name: 'layer-progress', layer })}
          className="min-h-16 rounded-3xl bg-white px-8 text-2xl font-extrabold text-slate-800 shadow-[0_6px_0_#94a3b8] transition active:translate-y-1"
        >
          📊 My Map
        </button>
        <button
          type="button"
          onClick={() => go({ name: 'settings' })}
          className="min-h-16 rounded-3xl bg-white px-8 text-2xl font-extrabold text-slate-800 shadow-[0_6px_0_#94a3b8] transition active:translate-y-1"
        >
          ⚙️ Settings
        </button>
      </div>
      <p className="mt-4 text-center text-lg font-bold text-slate-500">
        {canada ? 'Canada' : 'World'} has its own stars, streak and progress, separate from the USA. ({things})
      </p>
    </>
  );
}

export function HomeScreen({
  data,
  go,
  layer = 'usa',
  onLayer = () => {},
  layerProgress,
}: {
  data: SavedData;
  go: (s: Screen) => void;
  layer?: Layer;
  onLayer?: (l: Layer) => void;
  /** Progress of the active World/Canada layer (its own store). */
  layerProgress?: LayerProgress;
}) {
  if (layer !== 'usa') {
    return (
      <main className="flex h-full flex-col items-center overflow-y-auto px-4 py-6">
        <h1 className="flex items-center justify-center gap-3 text-center text-5xl font-black tracking-tight text-sky-700 sm:text-6xl">
          <Mascot mood="idle" size={76} /> State Explorer
        </h1>
        <p className="mt-2 text-center text-2xl font-bold text-slate-600">{layer === 'canada' ? "Let's explore Canada!" : "Let's explore the world!"}</p>
        <LayerSwitcher layer={layer} onLayer={onLayer} />
        <OtherLayerHome layer={layer} go={go} progress={layerProgress ?? emptyLayerProgress()} />
      </main>
    );
  }
  return <UsaHome data={data} go={go} onLayer={onLayer} />;
}

function UsaHome({ data, go, onLayer }: { data: SavedData; go: (s: Screen) => void; onLayer: (l: Layer) => void }) {
  const today = toDayKey(new Date());
  const streak = displayStreak(data.streak, today);
  const mastered = ALL_ABBRS.filter((s) => masteryOf(data.records[s]) === 'mastered').length;

  return (
    <main className="flex h-full flex-col items-center overflow-y-auto px-4 py-6">
      <h1 className="flex items-center justify-center gap-3 text-center text-5xl font-black tracking-tight text-sky-700 sm:text-6xl">
        <Mascot mood="idle" size={76} /> State Explorer
      </h1>
      <p className="mt-2 text-center text-2xl font-bold text-slate-600">Let's learn the 50 states!</p>
      <LayerSwitcher layer="usa" onLayer={onLayer} />

      <div className="mt-5 flex flex-wrap justify-center gap-3 text-2xl font-extrabold">
        <span className={`rounded-full px-5 py-2 ${streak > 0 ? 'bg-orange-100 text-orange-700' : 'bg-white/70 text-slate-500'}`}>
          🔥 {streak} day{streak === 1 ? '' : 's'}
          {streak > 0 && !playedToday(data.streak, today) && <span className="ml-2 text-lg">play today!</span>}
        </span>
        <span className="rounded-full bg-yellow-100 px-5 py-2 text-yellow-700">⭐ {data.totalStars}</span>
        <span className="rounded-full bg-green-100 px-5 py-2 text-green-700">🏆 {mastered} / 50</span>
      </div>

      <SuggestionCard data={data} go={go} />

      <div className="mt-6 grid w-full max-w-4xl gap-5 landscape:grid-cols-3 portrait:grid-cols-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => go(m.key === 'learn' ? { name: 'learn' } : { name: 'setup', mode: m.key })}
            className={`flex min-h-32 items-center gap-4 rounded-[2rem] px-6 py-5 text-left text-white transition active:translate-y-1.5 active:shadow-none landscape:flex-col landscape:text-center ${m.color}`}
          >
            <span className="text-6xl">{m.emoji}</span>
            <span>
              <span className="block text-4xl font-black">{m.title}</span>
              <span className="block text-xl font-bold opacity-90">{m.sub}</span>
              {/* Makes it obvious these lead to the Quiz/Practice + region choice screen */}
              {m.next && <span className="mt-2 inline-block rounded-full bg-white/25 px-3 py-1 text-lg font-extrabold">{m.next}</span>}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => go({ name: 'setup-test' })}
        className="mt-5 flex min-h-32 w-full max-w-4xl items-center gap-5 rounded-[2rem] bg-rose-500 px-6 py-5 text-left text-white shadow-[0_8px_0_#be123c] transition active:translate-y-1.5 active:shadow-none"
      >
        <span className="text-6xl">📝</span>
        <span>
          <span className="block text-4xl font-black">Test</span>
          <span className="block text-xl font-bold opacity-90">All 50 states, one try each. Find It or Name It.</span>
          {(data.bestTests.find || data.bestTests.name) && (
            <span className="mt-2 inline-block rounded-full bg-white/25 px-3 py-1 text-lg font-extrabold">
              Best
              {data.bestTests.find ? ` · Find It ${data.bestTests.find.correct}/${data.bestTests.find.total}` : ''}
              {data.bestTests.name ? ` · Name It ${data.bestTests.name.correct}/${data.bestTests.name.total}` : ''}
            </span>
          )}
        </span>
      </button>

      <div className="mt-8 flex w-full max-w-4xl flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={() => go({ name: 'progress' })}
          className="min-h-16 rounded-3xl bg-white px-8 text-2xl font-extrabold text-slate-800 shadow-[0_6px_0_#94a3b8] transition active:translate-y-1"
        >
          📊 My Map
        </button>
        <button
          type="button"
          onClick={() => go({ name: 'settings' })}
          className="min-h-16 rounded-3xl bg-white px-8 text-2xl font-extrabold text-slate-800 shadow-[0_6px_0_#94a3b8] transition active:translate-y-1"
        >
          ⚙️ Settings
        </button>
      </div>
    </main>
  );
}
