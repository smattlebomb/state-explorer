// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { button, click, render, type Rendered } from '../test/render';
import { CountiesScreen } from './CountiesScreen';
import { emptyData } from '../lib/storage';

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
});

async function loaded(c: Element) {
  for (let i = 0; i < 150 && !c.querySelector('path[data-county]'); i++) {
    await act(() => new Promise((r) => setTimeout(r, 20)));
  }
  expect(c.querySelector('path[data-county]')).not.toBeNull();
}

const header = (c: Element) => c.querySelector('header')!.textContent ?? '';

describe('US counties view', () => {
  it("draws the chosen state's counties (only that state) with the 50 states around it", async () => {
    view = render(<CountiesScreen data={emptyData()} state="OH" onHome={() => {}} onBack={() => {}} />);
    await loaded(view.container);
    const c = view.container;
    const ids = [...c.querySelectorAll('path[data-county]')].map((p) => p.getAttribute('data-county')!);
    expect(ids).toHaveLength(88);
    expect(ids.every((id) => id.startsWith('39'))).toBe(true);
    expect(c.querySelectorAll('path[data-state]')).toHaveLength(50);
    expect(header(c)).toContain('Ohio');
    expect(header(c)).toContain('88 counties');
    // Same big zoom buttons as the other maps.
    expect(button(c, 'Zoom in')!.className).toContain('h-16');
  });

  it('Louisiana says parishes; tiny Virginia cities get tap dots', async () => {
    view = render(<CountiesScreen data={emptyData()} state="LA" onHome={() => {}} onBack={() => {}} />);
    await loaded(view.container);
    expect(header(view.container)).toContain('64 parishes');
    view.unmount();
    view = render(<CountiesScreen data={emptyData()} state="VA" onHome={() => {}} onBack={() => {}} />);
    await loaded(view.container);
    expect(view.container.querySelector('circle[data-county-dot="51610"]')).not.toBeNull(); // Falls Church
  });

  it('has a big Back to the 50 states button', async () => {
    const onBack = vi.fn();
    view = render(<CountiesScreen data={emptyData()} state="RI" onHome={() => {}} onBack={onBack} />);
    await loaded(view.container);
    const b = button(view.container, /Back to the 50 states/)!;
    expect(b.className).toContain('min-h-16');
    click(b);
    expect(onBack).toHaveBeenCalled();
  });
});
