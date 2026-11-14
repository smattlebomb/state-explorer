// @vitest-environment jsdom
import { act, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { button, click, render, type Rendered } from '../test/render';
import { LayerSetupScreen } from './LayerSetupScreen';
import { LayerGameScreen } from './LayerGameScreen';
import { LayerProgressScreen } from './LayerProgressScreen';
import { emptyLayerProgress, type GameLayer, type LayerProgress } from '../lib/layerProgress';
import { DEFAULT_SETTINGS } from '../lib/storage';
import type { QuizMode, RoundSummary } from '../lib/quiz';
import { PROVINCES } from '../data/canada';
import { COUNTRY_BY_ID } from '../data/world';

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
  vi.useRealTimers();
});

const header = (c: Element) => c.querySelector('header')!.textContent ?? '';

describe('World / Canada setup', () => {
  it('World offers All 195, the 6 continents and their sub-regions, and tapping one starts it', () => {
    const onStart = vi.fn();
    view = render(<LayerSetupScreen layer="world" kind="find" progress={emptyLayerProgress()} updateProgress={() => {}} onHome={() => {}} onStart={onStart} />);
    const c = view.container;
    const starts = [...c.querySelectorAll('button')].filter((b) => b.getAttribute('aria-label')?.startsWith('Start: '));
    // 22 sub-regions, minus South America (same as its continent, so shown once).
    expect(starts).toHaveLength(1 + 6 + 21);
    expect(starts.filter((b) => b.getAttribute('aria-label') === 'Start: South America')).toHaveLength(1);
    for (const b of starts) expect(b.className).toMatch(/min-h-(16|24)/);
    click(button(c, 'Start: Western Europe'));
    expect(onStart).toHaveBeenLastCalledWith('find', 's:western-europe', false, false);
    click(button(c, 'Start: All 195 countries'));
    expect(onStart).toHaveBeenLastCalledWith('find', 'all', false, false);
  });

  it('Quiz / Practice is remembered in the layer store (not the US settings)', () => {
    let saved = emptyLayerProgress();
    view = render(<LayerSetupScreen layer="world" kind="name" progress={saved} updateProgress={(fn) => (saved = fn(saved))} onHome={() => {}} onStart={() => {}} />);
    click(button(view.container, /^🎈Practice/));
    expect(saved.practice).toBe(true);
  });

  it('Test setup: pick Find It or Name It, see best scores per scope, then a scope starts a test', () => {
    const onStart = vi.fn();
    const progress = { ...emptyLayerProgress(), bestTests: { 'c:europe|name': { correct: 40, total: 44 } } };
    view = render(<LayerSetupScreen layer="world" kind="test" progress={progress} updateProgress={() => {}} onHome={() => {}} onStart={onStart} />);
    const c = view.container;
    click(button(c, /^🔤Name It Test/));
    expect(button(c, 'Start: Europe')!.textContent).toContain('best 40/44');
    click(button(c, 'Start: Europe'));
    expect(onStart).toHaveBeenLastCalledWith('name', 'c:europe', false, true);
  });

  it('Canada has a single All 13 scope', () => {
    const onStart = vi.fn();
    view = render(<LayerSetupScreen layer="canada" kind="find" progress={emptyLayerProgress()} updateProgress={() => {}} onHome={() => {}} onStart={onStart} />);
    const starts = [...view.container.querySelectorAll('button')].filter((b) => b.getAttribute('aria-label')?.startsWith('Start: '));
    expect(starts.map((b) => b.getAttribute('aria-label'))).toEqual(['Start: All 13']);
    click(starts[0]);
    expect(onStart).toHaveBeenCalledWith('find', 'all', false, false);
  });
});

/** Holds the layer store like App does. */
let store: LayerProgress = emptyLayerProgress();
function Game({ layer, mode, scope, practice = false, test = false, onFinish }: { layer: GameLayer; mode: QuizMode; scope: string; practice?: boolean; test?: boolean; onFinish: (s: RoundSummary) => void }) {
  const [p, setP] = useState(emptyLayerProgress());
  store = p;
  return (
    <LayerGameScreen layer={layer} mode={mode} scopeId={scope} practice={practice} test={test} settings={DEFAULT_SETTINGS} progress={p} updateProgress={(fn) => setP((x) => fn(x))} onHome={() => {}} onFinish={onFinish} />
  );
}

const provinceNames = new Set(PROVINCES.map((p) => p.name));
const optionButtons = (c: Element) => [...c.querySelectorAll('button')].filter((b) => provinceNames.has(b.textContent!.replace('✅ ', '')));

