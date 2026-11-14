// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { button, click, mapLabels, render, type Rendered } from '../test/render';
import { CanadaScreen } from './CanadaScreen';
import { emptyData } from '../lib/storage';

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
});

async function loaded(c: Element) {
  for (let i = 0; i < 100 && !c.querySelector('path[data-id="ON"]'); i++) {
    await act(() => new Promise((r) => setTimeout(r, 20)));
  }
  expect(c.querySelector('path[data-id="ON"]')).not.toBeNull();
}

const header = (c: Element) => c.querySelector('header')!.textContent ?? '';

describe('Canada Learn map', () => {
  it('draws all 13 provinces and territories, plus the PEI callout box', async () => {
    view = render(<CanadaScreen data={emptyData()} onHome={() => {}} />);
    await loaded(view.container);
    const c = view.container;
    expect(c.querySelectorAll('svg path[data-id]').length).toBe(13);
    expect(c.querySelector('g[data-callout="PE"] rect')).not.toBeNull();
    expect(header(c)).toContain('Tap a province or territory');
    expect(c.textContent).toContain('explored 0 of 13');
    // Only offers "back to World" when she came from there.
    expect(button(c, 'Back to the world map')).toBeUndefined();
  });

  it('picking a province shows its name, kind and capital, labels it, and counts it', async () => {
    view = render(<CanadaScreen data={emptyData()} onHome={() => {}} />);
    await loaded(view.container);
    const c = view.container;
    click(button(c, 'Prince Edward Island'));
    expect(header(c)).toContain('Prince Edward Island');
    expect(header(c)).toContain('Province · Capital: Charlottetown');
    expect(mapLabels(c).join(' ')).toContain('Prince Edward');
    click(button(c, 'Nunavut'));
    expect(header(c)).toContain('Territory · Capital: Iqaluit');
    expect(c.textContent).toContain('explored 2 of 13');
  });

  it('has a big back-to-World button when opened from the world map', async () => {
    const onBack = vi.fn();
    view = render(<CanadaScreen data={emptyData()} onHome={() => {}} onBack={onBack} />);
    await loaded(view.container);
    const b = button(view.container, 'Back to the world map')!;
    expect(b.className).toContain('min-h-16');
    click(b);
    expect(onBack).toHaveBeenCalled();
  });
});
