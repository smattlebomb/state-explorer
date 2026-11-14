import { describe, expect, it } from 'vitest';
import { geoArea } from 'd3-geo';
import { feature, neighbors } from 'topojson-client';
import type { MultiPolygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import canadaJson from './canada/provinces-50m.json';
import {
  ALL_PROVINCE_ABBRS,
  CANADA_REGIONS,
  PROVINCES,
  PROVINCE_BY_ABBR,
  SMALL_PROVINCES,
  provinceCapital,
  provinceName,
} from './canada';
import { loadCanadaTopology } from './canadaGeo';

const canada = canadaJson as unknown as Topology<{ provinces: GeometryCollection }>;
const shapes = feature(canada, canada.objects.provinces).features;
const shapeById = new Map(shapes.map((f) => [String(f.id), f]));
const KM2_PER_SR = 6371 ** 2;

/** The exact quiz strings Matt specified. */
const EXPECTED: Record<string, [name: string, capital: string]> = {
  BC: ['British Columbia', 'Victoria'],
  AB: ['Alberta', 'Edmonton'],
  SK: ['Saskatchewan', 'Regina'],
  MB: ['Manitoba', 'Winnipeg'],
  ON: ['Ontario', 'Toronto'],
  QC: ['Quebec', 'Quebec City'],
  NB: ['New Brunswick', 'Fredericton'],
  NS: ['Nova Scotia', 'Halifax'],
  PE: ['Prince Edward Island', 'Charlottetown'],
  NL: ['Newfoundland and Labrador', "St. John's"],
  YT: ['Yukon', 'Whitehorse'],
  NT: ['Northwest Territories', 'Yellowknife'],
  NU: ['Nunavut', 'Iqaluit'],
};

/** Total area (land + fresh water), km², Statistics Canada. */
const OFFICIAL_AREA_KM2: Record<string, number> = {
  NU: 2093190, QC: 1542056, NT: 1346106, ON: 1076395, BC: 944735, AB: 661848, SK: 651036,
  MB: 647797, YT: 482443, NL: 405212, NB: 72908, NS: 55284, PE: 5660,
};

describe('Canada provinces and territories', () => {
  it('has exactly 13: 10 provinces and 3 territories', () => {
    expect(PROVINCES).toHaveLength(13);
    expect(PROVINCES.filter((p) => p.kind === 'province')).toHaveLength(10);
    expect(PROVINCES.filter((p) => p.kind === 'territory').map((p) => p.abbr).sort()).toEqual(['NT', 'NU', 'YT']);
  });

  it('uses the official two-letter postal abbreviations, each once', () => {
    expect(new Set(ALL_PROVINCE_ABBRS).size).toBe(13);
    expect([...ALL_PROVINCE_ABBRS].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it('has kid-friendly English names', () => {
    for (const p of PROVINCES) {
      expect(p.name, p.abbr).toBe(EXPECTED[p.abbr][0]);
      expect(provinceName(p.abbr)).toBe(p.name);
    }
    // Plain "Quebec" on buttons; the French spelling is kept as an aka.
    expect(PROVINCE_BY_ABBR.get('QC')?.aka).toContain('Québec');
  });

  it('every one has exactly the expected quiz capital', () => {
    for (const p of PROVINCES) {
      expect(p.capital.trim(), p.abbr).not.toBe('');
      expect(provinceCapital(p.abbr), p.abbr).toBe(EXPECTED[p.abbr][1]);
    }
    expect(new Set(PROVINCES.map((p) => p.capital)).size).toBe(13);
  });

  it('every one is in a known region, and every region has members', () => {
    const regionIds = CANADA_REGIONS.map((r) => r.id);
    for (const p of PROVINCES) expect(regionIds).toContain(p.region);
    for (const r of regionIds) expect(PROVINCES.some((p) => p.region === r), r).toBe(true);
  });

  it('small-province callouts are real provinces', () => {
    for (const abbr of SMALL_PROVINCES) expect(PROVINCE_BY_ABBR.has(abbr)).toBe(true);
  });
});

describe('Canada map shapes (src/data/canada/provinces-50m.json)', () => {
  it('has exactly one shape per province/territory, joined by postal abbreviation', () => {
    expect(shapes).toHaveLength(13);
    expect([...shapeById.keys()].sort()).toEqual([...ALL_PROVINCE_ABBRS].sort());
  });

  it('every shape is non-empty and the right size (within 10% of the official area)', () => {
    for (const f of shapes) {
      const id = String(f.id);
      const km2 = geoArea(f) * KM2_PER_SR;
      expect(km2 / OFFICIAL_AREA_KM2[id], id).toBeGreaterThan(0.9);
      expect(km2 / OFFICIAL_AREA_KM2[id], id).toBeLessThan(1.1);
    }
  });

  it('Prince Edward Island keeps a real outline (not collapsed to a sliver)', () => {
    const pe = shapeById.get('PE')!;
    expect(pe.geometry.type).toBe('MultiPolygon');
    const ring = (pe.geometry as MultiPolygon).coordinates[0][0];
    expect(ring.length).toBeGreaterThanOrEqual(12);
  });

  it('shares real borders (so neighbor-aware coloring will work later)', () => {
    const geoms = canada.objects.provinces.geometries;
    const ids = geoms.map((g) => String(g.id));
    const nb = neighbors(geoms as Parameters<typeof neighbors>[0]);
    const touches = (a: string, b: string) => nb[ids.indexOf(a)].map((i) => ids[i]).includes(b);
    expect(touches('AB', 'SK')).toBe(true);
    expect(touches('ON', 'QC')).toBe(true);
    expect(touches('NB', 'NS')).toBe(true);
    expect(touches('YT', 'NT')).toBe(true);
    expect(touches('NT', 'NU')).toBe(true);
    expect(touches('PE', 'NB')).toBe(false); // an island
  });

  it('loads lazily through loadCanadaTopology()', async () => {
    const topo = await loadCanadaTopology();
    expect(topo.objects.provinces.geometries).toHaveLength(13);
    expect(await loadCanadaTopology()).toBe(topo);
  });
});
