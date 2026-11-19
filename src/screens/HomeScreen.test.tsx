// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { emptyMathData, type Subject } from '../lib/mathStorage';
import { button, click, render, type Rendered } from '../test/render';
import { HomeScreen, findItIn } from './HomeScreen';
import { emptyData, withSetting, type SavedData } from '../lib/storage';
import { emptyLayerProgress } from '../lib/layerProgress';
import type { StateRecord } from '../lib/srs';

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
});

const mastered: StateRecord = { streak: 3, correct: 3, wrong: 0, lastSeen: 0 };

function setup(data: SavedData = emptyData()) {
  const go = vi.fn();
  view = render(<HomeScreen data={data} go={go} />);
  return { go, container: view.container };
}

describe('findItIn', () => {
  it('builds a Find It quiz screen for a region with the given flavor', () => {
    expect(findItIn('west', true, 7)).toEqual({ name: 'quiz', mode: 'find', region: 'west', practice: true, game: 7 });
    expect(findItIn('all', false, 7)).toEqual({ name: 'quiz', mode: 'find', region: 'all', practice: false, game: 7 });
  });
});

describe('Home "Practice next" card', () => {
  it('keeps the suggested region as the big default Find It button', () => {
    const { go, container } = setup();
    click(button(container, 'Find It: Northeast (suggested)'));
    expect(go).toHaveBeenCalledWith(expect.objectContaining({ name: 'quiz', mode: 'find', region: 'northeast', practice: false }));
  });

  it('shows a "Pick a different region" row with all 5 regions plus All 50, each with its mastered count', () => {
    const data = { ...emptyData(), records: { TX: mastered, OK: mastered } };
    const { container } = setup(data);
    expect(container.textContent).toContain('Or pick a different region');
    for (const label of ['Northeast', 'Southeast', 'Midwest', 'Southwest', 'West', 'All 50']) {
      expect(button(container, `Find It: ${label}`), label).toBeDefined();
    }
    expect(button(container, 'Find It: Southwest')!.textContent).toContain('🌵');
    expect(button(container, 'Find It: Southwest')!.textContent).toContain('2 / 4');
    expect(button(container, 'Find It: All 50')!.textContent).toContain('2 / 50');
  });

  it('each chip starts Find It for that region using the Quiz setting', () => {
    const { go, container } = setup();
    for (const [label, region] of [
      ['Midwest', 'midwest'],
      ['West', 'west'],
      ['All 50', 'all'],
    ] as const) {
      click(button(container, `Find It: ${label}`));
      expect(go).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'quiz', mode: 'find', region, practice: false }));
    }
  });

  it('chips use Practice when Practice is the current setting, and the card says so', () => {
    const { go, container } = setup(withSetting(emptyData(), 'practice', true));
    expect(container.textContent).toContain('🎈 Practice');
    click(button(container, 'Find It: Southeast'));
    expect(go).toHaveBeenLastCalledWith(expect.objectContaining({ region: 'southeast', practice: true }));
  });

  it('chips have region colors and are big enough to tap (min-h-20)', () => {
    const { container } = setup();
    const chip = button(container, 'Find It: Northeast')!;
    expect(chip.className).toContain('bg-[#0072b2]');
    expect(chip.className).toContain('min-h-20');
  });

  it('when everything is mastered, the default button is All 50', () => {
    const records = Object.fromEntries(
      ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'].map((s) => [s, mastered]),
    );
    const { go, container } = setup({ ...emptyData(), records });
    click(button(container, 'Find It: All 50 (suggested)'));
    expect(go).toHaveBeenLastCalledWith(expect.objectContaining({ region: 'all' }));
  });
});

describe('Home mode cards', () => {
  it('Find It and Name It still go to the Quiz/Practice + region choice screen, and say so', () => {
    const { go, container } = setup();
    const find = button(container, /^👆Find It/)!;
    const name = button(container, /^🔤Name It/)!;
    expect(find.textContent).toContain('Choose your states');
    expect(name.textContent).toContain('Choose your states');
    click(find);
    expect(go).toHaveBeenLastCalledWith({ name: 'setup', mode: 'find' });
    click(name);
    expect(go).toHaveBeenLastCalledWith({ name: 'setup', mode: 'name' });
  });
});

