// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { button, click, mapLabels, render, type Rendered } from '../test/render';
import { LearnScreen } from './LearnScreen';
import { emptyData, withSetting, type SavedData } from '../lib/storage';
import type { RegionId } from '../data/states';
import { REGION_STATES } from '../data/regions';

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
});

/** Holds SavedData like App does, so the screen's own updates (toggle, explored) take effect. */
let latest: SavedData = emptyData();
function Harness({ initial, tour }: { initial: SavedData; tour?: RegionId }) {
  const [data, setData] = useState(initial);
  latest = data;
  return <LearnScreen data={data} update={(fn) => setData((d) => fn(d))} onHome={() => {}} initialTour={tour} onPlay={() => {}} />;
}

function setup(keepNames: boolean, tour?: RegionId, regionColors = true) {
  let d = withSetting(emptyData(), 'learnKeepNames', keepNames);
  d = withSetting(d, 'regionColors', regionColors);
  view = render(<Harness initial={d} tour={tour} />);
  return view.container;
}

const toggle = (c: Element) => c.querySelector<HTMLButtonElement>('button[role="switch"]')!;

/** Step a tour: "Let's go" then "Next" (n-1) times → n states visited. */
function visit(c: Element, n: number) {
  click(button(c, /Let's go/));
  for (let i = 1; i < n; i++) click(button(c, /Next ▶|Finish ▶/));
}

describe('Learn "Keep names on the map"', () => {
  it('defaults to OFF, with a quick toggle on the Learn screen', () => {
    view = render(<Harness initial={emptyData()} />);
    const t = toggle(view.container);
    expect(t.textContent).toContain('Keep names on the map: OFF');
    expect(t.getAttribute('aria-checked')).toBe('false');
    expect(t.className).toContain('min-h-16');
  });

  it('the toggle saves the setting (and flips the label)', () => {
    const c = setup(false);
    click(toggle(c));
    expect(latest.settings.learnKeepNames).toBe(true);
    expect(toggle(c).textContent).toContain('ON');
    click(toggle(c));
    expect(latest.settings.learnKeepNames).toBe(false);
  });

  it('OFF in the region tour: only the current state is labeled (unchanged behavior)', () => {
    const c = setup(false, 'southwest');
    visit(c, 3);
    expect(mapLabels(c)).toHaveLength(1);
  });

  it('ON in the region tour: names build up as she goes', () => {
    const c = setup(true, 'southwest');
    visit(c, 1);
    expect(mapLabels(c)).toHaveLength(1);
    click(button(c, /Next ▶/));
    click(button(c, /Next ▶/));
    const labels = mapLabels(c);
    expect(labels).toHaveLength(3);
    for (const name of labels) expect(['Arizona', 'New Mexico', 'Oklahoma', 'Texas']).toContain(name);
  });

  it('ON: after finishing a tour every state in the region is labeled', () => {
    const c = setup(true, 'southwest');
    visit(c, REGION_STATES.southwest.length);
    click(button(c, /Finish ▶/));
    expect(mapLabels(c).sort()).toEqual(['Arizona', 'New Mexico', 'Oklahoma', 'Texas']);
  });

  it('small Northeast states get their names in their callout boxes', () => {
    const c = setup(true, 'northeast');
    visit(c, REGION_STATES.northeast.length);
    const labels = mapLabels(c);
    for (const name of ['Rhode Island', 'Delaware', 'Massachusetts', 'New Hampshire', 'Connecticut']) expect(labels).toContain(name);
    expect(labels).toHaveLength(11);
  });

  it('"Clear names" resets the built-up names but keeps the current one', () => {
    const c = setup(true, 'southwest');
    expect(button(c, /Clear names/)).toBeUndefined();
    visit(c, 3);
    click(button(c, /Clear names/));
    expect(mapLabels(c)).toHaveLength(1);
    expect(button(c, /Clear names/)).toBeUndefined();
    click(button(c, /Next ▶|Finish ▶/));
    expect(mapLabels(c)).toHaveLength(1);
    click(button(c, /Back/));
    expect(mapLabels(c)).toHaveLength(2);
  });

  it('turning it OFF mid-tour drops back to one label', () => {
    const c = setup(true, 'southwest');
    visit(c, 3);
    click(toggle(c));
    expect(mapLabels(c)).toHaveLength(1);
  });

  it('labels stay readable over region colors: dark text with a white outline', () => {
    const c = setup(true, 'southwest', true);
    visit(c, 2);
    const text = c.querySelector('svg text.map-label')!;
    expect(text.getAttribute('fill')).toBe('#0f172a');
    expect(text.getAttribute('class')).toContain('map-label'); // .map-label = white stroke halo (index.css)
  });
});
