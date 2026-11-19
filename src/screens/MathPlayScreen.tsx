import { useEffect, useMemo, useRef, useState } from 'react';
import type { MathData } from '../lib/mathStorage';
import { answerChoices, isCorrect, parseAnswer, parseFactId, product, spokenFact } from '../lib/mathFacts';
import { recordFact } from '../lib/mathMastery';
import { answerCard, createMathRound, currentCard, isFirstAnswer, nextCard, roundProgress, summarizeRound, type RoundKind, type RoundSummary } from '../lib/mathRound';
import { NumberPad } from '../components/math/NumberPad';
import { ArrayHint } from '../components/math/ArrayHint';
import { Mascot, type MascotMood } from '../components/Mascot';
import { BigButton, TopBar } from '../components/ui';
import { speak } from '../lib/speech';
import { soundCorrect, soundHint } from '../lib/sound';

/** After a right answer the next card comes on its own after this long. */
const NEXT_DELAY_MS = 1100;
/** The optional relaxed timer: a soft cue, never a fail-by-default buzzer. */
export const RELAXED_TIMER_SECONDS = 25;

const PRAISE = ['Nice!', 'You got it!', 'Great job!', 'Yes!', 'Super!', 'Well done!'];
const pickOne = <T,>(l: readonly T[]) => l[Math.floor(Math.random() * l.length)];

export interface MathPlayProps {
  kind: RoundKind;
  ids: string[];
  math: MathData;
  updateMath: (fn: (m: MathData) => MathData) => void;
  onHome: () => void;
  onFinish: (summary: RoundSummary, ids: string[]) => void;
}

/**
 * Multiplication flashcards (practice) and the quiz. Calm by design: no
 * timer unless she turns one on, gentle words on a miss, the answer and a
 * dot picture to learn from, and missed facts come back once at the end.
 */
