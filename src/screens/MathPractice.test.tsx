// @vitest-environment jsdom
import { act, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { button, click, render, type Rendered } from '../test/render';
import { MathPlayScreen } from './MathPlayScreen';
import { MathSetupScreen } from './MathSetupScreen';
import { emptyMathData, type MathData } from '../lib/mathStorage';
import type { RoundSummary } from '../lib/mathRound';

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
  vi.useRealTimers();
});

let latest: MathData = emptyMathData();
function Play({ ids, mode, onFinish = () => {}, kind = 'practice', init = {} }: { ids: string[]; mode: 'flip' | 'keypad' | 'choices'; onFinish?: (s: RoundSummary) => void; kind?: 'practice' | 'quiz'; init?: Partial<MathData> }) {
  const [m, setM] = useState<MathData>({ ...emptyMathData(), practiceMode: mode === 'choices' ? 'keypad' : mode, quizAnswerMode: mode === 'flip' ? 'keypad' : mode, ...init });
  latest = m;
  return <MathPlayScreen kind={kind} ids={ids} math={m} updateMath={(fn) => setM((x) => fn(x))} onHome={() => {}} onFinish={onFinish} />;
}

const fact = (c: Element) => c.querySelector('[data-testid="math-fact"]')!.textContent;
const type = (c: Element, digits: string) => {
  for (const d of digits) click(button(c, d));
};

describe('practice with the number pad', () => {
  it('shows a big a × b, progress, and a 64px+ number pad with labelled keys', () => {
    view = render(<Play ids={['3x4', '6x7']} mode="keypad" />);
    const c = view.container;
    expect(fact(c)).toBe('3 × 4');
    expect(c.textContent).toContain('1 of 2');
    for (const k of ['0', '1', '9', 'Delete', 'Clear', 'Check answer']) {
      const b = button(c, k)!;
      expect(b, k).toBeDefined();
      expect(b.className).toMatch(/min-h-(16|20)/);
    }
  });

  it('a miss: gentle words, the answer, a dot picture, then Next; it comes back once at the end', () => {
    vi.useFakeTimers();
    const onFinish = vi.fn();
    view = render(<Play ids={['3x4', '6x7']} mode="keypad" onFinish={onFinish} />);
    const c = view.container;
    type(c, '13');
    click(button(c, 'Check answer'));
    expect(c.textContent).toContain('Not quite: you typed 13. 3 × 4 = 12');
    expect(c.textContent).not.toMatch(/wrong|incorrect/i);
    expect(c.querySelector('[data-testid="math-answer"]')!.textContent).toContain('12');
    expect(c.querySelector('[role="img"][aria-label="3 rows of 4 = 12"]')).not.toBeNull();
    expect(c.textContent).toContain("We'll see this one again at the end");
    click(button(c, /Next/));

    expect(fact(c)).toBe('6 × 7');
    type(c, '42');
    click(button(c, 'Check answer'));
    expect(c.textContent).toMatch(/Nice!|You got it!|Great job!|Yes!|Super!|Well done!/);
    act(() => vi.advanceTimersByTime(1200)); // moves on by itself

    // Retry pass: 3 × 4 once more.
    expect(fact(c)).toBe('3 × 4');
    expect(c.textContent).toContain('One more try · 1 of 1');
    type(c, '12');
    click(button(c, 'Check answer'));
    act(() => vi.advanceTimersByTime(1200));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0][0]).toEqual({ kind: 'practice', total: 2, correct: 1, missed: ['3x4'], stillLearning: [] });
    // Mastery: only first answers count (3×4 missed once, 6×7 right once); the retry didn't count.
    expect(latest.facts['3x4']).toMatchObject({ streak: 0, wrong: 1, correct: 0 });
    expect(latest.facts['6x7']).toMatchObject({ streak: 1, correct: 1 });
  });

  it('Delete and Clear edit the answer; Check needs an answer', () => {
    view = render(<Play ids={['2x2']} mode="keypad" />);
    const c = view.container;
    expect(button(c, 'Check answer')!.disabled).toBe(true);
    type(c, '45');
    click(button(c, 'Delete'));
    expect(c.textContent).toContain('= 4');
    click(button(c, 'Clear'));
    expect(button(c, 'Check answer')!.disabled).toBe(true);
  });

  it('a hardware keyboard works too', () => {
    view = render(<Play ids={['2x3']} mode="keypad" />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '6' }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
    expect(latest.facts['2x3']).toMatchObject({ correct: 1 });
  });
});