describe('Canada Name It test', () => {
  it('asks all 13 once, says only "Answer recorded", then reports and saves the score', () => {
    vi.useFakeTimers();
    const onFinish = vi.fn();
    view = render(<Game layer="canada" mode="name" scope="all" test onFinish={onFinish} />);
    const c = view.container;
    expect(header(c)).toContain('1 / 13');
    expect(button(c, /^Hint/)).toBeUndefined(); // no hints in a test
    for (let i = 0; i < 13; i++) {
      const opts = optionButtons(c);
      expect(opts).toHaveLength(4);
      click(opts[0]);
      expect(header(c)).toContain('Answer recorded');
      expect(c.textContent).not.toContain('✅'); // no right/wrong reveal mid-test
      act(() => vi.advanceTimersByTime(800));
    }
    expect(onFinish).toHaveBeenCalledTimes(1);
    const summary: RoundSummary = onFinish.mock.calls[0][0];
    expect(summary.test).toBe(true);
    expect(summary.completed).toBe(true);
    expect(summary.total).toBe(13);
    expect(store.bestTests['all|name']).toEqual({ correct: summary.firstTry, total: 13 });
    // A test never changes mastery or stars.
    expect(store.records).toEqual({});
    expect(store.totalStars).toBe(0);
  });
});

describe('World Find It', () => {
  it('asks for a country in the scope, with two hints: the shape, then the region', async () => {
    view = render(<Game layer="world" mode="find" scope="s:western-europe" onFinish={() => {}} />);
    const c = view.container;
    for (let i = 0; i < 100 && !c.querySelector('path[data-id="FR"]'); i++) await act(() => new Promise((r) => setTimeout(r, 20)));
    const prompt = header(c).match(/Tap (.+?)!/)![1];
    const id = [...COUNTRY_BY_ID.values()].find((x) => x.name === prompt)!;
    expect(id.subregion).toBe('western-europe');
    click(button(c, 'Hint (2 left)'));
    expect(c.textContent).toContain('Shape hint');
    click(button(c, 'Hint (1 left)'));
    expect(header(c)).toContain('Western Europe');
    // Tiny countries keep their tap dots during the game.
    expect(c.querySelector('circle[data-marker="MC"]')).not.toBeNull();
  });
});

describe('Canada Practice', () => {
  it('a wrong pick gets a gentle "try another", and "Show me" appears', async () => {
    view = render(<Game layer="canada" mode="name" scope="all" practice onFinish={() => {}} />);
    const c = view.container;
    for (let i = 0; i < 100 && !c.querySelector('path[data-id="ON"]'); i++) await act(() => new Promise((r) => setTimeout(r, 20)));
    // The glowing (orange) province is the answer; pick a different one.
    const glowing = [...c.querySelectorAll<SVGPathElement>('path[data-id]')].find((p) => /fb923c|251, 146, 60/.test(p.getAttribute('style') ?? ''))!;
    const answer = PROVINCES.find((p) => p.abbr === glowing.getAttribute('data-id'))!.name;
    // The glowing answer's name must not be printed on the map before she answers.
    expect([...c.querySelectorAll('svg text')].map((t) => t.textContent).join(' ')).not.toContain(answer);
    const wrong = optionButtons(c).find((b) => b.textContent !== answer)!;
    click(wrong);
    expect(header(c)).toContain('Try another one');
    expect(button(c, /Show me/)).toBeDefined();
    expect(c.textContent).toContain('🎈 Practice');
    expect(wrong.disabled).toBe(true); // can't burn a try on the same wrong pick
  });
});

describe('World Name It', () => {
  it("doesn't give the answer away on the map", async () => {
    view = render(<Game layer="world" mode="name" scope="s:southern-europe" onFinish={() => {}} />);
    const c = view.container;
    for (let i = 0; i < 100 && !c.querySelector('path[data-id="IT"]'); i++) await act(() => new Promise((r) => setTimeout(r, 20)));
    const glowing = [...c.querySelectorAll<SVGElement>('path[data-id], circle[data-marker]')].find((p) => /fb923c|251, 146, 60/.test((p.getAttribute('style') ?? '') + (p.getAttribute('fill') ?? '')))!;
    const id = glowing.getAttribute('data-id') ?? glowing.getAttribute('data-marker')!;
    const name = COUNTRY_BY_ID.get(id)!.name;
    expect([...c.querySelectorAll('svg text')].map((t) => t.textContent).join(' ')).not.toContain(name);
  });
});

describe('World My Map', () => {
  it("shows the layer's own counts and test bests", () => {
    const m = { streak: 3, correct: 3, wrong: 0, lastSeen: 0 };
    const progress = { ...emptyLayerProgress(), records: { FR: m, JP: m }, totalStars: 4, bestTests: { 'all|find': { correct: 150, total: 195 } } };
    view = render(<LayerProgressScreen layer="world" progress={progress} updateProgress={() => {}} onHome={() => {}} />);
    const c = view.container;
    expect(c.textContent).toContain('Mastered: 2');
    expect(c.textContent).toContain('New: 193');
    expect(c.textContent).toContain('All 195 countries 150/195');
    expect(c.textContent).toContain('reset World progress');
  });
});
