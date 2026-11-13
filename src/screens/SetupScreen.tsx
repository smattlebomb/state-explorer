import { useEffect } from 'react';
import type { UpdateData } from '../App';
import { REGIONS, type Region } from '../data/regions';
import { masteryOf } from '../lib/srs';
import { withSetting, type SavedData } from '../lib/storage';
import type { QuizMode } from '../lib/quiz';
import { TopBar } from '../components/ui';
import { Toggle } from '../components/Toggle';
import { speak } from '../lib/speech';

interface Props {
  mode: QuizMode;
  data: SavedData;
  update: UpdateData;
  onHome: () => void;
  onStart: (region: Region['id'], practice: boolean) => void;
}

/** Setup before Find It / Name It: Quiz or Practice, keep-names toggle, then pick the states (which starts the game). */
export function SetupScreen({ mode, data, update, onHome, onStart }: Props) {
  const practice = data.settings.practice;
  useEffect(() => speak('Quiz or practice? Then pick your states!'), []);

  const setPractice = (p: boolean) => {
    update((d) => withSetting(d, 'practice', p));
    speak(p ? 'Practice. No score, take your time!' : 'Quiz. Earn stars!');
  };

  const flavorBtn = (p: boolean, emoji: string, title: string, sub: string) => {
    const on = practice === p;
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => setPractice(p)}
        className={`flex min-h-24 flex-1 items-center gap-3 rounded-[2rem] px-5 py-3 text-left transition active:translate-y-1 ${
          on ? 'bg-sky-500 text-white shadow-[0_6px_0_#0369a1] ring-4 ring-yellow-300' : 'bg-white text-slate-700 shadow-[0_6px_0_#94a3b8]'
        }`}
      >
        <span className="text-5xl">{emoji}</span>
        <span>
          <span className="block text-3xl font-black">
            {title} {on && '✓'}
          </span>
          <span className={`block text-lg font-bold ${on ? 'text-sky-50' : 'text-slate-500'}`}>{sub}</span>
        </span>
      </button>
    );
  };

  return (
    <main className="flex h-full flex-col overflow-y-auto">
      <TopBar onHome={onHome}>
        <h1 className="text-3xl font-black text-slate-800 sm:text-4xl">{mode === 'find' ? '👆 Find It' : '🔤 Name It'}</h1>
      </TopBar>

      <div className="flex flex-col gap-4 px-4 pt-2">
        <div className="flex flex-col gap-4 sm:flex-row">
          {flavorBtn(false, '🏆', 'Quiz', 'Earn stars and master states')}
          {flavorBtn(true, '🎈', 'Practice', 'No score · try as much as you like')}
        </div>
        <Toggle
          emoji="🏷️"
          label="Keep names on the map"
          sub="States you get right keep their name for the rest of the round"
          checked={data.settings.keepNames}
          onChange={(on) => update((d) => withSetting(d, 'keepNames', on))}
        />
        <h2 className="pt-2 text-center text-3xl font-black text-slate-800">Which states? Tap to start!</h2>
      </div>

      <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-4 p-4 landscape:grid-cols-3">
        {REGIONS.map((r) => {
          const mastered = r.states.filter((s) => masteryOf(data.records[s]) === 'mastered').length;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onStart(r.id, practice)}
              className={`flex min-h-32 flex-col items-center justify-center gap-1 rounded-[2rem] p-4 text-white shadow-[0_8px_0_rgba(0,0,0,0.25)] transition active:translate-y-1.5 active:shadow-none ${r.color}`}
            >
              <span className="text-6xl">{r.emoji}</span>
              <span className="text-4xl font-black">{r.label}</span>
              <span className="text-xl font-bold opacity-95">
                {r.states.length} states · 🏆 {mastered}
              </span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
