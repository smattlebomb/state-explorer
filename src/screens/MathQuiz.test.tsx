// @vitest-environment jsdom
import { act, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { button, click, render, type Rendered } from '../test/render';
import { MathPlayScreen, RELAXED_TIMER_SECONDS } from './MathPlayScreen';
import { MathResultsScreen, quizMessage } from './MathResultsScreen';
import { MathSetupScreen } from './MathSetupScreen';
import { emptyMathData, type MathData } from '../lib/mathStorage';
import type { RoundSummary } from '../lib/mathRound';
import App from '../App';
import { MATH_STORAGE_KEY } from '../lib/mathStorage';
import { STORAGE_KEY } from '../lib/storage';

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
  vi.useRealTimers();
  localStorage.clear();
});

let latest: MathData = emptyMathData();
function Quiz({ ids, init = {}, onFinish = () => {} }: { ids: string[]; init?: Partial<MathData>; onFinish?: (s: RoundSummary) => void }) {
  const [m, setM] = useState<MathData>({ ...emptyMathData(), ...init });
  latest = m;
  return <MathPlayScreen kind="quiz" ids={ids} math={m} updateMath={(fn) => setM((x) => fn(x))} onHome={() => {}} onFinish={onFinish} />;
}
const factText = (c: Element) => c.querySelector('[data-testid="math-fact"]')!.textContent!;
const answerOf = (c: Element) => factText(c).split('×').map((x) => parseInt(x)).reduce((a, b) => a * b);
const choiceButtons = (c: Element) => [...c.querySelectorAll<HTMLButtonElement>('[aria-label="Answer choices"] button')];

describe('quiz with 4 choices', () => {
  it('four big answer chips (2 per row, so they wrap on a phone), exactly one right', () => {
    view = render(<Quiz ids={['6x7']} init={{ quizAnswerMode: 'choices' }} />);
    const c = view.container;
    const chips = choiceButtons(c);
    expect(chips).toHaveLength(4);
    expect(c.querySelector('[aria-label="Answer choices"]')!.className).toContain('grid-cols-2');
    for (const b of chips) expect(b.className).toContain('min-h-20');
    expect(chips.filter((b) => b.textContent === '42')).toHaveLength(1);
    expect(button(c, 'Check answer')).toBeUndefined(); // no number pad in this mode
  });

  it('one chance per question: a miss shows the answer and dot picture and only the first answer is scored', () => {
    const onFinish = vi.fn();
    view = render(<Quiz ids={['3x4', '2x5']} init={{ quizAnswerMode: 'choices' }} onFinish={onFinish} />);
    const c = view.container;
    // Miss the first one.
    click(choiceButtons(c).find((b) => Number(b.textContent) !== answerOf(c)));
    expect(c.textContent).toContain("Not quite");
    expect(c.textContent).toContain('3 × 4 = 12');
    expect(choiceButtons(c)).toHaveLength(0); // can't answer again
    expect(c.querySelector('[role="img"][aria-label="3 rows of 4 = 12"]')).not.toBeNull();
    click(button(c, /Next/));
    // Get the second one right.
    vi.useFakeTimers();
    click(choiceButtons(c).find((b) => Number(b.textContent) === answerOf(c)));
    act(() => vi.advanceTimersByTime(1200));
    // Retry pass (not scored): get 3×4 right.
    expect(c.textContent).toContain('One more try');
    click(choiceButtons(c).find((b) => Number(b.textContent) === answerOf(c)));
    act(() => vi.advanceTimersByTime(1200));
    expect(onFinish.mock.calls[0][0]).toMatchObject({ kind: 'quiz', total: 2, correct: 1, missed: ['3x4'] });
    // Mastery counted the first answers only.
    expect(latest.facts['3x4']).toMatchObject({ wrong: 1, correct: 0 });
  });
});

describe('relaxed timer', () => {
  it('is off by default: no countdown', () => {
    view = render(<Quiz ids={['8x8']} />);
    expect(view.container.querySelector('[aria-label$="seconds left"]')).toBeNull();
  });

  it(`when on, a gentle ${RELAXED_TIMER_SECONDS}s cue; running out is treated as "not yet" with the same kind reveal`, () => {
    vi.useFakeTimers();
    view = render(<Quiz ids={['8x8', '2x2']} init={{ relaxedTimer: true }} />);
    const c = view.container;
    expect(c.querySelector(`[aria-label="${RELAXED_TIMER_SECONDS} seconds left"]`)).not.toBeNull();
    expect(RELAXED_TIMER_SECONDS).toBeGreaterThanOrEqual(20);
    for (let i = 0; i < RELAXED_TIMER_SECONDS; i++) act(() => vi.advanceTimersByTime(1000));
    expect(c.textContent).toContain("Time's up, and that's okay! 8 × 8 = 64");
    expect(c.querySelector('[role="img"][aria-label="8 rows of 8 = 64"]')).not.toBeNull();
    expect(latest.facts['8x8']).toMatchObject({ wrong: 1 });
    // No timer during the not-scored retry pass.
    click(button(c, /Next/));
    for (const d of '4') click(button(c, d));
    click(button(c, 'Check answer'));
    act(() => vi.advanceTimersByTime(1200));
    expect(c.textContent).toContain('One more try');
    expect(c.querySelector('[aria-label$="seconds left"]')).toBeNull();
  });
});

