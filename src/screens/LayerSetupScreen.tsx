import { useEffect, useState } from 'react';
import type { QuizMode } from '../lib/quiz';
import { masteryOf } from '../lib/srs';
import { layerWithPractice, testKey, type GameLayer, type LayerProgress } from '../lib/layerProgress';
import { layerConfig, type Scope } from '../lib/layers';
import { TopBar } from '../components/ui';
import { speak } from '../lib/speech';

interface Props {
  layer: GameLayer;
  /** 'find' / 'name' = Quiz or Practice setup; 'test' = test setup. */
  kind: QuizMode | 'test';
  progress: LayerProgress;
  updateProgress: (fn: (p: LayerProgress) => LayerProgress) => void;
  onHome: () => void;
  onStart: (mode: QuizMode, scopeId: string, practice: boolean, test: boolean) => void;
}

/** Choose Quiz/Practice (or the test mode), then tap a scope to start: all, a continent, or a sub-region. */
export function LayerSetupScreen({ layer, kind, progress, updateProgress, onHome, onStart }: Props) {
  const cfg = layerConfig(layer);
  const test = kind === 'test';
  const [testMode, setTestMode] = useState<QuizMode>('find');
  const mode: QuizMode = test ? testMode : kind;
  const practice = !test && progress.practice;

  useEffect(() => speak(test ? `Find It test or Name It test? Then pick your ${cfg.itemsWord}!` : `Quiz or practice? Then pick your ${cfg.itemsWord}!`), [test, cfg]);

  const toggle = (on: boolean, emoji: string, title: string, sub: string, onClick: () => void) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex min-h-24 flex-1 items-center gap-3 rounded-[2rem] px-5 py-3 text-left transition active:translate-y-1 ${
        on ? 'bg-sky-500 text-white shadow-[0_6px_0_#0369a1] ring-4 ring-yellow-300' : 'bg-white text-slate-700 shadow-[0_6px_0_#94a3b8]'
      }`}
    >
      <span className="text-5xl">{emoji}</span>
      <span>
        <span className="block text-3xl font-black">
          {title} {on && '✓'}
        </span>
        <span className={`block text-lg font-bold ${on ? 'text-sky-50' : 'text-slate-500'}`}>{sub}</span>
      </span>
    </button>
  );

  const detail = (s: Scope) => {
    if (test) {
      const best = progress.bestTests[testKey(s.id, mode)];
      return best ? `${s.ids.length} · best ${best.correct}/${best.total}` : `${s.ids.length} ${cfg.itemsWord}`;
    }
    const mastered = s.ids.filter((id) => masteryOf(progress.records[id]) === 'mastered').length;
    return `${s.ids.length} · 🏆 ${mastered}`;
  };

  const start = (s: Scope) => onStart(mode, s.id, practice, test);

  const bigScope = (s: Scope) => (
    <button
      key={s.id}
      type="button"
      aria-label={`Start: ${s.label}`}
      onClick={() => start(s)}
      style={{ background: s.color }}
      className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-[2rem] p-3 text-white shadow-[0_8px_0_rgba(0,0,0,0.25)] transition active:translate-y-1.5 active:shadow-none"
    >
      <span className="text-3xl font-black">
        {s.emoji} {s.label}
      </span>
      <span className="text-lg font-bold opacity-95">{detail(s)}</span>
    </button>
  );

  const [all, ...rest] = cfg.scopes;
  const continents = rest.filter((s) => !s.continent);

  return (
    <main className="flex h-full flex-col overflow-y-auto">
      <TopBar onHome={onHome}>
        <h1 className="text-3xl font-black text-slate-800 sm:text-4xl">
          {cfg.emoji} {test ? '📝 Test' : mode === 'find' ? '👆 Find It' : '🔤 Name It'}
        </h1>
      </TopBar>

      <div className="flex flex-col gap-4 px-4 pt-2">
        {test ? (
          <>
            <p className="text-center text-2xl font-bold text-slate-600">
              Every {cfg.itemWord} you pick, in a random order. One try each. No hints, and no right or wrong until the end.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              {toggle(testMode === 'find', '👆', 'Find It Test', 'Tap each one on the map', () => setTestMode('find'))}
              {toggle(testMode === 'name', '🔤', 'Name It Test', 'Pick the name of the glowing one', () => setTestMode('name'))}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row">
            {toggle(!practice, '🏆', 'Quiz', `Earn stars and master ${cfg.itemsWord}`, () => {
              updateProgress((p) => layerWithPractice(p, false));
              speak('Quiz. Earn stars!');
            })}
            {toggle(practice, '🎈', 'Practice', 'No score · try as much as you like', () => {
              updateProgress((p) => layerWithPractice(p, true));
              speak('Practice. No score, take your time!');
            })}
          </div>
        )}
        <h2 className="pt-2 text-center text-3xl font-black text-slate-800">Which {cfg.itemsWord}? Tap to start!</h2>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {bigScope(all)}
        {continents.map((c) => {
          const all = rest.filter((s) => s.continent === c.id.slice(2));
          // South America's only sub-region is the whole continent: don't show the same button twice.
          const subs = all.length > 1 ? all : [];
          return (
            <section key={c.id} className="rounded-[2rem] bg-white/70 p-3">
              <div className="grid gap-3 landscape:grid-cols-[minmax(14rem,1fr)_3fr]">
                {bigScope(c)}
                <div className="flex flex-wrap content-center gap-2">
                  {subs.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={`Start: ${s.label}`}
                      onClick={() => start(s)}
                      style={{ borderColor: s.color, color: s.color }}
                      className="min-h-16 rounded-3xl border-4 bg-white px-4 text-left transition active:translate-y-1"
                    >
                      <span className="block text-xl font-black leading-tight">{s.label}</span>
                      <span className="block text-base font-bold text-slate-500">{detail(s)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
