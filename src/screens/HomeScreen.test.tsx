// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { button, click, render, type Rendered } from '../test/render';
import { HomeScreen, findItIn } from './HomeScreen';
import { emptyData, withSetting, type SavedData } from '../lib/storage';
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