describe('Home Test card', () => {
  it('has a big Test card that goes to the test setup screen', () => {
    const { go, container } = setup();
    const btn = button(container, /^📝Test/)!;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('All 50 states');
    click(btn);
    expect(go).toHaveBeenLastCalledWith({ name: 'setup-test' });
  });

  it('shows saved best test scores on the card', () => {
    const data = { ...emptyData(), bestTests: { find: { correct: 42, total: 50 }, name: { correct: 30, total: 50 } } };
    const { container } = setup(data);
    expect(container.textContent).toContain('Find It 42/50');
    expect(container.textContent).toContain('Name It 30/50');
  });
});

describe('Home map switcher (USA / Canada / World)', () => {
  it('has three big layer buttons, with USA picked by default and all the US cards', () => {
    const { container } = setup();
    for (const label of ['USA map', 'Canada map', 'World map']) {
      const b = button(container, label)!;
      expect(b, label).toBeDefined();
      expect(b.className).toContain('min-h-20');
    }
    expect(button(container, 'USA map')!.getAttribute('aria-pressed')).toBe('true');
    expect(button(container, 'World map')!.getAttribute('aria-pressed')).toBe('false');
    expect(button(container, /^📝Test/)).toBeDefined();
    expect(button(container, 'Find It: Northeast (suggested)')).toBeDefined();
  });

  it('switching layer reports the choice', () => {
    const onLayer = vi.fn();
    view = render(<HomeScreen data={emptyData()} go={vi.fn()} onLayer={onLayer} />);
    click(button(view.container, 'Canada map'));
    expect(onLayer).toHaveBeenLastCalledWith('canada');
    click(button(view.container, 'World map'));
    expect(onLayer).toHaveBeenLastCalledWith('world');
  });

  it('the World home has its own big cards (Learn, Find It, Name It, Test, My Map) and no US cards', () => {
    const go = vi.fn();
    view = render(<HomeScreen data={emptyData()} go={go} layer="world" />);
    const c = view.container;
    expect(button(c, 'World map')!.getAttribute('aria-pressed')).toBe('true');
    expect(button(c, 'Find It: Northeast (suggested)')).toBeUndefined();
    expect(c.textContent).toContain('0 / 195');
    for (const [label, screen] of [
      ['World Learn', { name: 'world' }],
      ['World Find It', { name: 'layer-setup', layer: 'world', kind: 'find' }],
      ['World Name It', { name: 'layer-setup', layer: 'world', kind: 'name' }],
      ['World Test', { name: 'layer-setup', layer: 'world', kind: 'test' }],
      ['World My Map', { name: 'layer-progress', layer: 'world' }],
    ] as const) {
      const b = button(c, label)!;
      expect(b, label).toBeDefined();
      expect(b.className).toMatch(/min-h-(16|32)/);
      click(b);
      expect(go).toHaveBeenLastCalledWith(screen);
    }
  });

  it('the Canada home shows Canada progress (not US) and opens Canada games', () => {
    const go = vi.fn();
    const progress = { ...emptyLayerProgress(), totalStars: 7, records: { PE: mastered, ON: mastered }, bestTests: { 'all|find': { correct: 12, total: 13 } } };
    // US data has different stars: the Canada tab must show Canada's.
    view = render(<HomeScreen data={{ ...emptyData(), totalStars: 99 }} go={go} layer="canada" layerProgress={progress} />);
    const c = view.container;
    expect(c.textContent).toContain('⭐ 7');
    expect(c.textContent).not.toContain('99');
    expect(c.textContent).toContain('2 / 13');
    expect(c.textContent).toContain('Find It 12/13');
    click(button(c, 'Canada Learn'));
    expect(go).toHaveBeenLastCalledWith({ name: 'canada' });
    click(button(c, 'Canada Test'));
    expect(go).toHaveBeenLastCalledWith({ name: 'layer-setup', layer: 'canada', kind: 'test' });
  });
});

describe('Home layout (iPad)', () => {
  it('region chips stay in at most 3 columns so names do not collide in landscape', () => {
    const { container } = setup();
    const section = container.querySelector('[aria-label="Practice next"]');
    const grid = section!.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid!.className).toMatch(/grid-cols-2/);
    expect(grid!.className).toMatch(/sm:grid-cols-3/);
    expect(grid!.className).not.toMatch(/grid-cols-6/);
    for (const b of grid!.querySelectorAll('button')) {
      expect(b.className).toContain('min-h-20');
      expect(b.className).toContain('min-w-0');
    }
  });

  it('the map switcher buttons stay at least 64px tall and can shrink without overflowing the row', () => {
    const { container } = setup();
    const group = container.querySelector('[aria-label="Choose a map"]');
    expect(group!.className).toMatch(/grid-cols-3/);
    for (const label of ['USA map', 'Canada map', 'World map']) {
      const b = button(container, label)!;
      expect(b.className).toContain('min-h-20');
      expect(b.className).toContain('min-w-0');
      expect(b.className).toMatch(/flex-col/);
    }
  });
});

