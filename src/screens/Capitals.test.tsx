// @vitest-environment jsdom
import { act, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { button, click, render, type Rendered } from '../test/render';
import { LayerGameScreen } from './LayerGameScreen';
import { LayerSetupScreen } from './LayerSetupScreen';
import { LayerResultsScreen } from './LayerResultsScreen';
import { LayerProgressScreen } from './LayerProgressScreen';
import { CapitalsLearnScreen } from './CapitalsLearnScreen';
import { HomeScreen } from './HomeScreen';
import { emptyLayerProgress, type AnyLayer, type LayerProgress } from '../lib/layerProgress';
import { DEFAULT_SETTINGS, emptyData } from '../lib/storage';
import type { QuizMode, RoundSummary } from '../lib/quiz';
import { STATE_CAPITALS } from '../data/stateCapitals';
import { STATES } from '../data/states';
import { COUNTRIES } from '../data/world';

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
});
const header = (c: Element) => c.querySelector('header')!.textContent ?? '';
const svgText = (c: Element) => [...c.querySelectorAll('svg text')].map((t) => t.textContent).join(' | ');

let store: LayerProgress = emptyLayerProgress();
function Game({ layer, mode, scope = 'all', test = false }: { layer: AnyLayer; mode: QuizMode; scope?: string; test?: boolean }) {
  const [p, setP] = useState(emptyLayerProgress());
  store = p;
  return (
    <LayerGameScreen layer={layer} game="capitals" mode={mode} scopeId={scope} practice={false} test={test} settings={DEFAULT_SETTINGS} progress={p} updateProgress={(fn) => setP((x) => fn(x))} onHome={() => {}} onFinish={() => {}} />
  );
}

const capitalSet = new Set(Object.values(STATE_CAPITALS));

