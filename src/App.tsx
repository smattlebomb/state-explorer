import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { loadData, saveData, type SavedData } from './lib/storage';
import { setSpeechEnabled } from './lib/speech';
import { setSoundEnabled } from './lib/sound';
import type { QuizMode, RoundSummary } from './lib/quiz';
import type { Region } from './data/regions';
import type { RegionId } from './data/states';
import { HomeScreen } from './screens/HomeScreen';
import { SetupScreen } from './screens/SetupScreen';
import { LearnScreen } from './screens/LearnScreen';
import { QuizScreen } from './screens/QuizScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { TestSetupScreen } from './screens/TestSetupScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { MapLoading } from './components/MapLoading';
import type { WorldStart } from './screens/WorldScreen';
import {
  layerWithExplored,
  loadCapitalsProgress,
  loadLayerProgress,
  saveCapitalsProgress,
  saveLayerProgress,
  type AnyLayer,
  type GameKind,
  type GameLayer,
  type LayerProgress,
} from './lib/layerProgress';
import { bestQuizKey, loadMathData, mathWith, mathWithQuizScore, saveMathData, type MathData, type Subject } from './lib/mathStorage';
import type { RoundKind, RoundSummary as MathSummary } from './lib/mathRound';
import { factsForTables } from './lib/mathFacts';
import { practiceSet } from './lib/mathMastery';

// The World and Canada screens (and their map data) load on demand, in their own chunks,
// so the US app's first download doesn't grow.
const WorldScreen = lazy(() => import('./screens/WorldScreen'));
const CanadaScreen = lazy(() => import('./screens/CanadaScreen'));
const CountiesScreen = lazy(() => import('./screens/CountiesScreen'));
// World/Canada games: one lazy chunk for setup, play, results and My Map.
const LayerSetupScreen = lazy(() => import('./screens/layerScreens').then((m) => ({ default: m.LayerSetupScreen })));
const LayerGameScreen = lazy(() => import('./screens/layerScreens').then((m) => ({ default: m.LayerGameScreen })));
const LayerResultsScreen = lazy(() => import('./screens/layerScreens').then((m) => ({ default: m.LayerResultsScreen })));
const LayerProgressScreen = lazy(() => import('./screens/layerScreens').then((m) => ({ default: m.LayerProgressScreen })));
const CapitalsLearnScreen = lazy(() => import('./screens/layerScreens').then((m) => ({ default: m.CapitalsLearnScreen })));
// Math: one lazy chunk for setup, play and results.
const MathSetupScreen = lazy(() => import('./screens/mathScreens').then((m) => ({ default: m.MathSetupScreen })));
const MathPlayScreen = lazy(() => import('./screens/mathScreens').then((m) => ({ default: m.MathPlayScreen })));
const MathResultsScreen = lazy(() => import('./screens/mathScreens').then((m) => ({ default: m.MathResultsScreen })));
const MathFactsScreen = lazy(() => import('./screens/mathScreens').then((m) => ({ default: m.MathFactsScreen })));

/** Which map the Home screen is showing. USA is the default (and the full game). */
export type Layer = 'usa' | 'canada' | 'world';

export type Screen =
  | { name: 'home' }
  | { name: 'learn'; tour?: RegionId }
  | { name: 'progress' }
  | { name: 'settings' }
  | { name: 'setup'; mode: QuizMode }
  | { name: 'setup-test' }
  | { name: 'quiz'; mode: QuizMode; region: Region['id']; practice: boolean; test?: boolean; game: number }
  | { name: 'results'; mode: QuizMode; region: Region['id']; practice: boolean; test?: boolean; summary: RoundSummary }
  | { name: 'world'; start?: WorldStart }
  | { name: 'canada'; fromWorld?: boolean }
  | { name: 'counties'; state: string }
  // World/Canada place games, and capitals games on all three layers (`kind` defaults to 'places').
  | { name: 'layer-setup'; layer: AnyLayer; kind: QuizMode | 'test'; game?: GameKind }
  | { name: 'layer-quiz'; layer: AnyLayer; mode: QuizMode; scope: string; practice: boolean; test: boolean; game: number; kind?: GameKind }
  | { name: 'layer-results'; layer: AnyLayer; mode: QuizMode; scope: string; practice: boolean; test: boolean; summary: RoundSummary; kind?: GameKind }
  | { name: 'layer-progress'; layer: AnyLayer; game?: GameKind }
  | { name: 'capitals-learn'; layer: AnyLayer }
  // Math (multiplication). Its data lives only in `state-explorer:math-mult:v1`.
  | { name: 'math-setup'; mode: 'practice' | 'quiz' }
  | { name: 'math-play'; kind: RoundKind; ids: string[]; game: number }
  | { name: 'math-results'; summary: MathSummary; newBest?: boolean }
  | { name: 'math-facts' };

