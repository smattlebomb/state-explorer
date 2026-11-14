import { useMemo, useState } from 'react';
import { masteryOf, type Mastery } from '../lib/srs';
import { displayStreak, toDayKey } from '../lib/streak';
import { layerWithReset, type AnyLayer, type GameKind, type LayerProgress } from '../lib/layerProgress';
import { layerConfig } from '../lib/layers';
import { LayerMap, useLayerGeo } from '../components/LayerMap';
import { MapLoading } from '../components/MapLoading';
import { LongPressButton } from '../components/LongPressButton';
import { BigButton, TopBar } from '../components/ui';
import { speak } from '../lib/speech';

const MASTERY_STYLE: Record<Mastery, { fill: string; chip: string; label: string; emoji: string }> = {
  mastered: { fill: '#4ade80', chip: 'bg-green-400 text-green-950', label: 'Mastered', emoji: '🏆' },
  learning: { fill: '#facc15', chip: 'bg-yellow-300 text-yellow-950', label: 'Learning', emoji: '🌱' },
  new: { fill: '#f1f5f9', chip: 'bg-slate-100 text-slate-600', label: 'New', emoji: '✨' },
};

interface Props {
  layer: AnyLayer;
  game?: GameKind;
  progress: LayerProgress;
  updateProgress: (fn: (p: LayerProgress) => LayerProgress) => void;
  onHome: () => void;
}

/** "My Map" for the World or Canada layer: only that layer's progress (the US has its own). */
export function LayerProgressScreen({ layer, game = 'places', progress, updateProgress, onHome }: Props) {
  const capitals = game === 'capitals';
  const cfg = layerConfig(layer);
  const { lg } = useLayerGeo(layer);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const mastery = (id: string) => masteryOf(progress.records[id]);
  const counts = { mastered: 0, learning: 0, new: 0 };
  for (const id of cfg.allIds) counts[mastery(id)]++;

  const fill = useMemo(() => {
    const quiz = new Set(cfg.allIds);
    return (id: string) => (quiz.has(id) ? MASTERY_STYLE[masteryOf(progress.records[id])].fill : '#e2e8f0');
  }, [cfg, progress.records]);

  const label = (id: string) => (capitals ? `${cfg.nameOf(id)} · ${cfg.capitalOf(id)}` : cfg.nameOf(id));
  const tap = (id: string) => {
    setSelected(id);
    speak(capitals ? `The capital of ${cfg.nameOf(id)} is ${cfg.capitalOf(id)}.` : cfg.nameOf(id));
  };
  const what = capitals ? `${cfg.title} capitals` : cfg.title;

  // World: one section per continent. USA: per region. Canada: one section for all 13.
  const grouped = cfg.scopes.filter((s) => s.id.startsWith('c:') || s.id.startsWith('r:'));
  const groups = grouped.length > 0 ? grouped : cfg.scopes;
  const bests = Object.entries(progress.bestTests);

  return (
    <main className="flex h-full flex-col overflow-y-auto">
      <TopBar onHome={onHome}>
        <h1 className="text-3xl font-black text-slate-800 sm:text-4xl">
          📊 {capitals ? 'My Capitals' : 'My Map'} · {cfg.emoji} {cfg.title}
        </h1>
      </TopBar>

      <div className="flex flex-wrap justify-center gap-3 px-3 text-2xl font-extrabold">
        {(['mastered', 'learning', 'new'] as const).map((m) => (
          <span key={m} className={`rounded-full px-5 py-2 ${MASTERY_STYLE[m].chip}`}>
            {MASTERY_STYLE[m].emoji} {MASTERY_STYLE[m].label}: {counts[m]}
          </span>
        ))}
      </div>

      <div className="h-[50vh] shrink-0 px-2 py-2">
        {lg ? <LayerMap lg={lg} scopeId="all" regionColors={false} selected={selected} fillOverride={(id) => (id === selected ? undefined : fill(id))} onTap={tap} /> : <MapLoading />}
      </div>

      <p className="px-4 text-center text-xl font-bold text-slate-600">
        🏆 Mastered = right 3 times in a row · 🔥 Streak: {displayStreak(progress.streak, toDayKey(new Date()))} (best {progress.streak.best}) · ⭐ {progress.totalStars} stars · 🎮{' '}
        {progress.roundsPlayed} rounds · 🔍 explored {progress.explored.length}
      </p>
      <p className="px-4 text-center text-xl font-extrabold text-rose-700">
        📝 Test best
        {bests.length === 0
          ? ' · not taken yet'
          : bests.map(([key, b]) => {
              const [scopeId, mode] = key.split('|');
              const scope = cfg.scopes.find((s) => s.id === scopeId);
              return ` · ${mode === 'find' ? '👆' : '🔤'} ${scope?.label ?? scopeId} ${b.correct}/${b.total}`;
            })}
      </p>

      <div className="grid gap-4 p-4 landscape:grid-cols-2">
        {groups.map((g) => {
          const m = g.ids.filter((id) => mastery(id) === 'mastered').length;
          const l = g.ids.filter((id) => mastery(id) === 'learning').length;
          return (
            <section key={g.id} className="rounded-3xl bg-white/80 p-4">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2 className="text-2xl font-black text-slate-700">
                  {g.emoji} {g.label}
                </h2>
                <span className="text-xl font-extrabold text-slate-600">
                  🏆 {m} / {g.ids.length}
                </span>
              </div>
              <div className="mb-3 flex h-5 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={`${g.label}: ${m} of ${g.ids.length} mastered`} aria-valuemin={0} aria-valuemax={g.ids.length} aria-valuenow={m}>
                <div className="h-full bg-green-500" style={{ width: `${(m / g.ids.length) * 100}%` }} />
                <div className="h-full bg-yellow-400" style={{ width: `${(l / g.ids.length) * 100}%` }} />
              </div>
              <div className="flex flex-wrap gap-2">
                {[...g.ids]
                  .sort((a, b) => cfg.nameOf(a).localeCompare(cfg.nameOf(b)))
                  .map((id) => (
                    <button key={id} type="button" onClick={() => tap(id)} className={`min-h-12 rounded-2xl px-3 text-xl font-bold ${MASTERY_STYLE[mastery(id)].chip}`}>
                      {label(id)}
                    </button>
                  ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex justify-center px-4 pt-4 pb-10">
        <LongPressButton onLongPress={() => setConfirming(true)} className="min-h-16 rounded-3xl bg-white/60 px-6 text-lg font-bold text-slate-500">
          Grown-ups: hold for 3 seconds to reset {what} progress
        </LongPressButton>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6">
          <div className="pop-in max-w-xl rounded-[2rem] bg-white p-8 text-center shadow-2xl">
            <div className="text-5xl">⚠️</div>
            <h2 className="mt-3 text-3xl font-black text-slate-800">Erase {what} progress?</h2>
            <p className="mt-2 text-2xl text-slate-600">
              {what} stars, streak, mastered {capitals ? 'capitals' : cfg.itemsWord} and test scores will be erased.{' '}
              {capitals ? 'Finding places on the map is not touched.' : 'Capitals and the other maps keep theirs.'} This can't be undone.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <BigButton variant="success" onClick={() => setConfirming(false)}>
                Keep it!
              </BigButton>
              <BigButton
                variant="secondary"
                className="text-rose-600"
                onClick={() => {
                  updateProgress(layerWithReset);
                  setSelected(null);
                  setConfirming(false);
                }}
              >
                Erase {what}
              </BigButton>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
