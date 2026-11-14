import { describe, expect, it } from 'vitest';
import canadaJson from '../data/canada/provinces-50m.json';
import type { CanadaTopology } from '../data/canadaGeo';
import { ALL_PROVINCE_ABBRS, PROVINCES } from '../data/canada';
import { CANADA_MAX_SCALE, buildCanadaGeometry, canadaFills, pickProvince } from './canadaMap';
import { pointInRings } from './hittest';
import { MAX_SCALE } from './mapZoom';

const geo = buildCanadaGeometry(canadaJson as unknown as CanadaTopology);
const PX = 0.8; // roughly an iPad: ~1000 map units across ~800px

describe('Canada map geometry', () => {
  it('has all 13 provinces and territories', () => {
    expect(geo.shapes.map((s) => s.id).sort()).toEqual([...ALL_PROVINCE_ABBRS].sort());
  });

  it('zooms at least as deep as the US map', () => {
    expect(CANADA_MAX_SCALE).toBeGreaterThanOrEqual(MAX_SCALE);
  });

  it('PEI has a callout box out at sea that is inside the view', () => {
    const c = geo.callouts.find((b) => b.id === 'PE')!;
    expect(c).toBeDefined();
    const v = geo.view;
    expect(c.x).toBeGreaterThanOrEqual(v.x);
    expect(c.y).toBeGreaterThanOrEqual(v.y);
    expect(c.x + c.w).toBeLessThanOrEqual(v.x + v.w);
    expect(c.y + c.h).toBeLessThanOrEqual(v.y + v.h);
    // No land under the box (its corners and center are all in the water).
    const pts: [number, number][] = [[c.x, c.y], [c.x + c.w, c.y], [c.x, c.y + c.h], [c.x + c.w, c.y + c.h], [c.x + c.w / 2, c.y + c.h / 2]];
    for (const p of pts) for (const s of geo.shapes) expect(pointInRings(p, s.rings), `${s.id} under the PEI box`).toBe(false);
  });

  it('tapping the PEI box (or PEI itself) picks PEI', () => {
    const c = geo.callouts[0];
    expect(pickProvince(geo, [c.x + c.w / 2, c.y + c.h / 2], PX)).toBe('PE');
    expect(pickProvince(geo, geo.byId.get('PE')!.anchor, PX)).toBe('PE');
  });

  it('tapping in the middle of each big province picks it', () => {
    for (const id of ['BC', 'AB', 'SK', 'MB', 'ON', 'QC', 'YT', 'NT']) expect(pickProvince(geo, geo.byId.get(id)!.anchor, PX), id).toBe(id);
  });

  it('bordering provinces in the same region get different tints', () => {
    const fills = canadaFills(geo);
    for (const p of PROVINCES) expect(fills.get(p.abbr), p.abbr).toBeTruthy();
    for (const [a, b] of [['AB', 'SK'], ['SK', 'MB'], ['YT', 'NT'], ['NT', 'NU'], ['NB', 'NS']]) expect(fills.get(a), `${a}/${b}`).not.toBe(fills.get(b));
  });
});
