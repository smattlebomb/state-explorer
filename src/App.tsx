import { useCallback, useEffect, useState } from 'react';
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

export type Screen =
  | { name: 'home' }
  | { name: 'learn'; tour?: RegionId }
  | { name: 'progress' }
  | { name: 'settings' }
  | { name: 'setup'; mode: QuizMode }
  | { name: 'setup-test' }
  | { name: 'quiz'; mode: QuizMode; region: Region['id']; practice: boolean; test?: boolean; game: number }
  | { name: 'results'; mode: QuizMode; region: Region['id']; practice: boolean; test?: boolean; summary: RoundSummary };

export type UpdateData = (fn: (d: SavedData) => SavedData) => void;

function formatBest(score: SavedData['bestTests']['find']): string | null {
  if (!score) return null;
  const pct = Math.round((score.correct / score.total) * 100);
  return `${score.correct}/${score.total} (${pct}%)`;
}

export default function App() {
  const [data, setData] = useState<SavedData>(loadData);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

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
      content = <HomeScreen data={data} go={go} />;
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
  }

  // reducedMotion="user": framer-motion drops transform animations when the device asks for reduced motion.
  return <MotionConfig reducedMotion="user">{content}</MotionConfig>;
}
