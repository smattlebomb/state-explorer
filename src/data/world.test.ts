import { describe, expect, it } from 'vitest';
import { geoArea } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import worldJson from './world/countries-50m.json';
import {
  CONTINENTS,
  COUNTRIES,
  COUNTRY_BY_ID,
  MAP_TERRITORIES,
  SUBREGIONS,
  SUBREGION_BY_ID,
  TERRITORY_BY_ID,
  continentOf,
  countriesInContinent,
  countriesInSubregion,
  placeName,
} from './world';
import { loadWorldTopology } from './worldGeo';

const world = worldJson as unknown as Topology<{ countries: GeometryCollection }>;
const shapes = feature(world, world.objects.countries).features;
const shapeById = new Map(shapes.map((f) => [String(f.id), f]));

describe('world country list', () => {
  it('has 195 official countries (193 UN members + Vatican City + Palestine)', () => {
    expect(COUNTRIES).toHaveLength(195);
    expect(COUNTRY_BY_ID.has('VA')).toBe(true);
    expect(COUNTRY_BY_ID.has('PS')).toBe(true);
  });

  it('has unique ISO alpha-2 ids, ISO numeric codes and names', () => {
    for (const c of COUNTRIES) {
      expect(c.id).toMatch(/^[A-Z]{2}$/);
      expect(c.numeric).toMatch(/^\d{3}$/);
    }
    expect(new Set(COUNTRIES.map((c) => c.id)).size).toBe(195);
    expect(new Set(COUNTRIES.map((c) => c.numeric)).size).toBe(195);
    expect(new Set(COUNTRIES.map((c) => c.name)).size).toBe(195);
  });

  it('does not count display-only places as quiz countries', () => {
    for (const id of ['TW', 'XK', 'GL', 'EH', 'PR', 'HK', 'AQ']) expect(COUNTRY_BY_ID.has(id)).toBe(false);
    for (const t of MAP_TERRITORIES) expect(COUNTRY_BY_ID.has(t.id)).toBe(false);
  });
});

describe('continents and sub-regions', () => {
  it('has the 7 continents', () => {
    expect(CONTINENTS.map((c) => c.id).sort()).toEqual(
      ['africa', 'antarctica', 'asia', 'europe', 'north-america', 'oceania', 'south-america'],
    );
  });

  it('every sub-region nests under a real continent, and ids are unique', () => {
    const continentIds = new Set(CONTINENTS.map((c) => c.id));
    expect(new Set(SUBREGIONS.map((s) => s.id)).size).toBe(SUBREGIONS.length);
    for (const s of SUBREGIONS) expect(continentIds.has(s.continent)).toBe(true);
  });

  it('every country has exactly one known sub-region and so one continent', () => {
    for (const c of COUNTRIES) {
      expect(SUBREGION_BY_ID.has(c.subregion), c.id).toBe(true);
      expect(CONTINENTS.some((k) => k.id === continentOf(c))).toBe(true);
    }
    const perSubregion = SUBREGIONS.map((s) => countriesInSubregion(s.id).length);
    expect(perSubregion.reduce((a, b) => a + b, 0)).toBe(195);
  });

  it('every sub-region except Antarctica has countries', () => {
    for (const s of SUBREGIONS) {
      if (s.id === 'antarctica') expect(countriesInSubregion(s.id)).toHaveLength(0);
      else expect(countriesInSubregion(s.id).length, s.id).toBeGreaterThan(0);
    }
  });

  it('has the standard number of countries per continent', () => {
    const count = (id: Parameters<typeof countriesInContinent>[0]) => countriesInContinent(id).length;
    expect(count('africa')).toBe(54);
    expect(count('asia')).toBe(48); // includes Palestine
    expect(count('europe')).toBe(44); // includes Vatican City; Russia counts here
    expect(count('north-america')).toBe(23);
    expect(count('south-america')).toBe(12);
    expect(count('oceania')).toBe(14);
    expect(count('antarctica')).toBe(0);
  });

  it('puts some well-known countries where kids expect them', () => {
    const sub = (id: string) => COUNTRY_BY_ID.get(id)?.subregion;
    expect(sub('FR')).toBe('western-europe');
    expect(sub('VN')).toBe('southeastern-asia');
    expect(sub('JM')).toBe('caribbean');
    expect(sub('EG')).toBe('northern-africa');
    expect(sub('BR')).toBe('south-america');
    expect(sub('US')).toBe('northern-america');
    expect(sub('AU')).toBe('australia-new-zealand');
  });
});

