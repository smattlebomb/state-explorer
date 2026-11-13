import { describe, expect, it } from 'vitest';
import { distanceToShape, hitTest, pointInRings, type HitShape } from './hittest';
import { getMapGeometry } from './geo';

const square = (id: string, x: number, y: number, s: number): HitShape => ({
  id,
  rings: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s]]],
  bbox: [x, y, x + s, y + s],
});

describe('hit testing', () => {
  const a = square('A', 0, 0, 10);
  const b = square('B', 30, 0, 10);

  it('point in polygon', () => {
    expect(pointInRings([5, 5], a.rings)).toBe(true);
    expect(pointInRings([15, 5], a.rings)).toBe(false);
  });

  it('handles holes (even-odd)', () => {
    const donut: HitShape = { ...a, rings: [...a.rings, [[3, 3], [7, 3], [7, 7], [3, 7]]] };
    expect(pointInRings([5, 5], donut.rings)).toBe(false);
    expect(pointInRings([1, 1], donut.rings)).toBe(true);
  });

  it('distance to shape', () => {
    expect(distanceToShape([5, 5], a)).toBe(0);
    expect(distanceToShape([13, 5], a)).toBeCloseTo(3);
  });

  it('direct hits win, near-misses are forgiven, far misses return null', () => {
    expect(hitTest([5, 5], [a, b], 6)).toBe('A');
    expect(hitTest([14, 5], [a, b], 6)).toBe('A'); // 4 away from A
    expect(hitTest([27, 5], [a, b], 6)).toBe('B'); // closer to B
    expect(hitTest([20, 5], [a, b], 6)).toBe(null); // 10 from both
  });

  it('callout boxes take priority', () => {
    expect(hitTest([5, 5], [a], 6, [{ id: 'RI', x: 0, y: 0, w: 20, h: 20 }])).toBe('RI');
  });
});

describe('real map geometry', () => {
  const geo = getMapGeometry();

  it('has 50 state shapes with paths', () => {
    expect(geo.shapes).toHaveLength(50);
    for (const s of geo.shapes) {
      expect(s.d.length).toBeGreaterThan(10);
      expect(s.rings.length).toBeGreaterThan(0);
    }
  });

  it('every state centroid hit-tests to itself (except where a centroid falls outside a curvy state)', () => {
    let ok = 0;
    for (const s of geo.shapes) if (hitTest(s.centroid, geo.shapes, 0) === s.id) ok++;
    expect(ok).toBeGreaterThanOrEqual(46);
  });

  it('a tap a few px off Rhode Island still lands on Rhode Island', () => {
    const ri = geo.byId.get('RI')!;
    // Find open-water points 1-3 units off RI that are clearly closer to RI than any other state.
    const others = geo.shapes.filter((s) => s.id !== 'RI');
    const probes: [number, number][] = [];
    for (let x = ri.bbox[0] - 4; x <= ri.bbox[2] + 4; x += 0.5) {
      for (let y = ri.bbox[1] - 4; y <= ri.bbox[3] + 4; y += 0.5) {
        const d = distanceToShape([x, y], ri);
        if (d > 1 && d < 3 && others.every((o) => distanceToShape([x, y], o) > 5)) probes.push([x, y]);
      }
    }
    expect(probes.length).toBeGreaterThan(5);
    for (const p of probes) {
      expect(hitTest(p, geo.shapes, 0)).toBe(null); // a strict hit test misses
      expect(hitTest(p, geo.shapes, 4)).toBe('RI'); // forgiving one finds RI
    }
  });

  it('each small-state callout box maps to its state and sits off the map', () => {
    expect(geo.callouts.map((c) => c.id)).toEqual(['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD']);
    for (const c of geo.callouts) {
      expect(hitTest([c.x + c.w / 2, c.y + c.h / 2], geo.shapes, 4, geo.callouts)).toBe(c.id);
      expect(c.x + c.w).toBeLessThanOrEqual(geo.width);
      expect(c.y + c.h).toBeLessThanOrEqual(geo.height);
    }
  });

  it('Alaska and Hawaii are drawn as insets inside the view', () => {
    for (const id of ['AK', 'HI']) {
      const [x0, y0, x1, y1] = geo.byId.get(id)!.bbox;
      expect(x0).toBeGreaterThanOrEqual(0);
      expect(y0).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThanOrEqual(geo.width);
      expect(y1).toBeLessThanOrEqual(geo.height);
    }
  });
});
