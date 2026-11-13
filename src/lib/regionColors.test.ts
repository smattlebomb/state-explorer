import { describe, expect, it } from 'vitest';
import { colorGraph, regionFills } from './regionColors';
import { getMapGeometry } from './geo';
import { REGION_PALETTE, REGION_STATES } from '../data/regions';
import { ALL_ABBRS, STATE_BY_ABBR, type RegionId } from '../data/states';

const adjOf = (edges: [string, string][]) => {
  const m = new Map<string, Set<string>>();
  for (const [a, b] of edges) {
    if (!m.has(a)) m.set(a, new Set());
    if (!m.has(b)) m.set(b, new Set());
    m.get(a)!.add(b);
    m.get(b)!.add(a);
  }
  return m;
};

describe('colorGraph', () => {
  it('3-colors a triangle and a square so neighbors differ', () => {
    const tri = adjOf([['A', 'B'], ['B', 'C'], ['C', 'A']]);
    const c = colorGraph(['A', 'B', 'C'], tri, 3);
    expect(new Set(c.values()).size).toBe(3);

    const sq = adjOf([['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A']]);
    const c2 = colorGraph(['A', 'B', 'C', 'D'], sq, 3);
    for (const [a, nbrs] of sq) for (const b of nbrs) expect(c2.get(a)).not.toBe(c2.get(b));
  });

  it('only looks at neighbors inside the node set, and colors isolated nodes', () => {
    const adj = adjOf([['A', 'X']]);
    const c = colorGraph(['A', 'Z'], adj, 3);
    expect(c.get('A')).toBe(0);
    expect(c.get('Z')).toBe(0);
  });

  it('falls back to more colors when k is impossible (K4 with k=3)', () => {
    const k4 = adjOf([['A', 'B'], ['A', 'C'], ['A', 'D'], ['B', 'C'], ['B', 'D'], ['C', 'D']]);
    const c = colorGraph(['A', 'B', 'C', 'D'], k4, 3);
    expect(new Set(c.values()).size).toBe(4);
  });
});

describe('map adjacency', () => {
  const geo = getMapGeometry();
  it('knows real borders', () => {
    expect(geo.neighbors.get('OH')).toEqual(new Set(['PA', 'WV', 'KY', 'IN', 'MI']));
    expect(geo.neighbors.get('ME')).toEqual(new Set(['NH']));
    expect(geo.neighbors.get('AK')!.size).toBe(0);
    expect(geo.neighbors.get('HI')!.size).toBe(0);
  });
  it('is symmetric', () => {
    for (const [a, nbrs] of geo.neighbors) for (const b of nbrs) expect(geo.neighbors.get(b)!.has(a)).toBe(true);
  });
});

describe('regionFills', () => {
  const geo = getMapGeometry();
  const fills = regionFills(geo.neighbors);

  it('gives every state a tint from its own region', () => {
    expect(fills.size).toBe(50);
    for (const s of ALL_ABBRS) {
      const region = STATE_BY_ABBR.get(s)!.region;
      expect(REGION_PALETTE[region].tints).toContain(fills.get(s));
    }
  });

  it('bordering states in the same region never share a tint', () => {
    for (const [a, nbrs] of geo.neighbors) {
      for (const b of nbrs) {
        if (STATE_BY_ABBR.get(a)!.region === STATE_BY_ABBR.get(b)!.region) expect(fills.get(a)).not.toBe(fills.get(b));
      }
    }
  });

  it('every region uses more than one tint (so neighbors are easy to tell apart)', () => {
    for (const region of Object.keys(REGION_STATES) as RegionId[]) {
      const used = new Set(REGION_STATES[region].map((s) => fills.get(s)));
      expect(used.size).toBeGreaterThan(1);
    }
  });
});

describe('region palette', () => {
  it('uses 5 distinct hues and 15 distinct tints', () => {
    const p = Object.values(REGION_PALETTE);
    expect(new Set(p.map((x) => x.hue)).size).toBe(5);
    expect(new Set(p.flatMap((x) => x.tints)).size).toBe(15);
    expect(p.map((x) => x.hue).sort()).toEqual(['blue', 'green', 'orange', 'purple', 'yellow']);
  });

  /** WCAG relative luminance. */
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };

  it('dark label text is readable on every tint (contrast ≥ 7:1)', () => {
    for (const p of Object.values(REGION_PALETTE)) for (const t of p.tints) expect(contrast('#0f172a', t)).toBeGreaterThanOrEqual(7);
  });

  it('white text is readable on every region button color (≥ 3:1 for large text)', () => {
    for (const p of Object.values(REGION_PALETTE)) expect(contrast('#ffffff', p.solid)).toBeGreaterThanOrEqual(3);
  });
});
