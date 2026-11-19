import { useState } from 'react';
import type { Mastery } from '../lib/srs';
import { mathWithReset, type MathData } from '../lib/mathStorage';
import { factGrid, type GridCell } from '../lib/mathMastery';
import { ArrayHint } from '../components/math/ArrayHint';
import { LongPressButton } from '../components/LongPressButton';
import { BigButton, TopBar } from '../components/ui';
import { speak } from '../lib/speech';

/** Color AND a symbol for each level, so it never depends on color alone. */
export const FACT_STYLE: Record<Mastery, { cell: string; chip: string; label: string; mark: string }> = {
  mastered: { cell: 'bg-emerald-400 text-emerald-950', chip: 'bg-emerald-400 text-emerald-950', label: 'Mastered', mark: '★' },
  learning: { cell: 'bg-amber-300 text-amber-950', chip: 'bg-amber-300 text-amber-950', label: 'Learning', mark: '●' },
  new: { cell: 'bg-slate-100 text-slate-500', chip: 'bg-slate-100 text-slate-600', label: 'New', mark: '' },
};

interface Props {
  math: MathData;
  updateMath: (fn: (m: MathData) => MathData) => void;
  onHome: () => void;
  onPractice: () => void;
}

/** My Facts: every fact from 1 × 1 to 12 × 12 (0–12 with zeros) colored by how well she knows it. */
export function MathFactsScreen({ math, updateMath, onHome, onPractice }: Props) {
  const grid = factGrid(math.facts, math.includeZero);
  const [selected, setSelected] = useState<GridCell | null>(null);
  const [confirming, setConfirming] = useState(false);

  const pick = (cell: GridCell) => {
    setSelected(cell);
    speak(`${cell.a} times ${cell.b} is ${cell.product}.`);
  };

  return (
    <main className="flex h-full flex-col overflow-y-auto pb-[env(safe-area-inset-bottom)]">
      <TopBar onHome={onHome}>
        <h1 className="text-3xl font-black text-slate-800 sm:text-4xl">🟩 My Facts</h1>
      </TopBar>

      <div className="mx-auto flex w-full max-w-5xl shrink-0 flex-col items-center gap-4 px-3 pb-8 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
        <p className="text-center text-2xl font-black text-slate-700">
          🌟 Mastered {grid.counts.mastered} of {grid.counts.total}
        </p>
        <div className="flex flex-wrap justify-center gap-2 text-lg font-extrabold" aria-label="Legend">
          {(['mastered', 'learning', 'new'] as const).map((m) => (
            <span key={m} className={`rounded-full px-4 py-1 ${FACT_STYLE[m].chip}`}>
              {FACT_STYLE[m].mark || '○'} {FACT_STYLE[m].label}: {grid.counts[m]}
            </span>
          ))}
        </div>
        <p className="text-center text-base font-bold text-slate-500">★ = right 3 times in a row · ● = still learning. Tap any square to see the fact.</p>

        {/* Scrolls sideways on a phone; each square stays big enough to tap. */}
        <div className="w-full overflow-x-auto pb-2">
          <table className="mx-auto border-separate border-spacing-1" aria-label="Multiplication facts grid">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 h-12 w-12 bg-sky-50 text-xl font-black text-slate-500" aria-label="times">
                  ×
                </th>
                {grid.factors.map((b) => (
                  <th key={b} scope="col" className="h-12 min-w-12 text-2xl font-black text-violet-700">
                    {b}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row, i) => (
                <tr key={grid.factors[i]}>
                  {/* Row numbers stay put while the grid scrolls sideways on a phone. */}
                  <th scope="row" className="sticky left-0 z-10 h-12 w-12 rounded-xl bg-sky-50 text-2xl font-black text-sky-700">
                    {grid.factors[i]}
                  </th>
                  {row.map((cell) => {
                    const s = FACT_STYLE[cell.mastery];
                    const on = selected?.id === cell.id;
                    return (
                      <td key={cell.id} className="p-0">
                        <button
                          type="button"
                          aria-label={`${cell.a} times ${cell.b} equals ${cell.product}, ${s.label}`}
                          aria-pressed={on}
                          onClick={() => pick(cell)}
                          className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-black transition active:scale-95 sm:h-14 sm:w-14 ${s.cell} ${on ? 'ring-4 ring-violet-500' : ''}`}
                        >
                          {s.mark}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <section className="pop-in w-full max-w-xl rounded-[2rem] bg-white p-4 text-center shadow-[0_6px_0_#94a3b8]" aria-live="polite">
            <div className="text-5xl font-black text-slate-900">
              {selected.a} × {selected.b} = <span className="text-sky-700">{selected.product}</span>
            </div>
            <div className={`mt-2 inline-block rounded-full px-4 py-1 text-xl font-extrabold ${FACT_STYLE[selected.mastery].chip}`}>
              {FACT_STYLE[selected.mastery].mark} {FACT_STYLE[selected.mastery].label}
            </div>
            <ArrayHint a={selected.a} b={selected.b} className="mt-3" />
          </section>
        )}

        <BigButton variant="success" className="min-h-20 text-3xl" onClick={onPractice}>
          ✖️ Practice
        </BigButton>

        <LongPressButton onLongPress={() => setConfirming(true)} className="mt-4 min-h-16 rounded-3xl bg-white/60 px-6 text-lg font-bold text-slate-500">
          Grown-ups: hold for 3 seconds to reset math progress
        </LongPressButton>
      </div>

      {/* Always-visible answer for the tapped square (the grid is taller than a phone screen). */}
      {selected && (
        <div className="sticky bottom-0 z-20 mt-auto flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2" aria-live="polite">
          <div className="flex min-h-16 max-w-xl flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-3xl bg-white px-6 py-2 shadow-[0_6px_0_#94a3b8] ring-4 ring-violet-400" data-testid="fact-bar">
            <span className="text-4xl font-black text-slate-900">
              {selected.a} × {selected.b} = <span className="text-sky-700">{selected.product}</span>
            </span>
            <span className={`rounded-full px-3 py-1 text-lg font-extrabold ${FACT_STYLE[selected.mastery].chip}`}>
              {FACT_STYLE[selected.mastery].mark} {FACT_STYLE[selected.mastery].label}
            </span>
          </div>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6">
          <div className="pop-in max-w-xl rounded-[2rem] bg-white p-8 text-center shadow-2xl">
            <div className="text-5xl">⚠️</div>
            <h2 className="mt-3 text-3xl font-black text-slate-800">Erase math progress?</h2>
            <p className="mt-2 text-2xl text-slate-600">Mastered facts and best quiz scores will be erased. Geography is not touched. This can't be undone.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <BigButton variant="success" onClick={() => setConfirming(false)}>
                Keep it!
              </BigButton>
              <BigButton
                variant="secondary"
                className="text-rose-600"
                onClick={() => {
                  updateMath(mathWithReset);
                  setSelected(null);
                  setConfirming(false);
                }}
              >
                Erase math
              </BigButton>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
