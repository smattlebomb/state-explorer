import { describe, expect, it } from 'vitest';
import {
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  clientToMap,
  formatViewBox,
  fromVisible,
  identityZoom,
  meetScale,
  panBy,
  parseViewBox,
  visibleWindow,
  zoomAt,
  zoomIn,
  zoomOut,
} from './mapZoom';

const base = { x: 0, y: 0, w: 1000, h: 500 };

describe('mapZoom', () => {
  it('clamps scale to 1x–8x', () => {
    expect(clampScale(0)).toBe(MIN_SCALE);
    expect(clampScale(0.2)).toBe(1);
    expect(clampScale(1)).toBe(1);
    expect(clampScale(3)).toBe(3);
    expect(clampScale(8)).toBe(8);
    expect(clampScale(99)).toBe(MAX_SCALE);
    expect(clampScale(Number.NaN)).toBe(1);
  });

  it('at 1x the visible window is the base viewBox', () => {
    const z = identityZoom(base);
    expect(z).toEqual({ k: 1, cx: 500, cy: 250 });
    expect(visibleWindow(base, z)).toEqual(base);
    expect(formatViewBox(visibleWindow(base, z))).toBe('0 0 1000 500');
  });

  it('at 2x the window is half size and stays in bounds', () => {
    const vis = visibleWindow(base, { k: 2, cx: 500, cy: 250 });
    expect(vis).toEqual({ x: 250, y: 125, w: 500, h: 250 });
  });

  it('keeps the window inside the base when the center is near an edge', () => {
    const vis = visibleWindow(base, { k: 2, cx: 0, cy: 0 });
    expect(vis.x).toBe(0);
    expect(vis.y).toBe(0);
    expect(vis.w).toBe(500);
    expect(vis.h).toBe(250);
    const vis2 = visibleWindow(base, { k: 4, cx: 1000, cy: 500 });
    expect(vis2.x + vis2.w).toBe(1000);
    expect(vis2.y + vis2.h).toBe(500);
  });

  it('zoomAt keeps the anchor point fixed in the window (relative position)', () => {
    const z0 = identityZoom(base);
    const anchor = { x: 200, y: 100 };
    const z1 = zoomAt(base, z0, 2, anchor.x, anchor.y);
    const a = visibleWindow(base, z0);
    const b = visibleWindow(base, z1);
    const fx0 = (anchor.x - a.x) / a.w;
    const fx1 = (anchor.x - b.x) / b.w;
    const fy0 = (anchor.y - a.y) / a.h;
    const fy1 = (anchor.y - b.y) / b.h;
    expect(z1.k).toBe(2);
    expect(fx1).toBeCloseTo(fx0, 10);
    expect(fy1).toBeCloseTo(fy0, 10);
  });

  it('cannot pan at 1x (already fills the bounds)', () => {
    const z = panBy(base, identityZoom(base), 80, -40);
    expect(visibleWindow(base, z)).toEqual(base);
    expect(z.k).toBe(1);
  });

  it('pans at 2x and clamps at the edges', () => {
    const start = { k: 2, cx: 500, cy: 250 };
    const mid = panBy(base, start, 50, 0);
    expect(visibleWindow(base, mid).x).toBe(300);
    const edge = panBy(base, start, 10_000, 10_000);
    const vis = visibleWindow(base, edge);
    expect(vis.x + vis.w).toBe(1000);
    expect(vis.y + vis.h).toBe(500);
  });

  it('button zoom in/out around the center stays in bounds and inverts', () => {
    let z = identityZoom(base);
    z = zoomIn(base, z);
    expect(z.k).toBe(1.5);
    expect(visibleWindow(base, z).x).toBeCloseTo((1000 - 1000 / 1.5) / 2);
    z = zoomOut(base, z);
    expect(z.k).toBeCloseTo(1);
    expect(visibleWindow(base, z)).toEqual(base);
    // Mash zoom-in well past 8x.
    for (let i = 0; i < 10; i++) z = zoomIn(base, z);
    expect(z.k).toBe(MAX_SCALE);
    const vis = visibleWindow(base, z);
    expect(vis.w).toBeCloseTo(1000 / 8);
    expect(vis.x).toBeGreaterThanOrEqual(0);
    expect(vis.x + vis.w).toBeLessThanOrEqual(1000);
  });

  it('parse/format viewBox and fromVisible round-trip', () => {
    expect(parseViewBox('10 20 300 400')).toEqual({ x: 10, y: 20, w: 300, h: 400 });
    const vis = { x: 250, y: 125, w: 500, h: 250 };
    const z = fromVisible(base, vis);
    expect(z.k).toBe(2);
    expect(visibleWindow(base, z)).toEqual(vis);
  });

  it('clientToMap inverts a centered meet layout (letterboxed)', () => {
    // 200x100 viewBox shown in a 400x400 box → scale 2, 100px letterbox top and bottom.
    const vis = { x: 0, y: 0, w: 200, h: 100 };
    const svg = { left: 10, top: 10, width: 400, height: 400 };
    expect(meetScale(400, 400, vis)).toBe(2);
    // Center of the drawn map (svg center).
    expect(clientToMap(210, 210, svg, vis)).toEqual({ x: 100, y: 50 });
    // Top-left of the drawn map (not the svg, after 100px letterbox).
    expect(clientToMap(10, 110, svg, vis)).toEqual({ x: 0, y: 0 });
  });
});