describe('practice with flip cards', () => {
  it('tap the card to see the answer, then "I got it" or "Not yet" (which shows the dot picture)', () => {
    view = render(<Play ids={['5x6', '7x8']} mode="flip" />);
    const c = view.container;
    expect(c.querySelector('[data-testid="math-answer"]')).toBeNull();
    expect(button(c, /I got it/)).toBeUndefined();
    click(button(c, /5 times 6\. Tap to see the answer/));
    expect(c.querySelector('[data-testid="math-answer"]')!.textContent).toContain('30');
    click(button(c, /Not yet/));
    expect(c.textContent).toContain("That's okay! 5 × 6 = 30");
    expect(c.querySelector('[role="img"][aria-label="5 rows of 6 = 30"]')).not.toBeNull();
    expect(latest.facts['5x6']).toMatchObject({ wrong: 1 });
    click(button(c, /Next/));
    click(button(c, /Tap to see the answer/));
    click(button(c, /I got it/));
    expect(latest.facts['7x8']).toMatchObject({ correct: 1 });
  });
});

describe('dot picture for zeros', () => {
  it('a 0 fact explains instead of drawing nothing', () => {
    view = render(<Play ids={['0x7']} mode="flip" />);
    const c = view.container;
    click(button(c, /Tap to see the answer/));
    click(button(c, /Not yet/));
    expect(c.textContent).toContain('Anything times 0 is 0');
  });
});

describe('setup', () => {
  function Setup({ mode, onStart }: { mode: 'practice' | 'quiz'; onStart: (ids: string[]) => void }) {
    const [m, setM] = useState(emptyMathData());
    latest = m;
    return <MathSetupScreen mode={mode} math={m} updateMath={(fn) => setM((x) => fn(x))} onHome={() => {}} onStart={onStart} />;
  }

  it('table chips (1–12 + All) are big, multi-select, and All clears them', () => {
    view = render(<Setup mode="practice" onStart={() => {}} />);
    const c = view.container;
    const all = button(c, 'All tables')!;
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(c.textContent).toContain('All tables · 144 facts');
    click(button(c, '3 times table'));
    click(button(c, '4 times table'));
    expect(button(c, '3 times table')!.getAttribute('aria-pressed')).toBe('true');
    expect(all.getAttribute('aria-pressed')).toBe('false');
    expect(latest.tables).toEqual([3, 4]);
    expect(c.textContent).toContain('3, 4 · 44 facts');
    for (let t = 1; t <= 12; t++) expect(button(c, `${t} times table`)!.className).toContain('min-h-16');
    click(all);
    expect(latest.tables).toEqual([]);
  });

  it('Include 0s is off by default and adds the zero facts', () => {
    view = render(<Setup mode="practice" onStart={() => {}} />);
    const c = view.container;
    const zeros = c.querySelector<HTMLButtonElement>('button[role="switch"]')!;
    expect(zeros.textContent).toContain('Include 0s');
    expect(zeros.getAttribute('aria-checked')).toBe('false');
    click(zeros);
    expect(latest.includeZero).toBe(true);
    expect(c.textContent).toContain('169 facts');
  });

  it('both answer styles are offered, and Start builds a round from the chosen tables', () => {
    const onStart = vi.fn();
    view = render(<Setup mode="practice" onStart={onStart} />);
    const c = view.container;
    click(button(c, 'Flip the card'));
    expect(latest.practiceMode).toBe('flip');
    click(button(c, 'Number pad'));
    expect(latest.practiceMode).toBe('keypad');
    click(button(c, '7 times table'));
    click(button(c, /^Start/));
    const ids: string[] = onStart.mock.calls[0][0];
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
    expect(ids.every((id) => id.split('x').includes('7'))).toBe(true);
  });
});
