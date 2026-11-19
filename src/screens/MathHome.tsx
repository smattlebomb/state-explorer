import type { Screen } from '../App';
import { masteryOf } from '../lib/srs';
import { bestQuizKey, type MathData } from '../lib/mathStorage';

/** How many facts are in play: 1×1–12×12, plus the 25 zero facts when "Include 0s" is on. */
export function mathFactTotal(includeZero: boolean): number {
  return includeZero ? 169 : 144;
}

/** Best quiz chips, e.g. "Best 10: 9/10 · Best 20: 18/20". */
export function bestQuizSummary(math: MathData): string[] {
  const out: string[] = [];
  for (const len of [10, 20, 'all'] as const) {
    const scores = (['keypad', 'choices'] as const).map((m) => math.bestQuizzes[bestQuizKey(len, m)]).filter((b) => !!b);
    if (scores.length === 0) continue;
    const best = scores.reduce((a, b) => (b!.correct / b!.total > a!.correct / a!.total ? b : a))!;
    out.push(`Best ${len === 'all' ? 'All' : len}: ${best.correct}/${best.total}`);
  }
  return out;
}

/**
 * Math home: a calm, simple start. One big card for Multiplication
 * Flashcards (practice), the quiz, My Facts, and the shared Settings.
 */
export function MathHome({ go, math }: { go: (s: Screen) => void; math: MathData }) {
  const total = mathFactTotal(math.includeZero);
  const mastered = Object.entries(math.facts).filter(([id, r]) => (math.includeZero || !/(^0x|x0$)/.test(id)) && masteryOf(r) === 'mastered').length;
  const bests = bestQuizSummary(math);

  return (
    <>
      <div className="mt-5 flex flex-wrap justify-center gap-3 text-2xl font-extrabold">
        <span className="rounded-full bg-green-100 px-5 py-2 text-green-700">
          🌟 Mastered {mastered} of {total}
        </span>
        {bests.map((b) => (
          <span key={b} className="rounded-full bg-yellow-100 px-5 py-2 text-yellow-800">
            🏆 {b}
          </span>
        ))}
      </div>

      <button
        type="button"
        aria-label="Multiplication Flashcards: Practice"
        onClick={() => go({ name: 'math-setup', mode: 'practice' })}
        className="mt-6 flex min-h-32 w-full max-w-4xl min-w-0 items-center gap-5 rounded-[2rem] bg-sky-500 px-6 py-5 text-left text-white shadow-[0_8px_0_#0369a1] transition active:translate-y-1.5 active:shadow-none"
      >
        <span className="text-6xl">✖️</span>
        <span className="min-w-0">
          <span className="block text-4xl font-black">Multiplication Flashcards</span>
          <span className="block text-xl font-bold opacity-90">Practice facts up to 12 × 12. Flip the cards or use the number pad. No timer!</span>
          <span className="mt-2 inline-block rounded-full bg-white/25 px-3 py-1 text-lg font-extrabold">Choose your tables ➜</span>
        </span>
      </button>

      <div className="mt-5 grid w-full max-w-4xl gap-5 landscape:grid-cols-2 portrait:grid-cols-1">
        <button
          type="button"
          aria-label="Multiplication Quiz"
          onClick={() => go({ name: 'math-setup', mode: 'quiz' })}
          className="flex min-h-28 min-w-0 items-center gap-4 rounded-[2rem] bg-violet-500 px-6 py-5 text-left text-white shadow-[0_8px_0_#6d28d9] transition active:translate-y-1.5 active:shadow-none"
        >
          <span className="text-5xl">🏆</span>
          <span className="min-w-0">
            <span className="block text-3xl font-black">Quiz</span>
            <span className="block text-lg font-bold opacity-90">10, 20 or all your facts. See your score at the end.</span>
          </span>
        </button>
        <button
          type="button"
          aria-label="My Facts"
          onClick={() => go({ name: 'math-facts' })}
          className="flex min-h-28 min-w-0 items-center gap-4 rounded-[2rem] bg-orange-500 px-6 py-5 text-left text-white shadow-[0_8px_0_#c2410c] transition active:translate-y-1.5 active:shadow-none"
        >
          <span className="text-5xl">🟩</span>
          <span className="min-w-0">
            <span className="block text-3xl font-black">My Facts</span>
            <span className="block text-lg font-bold opacity-90">See which facts you know, from 1 × 1 to 12 × 12.</span>
          </span>
        </button>
      </div>

      <div className="mt-8 flex w-full max-w-4xl flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={() => go({ name: 'settings' })}
          className="min-h-16 rounded-3xl bg-white px-8 text-2xl font-extrabold text-slate-800 shadow-[0_6px_0_#94a3b8] transition active:translate-y-1"
        >
          ⚙️ Settings
        </button>
      </div>
      <p className="mt-4 max-w-2xl text-center text-lg font-bold text-slate-500">
        Math has its own progress, separate from geography. Take your time: there is no timer unless you turn one on.
      </p>
    </>
  );
}
