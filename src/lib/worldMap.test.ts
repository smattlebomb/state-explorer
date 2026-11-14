import { describe, expect, it } from 'vitest';
import worldJson from '../data/world/countries-50m.json';
import type { WorldTopology } from '../data/worldGeo';
import { COUNTRIES, MAP_TERRITORIES, SUBREGIONS, type SubregionId } from '../data/world';
import {
  WORLD_MAX_SCALE,
  buildWorldGeometry,
  drillContinent,
  inLevel,
  levelKey,
  levelView,
  markersFor,
  parentLevel,
  pickPlace,
  worldFills,
  type WorldLevel,
} from './worldMap';
import { MAX_SCALE } from './mapZoom';

const geo = buildWorldGeometry(worldJson as unknown as WorldTopology);
const sub = (subregion: SubregionId): WorldLevel => ({ kind: 'subregion', subregion });
const anchor = (id: string) => geo.byId.get(id)!.anchor;
const lonX = (lon: number, lat = 0) => geo.projection([lon, lat])![0];
const latY = (lat: number, lon = 0) => geo.projection([lon, lat])![1];

describe('world geometry', () => {
  it('has a drawable shape for every quiz country and display-only place', () => {
    expect(geo.shapes).toHaveLength(COUNTRIES.length + MAP_TERRITORIES.length);
    for (const s of geo.shapes) {
      expect(s.d.length, s.id).toBeGreaterThan(10);
      expect(s.rings.length, s.id).toBeGreaterThan(0);
    }
  });

  it('labels each country on its main piece (mainland France, not French Guiana)', () => {
    const fr = anchor('FR');
    expect(fr[0]).toBeGreaterThan(lonX(-5));
    expect(fr[0]).toBeLessThan(lonX(9));
    expect(fr[1]).toBeLessThan(latY(41));
    // Kiribati is labeled at its capital (Tarawa), west of the date line.
    expect(anchor('KI')[0]).toBeGreaterThan(lonX(170));
  });

  it('flags the micro-states and small islands for dot markers, but not big countries', () => {
    for (const id of ['VA', 'MC', 'SM', 'LI', 'AD', 'MT', 'NR', 'TV', 'SG', 'BH', 'GD']) expect(geo.byId.get(id)?.small, id).toBe(true);
    for (const id of ['FR', 'BR', 'IT', 'JP', 'NZ', 'CA']) expect(geo.byId.get(id)?.small, id).toBe(false);
  });

  it('a deeper max zoom than the US map', () => {
    expect(WORLD_MAX_SCALE).toBeGreaterThanOrEqual(16);
    expect(WORLD_MAX_SCALE).toBeGreaterThan(MAX_SCALE);
  });
});

describe('levels: world → continent → sub-region', () => {
  it('drills continents (South America skips its single sub-region; Antarctica stays on the world)', () => {
    expect(drillContinent('europe')).toEqual({ kind: 'continent', continent: 'europe' });
    expect(drillContinent('south-america')).toEqual(sub('south-america'));
    expect(drillContinent('antarctica')).toEqual({ kind: 'world' });
  });

  it('goes back up one level at a time', () => {
    expect(parentLevel(sub('western-europe'))).toEqual({ kind: 'continent', continent: 'europe' });
    expect(parentLevel({ kind: 'continent', continent: 'europe' })).toEqual({ kind: 'world' });
    expect(parentLevel(sub('south-america'))).toEqual({ kind: 'world' });
    expect(parentLevel({ kind: 'world' })).toEqual({ kind: 'world' });
  });

  it('level keys are unique', () => {
    const keys = [levelKey({ kind: 'world' }), ...SUBREGIONS.map((s) => levelKey(sub(s.id))), levelKey({ kind: 'continent', continent: 'asia' })];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every sub-region view frames all of its countries', () => {
    for (const s of SUBREGIONS) {
      if (s.id === 'antarctica') continue;
      const v = levelView(geo, sub(s.id));
      for (const c of COUNTRIES.filter((c) => c.subregion === s.id)) {
        const [x, y] = anchor(c.id);
        expect(x >= v.x && x <= v.x + v.w && y >= v.y && y <= v.y + v.h, `${c.id} in ${s.id}`).toBe(true);
      }
    }
  });

  it('zoomed views stay focused (no stray islands stretching them)', () => {
    const we = levelView(geo, sub('western-europe'));
    expect(we.y + we.h).toBeLessThan(latY(25)); // French Guiana is not in view
    const eu = levelView(geo, { kind: 'continent', continent: 'europe' });
    expect(eu.x + eu.w).toBeLessThan(lonX(90, 55)); // European Russia, not all of Siberia
    const mi = levelView(geo, sub('micronesia'));
    expect(mi.w).toBeLessThan(geo.view.w * 0.25);
    const oc = levelView(geo, { kind: 'continent', continent: 'oceania' });
    expect(oc.w).toBeLessThan(geo.view.w * 0.5);
  });

  it('inLevel matches the catalog', () => {
    expect(inLevel(geo.byId.get('FR')!, sub('western-europe'))).toBe(true);
    expect(inLevel(geo.byId.get('ES')!, sub('western-europe'))).toBe(false);
    expect(inLevel(geo.byId.get('GL')!, { kind: 'continent', continent: 'north-america' })).toBe(true);
  });
});

