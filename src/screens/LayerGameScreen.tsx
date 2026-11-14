import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Settings } from '../lib/storage';
import {
  answer,
  canTakeHint,
  COMBO_BIG,
  COMBO_SMALL,
  createRound,
  currentQuestion,
  MAX_HINTS,
  nextQuestion,
  progressLabel,
  reveal,
  summarize,
  takeHint,
  type QuizMode,
  type Round,
  type RoundSummary,
} from '../lib/quiz';
import { toDayKey } from '../lib/streak';
import {
  layerWithAnswer,
  layerWithPracticeAnswer,
  layerWithRoundFinished,
  layerWithTestScore,
  type GameLayer,
  type LayerProgress,
} from '../lib/layerProgress';
import { layerConfig, scopeOf } from '../lib/layers';
import { COUNTRIES, COUNTRY_BY_ID, continentOf } from '../data/world';
import { LayerMap, OutlineCard, useLayerGeo } from '../components/LayerMap';
import { MapLoading } from '../components/MapLoading';
import { Mascot, type MascotMood } from '../components/Mascot';
import { BigButton, IconButton, TopBar } from '../components/ui';
import { speak } from '../lib/speech';
import { soundCombo, soundCorrect, soundHint, soundWrong } from '../lib/sound';
import { bigCelebration, burstAt } from '../lib/celebrate';

const CORRECT_DELAY_MS = 1300;
const CHEERS = ['Nice!', 'Awesome!', 'You got it!', 'Great job!', 'Super!', 'Way to go!', 'Wow!', 'Yes!'];
const OOPS = ['Oops!', 'Almost!', 'Not quite!', 'So close!'];
const GREEN = '#22c55e';
const RED = '#f87171';
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

export interface LayerGameProps {
  layer: GameLayer;
  mode: QuizMode;
  scopeId: string;
  practice: boolean;
  test?: boolean;
  /** Shared settings (read-only here). */
  settings: Settings;
  progress: LayerProgress;
  updateProgress: (fn: (p: LayerProgress) => LayerProgress) => void;
  onHome: () => void;
  onFinish: (s: RoundSummary) => void;
}

/**
 * Where Name It finds extra wrong choices when a scope is tiny (Australia and
 * New Zealand is 2 countries): the rest of the same continent first, so the
 * choices stay plausible.
 */
function distractorsFor(layer: GameLayer, scopeIds: readonly string[], allIds: readonly string[]): readonly string[] {
  if (layer !== 'world' || scopeIds.length >= 4) return allIds;
  const first = COUNTRY_BY_ID.get(scopeIds[0]);
  return first ? COUNTRIES.filter((c) => continentOf(c) === continentOf(first)).map((c) => c.id) : allIds;
}

