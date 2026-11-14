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
  loadLayerProgress,
  saveLayerProgress,
  type GameLayer,
  type LayerProgress,
} from './lib/layerProgress';

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
  | { name: 'layer-setup'; layer: GameLayer; kind: QuizMode | 'test' }
  | { name: 'layer-quiz'; layer: GameLayer; mode: QuizMode; scope: string; practice: boolean; test: boolean; game: number }
  | { name: 'layer-results'; layer: GameLayer; mode: QuizMode; scope: string; practice: boolean; test: boolean; summary: RoundSummary }
  | { name: 'layer-progress'; layer: GameLayer };

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
      content = <HomeScreen data={data} go={go} layer={layer} onLayer={setLayer} layerProgress={layer === 'usa' ? undefined : layerData[layer]} />;
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
      content = <SettingsScreen data={data} update={update} onHome={home} />;
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
      const l = screen.layer;
      content = (
        <Suspense fallback={<MapLoading />}>
          <LayerSetupScreen
            layer={l}
            kind={screen.kind}
            progress={layerData[l]}
            updateProgress={(fn) => updateLayer(l, fn)}
            onHome={home}
            onStart={(mode, scope, practice, test) => go({ name: 'layer-quiz', layer: l, mode, scope, practice, test, game: Date.now() })}
          />
        </Suspense>
      );
      break;
    }
    case 'layer-quiz': {
      const sc = screen;
      content = (
        <Suspense fallback={<MapLoading />}>
          <LayerGameScreen
            key={sc.game}
            layer={sc.layer}
            mode={sc.mode}
            scopeId={sc.scope}
            practice={sc.practice}
            test={sc.test}
            settings={data.settings}
            progress={layerData[sc.layer]}
            updateProgress={(fn) => updateLayer(sc.layer, fn)}
            onHome={home}
            onFinish={(summary) => go({ name: 'layer-results', layer: sc.layer, mode: sc.mode, scope: sc.scope, practice: sc.practice, test: sc.test, summary })}
          />
        </Suspense>
      );
      break;
    }
    case 'layer-results': {
      const sc = screen;
      content = (
        <Suspense fallback={<MapLoading />}>
          <LayerResultsScreen
            layer={sc.layer}
            mode={sc.mode}
            scopeId={sc.scope}
            summary={sc.summary}
            progress={layerData[sc.layer]}
            onHome={home}
            onAgain={() => go({ name: 'layer-quiz', layer: sc.layer, mode: sc.mode, scope: sc.scope, practice: sc.practice, test: sc.test, game: Date.now() })}
            onOther={() => go({ name: 'layer-setup', layer: sc.layer, kind: sc.test ? 'test' : sc.mode })}
          />
        </Suspense>
      );
      break;
    }
    case 'layer-progress': {
      const l = screen.layer;
      content = (
        <Suspense fallback={<MapLoading />}>
          <LayerProgressScreen layer={l} progress={layerData[l]} updateProgress={(fn) => updateLayer(l, fn)} onHome={home} />
        </Suspense>
      );
      break;
    }
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