describe('tapping the world map', () => {
  // About what an iPad shows: the world view is ~1000 units over ~1000px.
  const WORLD_PX = 1;
  const ZOOMED_PX = 7;

  it('taps inside a country pick it', () => {
    expect(pickPlace(geo, { kind: 'world' }, anchor('BR'), WORLD_PX)).toBe('BR');
    expect(pickPlace(geo, sub('western-europe'), anchor('FR'), ZOOMED_PX)).toBe('FR');
    const southItaly = geo.projection([15.5, 40.5])!;
    expect(pickPlace(geo, sub('southern-europe'), [southItaly[0], southItaly[1]], ZOOMED_PX)).toBe('IT');
  });

  it('tiny countries win over the big country they sit in (Vatican City, San Marino in Italy)', () => {
    expect(pickPlace(geo, sub('southern-europe'), anchor('VA'), ZOOMED_PX)).toBe('VA');
    expect(pickPlace(geo, sub('southern-europe'), anchor('SM'), ZOOMED_PX)).toBe('SM');
    // A near-miss beside the Monaco dot (10px away) still counts.
    const [x, y] = anchor('MC');
    expect(pickPlace(geo, sub('western-europe'), [x + 10 / ZOOMED_PX, y], ZOOMED_PX)).toBe('MC');
  });

  it('island nations are tappable at world zoom (dots)', () => {
    for (const id of ['TV', 'NR', 'MV', 'MT']) expect(pickPlace(geo, { kind: 'world' }, anchor(id), WORLD_PX), id).toBe(id);
  });

  it('places outside the current sub-region are not tappable', () => {
    expect(pickPlace(geo, sub('western-europe'), anchor('ES'), ZOOMED_PX)).toBeNull();
  });

  it('display-only places are tappable in their sub-region', () => {
    expect(pickPlace(geo, sub('eastern-asia'), anchor('TW'), ZOOMED_PX)).toBe('TW');
    expect(pickPlace(geo, sub('northern-america'), anchor('GL'), 3)).toBe('GL');
  });

  it('dots: countries only above sub-region level, and they go away once the real shape is big', () => {
    const world = markersFor(geo, { kind: 'world' }, WORLD_PX, 4).map((m) => m.id);
    expect(world).toContain('VA');
    expect(world).not.toContain('JE'); // a territory
    const sr = markersFor(geo, sub('northern-europe'), ZOOMED_PX, 9).map((m) => m.id);
    expect(sr).toContain('JE');
    expect(markersFor(geo, sub('southern-europe'), 400, 9).map((m) => m.id)).not.toContain('MT');
  });
});

describe('world colors', () => {
  const fills = worldFills(geo);
  it('every place has a fill and every sub-region has a shade', () => {
    for (const s of geo.shapes) expect(fills.byPlace.get(s.id), s.id).toBeTruthy();
    for (const s of SUBREGIONS) expect(fills.bySubregion.get(s.id), s.id).toBeTruthy();
  });

  it('bordering countries on the same continent get different tints', () => {
    for (const [a, b] of [['FR', 'DE'], ['FR', 'ES'], ['BR', 'AR'], ['CN', 'IN'], ['US', 'MX'], ['EG', 'LY']]) {
      expect(fills.byPlace.get(a), `${a}/${b}`).not.toBe(fills.byPlace.get(b));
    }
  });

  it('bordering sub-regions get different shades', () => {
    expect(fills.bySubregion.get('western-europe')).not.toBe(fills.bySubregion.get('eastern-europe'));
    expect(fills.bySubregion.get('northern-africa')).not.toBe(fills.bySubregion.get('western-africa'));
  });
});
