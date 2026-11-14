// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { button, click, render, type Rendered } from '../test/render';
import { WorldScreen } from './WorldScreen';
import { emptyData } from '../lib/storage';

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
});

/** Wait for the lazily imported world map to load and draw. */
async function loaded(c: Element) {
  for (let i = 0; i < 100 && !c.querySelector('path[data-id="FR"]'); i++) {
    await act(() => new Promise((r) => setTimeout(r, 20)));
  }
  expect(c.querySelector('path[data-id="FR"]')).not.toBeNull();
}

async function setup() {
  const onOpenCanada = vi.fn();
  const onOpenUSA = vi.fn();
  view = render(<WorldScreen data={emptyData()} onHome={() => {}} onOpenCanada={onOpenCanada} onOpenUSA={onOpenUSA} />);
  await loaded(view.container);
  return { c: view.container, onOpenCanada, onOpenUSA };
}

const header = (c: Element) => c.querySelector('header')!.textContent ?? '';

describe('World Learn map', () => {
  it('starts on the whole world with all 7 continents as big buttons and every place drawn', async () => {
    const { c } = await setup();
    expect(header(c)).toContain('Tap a continent');
    for (const name of ['Asia', 'Africa', 'North America', 'South America', 'Antarctica', 'Europe', 'Oceania']) {
      const b = button(c, `Explore ${name}`)!;
      expect(b, name).toBeDefined();
      expect(b.className).toContain('min-h-20');
    }
    expect(c.querySelectorAll('svg path[data-id]').length).toBe(239);
    // Zoom buttons are there and 64px.
    expect(button(c, 'Zoom in')!.className).toContain('h-16');
    expect(button(c, 'Back up a level')).toBeUndefined();
  });

  it('drills continent → sub-region → country, and Back goes up one level at a time', async () => {
    const { c } = await setup();
    click(button(c, 'Explore Europe'));
    expect(header(c)).toContain('Europe');
    expect(header(c)).toContain('44 countries');
    for (const s of ['Northern Europe', 'Western Europe', 'Southern Europe', 'Eastern Europe']) expect(button(c, `Explore ${s}`), s).toBeDefined();

    click(button(c, 'Explore Western Europe'));
    expect(header(c)).toContain('Western Europe');
    click(button(c, 'Monaco'));
    expect(header(c)).toContain('Monaco');
    expect(header(c)).toContain('Capital: Monaco');
    // Tiny countries get a dot on the map.
    expect(c.querySelector('circle[data-marker="MC"]')).not.toBeNull();

    click(button(c, 'Back up a level'));
    expect(header(c)).toContain('44 countries');
    click(button(c, 'Back up a level'));
    expect(header(c)).toContain('Tap a continent');
  });

  it('South America goes straight to its countries (one sub-region)', async () => {
    const { c } = await setup();
    click(button(c, 'Explore South America'));
    expect(button(c, 'Brazil')).toBeDefined();
    click(button(c, 'Bolivia'));
    expect(header(c)).toContain('Capital: Sucre');
  });

  it('display-only places are labeled but marked as not one of the 195', async () => {
    const { c } = await setup();
    click(button(c, 'Explore Asia'));
    click(button(c, 'Explore Eastern Asia'));
    click(button(c, 'Taiwan'));
    expect(header(c)).toContain('Taiwan');
    expect(header(c)).toContain('Taipei');
    expect(c.textContent).toContain('Most countries do not officially count it');
  });

  it('Canada opens the Canada map; the United States opens the 50-state map', async () => {
    const { c, onOpenCanada, onOpenUSA } = await setup();
    click(button(c, 'Explore North America'));
    click(button(c, 'Explore Northern America'));
    click(button(c, 'Canada'));
    click(button(c, /Explore Canada's provinces/));
    expect(onOpenCanada).toHaveBeenCalled();
    click(button(c, 'United States'));
    click(button(c, /Explore the 50 states/));
    expect(onOpenUSA).toHaveBeenCalled();
  });

  it('Antarctica shows a note instead of zooming into nothing', async () => {
    const { c } = await setup();
    click(button(c, 'Explore Antarctica'));
    expect(header(c)).toContain('Antarctica');
    expect(c.textContent).toContain('No country owns it');
  });
});
