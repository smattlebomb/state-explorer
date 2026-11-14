/**
 * Game-layer configuration for World and Canada: what can be quizzed, how
 * it's scoped, and the words used on screen. The US layer keeps its own
 * screens and data (states.ts / regions.ts).
 *
 * Quiz pools only ever contain official items: the 195 countries (never
 * Taiwan, Kosovo, Greenland or other display-only places) or the 13
 * provinces and territories.
 */
import { CONTINENTS, COUNTRIES, COUNTRY_BY_ID, SUBREGIONS, SUBREGION_BY_ID, TERRITORY_BY_ID, continentOf, placeName } from '../data/world';
import { CANADA_REGIONS, PROVINCES, PROVINCE_BY_ABBR } from '../data/canada';
import { CONTINENT_PALETTE } from './worldMap';
import { ALL_ABBRS, STATE_BY_ABBR, stateName } from '../data/states';
import { REGION_COMPASS, REGION_PALETTE, REGIONS, getRegion } from '../data/regions';
import { STATE_CAPITALS, STATE_CAPITAL_NOTES } from '../data/stateCapitals';
import { COUNTRY_CAPITAL_AT, PROVINCE_CAPITAL_AT, STATE_CAPITAL_AT, type LonLat } from '../data/capitalCoords';
import type { AnyLayer } from './layerProgress';

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
  id: AnyLayer;
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
  /** The capital used as the quiz answer ('' for places without one, e.g. Antarctica). */
  capitalOf: (id: string) => string;
  /** Learn note about the capital (multi-capital countries, fun facts), if any. */
  capitalNote: (id: string) => string | undefined;
  /** Where the capital is, for the capital dot. */
  capitalAt: (id: string) => LonLat | undefined;
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
  capitalOf: (id) => COUNTRY_BY_ID.get(id)?.capital ?? TERRITORY_BY_ID.get(id)?.capital ?? '',
  capitalNote: (id) => COUNTRY_BY_ID.get(id)?.capitalNote,
  capitalAt: (id) => COUNTRY_CAPITAL_AT[id],
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
  capitalOf: (id) => PROVINCE_BY_ABBR.get(id)?.capital ?? '',
  capitalNote: (id) => PROVINCE_BY_ABBR.get(id)?.capitalNote,
  capitalAt: (id) => PROVINCE_CAPITAL_AT[id],
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

/**
 * The USA as a game layer. Only the capitals games use it: the US Find It /
 * Name It keep their original screens and save.
 */
export const USA_LAYER: LayerConfig = {
  id: 'usa',
  title: 'USA',
  emoji: '🇺🇸',
  itemWord: 'state',
  itemsWord: 'states',
  allIds: ALL_ABBRS,
  scopes: [
    { id: 'all', label: 'All 50', emoji: '🇺🇸', color: '#0284c7', ids: ALL_ABBRS },
    ...REGIONS.filter((r) => r.id !== 'all').map((r) => ({
      id: `r:${r.id}`,
      label: r.label,
      emoji: r.emoji,
      color: REGION_PALETTE[r.id as keyof typeof REGION_PALETTE].solid,
      ids: r.states,
    })),
  ],
  nameOf: stateName,
  hintRegion: (id) => {
    const info = STATE_BY_ABBR.get(id);
    if (!info) return { ids: new Set(), display: '', spoken: '' };
    const r = getRegion(info.region);
    return {
      ids: new Set(r.states),
      display: `💡 It's in the ${r.label}, ${REGION_COMPASS[info.region]}.`,
      spoken: `${info.name} is in the ${r.label}. That's ${REGION_COMPASS[info.region]}.`,
    };
  },
  capitalOf: (id) => STATE_CAPITALS[id] ?? '',
  capitalNote: (id) => STATE_CAPITAL_NOTES[id],
  capitalAt: (id) => STATE_CAPITAL_AT[id],
};

export function layerConfig(layer: AnyLayer): LayerConfig {
  return layer === 'world' ? WORLD_LAYER : layer === 'canada' ? CANADA_LAYER : USA_LAYER;
}

export function scopeOf(cfg: LayerConfig, id: string): Scope {
  return cfg.scopes.find((s) => s.id === id) ?? cfg.scopes[0];
}
