// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { button, click, render, type Rendered } from '../test/render';
import { MathFactsScreen } from './MathFactsScreen';
import { SettingsScreen } from './SettingsScreen';
import { emptyMathData, type MathData } from '../lib/mathStorage';
import { emptyData } from '../lib/storage';

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
});

const m3 = { streak: 3, correct: 3, wrong: 0, lastSeen: 0 };
const m1 = { streak: 1, correct: 1, wrong: 1, lastSeen: 0 };

describe('My Facts grid', () => {
  it('12 × 12 squares with counts, a legend, and symbols (not just color)', () => {
    const math = { ...emptyMathData(), facts: { '6x7': m3, '3x4': m1 } };
    view = render(<MathFactsScreen math={math} updateMath={() => {}} onHome={() => {}} onPractice={() => {}} />);
    const c = view.container;
    const cells = c.querySelectorAll('table button');
    expect(cells).toHaveLength(144);
    expect(c.textContent).toContain('Mastered 1 of 144');
    expect(c.textContent).toContain('Learning: 1');
    expect(c.textContent).toContain('New: 142');
    const sixSeven = button(c, '6 times 7 equals 42, Mastered')!;
    expect(sixSeven.textContent).toBe('★');
    expect(sixSeven.className).toContain('emerald');
    expect(button(c, '3 times 4 equals 12, Learning')!.textContent).toBe('●');
    expect(button(c, '1 times 1 equals 1, New')).toBeDefined();
    for (const b of cells) expect((b as HTMLElement).className).toContain('h-12');
  });

  it('tapping a square shows the fact, the answer and a small dot picture', () => {
    view = render(<MathFactsScreen math={emptyMathData()} updateMath={() => {}} onHome={() => {}} onPractice={() => {}} />);
    const c = view.container;
    click(button(c, '7 times 8 equals 56, New'));
    expect(c.textContent).toContain('7 × 8 = 56');
    expect(c.querySelector('[role="img"][aria-label="7 rows of 8 = 56"]')).not.toBeNull();
    // A pinned bar keeps the answer on screen even when the grid is taller than the phone.
    const bar = c.querySelector('[data-testid="fact-bar"]')!;
    expect(bar.textContent).toContain('7 × 8 = 56');
    expect(bar.parentElement!.className).toContain('sticky');
  });

  it('with zeros on, the grid is 0–12 (169 facts)', () => {
    view = render(<MathFactsScreen math={{ ...emptyMathData(), includeZero: true }} updateMath={() => {}} onHome={() => {}} onPractice={() => {}} />);
    expect(view.container.querySelectorAll('table button')).toHaveLength(169);
    expect(view.container.textContent).toContain('Mastered 0 of 169');
  });

  it('has a Practice button', () => {
    const onPractice = vi.fn();
    view = render(<MathFactsScreen math={emptyMathData()} updateMath={() => {}} onHome={() => {}} onPractice={onPractice} />);
    click(button(view.container, /Practice/));
    expect(onPractice).toHaveBeenCalled();
  });
});

describe('Settings: Math section', () => {
  it('has Include 0s and Relaxed timer (both off), saved in the math store; geography toggles unchanged', () => {
    let saved: MathData = emptyMathData();
    function Harness() {
      const [m, setM] = useState(emptyMathData());
      saved = m;
      return <SettingsScreen data={emptyData()} update={() => {}} onHome={() => {}} math={m} updateMath={(fn) => setM((x) => fn(x))} />;
    }
    view = render(<Harness />);
    const c = view.container;
    const section = c.querySelector('[aria-label="Math settings"]')!;
    const switches = [...section.querySelectorAll<HTMLButtonElement>('button[role="switch"]')];
    expect(switches.map((s) => s.textContent!.match(/Include 0s|Relaxed timer/)![0])).toEqual(['Include 0s', 'Relaxed timer']);
    for (const s of switches) expect(s.getAttribute('aria-checked')).toBe('false');
    click(switches[0]);
    click(switches[1]);
    expect(saved.includeZero).toBe(true);
    expect(saved.relaxedTimer).toBe(true);
    // The geography toggles are still there.
    expect(c.textContent).toContain('Region colors');
    expect(c.textContent).toContain('Sound effects');
  });

  it('without math props (older callers) there is no math section', () => {
    view = render(<SettingsScreen data={emptyData()} update={() => {}} onHome={() => {}} />);
    expect(view.container.querySelector('[aria-label="Math settings"]')).toBeNull();
  });
});
