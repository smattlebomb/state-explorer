/**
 * Game-layer configuration for World and Canada: what can be quizzed, how
 * it's scoped, and the words used on screen. The US layer keeps its own
 * screens and data (states.ts / regions.ts).
 *
 * Quiz pools only ever contain official items: the 195 countries (never
 * Taiwan, Kosovo, Greenland or other display-only places) or the 13
 * provinces and territories.
 */
import { CONTINENTS, COUNTRIES, COUNTRY_BY_ID, SUBREGIONS, SUBREGION_BY_ID, continentOf, placeName } from '../data/world';
import { CANADA_REGIONS, PROVINCES, PROVINCE_BY_ABBR } from '../data/canada';
import { CONTINENT_PALETTE } from './worldMap';
import type { GameLayer } from './layerProgress';

export interface Scope {
  /** 'all', 'c:<continent>' or 's:<sub-region>'. */
  id: string;
  label: string;
  emoji: string;
  /** Button color (dark enough for white text). */
  color: string;
  ids: readonly string[];
  /** For World: the continent this scope sits under (sub-regions are grouped under it on setup). */
  continent?: string;
}

export interface HintRegion {
  /** Every item in the hinted area (shaded on the map). */
  ids: ReadonlySet<string>;
  display: string;
  spoken: string;
}

export interface LayerConfig {
  id: GameLayer;
  title: string;
  emoji: string;
  /** "country" / "province or territory" */
  itemWord: string;
  itemsWord: string;
  allIds: readonly string[];
  /** First one is "all". */
  scopes: readonly Scope[];
  nameOf: (id: string) => string;
  /** Find It hint 2: the area the answer is in. */
  hintRegion: (id: string) => HintRegion;
}

const WORLD_SCOPES: Scope[] = [
  { id: 'all', label: 'All 195 countries', emoji: '🌍', color: '#047857', ids: COUNTRIES.map((c) => c.id) },
  ...CONTINENTS.filter((c) => c.id !== 'antarctica').map((c) => ({
    id: `c:${c.id}`,
    label: c.name,
    emoji: c.emoji,
    color: CONTINENT_PALETTE[c.id].solid,
    ids: COUNTRIES.filter((x) => continentOf(x) === c.id).map((x) => x.id),
  })),
  ...SUBREGIONS.filter((s) => s.id !== 'antarctica').map((s) => ({
    id: `s:${s.id}`,
    label: s.name,
    emoji: CONTINENTS.find((c) => c.id === s.continent)!.emoji,
    color: CONTINENT_PALETTE[s.continent].solid,
    ids: COUNTRIES.filter((x) => x.subregion === s.id).map((x) => x.id),
    continent: s.continent,
  })),
];

export const WORLD_LAYER: LayerConfig = {
  id: 'world',
  title: 'World',
  emoji: '🌍',
  itemWord: 'country',
  itemsWord: 'countries',
  allIds: COUNTRIES.map((c) => c.id),
  scopes: WORLD_SCOPES,
  nameOf: placeName,
  hintRegion: (id) => {
    const c = COUNTRY_BY_ID.get(id);
    if (!c) return { ids: new Set(), display: '', spoken: '' };
    const sub = SUBREGION_BY_ID.get(c.subregion)!;
    const continent = CONTINENTS.find((k) => k.id === sub.continent)!;
    const area = sub.id === 'caribbean' ? 'the Caribbean' : sub.name;
    // "Eastern Africa" already says Africa; "the Caribbean" gets ", in North America".
    const where = `${area}${sub.name.includes(continent.name) ? '' : `, in ${continent.name}`}`;
    return {
      ids: new Set(COUNTRIES.filter((x) => x.subregion === c.subregion).map((x) => x.id)),
      display: `💡 It's in ${where}.`,
      spoken: `${c.name} is in ${where}.`,
    };
  },
};

export const CANADA_LAYER: LayerConfig = {
  id: 'canada',
  title: 'Canada',
  emoji: '🍁',
  itemWord: 'province or territory',
  itemsWord: 'provinces and territories',
  allIds: PROVINCES.map((p) => p.abbr),
  // All 13 is the only scope: Canada's regions are 1–4 provinces each, too small for a round.
  scopes: [{ id: 'all', label: 'All 13', emoji: '🍁', color: '#dc2626', ids: PROVINCES.map((p) => p.abbr) }],
  nameOf: (id) => PROVINCE_BY_ABBR.get(id)?.name ?? placeName(id),
  hintRegion: (id) => {
    const p = PROVINCE_BY_ABBR.get(id);
    if (!p) return { ids: new Set(), display: '', spoken: '' };
    const r = CANADA_REGIONS.find((x) => x.id === p.region)!;
    return {
      ids: new Set(PROVINCES.filter((x) => x.region === p.region).map((x) => x.abbr)),
      display: `💡 It's in ${r.id === 'north' ? 'the North' : r.label}.`,
      spoken: `${p.name} is in ${r.id === 'north' ? 'the North' : r.label}.`,
    };
  },
};

export function layerConfig(layer: GameLayer): LayerConfig {
  return layer === 'world' ? WORLD_LAYER : CANADA_LAYER;
}

export function scopeOf(cfg: LayerConfig, id: string): Scope {
  return cfg.scopes.find((s) => s.id === id) ?? cfg.scopes[0];
}
