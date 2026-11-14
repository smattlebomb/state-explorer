import { BigButton, TopBar } from '../components/ui';
import type { QuizMode } from '../lib/quiz';

/** Pick Find It or Name It for a 50-state test. */
export function TestSetupScreen({
  onHome,
  onStart,
  bestFind,
  bestName,
}: {
  onHome: () => void;
  onStart: (mode: QuizMode) => void;
  bestFind: string | null;
  bestName: string | null;
}) {
  return (
    <main className="flex h-full flex-col overflow-y-auto">
      <TopBar onHome={onHome}>
        <h1 className="text-3xl font-black text-slate-800 sm:text-4xl">📝 Test</h1>
      </TopBar>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-10 text-center">
        <p className="max-w-2xl text-2xl font-bold text-slate-600">
          All 50 states, in a random order. You get one try on each. No hints, and we won't tell you if you're right until the end.
        </p>
        <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onStart('find')}
            className="flex min-h-36 flex-col items-center justify-center rounded-[2rem] bg-orange-500 px-6 py-6 text-white shadow-[0_8px_0_#c2410c] transition active:translate-y-1.5 active:shadow-none"
          >
            <span className="text-5xl">👆</span>
            <span className="text-4xl font-black">Find It Test</span>
            <span className="text-xl font-bold opacity-90">Tap each state on the map</span>
            {bestFind && <span className="mt-2 rounded-full bg-white/25 px-3 py-1 text-lg font-extrabold">Best: {bestFind}</span>}
          </button>
          <button
            type="button"
            onClick={() => onStart('name')}
            className="flex min-h-36 flex-col items-center justify-center rounded-[2rem] bg-violet-500 px-6 py-6 text-white shadow-[0_8px_0_#6d28d9] transition active:translate-y-1.5 active:shadow-none"
          >
            <span className="text-5xl">🔤</span>
            <span className="text-4xl font-black">Name It Test</span>
            <span className="text-xl font-bold opacity-90">Pick the name of the glowing state</span>
            {bestName && <span className="mt-2 rounded-full bg-white/25 px-3 py-1 text-lg font-extrabold">Best: {bestName}</span>}
          </button>
        </div>
        <BigButton variant="secondary" onClick={onHome}>
          🏠 Home
        </BigButton>
      </div>
    </main>
  );
}
