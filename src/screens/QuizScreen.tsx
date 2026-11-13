import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { UpdateData } from '../App';
import { withAnswer, withPracticeAnswer, withRoundFinished, type SavedData } from '../lib/storage';
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
import { hintText } from '../lib/hints';
import { getRegion, REGION_TINT, type Region } from '../data/regions';
import { STATE_BY_ABBR, STATES, stateName } from '../data/states';
import { baseFill, USMap, type MapApi } from '../components/USMap';
import { ShapeCard } from '../components/ShapeCard';
import { Mascot, type MascotMood } from '../components/Mascot';
import { RegionLegend } from '../components/RegionLegend';
import { getMapGeometry } from '../lib/geo';
import { BigButton, IconButton, TopBar } from '../components/ui';
import { speak } from '../lib/speech';
import { soundCombo, soundCorrect, soundHint, soundWrong } from '../lib/sound';
import { bigCelebration, burstAt } from '../lib/celebrate';

/** After a correct answer, move on after this long (all animations finish within ~1.2s). */
const CORRECT_DELAY_MS = 1300;
const CHEERS = ['Nice!', 'Awesome!', 'You got it!', 'Great job!', 'Super!', 'Way to go!', 'Wow!', 'Yes!'];
const OOPS = ['Oops!', 'Almost!', 'Not quite!', 'So close!'];

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/** Put the shape card in the map corner diagonally opposite the target, so it doesn't cover it. */
function cardCorner(target: string, focus: readonly string[] | undefined): string {
  const geo = getMapGeometry();
  const t = geo.byId.get(target);
  if (!t) return 'left-3 top-1';
  const shapes = (focus ?? geo.shapes.map((s) => s.id)).map((id) => geo.byId.get(id)!).filter(Boolean);
  const midX = (Math.min(...shapes.map((s) => s.bbox[0])) + Math.max(...shapes.map((s) => s.bbox[2]))) / 2;
  const midY = (Math.min(...shapes.map((s) => s.bbox[1])) + Math.max(...shapes.map((s) => s.bbox[3]))) / 2;
  const x = t.centroid[0] < midX ? 'right-3' : 'left-3';
  const y = t.centroid[1] < midY ? 'bottom-3' : 'top-1';
  return `${x} ${y}`;
}

interface Floater {
  key: number;
  text: string;
  x: number;
  y: number;
  big?: boolean;
}

interface Props {
  mode: QuizMode;
  regionId: Region['id'];
  practice: boolean;
  data: SavedData;
  update: UpdateData;
  onHome: () => void;
  onFinish: (s: RoundSummary) => void;
}

