import { useEffect } from 'react';
import type { RoundSummary } from '../lib/mathRound';
import { bestQuizKey, type MathData } from '../lib/mathStorage';
import { parseFactId, product } from '../lib/mathFacts';
import { Mascot } from '../components/Mascot';
import { BigButton } from '../components/ui';
import { speak } from '../lib/speech';
import { soundFanfare } from '../lib/sound';

interface Props {
  summary: RoundSummary;
  /** This quiz beat the previous best. */
  newBest?: boolean;
  math: MathData;
  /** Practice just these facts (the ones missed). */
  onRetryMissed: (ids: string[]) => void;
  /** A new practice round with the same tables. */
  onPracticeTables: () => void;
  onFacts: () => void;
  onHome: () => void;
}

/** A warm word for any score. Even a low score is effort worth praising. */
export function quizMessage(correct: number, total: number): string {
  if (total === 0) return 'Nice work!';
  const pct = correct / total;
  if (pct === 1) return 'Every single one! Amazing! 🌟';
  if (pct >= 0.8) return 'Awesome work! You really know these. 🎉';
  if (pct >= 0.5) return 'Great effort! A little more practice and these will be easy.';
  return 'Great effort! These ones are good to practice. Every try helps your brain grow. 🌱';
}

function FactChip({ id }: { id: string }) {
  const f = parseFactId(id);
  return (
    <li className="rounded-2xl bg-amber-100 px-4 py-2 text-2xl font-black text-amber-900">
      {f.a} × {f.b} = {product(f)}
    </li>
  );
}

/** The calm end of a practice round, or the quiz score. */
export function MathResultsScreen({ summary, newBest = false, math, onRetryMissed, onPracticeTables, onFacts, onHome }: Props) {
  const quiz = summary.kind === 'quiz';
  const best = quiz ? math.bestQuizzes[bestQuizKey(math.quizLength, math.quizAnswerMode)] : null;
  const isBest = quiz && newBest;
  const message = quiz ? quizMessage(summary.correct, summary.total) : summary.missed.length === 0 ? 'You knew every one! 🌟' : 'Great practicing! 🌱';

  useEffect(() => {
    soundFanfare();
    speak(quiz ? `You got ${summary.correct} out of ${summary.total}. ${message.replace(/[^\w\s.!,']/g, '')}` : 'Practice finished! Great work!');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex h-full flex-col items-center gap-4 overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] text-center">
      <div className="text-xl font-bold text-slate-500">{quiz ? '🏆 Multiplication Quiz' : '✖️ Multiplication Flashcards'}</div>
      <Mascot mood="celebrate" size={110} />
      {quiz ? (
        <h1 className="text-7xl font-black text-sky-700" aria-label={`${summary.correct} out of ${summary.total}`}>
          {summary.correct}/{summary.total}
        </h1>
      ) : (
        <h1 className="text-5xl font-black text-sky-700">You practiced {summary.total} facts!</h1>
      )}
      <p className="max-w-2xl text-3xl font-extrabold text-slate-700">{message}</p>
      {quiz && isBest && <p className="text-2xl font-extrabold text-green-700">🎉 New best score!</p>}
      {quiz && best && !isBest && (
        <p className="text-xl font-bold text-slate-500">
          Best: {best.correct}/{best.total}
        </p>
      )}

      {summary.missed.length > 0 && (
        <section className="w-full max-w-3xl rounded-3xl bg-white/80 px-5 py-4" aria-label="Facts to practice">
          <h2 className="text-2xl font-black text-slate-700">{quiz ? 'Good ones to practice' : 'Keep practicing these'}</h2>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {summary.missed.map((id) => (
              <FactChip key={id} id={id} />
            ))}
          </ul>
        </section>
      )}

      <div className="mt-2 flex w-full max-w-3xl flex-wrap justify-center gap-4">
        {summary.missed.length > 0 && (
          <BigButton variant="success" className="min-h-20 text-3xl" onClick={() => onRetryMissed(summary.missed)}>
            🔁 Retry missed
          </BigButton>
        )}
        <BigButton variant="primary" onClick={onPracticeTables}>
          ✖️ Practice these tables
        </BigButton>
        <BigButton variant="secondary" onClick={onFacts}>
          🟩 My Facts
        </BigButton>
        <BigButton variant="secondary" onClick={onHome}>
          🏠 Home
        </BigButton>
      </div>
    </main>
  );
}