/** Find It / Name It (Quiz, Practice or Test) on the World or Canada map. Same rules as the US game. */
export function LayerGameScreen({ layer, mode, scopeId, practice, test = false, settings, progress, updateProgress, onHome, onFinish }: LayerGameProps) {
  const cfg = layerConfig(layer);
  const scope = scopeOf(cfg, scopeId);
  const { lg, failed } = useLayerGeo(layer);
  const { regionColors, keepNames: keepNamesSetting, narration } = settings;
  const keepNames = keepNamesSetting && !test;
  const recordsAtStart = useRef(progress.records);
  const [round, setRound] = useState<Round>(() =>
    createRound({
      mode,
      pool: scope.ids,
      records: progress.records,
      now: Date.now(),
      practice: test ? false : practice,
      test,
      distractors: distractorsFor(layer, scope.ids, cfg.allIds),
    }),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [mood, setMood] = useState<{ mood: MascotMood; key: number }>({ mood: 'idle', key: 0 });
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const [named, setNamed] = useState<string[]>([]);
  const [quitOpen, setQuitOpen] = useState(false);
  const mapWrap = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);

  const q = currentQuestion(round);
  const target = q?.state ?? '';
  const targetName = cfg.nameOf(target);
  const prog = progressLabel(round);
  const itemWord = cfg.itemWord;
  const promptText = mode === 'find' ? `Tap ${targetName}!` : `Which ${itemWord} is this?`;

  const spokenPrompt = (r: Round) => {
    const cq = currentQuestion(r);
    if (!cq) return '';
    const lead = cq.retry ? "Let's try one more time. " : '';
    if (mode === 'find') return `${lead}Find ${cfg.nameOf(cq.state)}!`;
    const opts = cq.options.map(cfg.nameOf);
    return `${lead}Which ${itemWord} is this? ${opts.slice(0, -1).join(', ')}, or ${opts[opts.length - 1]}?`;
  };

  const react = (m: MascotMood) => setMood((prev) => ({ mood: m, key: prev.key + 1 }));

  useEffect(() => {
    if (!round.finished) speak(spokenPrompt(round));
    setMessage(null);
    setWrongFlash(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.index, round.finished]);

  useEffect(() => {
    if (mood.mood === 'idle') return;
    const t = setTimeout(() => setMood((m) => ({ mood: 'idle', key: m.key })), 1200);
    return () => clearTimeout(t);
  }, [mood]);

  // Correct → move on by itself. In a test, every answer moves on (the first pick is final).
  useEffect(() => {
    if (round.status !== 'correct' && !(test && round.status === 'revealed')) return;
    const t = setTimeout(() => setRound((r) => nextQuestion(r)), test ? 700 : CORRECT_DELAY_MS);
    return () => clearTimeout(t);
  }, [round.status, round.index, test]);

  const finish = (r: Round) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const summary = summarize(r, recordsAtStart.current, Date.now());
    if (test) {
      if (summary.completed) updateProgress((p) => layerWithTestScore(p, scope.id, scope.ids.length, mode, summary.firstTry, summary.total));
    } else if (!practice) {
      updateProgress((p) => layerWithRoundFinished(p, summary.stars, toDayKey(new Date())));
    }
    onFinish(summary);
  };

  useEffect(() => {
    if (round.finished) finish(round);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.finished]);

  const persist = (next: Round) => {
    if (test) return; // tests never change mastery, stars or streak
    const res = next.results[next.results.length - 1];
    if (!res) return;
    if (practice) updateProgress((p) => layerWithPracticeAnswer(p, res.state, res.firstTry, Date.now()));
    else updateProgress((p) => layerWithAnswer(p, res.state, res.mastery, Date.now()));
  };

  const celebrate = (next: Round) => {
    setNamed((list) => (list.includes(target) ? list : [...list, target]));
    soundCorrect();
    react('happy');
    const cheer = pick(CHEERS);
    const box = mapWrap.current?.getBoundingClientRect();
    if (box && box.width > 0) burstAt(box.left + box.width / 2, box.top + box.height / 2);
    setMessage(`🎉 ${cheer} That's ${targetName}!`);
    speak(`${cheer} That's ${targetName}!`);
    if (!practice) {
      if (next.combo === COMBO_SMALL) soundCombo();
      else if (next.combo >= COMBO_BIG && next.combo % COMBO_BIG === 0) {
        soundCombo();
        bigCelebration();
        speak(`${cheer} ${next.combo} in a row!`);
      }
    }
  };

  const handlePick = (choice: string) => {
    if (!q || round.status !== 'asking') return;
    const { round: next, outcome } = answer(round, choice);
    if (outcome === 'ignored') return;
    setRound(next);
    if ((outcome === 'correct' || outcome === 'revealed') && !q.retry) persist(next);
    if (test) {
      setMessage('Answer recorded');
      return;
    }
    if (outcome === 'correct') return celebrate(next);

    if (mode === 'find') setWrongFlash(choice);
    soundWrong();
    react('oops');
    const oops = pick(OOPS);
    if (outcome === 'wrong') {
      if (mode === 'find') {
        const hint = next.triesUsed === 2 ? ' Look inside the dashed circle!' : '';
        setMessage(`${oops} That's ${cfg.nameOf(choice)}. Try again!${hint}`);
        speak(`${oops} That's ${cfg.nameOf(choice)}. Try again!${hint}`);
      } else {
        setMessage(`${oops} Try another one!`);
        speak(`${oops} That one is ${cfg.nameOf(choice)}. Try another one!`);
      }
    } else {
      setMessage(mode === 'find' ? `Here's ${targetName}! 👀` : `This one is ${targetName}! 👀`);
      speak(`Good try! ${mode === 'find' ? 'Here is' : 'This one is'} ${targetName}.`);
    }
  };

  const handleShowMe = () => {
    if (round.status !== 'asking') return;
    const next = reveal(round);
    setRound(next);
    if (!q?.retry) persist(next);
    setMessage(`Here's ${targetName}! 👀`);
    speak(`Here is ${targetName}.`);
  };

  const hintFor = (level: number) =>
    level <= 1
      ? { display: `💡 Here's the shape of ${targetName}. Find it on the map!`, spoken: `Here is the shape of ${targetName}. Can you find it?` }
      : cfg.hintRegion(target);

  const handleHint = () => {
    if (!canTakeHint(round)) return;
    const next = takeHint(round);
    setRound(next);
    soundHint();
    const h = hintFor(next.hintsUsed);
    setMessage(h.display);
    speak(h.spoken);
  };

  const resolved = round.status !== 'asking';
  const showShape = mode === 'find' && !resolved && round.hintsUsed >= 1;
  const hintArea = mode === 'find' && round.hintsUsed >= 2 ? cfg.hintRegion(target).ids : null;
  const dim = useMemo(() => (hintArea ? new Set(cfg.allIds.filter((id) => !hintArea.has(id))) : undefined), [hintArea, cfg]);

  // Name It shows the target (orange) until answered; Find It shows it only when revealed. Tests never reveal.
  const selected = test ? (mode === 'name' && !resolved ? target : null) : mode === 'name' ? (round.status === 'correct' ? null : target) : round.status === 'revealed' ? target : null;
  const fillOverride = useMemo(() => {
    const correctId = !test && round.status === 'correct' ? target : null;
    return (id: string) => (id === correctId ? GREEN : id === wrongFlash ? RED : undefined);
  }, [test, round.status, target, wrongFlash]);
  const ring = !test && mode === 'find' && round.status === 'asking' && round.triesUsed >= 2 ? target : null;
  const lastWrong = round.wrongPicks[round.wrongPicks.length - 1];
  const labels = test ? [] : [...(keepNames ? named : []), ...(resolved ? [target] : []), ...(mode === 'find' && lastWrong && round.status === 'asking' ? [lastWrong] : [])];
  const showMe = practice && round.status === 'asking' && round.triesUsed >= 1;

  if (!q) return <main className="h-full" />;

  return (
    <main className="flex h-full flex-col">
      <TopBar
        onHome={test ? () => setQuitOpen(true) : onHome}
        right={
          <>
            <div className="hidden flex-col items-center gap-1 sm:flex">
              <span className="rounded-full bg-white/80 px-4 py-1 text-xl font-extrabold text-slate-600">{prog.retry ? '🔁' : `${prog.number} / ${prog.total}`}</span>
              {test ? (
                <span className="rounded-full bg-rose-100 px-3 text-base font-extrabold text-rose-700">📝 Test</span>
              ) : practice ? (
                <span className="rounded-full bg-sky-100 px-3 text-base font-extrabold text-sky-700">🎈 Practice</span>
              ) : (
                <ComboBadge combo={round.combo} />
              )}
            </div>
            {test && (
              <button type="button" onClick={() => setQuitOpen(true)} className="min-h-16 rounded-3xl bg-white px-4 text-xl font-extrabold text-slate-800 shadow-[0_4px_0_#94a3b8] transition active:translate-y-1">
                Stop
              </button>
            )}
            {mode === 'find' && !test && (
              <button
                type="button"
                onClick={handleHint}
                disabled={!canTakeHint(round)}
                aria-label={`Hint (${MAX_HINTS - round.hintsUsed} left)`}
                title="Hint"
                className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-amber-400 font-serif text-4xl font-black italic text-white shadow-[0_4px_0_#b45309] transition active:translate-y-1 active:shadow-[0_1px_0_#b45309] disabled:bg-slate-300 disabled:shadow-[0_4px_0_#94a3b8]"
              >
                i
                <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white font-sans text-base font-black not-italic text-amber-600 shadow">{MAX_HINTS - round.hintsUsed}</span>
              </button>
            )}
            {narration && (
              <IconButton label="Say it again" onClick={() => speak(spokenPrompt(round))}>
                🔊
              </IconButton>
            )}
          </>
        }
      >
        <div className="flex items-center gap-2">
          <Mascot key={mood.key} mood={mood.mood} size={68} />
          <div className="min-w-0 flex-1 text-center">
            <div className="text-lg font-bold text-slate-500">
              {test ? `📝 Test · ${scope.label} · ${prog.number} / ${prog.total}` : `${scope.emoji} ${scope.label}`} {prog.retry && '· one more try'}
              {mode === 'find' && !resolved && !practice && !test && ` · ${'❤️'.repeat(Math.max(0, round.maxTries - round.triesUsed))}`}
            </div>
            {test && resolved ? (
              <div className="text-3xl font-black leading-tight text-slate-800 sm:text-4xl">Answer recorded</div>
            ) : mode === 'find' ? (
              <>
                <div className={`text-3xl font-black leading-tight sm:text-4xl ${round.status === 'correct' ? 'text-green-600' : 'text-slate-900'}`}>{round.status === 'correct' ? message : promptText}</div>
                {round.status !== 'correct' && message && <div className="text-2xl font-extrabold leading-tight text-slate-700">{message}</div>}
              </>
            ) : (
              <div className={`text-3xl font-black leading-tight sm:text-4xl ${round.status === 'correct' ? 'text-green-600' : 'text-slate-900'}`}>{message ?? promptText}</div>
            )}
          </div>
        </div>
      </TopBar>

      <div ref={mapWrap} className="relative min-h-0 flex-1 px-2">
        {lg ? (
          <LayerMap
            lg={lg}
            scopeId={scope.id}
            regionColors={regionColors}
            selected={selected}
            onTap={mode === 'find' ? handlePick : undefined}
            fillOverride={fillOverride}
            labels={labels}
            ring={ring}
            dim={dim}
            // Name It highlights the answer: never print its name until she has answered.
            labelSelected={false}
          />
        ) : (
          <MapLoading text={failed ? "Oops, the map didn't load. Go back and try again!" : undefined} />
        )}
        {lg && showShape && <OutlineCard key={round.index} lg={lg} id={target} className="pointer-events-none absolute left-3 top-1" />}

        {!test && (round.status === 'revealed' || showMe) && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center">
            {round.status === 'revealed' ? (
              <BigButton variant="success" className="pop-in min-w-56 text-3xl" onClick={() => setRound((r) => nextQuestion(r))}>
                Next ➜
              </BigButton>
            ) : (
              <BigButton variant="secondary" className="pop-in" onClick={handleShowMe}>
                👀 Show me
              </BigButton>
            )}
          </div>
        )}
      </div>

      {mode === 'name' && (
        <div className="grid grid-cols-2 gap-3 p-3 landscape:grid-cols-4">
          {q.options.map((opt) => {
            const isAnswer = opt === target;
            const picked = round.wrongPicks.includes(opt);
            let cls = 'bg-white text-slate-900 shadow-[0_6px_0_#94a3b8]';
            if (!test && resolved && isAnswer) cls = 'bg-green-500 text-white shadow-[0_6px_0_#15803d] pop-in ring-4 ring-yellow-300';
            else if (!test && picked) cls = 'bg-rose-100 text-rose-400 shadow-[0_6px_0_#fda4af] shake';
            else if (resolved) cls = 'bg-white/60 text-slate-400 shadow-[0_6px_0_#cbd5e1]';
            return (
              <button
                key={`${round.index}-${opt}`}
                type="button"
                disabled={resolved || picked}
                onClick={() => handlePick(opt)}
                className={`min-h-20 rounded-3xl px-3 text-2xl font-extrabold leading-tight transition active:translate-y-1 sm:text-3xl ${cls}`}
              >
                {!test && opt === target && resolved ? '✅ ' : ''}
                {cfg.nameOf(opt)}
              </button>
            );
          })}
        </div>
      )}
      {mode === 'find' && <div className="h-2" />}
      <span className="sr-only" aria-live="polite">
        {message}
      </span>

      {quitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6">
          <div className="pop-in max-w-xl rounded-[2rem] bg-white p-8 text-center shadow-2xl">
            <div className="text-5xl">📝</div>
            <h2 className="mt-3 text-3xl font-black text-slate-800">Stop the test?</h2>
            <p className="mt-2 text-2xl text-slate-600">
              {round.results.length === 0 ? "You haven't answered any yet. You can start again any time." : `We'll score the ${round.results.length} you've already answered.`}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <BigButton variant="success" onClick={() => setQuitOpen(false)}>
                Keep going
              </BigButton>
              <BigButton
                variant="secondary"
                onClick={() => {
                  setQuitOpen(false);
                  if (round.results.length === 0) return onHome();
                  finish(round);
                }}
              >
                Stop and see my score
              </BigButton>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ComboBadge({ combo }: { combo: number }) {
  if (combo < 2) return <span className="h-7" />;
  const big = combo >= COMBO_BIG;
  const icon = big ? '🚀' : combo >= COMBO_SMALL ? '🔥' : '⚡';
  return (
    <motion.span
      key={combo}
      initial={{ scale: 0.4 }}
      animate={{ scale: [0.4, big ? 1.35 : 1.2, 1] }}
      transition={{ duration: 0.45 }}
      className={`rounded-full px-3 font-black text-white shadow ${big ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-xl' : combo >= COMBO_SMALL ? 'bg-orange-500 text-lg' : 'bg-sky-500 text-base'}`}
      aria-label={`${combo} in a row`}
    >
      {icon} x{combo}
    </motion.span>
  );
}