export function QuizScreen({ mode, regionId, practice, data, update, onHome, onFinish }: Props) {
  const region = getRegion(regionId);
  const { regionColors, keepNames } = data.settings;
  const recordsAtStart = useRef(data.records);
  const [round, setRound] = useState<Round>(() => createRound({ mode, pool: region.states, records: data.records, now: Date.now(), practice }));
  const [message, setMessage] = useState<string | null>(null);
  const [mood, setMood] = useState<{ mood: MascotMood; key: number }>({ mood: 'idle', key: 0 });
  const [fxKey, setFxKey] = useState(0);
  const [correctFx, setCorrectFx] = useState<{ id: string; key: number } | null>(null);
  const [wrongFx, setWrongFx] = useState<{ id: string; key: number } | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  /** States answered correctly this round (labels stay on them in keep-names mode). */
  const [named, setNamed] = useState<string[]>([]);
  const mapApi = useRef<MapApi>(null);
  const mapWrap = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);

  const q = currentQuestion(round);
  const target = q?.state ?? '';
  const targetName = stateName(target);
  const prog = progressLabel(round);
  const tappable = useMemo(() => new Set(region.states), [region]);
  const focus = region.id === 'all' ? undefined : region.states;

  const promptText = mode === 'find' ? `Tap ${targetName}!` : 'Which state is this?';
  const spokenPrompt = (r: Round) => {
    const cq = currentQuestion(r);
    if (!cq) return '';
    const name = stateName(cq.state);
    const lead = cq.retry ? "Let's try one more time. " : '';
    if (mode === 'find') return `${lead}Find ${name}!`;
    const opts = cq.options.map(stateName);
    return `${lead}Which state is this? ${opts.slice(0, -1).join(', ')}, or ${opts[opts.length - 1]}?`;
  };

  const react = (m: MascotMood) => setMood((prev) => ({ mood: m, key: prev.key + 1 }));

  /** Floating cheer word / "+1" that rises from a state and fades (≈1s). */
  const floatAt = (abbr: string, text: string, big = false) => {
    const p = mapApi.current?.screenPoint(abbr);
    const box = mapWrap.current?.getBoundingClientRect();
    if (!p || !box) return null;
    const f: Floater = { key: Date.now() + Math.random(), text, x: p.x - box.left, y: p.y - box.top, big };
    setFloaters((list) => [...list, f]);
    setTimeout(() => setFloaters((list) => list.filter((x) => x.key !== f.key)), 1100);
    return p;
  };

  // New question: read the prompt aloud, clear feedback.
  useEffect(() => {
    if (!round.finished) speak(spokenPrompt(round));
    setMessage(null);
    setCorrectFx(null);
    setWrongFx(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.index, round.finished]);

  // Mascot goes back to idle after its reaction.
  useEffect(() => {
    if (mood.mood === 'idle') return;
    const t = setTimeout(() => setMood((m) => ({ mood: 'idle', key: m.key })), 1200);
    return () => clearTimeout(t);
  }, [mood]);

  // After a correct answer, move on automatically.
  useEffect(() => {
    if (round.status !== 'correct') return;
    const t = setTimeout(() => setRound((r) => nextQuestion(r)), CORRECT_DELAY_MS);
    return () => clearTimeout(t);
  }, [round.status, round.index]);

  // Round over → (Quiz only) save stars + streak, then show the end screen.
  useEffect(() => {
    if (!round.finished || finishedRef.current) return;
    finishedRef.current = true;
    const summary = summarize(round, recordsAtStart.current, Date.now());
    if (!practice) update((d) => withRoundFinished(d, summary.stars, toDayKey(new Date())));
    onFinish(summary);
  }, [round, update, onFinish, practice]);

  const persist = (next: Round) => {
    const res = next.results[next.results.length - 1];
    if (!res) return;
    if (practice) update((d) => withPracticeAnswer(d, res.state, res.firstTry, Date.now()));
    // Hinted answers are recorded as 'assisted' and don't count toward mastery.
    else update((d) => withAnswer(d, res.state, res.mastery, Date.now()));
  };

  const celebrateCorrect = (next: Round) => {
    const k = fxKey + 1;
    setFxKey(k);
    setCorrectFx({ id: target, key: k });
    setNamed((list) => (list.includes(target) ? list : [...list, target]));
    soundCorrect();
    react('happy');
    const cheer = pick(CHEERS);
    const p = floatAt(target, practice ? cheer : `+1 ${cheer}`);
    if (p) burstAt(p.x, p.y);
    setMessage(`🎉 ${cheer} That's ${targetName}!`);
    speak(`${cheer} That's ${targetName}!`);

    if (!practice) {
      if (next.combo === COMBO_SMALL) {
        soundCombo();
        setTimeout(() => floatAt(target, `🔥 ${COMBO_SMALL} in a row!`, true), 250);
      } else if (next.combo >= COMBO_BIG && next.combo % COMBO_BIG === 0) {
        soundCombo();
        bigCelebration();
        setTimeout(() => floatAt(target, `🚀 ${next.combo} in a row!`, true), 250);
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

    if (outcome === 'correct') {
      celebrateCorrect(next);
      return;
    }

    // wrong / revealed: gentle wobble + soft red flash on what she tapped, Ollie says "oops"
    const k = fxKey + 1;
    setFxKey(k);
    if (mode === 'find') setWrongFx({ id: choice, key: k });
    soundWrong();
    react('oops');
    const oops = pick(OOPS);

    if (outcome === 'wrong') {
      if (mode === 'find') {
        const hint = next.triesUsed === 2 ? ' Look inside the dashed circle!' : '';
        setMessage(`${oops} That's ${stateName(choice)}. Try again!${hint}`);
        speak(`${oops} That's ${stateName(choice)}. Try again!${hint}`);
      } else {
        setMessage(`${oops} Try another one!`);
        speak(`${oops} That one is ${stateName(choice)}. Try another one!`);
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

  const handleHint = () => {
    if (!canTakeHint(round)) return;
    const next = takeHint(round);
    setRound(next);
    soundHint();
    const text = hintText(target, next.hintsUsed);
    setMessage(text.display);
    speak(text.spoken);
  };

  const resolved = round.status !== 'asking';
  const wrong = new Set(round.wrongPicks);
  const targetRegion = STATE_BY_ABBR.get(target)?.region;
  const showShape = mode === 'find' && !resolved && round.hintsUsed >= 1;
  // Hint 2 highlights the target's region: with region colors on, every other region is dimmed;
  // with colors off, the region gets a soft tint. Kept after a reveal so she sees where it was.
  const hintRegion = mode === 'find' && round.hintsUsed >= 2 && targetRegion ? targetRegion : null;
  const dim = useMemo(
    () => (hintRegion && regionColors ? new Set(STATES.filter((s) => s.region !== hintRegion).map((s) => s.abbr)) : undefined),
    [hintRegion, regionColors],
  );

  const fillFor = (id: string) => {
    if (hintRegion && !regionColors && STATE_BY_ABBR.get(id)?.region === hintRegion) return REGION_TINT[hintRegion];
    return baseFill(id, regionColors);
  };

  // Name It highlights the target until she gets it; Find It pulses it only when revealing the answer.
  const pulse = mode === 'name' ? (round.status === 'correct' ? null : target) : round.status === 'revealed' ? target : null;
  const circleHint = mode === 'find' && round.status === 'asking' && round.triesUsed >= 2 ? target : null;
  const lastWrong = round.wrongPicks[round.wrongPicks.length - 1];
  const labels = [
    ...(keepNames ? named : []),
    ...(resolved ? [target] : []),
    ...(mode === 'find' && lastWrong && round.status === 'asking' ? [lastWrong] : []),
  ];
  const showMe = practice && round.status === 'asking' && round.triesUsed >= 1;

  if (!q) return <main className="h-full" />;

  return (
    <main className="flex h-full flex-col">
      <TopBar
        onHome={onHome}
        right={
          <>
            <div className="hidden flex-col items-center gap-1 sm:flex">
              <span className="rounded-full bg-white/80 px-4 py-1 text-xl font-extrabold text-slate-600">
                {prog.retry ? '🔁' : `${prog.number} / ${prog.total}`}
              </span>
              {practice ? (
                <span className="rounded-full bg-sky-100 px-3 text-base font-extrabold text-sky-700">🎈 Practice</span>
              ) : (
                <ComboBadge combo={round.combo} />
              )}
            </div>
            {mode === 'find' && (
              <button
                type="button"
                onClick={handleHint}
                disabled={!canTakeHint(round)}
                aria-label={`Hint (${MAX_HINTS - round.hintsUsed} left)`}
                title="Hint"
                className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-amber-400 font-serif text-4xl font-black italic text-white shadow-[0_4px_0_#b45309] transition active:translate-y-1 active:shadow-[0_1px_0_#b45309] disabled:bg-slate-300 disabled:shadow-[0_4px_0_#94a3b8]"
              >
                i
                <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white font-sans text-base font-black not-italic text-amber-600 shadow">
                  {MAX_HINTS - round.hintsUsed}
                </span>
              </button>
            )}
            <IconButton
              label="Say it again"
              onClick={() => speak(round.hintsUsed > 0 && !resolved ? `${spokenPrompt(round)} ${hintText(target, round.hintsUsed).spoken}` : spokenPrompt(round))}
            >
              🔊
            </IconButton>
          </>
        }
      >
        <div className="flex items-center gap-2">
          <Mascot key={mood.key} mood={mood.mood} size={68} />
          <div className="min-w-0 flex-1 text-center">
            <div className="text-lg font-bold text-slate-500">
              {region.emoji} {region.label} {prog.retry && '· one more try'}
              {mode === 'find' && !resolved && !practice && ` · ${'❤️'.repeat(Math.max(0, round.maxTries - round.triesUsed))}`}
            </div>
            {mode === 'find' ? (
              <>
                {/* Find It keeps "Tap Ohio!" visible; feedback and hints go on a second line. */}
                <div className={`text-3xl font-black leading-tight sm:text-4xl ${round.status === 'correct' ? 'text-green-600' : 'text-slate-900'}`}>
                  {round.status === 'correct' ? message : promptText}
                </div>
                {round.status !== 'correct' && message && <div className="text-2xl font-extrabold leading-tight text-slate-700">{message}</div>}
              </>
            ) : (
              <div className={`text-3xl font-black leading-tight sm:text-4xl ${round.status === 'correct' ? 'text-green-600' : 'text-slate-900'}`}>
                {message ?? promptText}
              </div>
            )}
          </div>
        </div>
      </TopBar>

      <div ref={mapWrap} className="relative min-h-0 flex-1 px-2">
        <USMap
          apiRef={mapApi}
          fillFor={fillFor}
          whiteBorders={regionColors}
          onTap={mode === 'find' ? handlePick : undefined}
          tappable={tappable}
          dim={dim}
          focus={focus}
          correct={correctFx}
          wrong={wrongFx}
          pulse={pulse}
          hint={circleHint}
          labels={labels}
        />
        {showShape && <ShapeCard key={`${round.index}`} abbr={target} className={`pointer-events-none absolute ${cardCorner(target, focus)}`} />}

        <AnimatePresence>
          {floaters.map((f) => (
            <motion.div
              key={f.key}
              className={`pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 font-black text-white shadow-lg ${f.big ? 'bg-orange-500 text-3xl' : 'bg-green-500 text-2xl'}`}
              style={{ left: f.x, top: f.y - 30 }}
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 1, 0], y: f.big ? -90 : -70, scale: 1 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              {f.text}
            </motion.div>
          ))}
        </AnimatePresence>

        {(round.status === 'revealed' || showMe) && (
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

      {regionColors && <RegionLegend className="px-2 pt-1" />}

      {mode === 'name' && (
        <div className="grid grid-cols-2 gap-3 p-3 landscape:grid-cols-4">
          {q.options.map((opt) => {
            const isAnswer = opt === target;
            const picked = wrong.has(opt);
            let cls = 'bg-white text-slate-900 shadow-[0_6px_0_#94a3b8]';
            if (resolved && isAnswer) cls = 'bg-green-500 text-white shadow-[0_6px_0_#15803d] pop-in ring-4 ring-yellow-300';
            else if (picked) cls = 'bg-rose-100 text-rose-400 shadow-[0_6px_0_#fda4af] shake';
            else if (resolved) cls = 'bg-white/60 text-slate-400 shadow-[0_6px_0_#cbd5e1]';
            return (
              <button
                key={`${round.index}-${opt}`}
                type="button"
                disabled={resolved || picked}
                onClick={() => handlePick(opt)}
                className={`min-h-20 rounded-3xl px-3 text-2xl font-extrabold leading-tight transition active:translate-y-1 sm:text-3xl ${cls}`}
              >
                {opt === target && resolved ? '✅ ' : ''}
                {stateName(opt)}
              </button>
            );
          })}
        </div>
      )}
      {mode === 'find' && <div className="h-2" />}
      <span className="sr-only" aria-live="polite">
        {message}
      </span>
    </main>
  );
}

/** Combo counter for graded rounds: ⚡2, then 🔥3–4, then a bigger 🚀5+. */
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