describe('quiz setup', () => {
  it('offers 10 / 20 / All, number pad (default) or pick from 4, and the relaxed timer (off)', () => {
    function Setup() {
      const [m, setM] = useState(emptyMathData());
      latest = m;
      return <MathSetupScreen mode="quiz" math={m} updateMath={(fn) => setM((x) => fn(x))} onHome={() => {}} onStart={() => {}} />;
    }
    view = render(<Setup />);
    const c = view.container;
    expect(button(c, '10 questions')!.getAttribute('aria-pressed')).toBe('true');
    expect(button(c, 'Number pad')!.getAttribute('aria-pressed')).toBe('true');
    click(button(c, '20 questions'));
    click(button(c, 'All questions'));
    expect(latest.quizLength).toBe('all');
    click(button(c, 'Pick from 4'));
    expect(latest.quizAnswerMode).toBe('choices');
    const timer = [...c.querySelectorAll<HTMLButtonElement>('button[role="switch"]')].find((b) => b.textContent!.includes('Relaxed timer'))!;
    expect(timer.getAttribute('aria-checked')).toBe('false');
  });
});

describe('quiz results', () => {
  const s = (correct: number, total: number, missed: string[] = []): RoundSummary => ({ kind: 'quiz', total, correct, missed, stillLearning: missed });

  it('big score, kind words even for a low score, missed facts with answers, and the buttons', () => {
    const onRetry = vi.fn();
    view = render(<MathResultsScreen summary={s(4, 10, ['7x8', '6x9'])} math={emptyMathData()} onRetryMissed={onRetry} onPracticeTables={() => {}} onFacts={() => {}} onHome={() => {}} />);
    const c = view.container;
    expect(c.querySelector('h1')!.textContent).toBe('4/10');
    expect(c.textContent).toContain('Great effort');
    expect(c.textContent).not.toMatch(/fail|wrong|bad/i);
    expect(c.textContent).toContain('7 × 8 = 56');
    expect(c.textContent).toContain('6 × 9 = 54');
    for (const b of [/Retry missed/, /Practice these tables/, /My Facts/, /Home/]) expect(button(c, b), String(b)).toBeDefined();
    click(button(c, /Retry missed/));
    expect(onRetry).toHaveBeenCalledWith(['7x8', '6x9']);
  });

  it('shows "New best" or the best so far', () => {
    const math = { ...emptyMathData(), bestQuizzes: { '10|keypad': { correct: 9, total: 10 } } };
    view = render(<MathResultsScreen summary={s(9, 10)} newBest math={math} onRetryMissed={() => {}} onPracticeTables={() => {}} onFacts={() => {}} onHome={() => {}} />);
    expect(view.container.textContent).toContain('New best score!');
    view.unmount();
    view = render(<MathResultsScreen summary={s(7, 10, ['2x2'])} math={math} onRetryMissed={() => {}} onPracticeTables={() => {}} onFacts={() => {}} onHome={() => {}} />);
    expect(view.container.textContent).toContain('Best: 9/10');
  });

  it('messages are encouraging at every score', () => {
    for (let k = 0; k <= 10; k++) expect(quizMessage(k, 10)).toMatch(/Amazing|Awesome|Great effort/);
  });
});

describe('whole app: a math quiz saves its best score in the math key only', () => {
  it('Home → Math → Quiz → finish → results; best saved; geography save untouched', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: {}, explored: ['OH'], streak: { current: 0, best: 0, lastDay: null }, totalStars: 5, roundsPlayed: 1, settings: {}, bestTests: { find: null, name: null } }));
    view = render(<App />);
    const c = view.container;
    const geoBefore = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!).totalStars;
    click(button(c, 'Math'));
    expect(JSON.parse(localStorage.getItem(MATH_STORAGE_KEY)!).subject).toBe('math');
    click(button(c, 'Multiplication Quiz'));
    for (let i = 0; i < 100 && !button(c, 'Pick from 4'); i++) await act(() => new Promise((r) => setTimeout(r, 20)));
    click(button(c, '2 times table'));
    click(button(c, 'Pick from 4'));
    click(button(c, /^Start quiz/));
    for (let i = 0; i < 100 && !c.querySelector('[data-testid="math-fact"]'); i++) await act(() => new Promise((r) => setTimeout(r, 20)));
    // Miss every question (no waiting), then the retry pass.
    for (let i = 0; i < 40 && c.querySelector('[data-testid="math-fact"]'); i++) {
      click(choiceButtons(c).find((b) => Number(b.textContent) !== answerOf(c)));
      click(button(c, /Next/));
    }
    for (let i = 0; i < 100 && !c.querySelector('h1'); i++) await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(c.querySelector('h1')!.textContent).toBe('0/10');
    expect(c.textContent).toContain('Great effort');
    const saved = JSON.parse(localStorage.getItem(MATH_STORAGE_KEY)!);
    expect(saved.bestQuizzes['10|choices']).toEqual({ correct: 0, total: 10 });
    expect(Object.keys(saved.facts)).toHaveLength(10);
    expect(geoBefore()).toBe(5);
    // Home goes back to the Math home.
    click(button(c, /🏠 Home/));
    expect(c.textContent).toContain('Multiplication Flashcards');
    expect(c.textContent).toContain('Best 10: 0/10');
  });
});
