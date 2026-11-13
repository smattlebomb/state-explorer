import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { SavedData } from '../lib/storage';
import { COMBO_SMALL, type QuizMode, type RoundSummary } from '../lib/quiz';
import { displayStreak, toDayKey } from '../lib/streak';
import { getRegion, type Region } from '../data/regions';
import { stateName } from '../data/states';
import { BigButton } from '../components/ui';
import { Mascot } from '../components/Mascot';
import { speak } from '../lib/speech';
import { soundFanfare } from '../lib/sound';
import { bigCelebration } from '../lib/celebrate';

const HEADLINES = { 3: 'Amazing!', 2: 'Great job!', 1: 'Nice try!' } as const;
const HEADLINE_EMOJI = { 3: '🎉', 2: '🙌', 1: '💪' } as const;

interface Props {
  mode: QuizMode;
  regionId: Region['id'];
  summary: RoundSummary;
  data: SavedData;
  onHome: () => void;
  onAgain: () => void;
  onOtherRegion: () => void;
}

/** Stars drop in one at a time (~0.3s apart); earned ones spin in, the rest fade in grey. */
function FlyingStars({ count }: { count: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex justify-center gap-3 text-8xl" aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((i) => {
        const earned = i < count;
        return (
          <motion.span
            key={i}
            className={earned ? '' : 'opacity-25 grayscale'}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -160, scale: 0.2, rotate: -200 }}
            animate={{ opacity: earned ? 1 : 0.25, y: 0, scale: 1, rotate: 0 }}
            transition={{ delay: 0.15 + i * 0.3, duration: 0.45, type: 'spring', stiffness: 260, damping: 14 }}
          >
            ⭐
          </motion.span>
        );
      })}
    </div>
  );
}

function Buttons({ onAgain, onOtherRegion, onHome }: Pick<Props, 'onAgain' | 'onOtherRegion' | 'onHome'>) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-4">
      <BigButton variant="success" className="min-h-20 min-w-64 text-4xl" onClick={onAgain}>
        Play again ➜
      </BigButton>
      <BigButton variant="secondary" onClick={onOtherRegion}>
        🗺️ Other states
      </BigButton>
      <BigButton variant="secondary" onClick={onHome}>
        🏠 Home
      </BigButton>
    </div>
  );
}

function StateChips({ states, tone }: { states: string[]; tone: 'sparkle' | 'practice' }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      {states.map((s, i) => (
        <motion.button
          key={s}
          type="button"
          onClick={() => speak(stateName(s))}
          className={`min-h-14 rounded-2xl px-4 text-2xl font-extrabold ${tone === 'sparkle' ? 'bg-green-100 text-green-800 ring-2 ring-yellow-300' : 'bg-amber-100 text-amber-800'}`}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={tone === 'sparkle' ? { opacity: 1, scale: [0.6, 1.15, 1] } : { opacity: 1, scale: 1 }}
          transition={{ delay: 1.1 + i * 0.12, duration: 0.4 }}
        >
          {tone === 'sparkle' && '✨ '}
          {stateName(s)}
          {tone === 'sparkle' && ' ✨'}
        </motion.button>
      ))}
    </div>
  );
}

export function ResultsScreen({ mode, regionId, summary, data, onHome, onAgain, onOtherRegion }: Props) {
  const region = getRegion(regionId);
  const streak = displayStreak(data.streak, toDayKey(new Date()));
  const practice = summary.practice;

  useEffect(() => {
    soundFanfare();
    if (practice) {
      speak('Practice finished! Great work!');
      return;
    }
    if (summary.stars === 3) setTimeout(bigCelebration, 900);
    const mastered = summary.newlyMastered.length;
    speak(
      `${HEADLINES[summary.stars]} You earned ${summary.stars} star${summary.stars === 1 ? '' : 's'}!` +
        (mastered > 0 ? ` And you mastered ${mastered === 1 ? stateName(summary.newlyMastered[0]) : `${mastered} new states`}!` : ''),
    );
  }, [practice, summary]);

  const header = (
    <div className="text-xl font-bold text-slate-500">
      {mode === 'find' ? '👆 Find It' : '🔤 Name It'} · {practice ? '🎈 Practice' : '🏆 Quiz'} · {region.emoji} {region.label}
    </div>
  );

  if (practice) {
    // No score, no stars, no grade, just a friendly wrap-up.
    return (
      <main className="flex h-full flex-col items-center justify-center gap-5 overflow-y-auto p-6 text-center">
        {header}
        <Mascot mood="celebrate" size={130} />
        <h1 className="text-6xl font-black text-sky-700">Practice done! 🎈</h1>
        <p className="text-3xl font-extrabold text-slate-700">You practiced {summary.total} states. Way to go!</p>
        {summary.missed.length > 0 && (
          <div className="max-w-3xl rounded-3xl bg-white/80 px-6 py-4">
            <div className="text-2xl font-bold text-slate-600">These are tricky. We'll see them again soon:</div>
            <StateChips states={summary.missed} tone="practice" />
          </div>
        )}
        <Buttons onAgain={onAgain} onOtherRegion={onOtherRegion} onHome={onHome} />
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
      {summary.usedHints && (
        <p className="rounded-2xl bg-amber-100 px-5 py-2 text-2xl font-bold text-amber-800">💡 You used hints this time. Try without hints to earn 3 stars!</p>
      )}

      {summary.newlyMastered.length > 0 && (
        <div className="max-w-3xl rounded-3xl bg-white/80 px-6 py-4">
          <div className="text-2xl font-black text-green-700">🏆 New mastered states!</div>
          <StateChips states={summary.newlyMastered} tone="sparkle" />
        </div>
      )}

      {summary.missed.length > 0 && (
        <div className="max-w-3xl rounded-3xl bg-white/80 px-6 py-4">
          <div className="text-2xl font-bold text-slate-600">Let's practice these again soon:</div>
          <StateChips states={summary.missed} tone="practice" />
        </div>
      )}

      <Buttons onAgain={onAgain} onOtherRegion={onOtherRegion} onHome={onHome} />
    </main>
  );
}