describe('Home subject switcher (Geography / Math)', () => {
  it('shows two big subject chips above the map switcher, with Geography picked by default', () => {
    view = render(<HomeScreen data={emptyData()} go={vi.fn()} />);
    const c = view.container;
    const geo = button(c, 'Geography')!;
    const math = button(c, 'Math')!;
    expect(geo.getAttribute('aria-pressed')).toBe('true');
    expect(math.getAttribute('aria-pressed')).toBe('false');
    for (const b of [geo, math]) {
      expect(b.className).toContain('min-h-20');
      expect(b.className).toContain('min-w-0');
      expect(b.className).toContain('rounded-3xl');
    }
    // Above the map switcher, and only two across.
    const subjectGroup = c.querySelector('[aria-label="Choose a subject"]')!;
    const mapGroup = c.querySelector('[aria-label="Choose a map"]')!;
    expect(subjectGroup.compareDocumentPosition(mapGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(subjectGroup.className).toContain('grid-cols-2');
    // Geography home is unchanged.
    expect(button(c, 'Find It: Northeast (suggested)')).toBeDefined();
    expect(button(c, /^📝Test/)).toBeDefined();
  });

  it('tapping Math reports the choice', () => {
    const onSubject = vi.fn();
    view = render(<HomeScreen data={emptyData()} go={vi.fn()} onSubject={onSubject} />);
    click(button(view.container, 'Math'));
    expect(onSubject).toHaveBeenCalledWith('math');
  });

  it('Math hides the map switcher and geography games and shows the Math home', () => {
    const go = vi.fn();
    view = render(<HomeScreen data={emptyData()} go={go} subject="math" math={emptyMathData()} />);
    const c = view.container;
    expect(button(c, 'Math')!.getAttribute('aria-pressed')).toBe('true');
    expect(c.querySelector('[aria-label="Choose a map"]')).toBeNull();
    expect(button(c, 'Find It: Northeast (suggested)')).toBeUndefined();
    expect(button(c, /^📝Test/)).toBeUndefined();
    expect(c.textContent).not.toContain('State Capitals');
    expect(c.textContent).toContain('Multiplication Flashcards');
    expect(c.textContent).toContain('Mastered 0 of 144');
    click(button(c, 'Multiplication Flashcards: Practice'));
    expect(go).toHaveBeenLastCalledWith({ name: 'math-setup', mode: 'practice' });
    click(button(c, 'Multiplication Quiz'));
    expect(go).toHaveBeenLastCalledWith({ name: 'math-setup', mode: 'quiz' });
    click(button(c, 'My Facts'));
    expect(go).toHaveBeenLastCalledWith({ name: 'math-facts' });
    click(button(c, '⚙️ Settings'));
    expect(go).toHaveBeenLastCalledWith({ name: 'settings' });
  });

  it('switching back to Geography restores the geography home', () => {
    function Harness() {
      const [subject, setSubject] = useState<Subject>('math');
      return <HomeScreen data={emptyData()} go={vi.fn()} subject={subject} onSubject={setSubject} math={emptyMathData()} />;
    }
    view = render(<Harness />);
    const c = view.container;
    expect(c.textContent).toContain('Multiplication Flashcards');
    click(button(c, 'Geography'));
    expect(c.textContent).not.toContain('Multiplication Flashcards');
    expect(c.querySelector('[aria-label="Choose a map"]')).not.toBeNull();
    expect(button(c, 'Find It: Northeast (suggested)')).toBeDefined();
    click(button(c, 'Math'));
    expect(c.textContent).toContain('Multiplication Flashcards');
  });

  it('Math home shows best quiz scores and counts zeros only when they are on', () => {
    const m = { streak: 3, correct: 3, wrong: 0, lastSeen: 0 };
    const math = { ...emptyMathData(), includeZero: true, facts: { '3x4': m, '0x5': m }, bestQuizzes: { '20|keypad': { correct: 18, total: 20 } } };
    view = render(<HomeScreen data={emptyData()} go={vi.fn()} subject="math" math={math} />);
    expect(view.container.textContent).toContain('Mastered 2 of 169');
    expect(view.container.textContent).toContain('Best 20: 18/20');
  });
});
