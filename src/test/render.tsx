/**
 * Minimal screen-test helpers for jsdom (no extra testing library needed).
 * Use in a test file that starts with: // @vitest-environment jsdom
 */
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no matchMedia (framer-motion asks for prefers-reduced-motion).
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

export interface Rendered {
  container: HTMLDivElement;
  root: Root;
  unmount: () => void;
}

export function render(ui: ReactElement): Rendered {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  return {
    container,
    root,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

export function click(el: Element | null | undefined) {
  if (!el) throw new Error('click: element not found');
  act(() => {
    (el as HTMLElement).click();
  });
}

/** Find a button by its aria-label, or by its visible text if there's no aria-label match. */
export function button(container: Element, name: string | RegExp): HTMLButtonElement | undefined {
  const all = [...container.querySelectorAll('button')];
  const matches = (s: string | null | undefined) => !!s && (typeof name === 'string' ? s.trim() === name : name.test(s));
  return all.find((b) => matches(b.getAttribute('aria-label'))) ?? all.find((b) => matches(b.textContent));
}

/** Names currently printed on the map (each label's tspans joined). */
export function mapLabels(container: Element): string[] {
  return [...container.querySelectorAll('svg text.map-label')].map((t) =>
    [...t.querySelectorAll('tspan')].map((s) => s.textContent).join(' '),
  );
}
