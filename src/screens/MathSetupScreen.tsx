import type { ReactNode } from 'react';
import { mathWith, type MathData, type QuizLength } from '../lib/mathStorage';
import { TABLES, factsForTables, isAllTables, normalizeTables, toggleTable } from '../lib/mathFacts';
import { practiceSet, quizSet } from '../lib/mathMastery';
import { BigButton, TopBar } from '../components/ui';
import { Toggle } from '../components/Toggle';

interface Props {
  mode: 'practice' | 'quiz';
  math: MathData;
  updateMath: (fn: (m: MathData) => MathData) => void;
  onHome: () => void;
  /** Start a round with these fact ids. */
  onStart: (ids: string[]) => void;
}

/** One big selectable option (answer style, quiz length…). */
function Choice({ on, onClick, emoji, title, sub, label }: { on: boolean; onClick: () => void; emoji: string; title: string; sub?: string; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={`flex min-h-20 min-w-0 flex-1 items-center gap-3 rounded-3xl px-4 py-3 text-left transition active:translate-y-1 ${
        on ? 'bg-sky-500 text-white shadow-[0_6px_0_#0369a1] ring-4 ring-yellow-300' : 'bg-white text-slate-700 shadow-[0_6px_0_#94a3b8]'
      }`}
    >
      <span className="text-4xl">{emoji}</span>
      <span className="min-w-0">
        <span className="block text-2xl font-black leading-tight">
          {title} {on && '✓'}
        </span>
        {sub && <span className={`block text-base font-bold ${on ? 'text-sky-50' : 'text-slate-500'}`}>{sub}</span>}
      </span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[2rem] bg-white/70 p-4">
      <h2 className="mb-3 text-2xl font-black text-slate-700">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Before Multiplication Flashcards (practice) or the quiz: pick the tables,
 * zeros on/off, and how to answer. Everything is remembered for next time.
 */
export function MathSetupScreen({ mode, math, updateMath, onHome, onStart }: Props) {
  const quiz = mode === 'quiz';
  const all = isAllTables(math.tables);
  const selected = new Set(normalizeTables(math.tables));
  const pool = factsForTables(math.tables, math.includeZero).map((f) => f.id);

  const start = () => {
    const ids = quiz ? quizSet(pool, math.facts, math.quizLength, Date.now()) : practiceSet(pool, math.facts, Date.now());
    onStart(ids);
  };

  const chip = (on: boolean) =>
    `flex min-h-16 min-w-0 items-center justify-center rounded-3xl text-3xl font-black transition active:translate-y-1 ${
      on ? 'bg-violet-600 text-white shadow-[0_5px_0_#4c1d95] ring-4 ring-yellow-300' : 'bg-white text-slate-700 shadow-[0_5px_0_#94a3b8]'
    }`;

  const lengthLabel = (n: QuizLength) => (n === 'all' ? `All ${pool.length}` : `${n}`);

  return (
    <main className="flex h-full flex-col overflow-y-auto pb-[env(safe-area-inset-bottom)]">
      <TopBar onHome={onHome}>
        <h1 className="text-3xl font-black text-slate-800 sm:text-4xl">{quiz ? '🏆 Multiplication Quiz' : '✖️ Flashcards'}</h1>
      </TopBar>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-6 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <Section title="Which times tables?">
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-7" role="group" aria-label="Times tables">
            <button type="button" aria-pressed={all} aria-label="All tables" onClick={() => updateMath((m) => mathWith(m, 'tables', toggleTable(m.tables, 'all')))} className={`${chip(all)} col-span-2 sm:col-span-1 text-2xl`}>
              All
            </button>
            {TABLES.map((t) => {
              const on = !all && selected.has(t);
              return (
                <button key={t} type="button" aria-pressed={on} aria-label={`${t} times table`} onClick={() => updateMath((m) => mathWith(m, 'tables', toggleTable(m.tables, t)))} className={chip(on)}>
                  {t}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-lg font-bold text-slate-500">
            {all ? `All tables · ${pool.length} facts` : `${[...selected].join(', ')} · ${pool.length} facts`}
          </p>
        </Section>

        <Toggle
          emoji="0️⃣"
          label="Include 0s"
          sub="Add facts like 0 × 7 and 5 × 0"
          checked={math.includeZero}
          onChange={(on) => updateMath((m) => mathWith(m, 'includeZero', on))}
        />

        {!quiz ? (
          <Section title="How do you want to answer?">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Choice
                label="Flip the card"
                on={math.practiceMode === 'flip'}
                onClick={() => updateMath((m) => mathWith(m, 'practiceMode', 'flip'))}
                emoji="🃏"
                title="Flip the card"
                sub="Think of the answer, then tap to check"
              />
              <Choice
                label="Number pad"
                on={math.practiceMode === 'keypad'}
                onClick={() => updateMath((m) => mathWith(m, 'practiceMode', 'keypad'))}
                emoji="🔢"
                title="Number pad"
                sub="Type the answer on big buttons"
              />
            </div>
          </Section>
        ) : (
          <>
            <Section title="How many?">
              <div className="flex flex-col gap-3 sm:flex-row">
                {([10, 20, 'all'] as const).map((n) => (
                  <Choice key={String(n)} label={`${n === 'all' ? 'All' : n} questions`} on={math.quizLength === n} onClick={() => updateMath((m) => mathWith(m, 'quizLength', n))} emoji={n === 'all' ? '🌈' : n === 10 ? '🔟' : '✌️'} title={lengthLabel(n)} />
                ))}
              </div>
            </Section>
            <Section title="How do you want to answer?">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Choice label="Number pad" on={math.quizAnswerMode === 'keypad'} onClick={() => updateMath((m) => mathWith(m, 'quizAnswerMode', 'keypad'))} emoji="🔢" title="Number pad" sub="Type the answer" />
                <Choice label="Pick from 4" on={math.quizAnswerMode === 'choices'} onClick={() => updateMath((m) => mathWith(m, 'quizAnswerMode', 'choices'))} emoji="🔘" title="Pick from 4" sub="Tap the right answer" />
              </div>
            </Section>
            <Toggle
              emoji="⏳"
              label="Relaxed timer"
              sub="A gentle 25-second reminder on each question. Running out is okay: we just show the answer."
              checked={math.relaxedTimer}
              onChange={(on) => updateMath((m) => mathWith(m, 'relaxedTimer', on))}
            />
          </>
        )}

        <BigButton variant="success" className="min-h-20 text-4xl" onClick={start} disabled={pool.length === 0}>
          {quiz ? 'Start quiz ➜' : 'Start ➜'}
        </BigButton>
      </div>
    </main>
  );
}
