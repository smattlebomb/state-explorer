import { useEffect, useMemo } from 'react';
import { COMBO_SMALL, type QuizMode, type RoundSummary } from '../lib/quiz';
import { displayStreak, toDayKey } from '../lib/streak';
import { testKey, type GameLayer, type LayerProgress } from '../lib/layerProgress';
import { layerConfig, scopeOf } from '../lib/layers';
import { LayerMap, useLayerGeo } from '../components/LayerMap';
import { MapLoading } from '../components/MapLoading';
import { Mascot } from '../components/Mascot';
import { Buttons, FlyingStars, HEADLINES, HEADLINE_EMOJI, StateChips } from './ResultsScreen';
import { speak } from '../lib/speech';
import { soundFanfare } from '../lib/sound';
import { bigCelebration } from '../lib/celebrate';

interface Props {
  layer: GameLayer;
  mode: QuizMode;
  scopeId: string;
  summary: RoundSummary;
  progress: LayerProgress;
  onHome: () => void;
  onAgain: () => void;
  onOther: () => void;
}

/** End of a World / Canada round: same three endings as the US (Test, Practice, Quiz). */
export function LayerResultsScreen({ layer, mode, scopeId, summary, progress, onHome, onAgain, onOther }: Props) {
  const cfg = layerConfig(layer);
  const scope = scopeOf(cfg, scopeId);
  const streak = displayStreak(progress.streak, toDayKey(new Date()));
  const { lg } = useLayerGeo(layer);
  const words = cfg.itemsWord;

  useEffect(() => {
    soundFanfare();
    if (summary.test) {
      const pct = summary.total === 0 ? 0 : Math.round(summary.accuracy * 100);
      speak(summary.completed ? `Test finished! You got ${summary.firstTry} out of ${summary.total}, ${pct} percent.` : `You stopped the test. You got ${summary.firstTry} out of ${summary.total}.`);
      return;
    }
    if (summary.practice) return speak('Practice finished! Great work!');
    if (summary.stars === 3) setTimeout(bigCelebration, 900);
    const mastered = summary.newlyMastered.length;
    speak(
      `${HEADLINES[summary.stars]} You earned ${summary.stars} star${summary.stars === 1 ? '' : 's'}!` +
        (mastered > 0 ? ` And you mastered ${mastered === 1 ? cfg.nameOf(summary.newlyMastered[0]) : `${mastered} new ${words}`}!` : ''),
    );
  }, [summary, cfg, words]);

  const byId = useMemo(() => new Map(summary.answers.map((a) => [a.state, a.correct])), [summary]);
  const resultFill = useMemo(
    () => (id: string) => {
      const ok = byId.get(id);
      return ok === true ? '#4ade80' : ok === false ? '#f87171' : scope.ids.includes(id) ? '#e2e8f0' : undefined;
    },
    [byId, scope],
  );

  const header = (
    <div className="text-xl font-bold text-slate-500">
      {cfg.emoji} {cfg.title} · {mode === 'find' ? '👆 Find It' : '🔤 Name It'} · {summary.test ? '📝 Test' : summary.practice ? '🎈 Practice' : '🏆 Quiz'} · {scope.emoji} {scope.label}
    </div>
  );

  if (summary.test) {
    const pct = summary.total === 0 ? 0 : Math.round(summary.accuracy * 100);
    const best = progress.bestTests[testKey(scope.id, mode)];
    const isNewBest = summary.completed && best && best.correct === summary.firstTry;
    return (
      <main className="flex h-full flex-col overflow-y-auto p-4 text-center">
        {header}
        <Mascot mood={pct >= 80 ? 'celebrate' : pct >= 50 ? 'happy' : 'idle'} size={110} />
        <h1 className="text-5xl font-black text-sky-700 sm:text-6xl">
          {summary.firstTry}/{summary.total} ({pct}%)
        </h1>
        {!summary.completed && <p className="text-2xl font-bold text-slate-600">You stopped after {summary.total} of {scope.ids.length} {words}.</p>}
        {summary.completed && isNewBest && <p className="text-2xl font-extrabold text-green-700">🎉 New best score!</p>}
        {summary.completed && best && !isNewBest && (
          <p className="text-xl font-bold text-slate-500">
            Your best is {best.correct}/{best.total} ({Math.round((best.correct / best.total) * 100)}%)
          </p>
        )}
        <div className="mx-auto h-[42vh] w-full max-w-5xl shrink-0">
          {lg ? <LayerMap lg={lg} scopeId={scope.id} regionColors={false} fillOverride={resultFill} /> : <MapLoading />}
        </div>
        <p className="text-lg font-bold text-slate-500">Green = correct · Red = missed{!summary.completed ? ' · Gray = not asked' : ''}</p>
        {summary.misses.length > 0 && (
          <div className="mx-auto mt-3 w-full max-w-3xl rounded-3xl bg-white/80 px-5 py-4 text-left">
            <div className="text-center text-2xl font-black text-slate-700">Misses</div>
            <ul className="mt-3 space-y-2">
              {summary.misses.map((m) => (
                <li key={m.state} className="rounded-2xl bg-rose-50 px-4 py-2 text-xl font-bold text-slate-800">
                  <span className="font-black">{cfg.nameOf(m.state)}</span>
                  {m.picked ? (
                    <>
                      {' '}
                      — you picked <span className="text-rose-700">{cfg.nameOf(m.picked)}</span>
                    </>
                  ) : (
                    ' — skipped'
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="py-4">
          <Buttons onAgain={onAgain} onOtherRegion={onOther} onHome={onHome} otherLabel="📝 Other test" />
        </div>
      </main>
    );
  }

  if (summary.practice) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-5 overflow-y-auto p-6 text-center">
        {header}
        <Mascot mood="celebrate" size={130} />
        <h1 className="text-6xl font-black text-sky-700">Practice done! 🎈</h1>
        <p className="text-3xl font-extrabold text-slate-700">
          You practiced {summary.total} {summary.total === 1 ? cfg.itemWord : words}. Way to go!
        </p>
        {summary.missed.length > 0 && (
          <div className="max-w-3xl rounded-3xl bg-white/80 px-6 py-4">
            <div className="text-2xl font-bold text-slate-600">These are tricky. We'll see them again soon:</div>
            <StateChips states={summary.missed} tone="practice" nameOf={cfg.nameOf} />
          </div>
        )}
        <Buttons onAgain={onAgain} onOtherRegion={onOther} onHome={onHome} otherLabel={`🗺️ Other ${words}`} />
      </main>
    );
  }

  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-center">
      {header}
      <Mascot mood={summary.stars >= 2 ? 'celebrate' : 'happy'} size={130} />
      <h1 className="text-6xl font-black text-sky-700">
        {HEADLINES[summary.stars]} {HEADLINE_EMOJI[summary.stars]}
      </h1>
      <FlyingStars count={summary.stars} />
      <p className="text-3xl font-extrabold text-slate-700">
        You got {summary.firstTry} of {summary.total} on the first try!
      </p>
      <div className="flex flex-wrap justify-center gap-3 text-2xl font-extrabold">
        {streak > 0 && <span className="rounded-full bg-orange-100 px-4 py-1 text-orange-700">🔥 {streak} day streak!</span>}
        {summary.bestCombo >= COMBO_SMALL && <span className="rounded-full bg-pink-100 px-4 py-1 text-pink-700">🚀 Best combo: {summary.bestCombo} in a row</span>}
      </div>
      {summary.usedHints && <p className="rounded-2xl bg-amber-100 px-5 py-2 text-2xl font-bold text-amber-800">💡 You used hints this time. Try without hints to earn 3 stars!</p>}
      {summary.newlyMastered.length > 0 && (
        <div className="max-w-3xl rounded-3xl bg-white/80 px-6 py-4">
          <div className="text-2xl font-black text-green-700">🏆 New mastered {words}!</div>
          <StateChips states={summary.newlyMastered} tone="sparkle" nameOf={cfg.nameOf} />
        </div>
      )}
      {summary.missed.length > 0 && (
        <div className="max-w-3xl rounded-3xl bg-white/80 px-6 py-4">
          <div className="text-2xl font-bold text-slate-600">Let's practice these again soon:</div>
          <StateChips states={summary.missed} tone="practice" nameOf={cfg.nameOf} />
        </div>
      )}
      <Buttons onAgain={onAgain} onOtherRegion={onOther} onHome={onHome} otherLabel={`🗺️ Other ${words}`} />
    </main>
  );
}
