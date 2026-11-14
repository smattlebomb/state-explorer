import { describe, expect, it } from 'vitest';
import worldJson from './world/countries-50m.json';
import canadaJson from './canada/provinces-50m.json';
import type { WorldTopology } from './worldGeo';
import type { CanadaTopology } from './canadaGeo';
import { buildWorldGeometry } from '../lib/worldMap';
import { buildCanadaGeometry } from '../lib/canadaMap';
import { getMapGeometry } from '../lib/geo';
import { distanceToShape, type HitShape, type Pt } from '../lib/hittest';
import { CANADA_LAYER, USA_LAYER, WORLD_LAYER, type LayerConfig } from '../lib/layers';
import { COUNTRY_CAPITAL_AT, PROVINCE_CAPITAL_AT, STATE_CAPITAL_AT } from './capitalCoords';
import { ALL_ABBRS } from './states';
import { STATE_CAPITALS } from './stateCapitals';
import { COUNTRIES, MAP_TERRITORIES } from './world';

describe('capital names for every quiz item', () => {
  it('all 50 states have a capital (and the US layer uses them)', () => {
    for (const abbr of ALL_ABBRS) {
      expect(USA_LAYER.capitalOf(abbr), abbr).toBe(STATE_CAPITALS[abbr]);
      expect(USA_LAYER.capitalOf(abbr).length).toBeGreaterThan(2);
    }
    expect(USA_LAYER.capitalOf('OH')).toBe('Columbus');
  });

  it('the 13 Canadian capitals are exactly the quiz strings', () => {
    const expected = {
      BC: 'Victoria', AB: 'Edmonton', SK: 'Regina', MB: 'Winnipeg', ON: 'Toronto', QC: 'Quebec City', NB: 'Fredericton',
      NS: 'Halifax', PE: 'Charlottetown', NL: "St. John's", YT: 'Whitehorse', NT: 'Yellowknife', NU: 'Iqaluit',
    };
    for (const [abbr, cap] of Object.entries(expected)) expect(CANADA_LAYER.capitalOf(abbr), abbr).toBe(cap);
    expect(CANADA_LAYER.allIds).toHaveLength(13);
  });

  it('every quiz country has a capital; multi-capital countries explain the others', () => {
    for (const c of COUNTRIES) expect(WORLD_LAYER.capitalOf(c.id), c.id).toBe(c.capital);
    expect(WORLD_LAYER.capitalOf('ZA')).toBe('Pretoria');
    expect(WORLD_LAYER.capitalNote('ZA')).toMatch(/Cape Town.*Bloemfontein/);
    expect(WORLD_LAYER.capitalOf('BO')).toBe('Sucre');
    expect(WORLD_LAYER.capitalNote('BO')).toContain('La Paz');
  });

  it('capitals are unique within each layer (so "which place has capital Y?" has one answer)', () => {
    for (const cfg of [USA_LAYER, CANADA_LAYER, WORLD_LAYER]) {
      const caps = cfg.allIds.map(cfg.capitalOf);
      expect(new Set(caps).size, cfg.id).toBe(caps.length);
    }
  });
});

describe('capital dots', () => {
  it('every quiz item has a capital position', () => {
    for (const a of ALL_ABBRS) expect(STATE_CAPITAL_AT[a], a).toBeDefined();
    for (const p of CANADA_LAYER.allIds) expect(PROVINCE_CAPITAL_AT[p], p).toBeDefined();
    for (const c of COUNTRIES) expect(COUNTRY_CAPITAL_AT[c.id], c.id).toBeDefined();
    // Display-only places with a capital also get a dot in Learn.
    for (const t of MAP_TERRITORIES.filter((t) => t.capital)) expect(COUNTRY_CAPITAL_AT[t.id], t.id).toBeDefined();
  });

  /** The capital lands on its own place: inside it, or within `tol` map units (coastal capitals on a simplified coast). */
  function check(cfg: LayerConfig, project: (ll: readonly [number, number]) => Pt | null, shapeOf: (id: string) => HitShape | undefined, tol: number) {
    const misses: string[] = [];
    for (const id of cfg.allIds) {
      const at = cfg.capitalAt(id)!;
      const p = project(at);
      const shape = shapeOf(id);
      if (!p || !shape) {
        misses.push(`${id}: no point/shape`);
        continue;
      }
      const d = distanceToShape(p, shape);
      if (d > tol) misses.push(`${id} ${cfg.capitalOf(id)}: ${d.toFixed(2)} units off`);
    }
    expect(misses).toEqual([]);
  }

  it('US state capitals sit on their state', () => {
    const us = getMapGeometry();
    check(USA_LAYER, (ll) => us.projection([ll[0], ll[1]]) as Pt | null, (id) => us.byId.get(id), 3);
  });

  it('Canadian capitals sit on their province or territory', () => {
    const geo = buildCanadaGeometry(canadaJson as unknown as CanadaTopology);
    check(CANADA_LAYER, (ll) => geo.projection([ll[0], ll[1]]) as Pt | null, (id) => geo.byId.get(id), 4);
  });

  it('country capitals sit on their country (or right at its coast)', () => {
    const geo = buildWorldGeometry(worldJson as unknown as WorldTopology);
    check(WORLD_LAYER, (ll) => geo.projection([ll[0], ll[1]]) as Pt | null, (id) => geo.byId.get(id), 1.5);
  });
});
