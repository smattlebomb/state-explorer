import { describe, expect, it } from 'vitest';
import countiesJson from 'us-atlas/counties-10m.json';
import type { CountyTopology } from '../data/countiesGeo';
import { ALL_ABBRS, STATE_BY_ABBR } from '../data/states';
import { getMapGeometry } from './geo';
import { distanceToShape } from './hittest';
import { MAX_SCALE } from './mapZoom';
import {
  COUNTY_MAX_SCALE,
  buildStateCounties,
  countyFills,
  countyKind,
  countyLabel,
  countyMarkers,
  pickCounty,
  stateCountyGeometries,
  stateCountyView,
  stateOfCounty,
} from './counties';

const topo = countiesJson as unknown as CountyTopology;
const us = getMapGeometry();
const counties = (abbr: string) => buildStateCounties(topo, abbr, us.projection);

describe('county data (US only)', () => {
  const all = stateCountyGeometries(topo);

  it('has the 3,141 counties (and county equivalents) of the 50 states, each with a unique FIPS id and a name', () => {
    expect(all).toHaveLength(3141);
    expect(new Set(all.map((g) => g.id)).size).toBe(3141);
    for (const g of all) {
      expect(String(g.id)).toMatch(/^\d{5}$/);
      expect((g.properties as { name?: string } | undefined)?.name, String(g.id)).toBeTruthy();
    }
  });

  it('every county maps to one of the 50 states, and every state has counties', () => {
    const states = new Set(all.map((g) => stateOfCounty(String(g.id))));
    expect([...states].sort()).toEqual([...ALL_ABBRS].sort());
  });

  it('DC and the territories are left out', () => {
    expect(stateOfCounty('11001')).toBeUndefined(); // District of Columbia
    expect(stateOfCounty('72127')).toBeUndefined(); // San Juan, Puerto Rico
  });

  it('has the right number of counties for a few states', () => {
    const count = (abbr: string) => all.filter((g) => stateOfCounty(String(g.id)) === abbr).length;
    expect(count('TX')).toBe(254);
    expect(count('CA')).toBe(58);
    expect(count('DE')).toBe(3);
    expect(count('LA')).toBe(64);
    expect(count('OH')).toBe(88);
  });
});

describe('county names', () => {
  it('adds the right word for each kind of county', () => {
    expect(countyLabel('39049', 'Franklin')).toBe('Franklin County');
    expect(countyLabel('22071', 'Orleans')).toBe('Orleans Parish');
    expect(countyLabel('02122', 'Kenai Peninsula')).toBe('Kenai Peninsula Borough');
    expect(countyLabel('02050', 'Bethel')).toBe('Bethel Census Area');
    expect(countyLabel('02110', 'Juneau')).toBe('Juneau City and Borough');
    expect(countyLabel('02020', 'Anchorage')).toBe('Anchorage Municipality');
  });

  it('tells independent cities apart from counties with the same name', () => {
    expect(countyLabel('51760', 'Richmond')).toBe('Richmond (city)');
    expect(countyLabel('51159', 'Richmond')).toBe('Richmond County');
    expect(countyLabel('24510', 'Baltimore')).toBe('Baltimore (city)');
    expect(countyLabel('24005', 'Baltimore')).toBe('Baltimore County');
    expect(countyLabel('29510', 'St. Louis')).toBe('St. Louis (city)');
    expect(countyLabel('32510', 'Carson City')).toBe('Carson City');
    // Texas codes above 500 are ordinary counties.
    expect(countyKind('48501')).toBe('county');
  });

  it('every county label in each state is unique', () => {
    for (const abbr of ALL_ABBRS) {
      const labels = counties(abbr).counties.map((c) => c.label);
      expect(new Set(labels).size, abbr).toBe(labels.length);
    }
  });
});

describe('county shapes line up with the state map', () => {
  it('every county of a state sits inside that state on the 50-state map', () => {
    for (const abbr of ['OH', 'TX', 'VA', 'CA', 'MA', 'HI', 'AK']) {
      const st = us.byId.get(abbr)!;
      for (const c of counties(abbr).counties) {
        // Each county's label point is on (or right at the coast of) the state outline: same projection.
        expect(distanceToShape(c.anchor, st), `${c.label}, ${abbr}`).toBeLessThan(2);
      }
    }
  });

  it('every county has a drawable shape', () => {
    const oh = counties('OH');
    expect(oh.counties).toHaveLength(88);
    for (const c of oh.counties) expect(c.d.length, c.label).toBeGreaterThan(10);
  });
});

describe('tapping counties', () => {
  it('tapping inside a county picks it', () => {
    const oh = counties('OH');
    const franklin = oh.byId.get('39049')!;
    expect(pickCounty(oh, franklin.anchor, 6)).toBe('39049');
    const tx = counties('TX');
    expect(pickCounty(tx, tx.byId.get('48453')!.anchor, 3)).toBe('48453'); // Travis County (Austin)
  });

  it('tiny independent cities get dots until zoomed in, and their dot wins', () => {
    const va = counties('VA');
    const view = stateCountyView(us.byId.get('VA')!.bbox, us.width);
    const px = 1000 / view.w; // ~1000px wide map area
    const dots = countyMarkers(va, px, 6).map((m) => m.id);
    expect(dots).toContain('51610'); // Falls Church
    expect(dots).not.toContain('51019'); // Bedford County is big
    expect(pickCounty(va, va.byId.get('51610')!.anchor, px)).toBe('51610');
    // Zoomed far in, the dot goes away and the shape itself is tapped.
    expect(countyMarkers(va, px * 200, 6).map((m) => m.id)).not.toContain('51610');
  });

  it('a tap outside every county of the state picks nothing (it may switch state instead)', () => {
    const oh = counties('OH');
    const tx = us.byId.get('TX')!;
    expect(pickCounty(oh, [(tx.bbox[0] + tx.bbox[2]) / 2, (tx.bbox[1] + tx.bbox[3]) / 2], 4)).toBeNull();
  });

  it('counties zoom deeper than the 8x state games', () => {
    expect(COUNTY_MAX_SCALE).toBeGreaterThan(MAX_SCALE);
  });
});

describe('county colors', () => {
  it('neighboring counties get different tints of the state region hue', () => {
    for (const abbr of ALL_ABBRS) {
      const sc = counties(abbr);
      const fills = countyFills(sc);
      let clashes = 0;
      for (const [id, nbrs] of sc.neighbors) for (const n of nbrs) if (fills.get(id) === fills.get(n)) clashes++;
      expect(clashes, abbr).toBe(0);
      expect(fills.size).toBe(sc.counties.length);
    }
    expect(STATE_BY_ABBR.get('TX')?.region).toBe('southwest');
  });
});