describe('country capitals', () => {
  it('every quiz country has one non-empty capital', () => {
    for (const c of COUNTRIES) {
      expect(c.capital.trim(), c.id).not.toBe('');
      expect(c.capital).toBe(c.capital.trim());
    }
  });

  it('no two countries share a capital name (so "which country has capital X?" has one answer)', () => {
    expect(new Set(COUNTRIES.map((c) => c.capital)).size).toBe(195);
  });

  it('multi-capital countries quiz one capital and explain the others', () => {
    const za = COUNTRY_BY_ID.get('ZA')!;
    expect(za.capital).toBe('Pretoria');
    expect(za.capitalNote).toContain('Cape Town');
    expect(za.capitalNote).toContain('Bloemfontein');

    const bo = COUNTRY_BY_ID.get('BO')!;
    expect(bo.capital).toBe('Sucre');
    expect(bo.capitalNote).toContain('La Paz');

    expect(COUNTRY_BY_ID.get('NL')?.capital).toBe('Amsterdam');
    expect(COUNTRY_BY_ID.get('NL')?.capitalNote).toContain('The Hague');
    expect(COUNTRY_BY_ID.get('CI')?.capitalNote).toContain('Abidjan');
    expect(COUNTRY_BY_ID.get('BJ')?.capitalNote).toContain('Cotonou');
    expect(COUNTRY_BY_ID.get('LK')?.capitalNote).toContain('Colombo');
    expect(COUNTRY_BY_ID.get('MY')?.capitalNote).toContain('Putrajaya');
    expect(COUNTRY_BY_ID.get('SZ')?.capitalNote).toContain('Lobamba');
    expect(COUNTRY_BY_ID.get('TZ')?.capitalNote).toContain('Dar es Salaam');
  });

  it('spot-checks a few capitals', () => {
    const cap = (id: string) => COUNTRY_BY_ID.get(id)?.capital;
    expect(cap('US')).toBe('Washington, D.C.');
    expect(cap('CA')).toBe('Ottawa');
    expect(cap('AU')).toBe('Canberra');
    expect(cap('BR')).toBe('Brasília');
    expect(cap('TR')).toBe('Ankara');
    expect(cap('NG')).toBe('Abuja');
    expect(cap('MM')).toBe('Naypyidaw');
    expect(cap('KZ')).toBe('Astana');
    expect(cap('UA')).toBe('Kyiv');
  });
});

describe('world map shapes (src/data/world/countries-50m.json)', () => {
  it('feature ids are unique', () => {
    expect(shapeById.size).toBe(shapes.length);
  });

  it('every quiz country has a shape, joined by its id', () => {
    const missing = COUNTRIES.filter((c) => !shapeById.has(c.id)).map((c) => c.id);
    expect(missing).toEqual([]);
  });

  it('every display-only territory has a shape', () => {
    const missing = MAP_TERRITORIES.filter((t) => !shapeById.has(t.id)).map((t) => t.id);
    expect(missing).toEqual([]);
  });

  it('every shape is either a quiz country or a display-only territory', () => {
    for (const f of shapes) {
      const id = String(f.id);
      expect(COUNTRY_BY_ID.has(id) || TERRITORY_BY_ID.has(id), id).toBe(true);
    }
    expect(shapes).toHaveLength(COUNTRIES.length + MAP_TERRITORIES.length);
  });

  it('no shape collapsed or turned inside out when simplified (including Vatican City, Monaco, Tuvalu)', () => {
    for (const f of shapes) {
      const a = geoArea(f);
      expect(a, String(f.id)).toBeGreaterThan(0);
      expect(a, String(f.id)).toBeLessThan(2 * Math.PI);
    }
    // Russia should be by far bigger than Vatican City.
    expect(geoArea(shapeById.get('RU')!)).toBeGreaterThan(1e5 * geoArea(shapeById.get('VA')!));
  });

  it('loads lazily through loadWorldTopology()', async () => {
    const topo = await loadWorldTopology();
    expect(topo.objects.countries.geometries).toHaveLength(shapes.length);
    expect(await loadWorldTopology()).toBe(topo);
  });
});

describe('display-only territories', () => {
  it('have unique ids, names and kid-friendly notes', () => {
    expect(new Set(MAP_TERRITORIES.map((t) => t.id)).size).toBe(MAP_TERRITORIES.length);
    for (const t of MAP_TERRITORIES) {
      expect(t.name.trim(), t.id).not.toBe('');
      expect(t.note.length, t.id).toBeGreaterThan(10);
      expect(t.note, t.id).not.toContain('undefined');
      expect(SUBREGION_BY_ID.has(t.subregion), t.id).toBe(true);
    }
  });

  it('territories point at the quiz country they belong to', () => {
    for (const t of MAP_TERRITORIES) {
      if (t.status === 'territory') expect(COUNTRY_BY_ID.has(t.belongsTo ?? ''), t.id).toBe(true);
      else expect(t.belongsTo, t.id).toBeUndefined();
    }
  });

  it('includes the widely shown ones with sensible labels', () => {
    expect(placeName('TW')).toBe('Taiwan');
    expect(placeName('XK')).toBe('Kosovo');
    expect(placeName('GL')).toBe('Greenland');
    expect(placeName('EH')).toBe('Western Sahara');
    expect(placeName('PR')).toBe('Puerto Rico');
    expect(TERRITORY_BY_ID.get('GL')?.belongsTo).toBe('DK');
    expect(TERRITORY_BY_ID.get('PR')?.belongsTo).toBe('US');
    expect(TERRITORY_BY_ID.get('TW')?.status).toBe('partially-recognized');
    expect(TERRITORY_BY_ID.get('XK')?.status).toBe('partially-recognized');
    expect(TERRITORY_BY_ID.get('TW')?.capital).toBe('Taipei');
    expect(TERRITORY_BY_ID.get('XK')?.capital).toBe('Pristina');
  });
});