describe('US "What\'s the capital?" quiz', () => {
  it('asks the capital of a state with 4 capital buttons; a right answer puts the capital dot on the map', () => {
    view = render(<Game layer="usa" mode="name" />);
    const c = view.container;
    const stateName = header(c).match(/What's the capital of (.+?)\?/)![1];
    const abbr = STATES.find((s) => s.name === stateName)!.abbr;
    const options = [...c.querySelectorAll('button')].filter((b) => capitalSet.has(b.textContent!));
    expect(options).toHaveLength(4);
    for (const o of options) expect(o.className).toContain('min-h-20');
    expect(c.querySelector('[data-capital]')).toBeNull(); // no dot before answering
    click(options.find((o) => o.textContent === STATE_CAPITALS[abbr]));
    expect(header(c)).toContain(`${STATE_CAPITALS[abbr]} is the capital of ${stateName}!`);
    expect(c.querySelector(`[data-capital="${STATE_CAPITALS[abbr]}"]`)).not.toBeNull();
    // Mastery goes to the capitals store.
    expect(store.records[abbr]?.correct).toBe(1);
  });

  it('a wrong pick still teaches a real fact', () => {
    view = render(<Game layer="usa" mode="name" />);
    const c = view.container;
    const stateName = header(c).match(/What's the capital of (.+?)\?/)![1];
    const right = STATE_CAPITALS[STATES.find((s) => s.name === stateName)!.abbr];
    const wrong = [...c.querySelectorAll('button')].find((b) => capitalSet.has(b.textContent!) && b.textContent !== right)!;
    const wrongState = STATES.find((s) => STATE_CAPITALS[s.abbr] === wrong.textContent)!;
    click(wrong);
    expect(header(c)).toContain(`${wrong.textContent} is the capital of ${wrongState.name}.`);
  });
});

describe('World "Find the place" capitals quiz', () => {
  it('names a capital and asks her to tap the country; the map never names the answer; hint 1 is the region', async () => {
    view = render(<Game layer="world" mode="find" scope="s:western-europe" />);
    const c = view.container;
    for (let i = 0; i < 100 && !c.querySelector('path[data-id="FR"]'); i++) await act(() => new Promise((r) => setTimeout(r, 20)));
    const capital = header(c).match(/Which country has the capital (.+?)\?/)![1];
    const country = COUNTRIES.find((x) => x.capital === capital)!;
    expect(country.subregion).toBe('western-europe');
    expect(svgText(c)).not.toContain(country.name);
    click(button(c, 'Hint (2 left)'));
    expect(header(c)).toContain('Western Europe');
    expect(c.textContent).not.toContain('Shape hint'); // the shape comes second for capitals
    click(button(c, 'Hint (1 left)'));
    expect(c.textContent).toContain('Shape hint');
  });
});

describe('capitals test misses', () => {
  const summary: RoundSummary = {
    practice: false, test: true, completed: false, total: 1, firstTry: 0, accuracy: 0, stars: 1,
    missed: ['OH'], misses: [{ state: 'OH', picked: 'MI' }], usedHints: false, bestCombo: 0, newlyMastered: [],
    answers: [{ state: 'OH', picked: 'MI', correct: false }],
  };

  it('"What\'s the capital?" shows the capital she picked vs the right capital', () => {
    view = render(<LayerResultsScreen layer="usa" game="capitals" mode="name" scopeId="all" summary={summary} progress={emptyLayerProgress()} onHome={() => {}} onAgain={() => {}} onOther={() => {}} />);
    expect(view.container.textContent).toContain("Ohio — you picked Lansing · it's Columbus");
  });

  it('"Find the place" shows the place she tapped vs the right place', () => {
    view = render(<LayerResultsScreen layer="usa" game="capitals" mode="find" scopeId="all" summary={summary} progress={emptyLayerProgress()} onHome={() => {}} onAgain={() => {}} onOther={() => {}} />);
    expect(view.container.textContent).toContain("Columbus — you tapped Michigan · it's Ohio");
  });
});

describe('Capitals Learn', () => {
  it('USA: tapping a state shows its capital, a capital dot and the note', () => {
    view = render(<CapitalsLearnScreen layer="usa" settings={DEFAULT_SETTINGS} onHome={() => {}} />);
    const c = view.container;
    click(button(c, 'New York'));
    expect(header(c)).toContain('Albany');
    expect(header(c)).toContain('Capital of New York');
    expect(c.querySelector('[data-capital="Albany"]')).not.toBeNull();
    expect(c.textContent).toContain('not New York City');
  });

  it('World: South Africa shows Pretoria with a note about Cape Town and Bloemfontein', async () => {
    view = render(<CapitalsLearnScreen layer="world" settings={DEFAULT_SETTINGS} onHome={() => {}} />);
    const c = view.container;
    for (let i = 0; i < 100 && !c.querySelector('path[data-id="ZA"]'); i++) await act(() => new Promise((r) => setTimeout(r, 20)));
    click(button(c, '🦁 Africa'));
    click(button(c, 'South Africa'));
    expect(header(c)).toContain('Pretoria');
    expect(c.textContent).toContain('Cape Town');
    expect(c.textContent).toContain('Bloemfontein');
    expect(c.querySelector('[data-capital="Pretoria"]')).not.toBeNull();
  });
});

describe('Home capitals cards', () => {
  it('every tab has its own Capitals card with Learn, Quiz, Test and My Capitals', () => {
    for (const [layer, title] of [
      ['usa', 'State Capitals'],
      ['canada', 'Province & Territory Capitals'],
      ['world', 'Country Capitals'],
    ] as const) {
      const go = vi.fn();
      view = render(<HomeScreen data={emptyData()} go={go} layer={layer} />);
      const c = view.container;
      click(button(c, `${title}: Learn`));
      expect(go).toHaveBeenLastCalledWith({ name: 'capitals-learn', layer });
      click(button(c, `${title}: Quiz`));
      expect(go).toHaveBeenLastCalledWith({ name: 'layer-setup', layer, game: 'capitals', kind: 'name' });
      click(button(c, `${title}: Test`));
      expect(go).toHaveBeenLastCalledWith({ name: 'layer-setup', layer, game: 'capitals', kind: 'test' });
      click(button(c, `${title}: My Capitals`));
      expect(go).toHaveBeenLastCalledWith({ name: 'layer-progress', layer, game: 'capitals' });
      expect(button(c, `${title}: Learn`)!.className).toContain('min-h-20');
      view.unmount();
      view = null;
    }
  });

  it('the US home still has all its place games, and capitals mastery is shown separately', () => {
    const m = { streak: 3, correct: 3, wrong: 0, lastSeen: 0 };
    view = render(<HomeScreen data={emptyData()} go={vi.fn()} capitalsProgress={{ ...emptyLayerProgress(), records: { OH: m } }} />);
    const c = view.container;
    expect(button(c, /^📝Test/)).toBeDefined();
    expect(button(c, 'Find It: Northeast (suggested)')).toBeDefined();
    expect(c.querySelector('section[aria-label="State Capitals"]')!.textContent).toContain('1 / 50');
    expect(c.textContent).toContain('🏆 0 / 50'); // place mastery is still 0
  });
});

describe('Capitals setup and My Capitals', () => {
  it('setup offers both question types, Quiz/Practice, and US regions', () => {
    const onStart = vi.fn();
    view = render(<LayerSetupScreen layer="usa" game="capitals" kind="name" progress={emptyLayerProgress()} updateProgress={() => {}} onHome={() => {}} onStart={onStart} />);
    const c = view.container;
    expect(button(c, /What's the capital\?/)!.getAttribute('aria-pressed')).toBe('true');
    click(button(c, /Find the place/));
    click(button(c, 'Start: West'));
    expect(onStart).toHaveBeenLastCalledWith('find', 'r:west', false, false);
    click(button(c, 'Start: All 50'));
    expect(onStart).toHaveBeenLastCalledWith('find', 'all', false, false);
  });

  it('capitals test setup starts a capitals test', () => {
    const onStart = vi.fn();
    view = render(<LayerSetupScreen layer="canada" game="capitals" kind="test" progress={emptyLayerProgress()} updateProgress={() => {}} onHome={() => {}} onStart={onStart} />);
    click(button(view.container, 'Start: All 13'));
    expect(onStart).toHaveBeenLastCalledWith('name', 'all', false, true);
  });

  it('My Capitals lists each place with its capital', () => {
    view = render(<LayerProgressScreen layer="canada" game="capitals" progress={emptyLayerProgress()} updateProgress={() => {}} onHome={() => {}} />);
    expect(view.container.textContent).toContain('Prince Edward Island · Charlottetown');
    expect(view.container.textContent).toContain('My Capitals');
    expect(view.container.textContent).toContain('reset Canada capitals progress');
  });
});