export function MathPlayScreen({ kind, ids, math, updateMath, onHome, onFinish }: MathPlayProps) {
  const quiz = kind === 'quiz';
  const style: 'flip' | 'keypad' | 'choices' = quiz ? math.quizAnswerMode : math.practiceMode;
  const [round, setRound] = useState(() => createMathRound(kind, ids));
  const [typed, setTyped] = useState('');
  const [flipped, setFlipped] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mood, setMood] = useState<{ mood: MascotMood; key: number }>({ mood: 'idle', key: 0 });
  const [secondsLeft, setSecondsLeft] = useState(RELAXED_TIMER_SECONDS);
  const finished = useRef(false);

  const id = currentCard(round);
  const fact = id ? parseFactId(id) : null;
  const answer = fact ? product(fact) : 0;
  const prog = roundProgress(round);
  const timed = quiz && math.relaxedTimer && round.phase === 'main';
  const choices = useMemo(() => (fact && style === 'choices' ? answerChoices(fact) : []), [id, round.phase, round.index, style]); // eslint-disable-line react-hooks/exhaustive-deps

  // New card: clear the slate and (only if read-aloud is on) say the fact.
  useEffect(() => {
    if (!fact) return;
    setTyped('');
    setFlipped(false);
    setMessage(null);
    setSecondsLeft(RELAXED_TIMER_SECONDS);
    speak(spokenFact(fact));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.phase, round.index]);

  // Right answer → next card by itself.
  useEffect(() => {
    if (round.status !== 'right') return;
    const t = setTimeout(() => setRound((r) => nextCard(r)), NEXT_DELAY_MS);
    return () => clearTimeout(t);
  }, [round.status, round.index, round.phase]);

  // All done → end card / results.
  useEffect(() => {
    if (round.phase !== 'done' || finished.current) return;
    finished.current = true;
    onFinish(summarizeRound(round), ids);
  }, [round, ids, onFinish]);

  const resolve = (correct: boolean, given: number | null, missText?: string) => {
    if (!id || !fact || round.status !== 'asking') return;
    if (isFirstAnswer(round)) {
      const now = Date.now();
      updateMath((m) => ({ ...m, facts: recordFact(m.facts, id, correct, now) }));
    }
    setRound((r) => answerCard(r, correct, given));
    setMood((m) => ({ mood: correct ? 'happy' : 'oops', key: m.key + 1 }));
    if (correct) {
      soundCorrect();
      const p = pickOne(PRAISE);
      setMessage(`🎉 ${p}`);
      speak(p);
    } else {
      soundHint();
      setMessage(missText ?? `Not quite. ${fact.a} × ${fact.b} = ${answer}. Let's look!`);
      speak(`${spokenFact(fact)} is ${answer}.`);
    }
  };

  // The optional relaxed timer: counts down gently; running out is just "not yet".
  useEffect(() => {
    if (!timed || round.status !== 'asking') return;
    if (secondsLeft <= 0) {
      resolve(false, null, `Time's up, and that's okay! ${fact?.a} × ${fact?.b} = ${answer}.`);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timed, secondsLeft, round.status]);

  const checkTyped = () => {
    if (!fact) return;
    const n = parseAnswer(typed);
    if (n === null) {
      setMessage('Type your answer, then tap Check.');
      return;
    }
    resolve(isCorrect(fact, n), n, n === answer ? undefined : `Not quite: you typed ${n}. ${fact.a} × ${fact.b} = ${answer}. Let's look!`);
  };

  if (!fact) return <main className="h-full" />;
  const missed = round.status === 'missed';
  const right = round.status === 'right';
  const showAnswer = right || missed || flipped;

  return (
    <main className="flex h-full flex-col overflow-y-auto pb-[env(safe-area-inset-bottom)]">
      <TopBar
        onHome={onHome}
        right={
          <span className="whitespace-nowrap rounded-full bg-white/80 px-4 py-2 text-xl font-extrabold text-slate-600" aria-live="polite">
            {prog.retry ? `One more try · ${prog.number} of ${prog.total}` : `${prog.number} of ${prog.total}`}
          </span>
        }
      >
        <div className="flex items-center justify-center gap-2">
          <Mascot key={mood.key} mood={mood.mood} size={56} />
          <span className="text-2xl font-black text-slate-700">{quiz ? '🏆 Quiz' : '✖️ Practice'}</span>
        </div>
      </TopBar>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-4 px-4 pb-6 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        {timed && round.status === 'asking' && (
          <div className="w-full max-w-md" aria-label={`${secondsLeft} seconds left`}>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-sky-300 transition-all duration-1000" style={{ width: `${(secondsLeft / RELAXED_TIMER_SECONDS) * 100}%` }} />
            </div>
          </div>
        )}

        {/* The card. In flip mode the whole card is the button that turns it over. */}
        <button
          type="button"
          aria-label={style === 'flip' && !flipped && !showAnswer ? `${fact.a} times ${fact.b}. Tap to see the answer` : `${fact.a} times ${fact.b}`}
          disabled={style !== 'flip' || flipped || round.status !== 'asking'}
          onClick={() => setFlipped(true)}
          className={`flex min-h-48 w-full max-w-xl flex-col items-center justify-center rounded-[2rem] px-6 py-6 text-center shadow-[0_8px_0_#94a3b8] transition ${
            right ? 'bg-green-100' : missed ? 'bg-amber-50' : 'bg-white'
          } ${style === 'flip' && !flipped ? 'active:translate-y-1' : ''}`}
        >
          <span className="text-7xl font-black tracking-tight text-slate-900 sm:text-8xl" data-testid="math-fact">
            {fact.a} × {fact.b}
          </span>
          {showAnswer ? (
            <span key="ans" className="pop-in mt-2 text-6xl font-black text-sky-700 sm:text-7xl" data-testid="math-answer">
              = {answer}
            </span>
          ) : style === 'flip' ? (
            <span className="mt-3 text-2xl font-bold text-slate-500">Think of the answer, then tap the card 👆</span>
          ) : style === 'keypad' ? (
            <span className="mt-2 min-h-16 min-w-32 rounded-2xl border-4 border-dashed border-slate-300 px-4 text-6xl font-black text-violet-700" aria-label="Your answer">
              = {typed || ' '}
            </span>
          ) : null}
        </button>

        {message && (
          <p className={`text-center text-2xl font-black ${right ? 'text-green-700' : 'text-slate-700'}`} role="status">
            {message}
          </p>
        )}

        {missed && <ArrayHint a={fact.a} b={fact.b} className="w-full max-w-xl" />}

        {round.status === 'asking' && style === 'keypad' && <NumberPad value={typed} onChange={setTyped} onSubmit={checkTyped} />}

        {round.status === 'asking' && style === 'choices' && (
          <div className="grid w-full max-w-xl grid-cols-2 gap-3" role="group" aria-label="Answer choices">
            {choices.map((n) => (
              <button
                key={`${round.phase}-${round.index}-${n}`}
                type="button"
                aria-label={`Answer ${n}`}
                onClick={() => resolve(n === answer, n, n === answer ? undefined : `Not quite: ${n} isn't it. ${fact.a} × ${fact.b} = ${answer}. Let's look!`)}
                className="min-h-20 min-w-0 rounded-3xl bg-white text-5xl font-black text-slate-800 shadow-[0_6px_0_#94a3b8] transition active:translate-y-1 active:shadow-none"
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {round.status === 'asking' && style === 'flip' && flipped && (
          <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
            <BigButton variant="success" className="min-h-20 flex-1 text-3xl" onClick={() => resolve(true, null)}>
              👍 I got it
            </BigButton>
            <BigButton variant="secondary" className="min-h-20 flex-1 text-3xl" onClick={() => resolve(false, null, `That's okay! ${fact.a} × ${fact.b} = ${answer}. Let's look!`)}>
              🌱 Not yet
            </BigButton>
          </div>
        )}

        {missed && (
          <BigButton variant="primary" className="min-h-20 min-w-56 text-3xl" onClick={() => setRound((r) => nextCard(r))}>
            Next ➜
          </BigButton>
        )}
        {missed && round.phase === 'main' && <p className="text-lg font-bold text-slate-500">We'll see this one again at the end.</p>}
      </div>
    </main>
  );
}