export type UpdateData = (fn: (d: SavedData) => SavedData) => void;

function formatBest(score: SavedData['bestTests']['find']): string | null {
  if (!score) return null;
  const pct = Math.round((score.correct / score.total) * 100);
  return `${score.correct}/${score.total} (${pct}%)`;
}

export default function App() {
  const [data, setData] = useState<SavedData>(loadData);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  // Session only: the US save (state-explorer:v1) is not touched by the new layers.
  const [layer, setLayer] = useState<Layer>('usa');
  // World and Canada progress: each in its own localStorage key, never mixed with the US save.
  const [layerData, setLayerData] = useState<Record<GameLayer, LayerProgress>>(() => ({ world: loadLayerProgress('world'), canada: loadLayerProgress('canada') }));
  const savedLayers = useRef(layerData);
  useEffect(() => {
    for (const l of ['world', 'canada'] as const) {
      if (layerData[l] !== savedLayers.current[l]) saveLayerProgress(l, layerData[l]);
    }
    savedLayers.current = layerData;
  }, [layerData]);
  const updateLayer = useCallback((l: GameLayer, fn: (p: LayerProgress) => LayerProgress) => setLayerData((d) => ({ ...d, [l]: fn(d[l]) })), []);
  // Capitals progress: three more keys of their own, so capitals mastery never touches place-finding records.
  const [capitalsData, setCapitalsData] = useState<Record<AnyLayer, LayerProgress>>(() => ({
    usa: loadCapitalsProgress('usa'),
    world: loadCapitalsProgress('world'),
    canada: loadCapitalsProgress('canada'),
  }));
  const savedCapitals = useRef(capitalsData);
  useEffect(() => {
    for (const l of ['usa', 'world', 'canada'] as const) {
      if (capitalsData[l] !== savedCapitals.current[l]) saveCapitalsProgress(l, capitalsData[l]);
    }
    savedCapitals.current = capitalsData;
  }, [capitalsData]);
  const updateCapitals = useCallback((l: AnyLayer, fn: (p: LayerProgress) => LayerProgress) => setCapitalsData((d) => ({ ...d, [l]: fn(d[l]) })), []);
  /** The progress store (and updater) for a layer's place games or capitals games. */
  const store = (l: AnyLayer, game: GameKind = 'places'): [LayerProgress, (fn: (p: LayerProgress) => LayerProgress) => void] =>
    game === 'capitals' || l === 'usa' ? [capitalsData[l], (fn) => updateCapitals(l, fn)] : [layerData[l], (fn) => updateLayer(l, fn)];

  // Math store (also remembers the last Home subject). Saved only when it changes.
  const [math, setMath] = useState<MathData>(loadMathData);
  const savedMath = useRef(math);
  useEffect(() => {
    if (math !== savedMath.current) saveMathData(math);
    savedMath.current = math;
  }, [math]);
  const updateMath = useCallback((fn: (m: MathData) => MathData) => setMath((m) => fn(m)), []);
  const setSubject = useCallback((s: Subject) => updateMath((m) => mathWith(m, 'subject', s)), [updateMath]);

  useEffect(() => saveData(data), [data]);
  useEffect(() => setSpeechEnabled(data.settings.narration), [data.settings.narration]);
  useEffect(() => setSoundEnabled(data.settings.sound), [data.settings.sound]);

  const update: UpdateData = useCallback((fn) => setData((d) => fn(d)), []);
  const go = useCallback((s: Screen) => setScreen(s), []);
  const home = useCallback(() => setScreen({ name: 'home' }), []);

  const play = (mode: QuizMode, region: Region['id'], practice: boolean, test = false) =>
    go({ name: 'quiz', mode, region, practice: test ? false : practice, test, game: Date.now() });

  let content;
  switch (screen.name) {
    case 'home':
      content = (
        <HomeScreen
          data={data}
          go={go}
          layer={layer}
          onLayer={setLayer}
          layerProgress={layer === 'usa' ? undefined : layerData[layer]}
          capitalsProgress={capitalsData[layer]}
          subject={math.subject}
          onSubject={setSubject}
          math={math}
        />
      );
      break;
    case 'learn':
      content = (
        <LearnScreen
          key={screen.tour ?? 'explore'}
          data={data}
          update={update}
          onHome={home}
          initialTour={screen.tour}
          onPlay={(region) => play('find', region, data.settings.practice)}
          onCounties={(abbr) => go({ name: 'counties', state: abbr })}
        />
      );
      break;
    case 'progress':
      content = <ProgressScreen data={data} update={update} onHome={home} />;
      break;
    case 'settings':
      content = <SettingsScreen data={data} update={update} onHome={home} math={math} updateMath={updateMath} />;
      break;
    case 'setup':
      content = <SetupScreen mode={screen.mode} data={data} update={update} onHome={home} onStart={(region, practice) => play(screen.mode, region, practice)} />;
      break;
    case 'setup-test':
      content = (
        <TestSetupScreen
          onHome={home}
          onStart={(mode) => play(mode, 'all', false, true)}
          bestFind={formatBest(data.bestTests.find)}
          bestName={formatBest(data.bestTests.name)}
        />
      );
      break;
    case 'quiz':
      content = (
        <QuizScreen
          key={screen.game}
          mode={screen.mode}
          regionId={screen.region}
          practice={screen.practice}
          test={screen.test}
          data={data}
          update={update}
          onHome={home}
          onFinish={(summary) => go({ name: 'results', mode: screen.mode, region: screen.region, practice: screen.practice, test: screen.test, summary })}
        />
      );
      break;
    case 'results':
      content = (
        <ResultsScreen
          mode={screen.mode}
          regionId={screen.region}
          summary={screen.summary}
          data={data}
          onHome={home}
          onAgain={() => play(screen.mode, screen.region, screen.practice, screen.test)}
          onOtherRegion={() => go(screen.test ? { name: 'setup-test' } : { name: 'setup', mode: screen.mode })}
        />
      );
      break;
    case 'world':
      content = (
        <Suspense fallback={<MapLoading />}>
          <WorldScreen
            data={data}
            onHome={home}
            start={screen.start}
            onOpenCanada={() => go({ name: 'canada', fromWorld: true })}
            onOpenUSA={() => go({ name: 'learn' })}
            onExplore={(id) => updateLayer('world', (p) => layerWithExplored(p, id))}
          />
        </Suspense>
      );
      break;
    case 'counties':
      content = (
        <Suspense fallback={<MapLoading text="Drawing the counties…" />}>
          <CountiesScreen data={data} state={screen.state} onHome={home} onBack={() => go({ name: 'learn' })} />
        </Suspense>
      );
      break;
    case 'layer-setup': {
      const sc = screen;
      const [progress, updateProgress] = store(sc.layer, sc.game);
      content = (
        <Suspense fallback={<MapLoading />}>
          <LayerSetupScreen
            layer={sc.layer}
            game={sc.game}
            kind={sc.kind}
            progress={progress}
            updateProgress={updateProgress}
            onHome={home}
            onStart={(mode, scope, practice, test) => go({ name: 'layer-quiz', layer: sc.layer, kind: sc.game, mode, scope, practice, test, game: Date.now() })}
          />
        </Suspense>
      );
      break;
    }
    case 'layer-quiz': {
      const sc = screen;
      const [progress, updateProgress] = store(sc.layer, sc.kind);
      content = (
        <Suspense fallback={<MapLoading />}>
          <LayerGameScreen
            key={sc.game}
            layer={sc.layer}
            game={sc.kind}
            mode={sc.mode}
            scopeId={sc.scope}
            practice={sc.practice}
            test={sc.test}
            settings={data.settings}
            progress={progress}
            updateProgress={updateProgress}
            onHome={home}
            onFinish={(summary) => go({ name: 'layer-results', layer: sc.layer, kind: sc.kind, mode: sc.mode, scope: sc.scope, practice: sc.practice, test: sc.test, summary })}
          />
        </Suspense>
      );
      break;
    }
    case 'layer-results': {
      const sc = screen;
      const [progress] = store(sc.layer, sc.kind);
      content = (
        <Suspense fallback={<MapLoading />}>
          <LayerResultsScreen
            layer={sc.layer}
            game={sc.kind}
            mode={sc.mode}
            scopeId={sc.scope}
            summary={sc.summary}
            progress={progress}
            onHome={home}
            onAgain={() => go({ name: 'layer-quiz', layer: sc.layer, kind: sc.kind, mode: sc.mode, scope: sc.scope, practice: sc.practice, test: sc.test, game: Date.now() })}
            onOther={() => go({ name: 'layer-setup', layer: sc.layer, game: sc.kind, kind: sc.test ? 'test' : sc.mode })}
          />
        </Suspense>
      );
      break;
    }
    case 'layer-progress': {
      const sc = screen;
      const [progress, updateProgress] = store(sc.layer, sc.game);
      content = (
        <Suspense fallback={<MapLoading />}>
          <LayerProgressScreen layer={sc.layer} game={sc.game} progress={progress} updateProgress={updateProgress} onHome={home} />
        </Suspense>
      );
      break;
    }
    case 'capitals-learn':
      content = (
        <Suspense fallback={<MapLoading />}>
          <CapitalsLearnScreen layer={screen.layer} settings={data.settings} onHome={home} />
        </Suspense>
      );
      break;
    case 'math-setup':
      content = (
        <Suspense fallback={<MapLoading text="Getting the cards…" />}>
          <MathSetupScreen mode={screen.mode} math={math} updateMath={updateMath} onHome={home} onStart={(ids) => go({ name: 'math-play', kind: screen.mode, ids, game: Date.now() })} />
        </Suspense>
      );
      break;
    case 'math-play': {
      const sc = screen;
      content = (
        <Suspense fallback={<MapLoading text="Getting the cards…" />}>
          <MathPlayScreen
            key={sc.game}
            kind={sc.kind}
            ids={sc.ids}
            math={math}
            updateMath={updateMath}
            onHome={home}
            onFinish={(summary) => {
              // A finished quiz saves its best score (per length + answer mode).
              let newBest = false;
              if (summary.kind === 'quiz') {
                const prev = math.bestQuizzes[bestQuizKey(math.quizLength, math.quizAnswerMode)];
                newBest = summary.total > 0 && (!prev || summary.correct / summary.total > prev.correct / prev.total);
                updateMath((m) => mathWithQuizScore(m, m.quizLength, m.quizAnswerMode, summary.correct, summary.total));
              }
              go({ name: 'math-results', summary, newBest });
            }}
          />
        </Suspense>
      );
      break;
    }
    case 'math-results':
      content = (
        <Suspense fallback={<MapLoading text="Getting the cards…" />}>
          <MathResultsScreen
            summary={screen.summary}
            newBest={screen.newBest}
            math={math}
            onRetryMissed={(ids) => go({ name: 'math-play', kind: 'practice', ids, game: Date.now() })}
            onPracticeTables={() => go({ name: 'math-play', kind: 'practice', ids: practiceSet(factsForTables(math.tables, math.includeZero).map((f) => f.id), math.facts, Date.now()), game: Date.now() })}
            onFacts={() => go({ name: 'math-facts' })}
            onHome={home}
          />
        </Suspense>
      );
      break;
    case 'math-facts':
      content = (
        <Suspense fallback={<MapLoading text="Getting the cards…" />}>
          <MathFactsScreen math={math} updateMath={updateMath} onHome={home} onPractice={() => go({ name: 'math-setup', mode: 'practice' })} />
        </Suspense>
      );
      break;
    case 'canada':
      content = (
        <Suspense fallback={<MapLoading />}>
          <CanadaScreen
            data={data}
            onHome={home}
            // Back lands on Northern America with Canada still picked.
            onBack={screen.fromWorld ? () => go({ name: 'world', start: { level: { kind: 'subregion', subregion: 'northern-america' }, selected: 'CA' } }) : undefined}
            explored={layerData.canada.explored}
            onExplore={(abbr) => updateLayer('canada', (p) => layerWithExplored(p, abbr))}
          />
        </Suspense>
      );
      break;
  }

  // reducedMotion="user": framer-motion drops transform animations when the device asks for reduced motion.
  return <MotionConfig reducedMotion="user">{content}</MotionConfig>;
}
