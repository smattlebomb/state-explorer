import type { UpdateData } from '../App';
import { withSetting, type SavedData, type Settings } from '../lib/storage';
import { speak, speechSupported } from '../lib/speech';
import { soundCorrect } from '../lib/sound';
import { TopBar } from '../components/ui';
import { Toggle } from '../components/Toggle';
import { RegionLegend } from '../components/RegionLegend';
import { mathWith, type MathData } from '../lib/mathStorage';

export function SettingsScreen({
  data,
  update,
  onHome,
  math,
  updateMath,
}: {
  data: SavedData;
  update: UpdateData;
  onHome: () => void;
  /** Math settings live in the math store (state-explorer:math-mult:v1), not the geography save. */
  math?: MathData;
  updateMath?: (fn: (m: MathData) => MathData) => void;
}) {
  const s = data.settings;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => update((d) => withSetting(d, key, value));

  return (
    <main className="flex h-full flex-col overflow-y-auto">
      <TopBar onHome={onHome}>
        <h1 className="text-3xl font-black text-slate-800 sm:text-4xl">⚙️ Settings</h1>
      </TopBar>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
        {speechSupported() && (
          <Toggle
            emoji="🗣️"
            label="Spoken narration"
            sub="Read prompts and state names out loud. Off unless you turn it on."
            checked={s.narration}
            onChange={(on) => {
              set('narration', on);
              if (on) setTimeout(() => speak('Spoken narration is on!'), 50);
            }}
          />
        )}
        <Toggle
          emoji="🔔"
          label="Sound effects"
          sub="Soft dings and cheers (separate from spoken narration)"
          checked={s.sound}
          onChange={(on) => {
            set('sound', on);
            if (on) setTimeout(soundCorrect, 50);
          }}
        />
        <Toggle
          emoji="🎨"
          label="Region colors"
          sub="Color each state by its region. Turn off for a harder blank map!"
          checked={s.regionColors}
          onChange={(on) => set('regionColors', on)}
        />
        {s.regionColors && <RegionLegend className="-mt-1" />}
        <Toggle
          emoji="🏷️"
          label="Keep names on the map (Find It & Name It)"
          sub="States you get right keep their name for the rest of the round"
          checked={s.keepNames}
          onChange={(on) => set('keepNames', on)}
        />
        <Toggle
          emoji="🔍"
          label="Keep names on the map (Learn)"
          sub="Every state you tap keeps its name, so the map fills up as you explore"
          checked={s.learnKeepNames}
          onChange={(on) => set('learnKeepNames', on)}
        />
        {math && updateMath && (
          <section className="mt-2 flex flex-col gap-4 rounded-[2rem] bg-violet-50 p-4" aria-label="Math settings">
            <h2 className="text-2xl font-black text-violet-800">🔢 Math</h2>
            <Toggle
              emoji="0️⃣"
              label="Include 0s"
              sub="Add facts like 0 × 7 and 5 × 0 to flashcards, quizzes and My Facts"
              checked={math.includeZero}
              onChange={(on) => updateMath((m) => mathWith(m, 'includeZero', on))}
            />
            <Toggle
              emoji="⏳"
              label="Relaxed timer (quizzes)"
              sub="A gentle 25-second bar on each quiz question. Off by default. If time runs out, we just show the answer, no penalty."
              checked={math.relaxedTimer}
              onChange={(on) => updateMath((m) => mathWith(m, 'relaxedTimer', on))}
            />
          </section>
        )}
        <p className="pt-2 text-center text-lg font-semibold text-slate-500">
          To erase progress, go to 📊 My Map (geography) or 🟩 My Facts (math) and hold the grown-ups button.
        </p>
      </div>
    </main>
  );
}
