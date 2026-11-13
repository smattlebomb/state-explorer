import { useState } from 'react';
import type { UpdateData } from '../App';
import { withReset, type SavedData } from '../lib/storage';
import { masteryOf, type Mastery } from '../lib/srs';
import { displayStreak, toDayKey } from '../lib/streak';
import { getRegion } from '../data/regions';
import { REGION_IDS, regionProgress } from '../lib/regionProgress';
import { ALL_ABBRS, stateName } from '../data/states';
import { USMap } from '../components/USMap';
import { BigButton, TopBar } from '../components/ui';
import { LongPressButton } from '../components/LongPressButton';
import { speak } from '../lib/speech';

const MASTERY_STYLE: Record<Mastery, { fill: string; chip: string; label: string; emoji: string }> = {
  mastered: { fill: '#4ade80', chip: 'bg-green-400 text-green-950', label: 'Mastered', emoji: '🏆' },
  learning: { fill: '#facc15', chip: 'bg-yellow-300 text-yellow-950', label: 'Learning', emoji: '🌱' },
  new: { fill: '#f1f5f9', chip: 'bg-slate-100 text-slate-600', label: 'New', emoji: '✨' },
};

export function ProgressScreen({ data, update, onHome }: { data: SavedData; update: UpdateData; onHome: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const today = toDayKey(new Date());
  const mastery = (s: string) => masteryOf(data.records[s]);
  const counts = { mastered: 0, learning: 0, new: 0 };
  for (const s of ALL_ABBRS) counts[mastery(s)]++;

  const tap = (s: string) => {
    setSelected(s);
    speak(stateName(s));
  };

  return (
    <main className="flex h-full flex-col overflow-y-auto">
      <TopBar onHome={onHome}>
        <h1 className="text-3xl font-black text-slate-800 sm:text-4xl">📊 My Map</h1>
      </TopBar>

      <div className="flex flex-wrap justify-center gap-3 px-3 text-2xl font-extrabold">
        {(['mastered', 'learning', 'new'] as const).map((m) => (
          <span key={m} className={`rounded-full px-5 py-2 ${MASTERY_STYLE[m].chip}`}>
            {MASTERY_STYLE[m].emoji} {MASTERY_STYLE[m].label}: {counts[m]}
          </span>
        ))}
      </div>

      <div className="h-[55vh] shrink-0 px-2 py-2">
        <USMap fillFor={(s) => MASTERY_STYLE[mastery(s)].fill} onTap={tap} labels={selected ? [selected] : []} />
      </div>

      <p className="px-4 text-center text-xl font-bold text-slate-600">
        🏆 Mastered = right 3 times in a row · 🔥 Streak: {displayStreak(data.streak, today)} (best {data.streak.best}) · ⭐ {data.totalStars} stars · 🎮 {data.roundsPlayed} rounds
      </p>

      <div className="grid gap-4 p-4 landscape:grid-cols-2">
        {REGION_IDS.map((id) => ({ r: getRegion(id), p: regionProgress(id, data.records) })).map(({ r, p }) => (
          <section key={r.id} className="rounded-3xl bg-white/80 p-4">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="text-2xl font-black text-slate-700">
                {r.emoji} {r.label}
              </h2>
              <span className="text-xl font-extrabold text-slate-600">
                🏆 {p.mastered} / {p.total}
              </span>
            </div>
            {/* Stacked bar: mastered (green) then learning (yellow), out of all states in the region */}
            <div
              className="mb-3 flex h-5 w-full overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-label={`${r.label}: ${p.mastered} of ${p.total} mastered`}
              aria-valuemin={0}
              aria-valuemax={p.total}
              aria-valuenow={p.mastered}
            >
              <div className="h-full bg-green-500 transition-all" style={{ width: `${(p.mastered / p.total) * 100}%` }} />
              <div className="h-full bg-yellow-400 transition-all" style={{ width: `${(p.learning / p.total) * 100}%` }} />
            </div>
            <div className="flex flex-wrap gap-2">
              {[...r.states]
                .sort((a, b) => stateName(a).localeCompare(stateName(b)))
                .map((s) => (
                  <button key={s} type="button" onClick={() => tap(s)} className={`min-h-12 rounded-2xl px-3 text-xl font-bold ${MASTERY_STYLE[mastery(s)].chip}`}>
                    {stateName(s)}
                  </button>
                ))}
            </div>
          </section>
        ))}
      </div>

      <div className="flex justify-center px-4 pt-4 pb-10">
        <LongPressButton onLongPress={() => setConfirming(true)} className="min-h-16 rounded-3xl bg-white/60 px-6 text-lg font-bold text-slate-500">
          Grown-ups: hold for 3 seconds to reset progress
        </LongPressButton>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6">
          <div className="pop-in max-w-xl rounded-[2rem] bg-white p-8 text-center shadow-2xl">
            <div className="text-5xl">⚠️</div>
            <h2 className="mt-3 text-3xl font-black text-slate-800">Erase all progress?</h2>
            <p className="mt-2 text-2xl text-slate-600">Stars, streak, and mastered states will all be erased. This can't be undone.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <BigButton variant="success" onClick={() => setConfirming(false)}>
                Keep it!
              </BigButton>
              <BigButton
                variant="secondary"
                className="text-rose-600"
                onClick={() => {
                  update(withReset);
                  setSelected(null);
                  setConfirming(false);
                }}
              >
                Erase everything
              </BigButton>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
