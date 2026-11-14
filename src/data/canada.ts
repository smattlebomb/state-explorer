/**
 * Canada layer: the 10 provinces + 3 territories, played like the US states.
 *
 * Plain data with no imports, so scripts/build-canada-topo.mjs can load it
 * with Node. Map geometry lives in src/data/canada/ and is loaded lazily
 * through src/data/canadaGeo.ts.
 *
 * Join key: `abbr` (the official Canada Post abbreviation) is the feature
 * `id` in src/data/canada/provinces-50m.json. See CANADA_NOTES.md.
 */

export type ProvinceKind = 'province' | 'territory';

/** Common five-way grouping of Canada; optional scoping for later games. */
export type CanadaRegionId = 'west' | 'prairies' | 'central' | 'atlantic' | 'north';

export interface ProvinceInfo {
  /** Two-letter postal abbreviation, used as the id everywhere. */
  abbr: string;
  /** English name used on buttons and labels. */
  name: string;
  /** Other names a kid may see (French spelling, nicknames). */
  aka?: readonly string[];
  kind: ProvinceKind;
  /** The capital used as the quiz answer. */
  capital: string;
  /** Learn-mode note about the capital, where there's a story worth telling. */
  capitalNote?: string;
  region: CanadaRegionId;
}

/** West → east, then the three northern territories. */
export const PROVINCES: readonly ProvinceInfo[] = [
  { abbr: 'BC', name: 'British Columbia', kind: 'province', capital: 'Victoria', region: 'west',
    capitalNote: 'Victoria is on Vancouver Island. The biggest city, Vancouver, is on the mainland.' },
  { abbr: 'AB', name: 'Alberta', kind: 'province', capital: 'Edmonton', region: 'prairies',
    capitalNote: 'Edmonton is the capital; Calgary is the biggest city.' },
  { abbr: 'SK', name: 'Saskatchewan', kind: 'province', capital: 'Regina', region: 'prairies' },
  { abbr: 'MB', name: 'Manitoba', kind: 'province', capital: 'Winnipeg', region: 'prairies' },
  { abbr: 'ON', name: 'Ontario', kind: 'province', capital: 'Toronto', region: 'central',
    capitalNote: 'Toronto is Ontario’s capital. Ottawa, the capital of all of Canada, is in Ontario too.' },
  { abbr: 'QC', name: 'Quebec', aka: ['Québec'], kind: 'province', capital: 'Quebec City', region: 'central',
    capitalNote: 'Quebec City (Québec in French) is one of the oldest cities in North America. Montreal is the biggest city.' },
  { abbr: 'NB', name: 'New Brunswick', kind: 'province', capital: 'Fredericton', region: 'atlantic' },
  { abbr: 'NS', name: 'Nova Scotia', kind: 'province', capital: 'Halifax', region: 'atlantic' },
  { abbr: 'PE', name: 'Prince Edward Island', aka: ['PEI'], kind: 'province', capital: 'Charlottetown', region: 'atlantic',
    capitalNote: 'Prince Edward Island is Canada’s smallest province.' },
  { abbr: 'NL', name: 'Newfoundland and Labrador', kind: 'province', capital: "St. John's", region: 'atlantic',
    capitalNote: 'St. John’s is on the island of Newfoundland. Labrador is the mainland part.' },
  { abbr: 'YT', name: 'Yukon', kind: 'territory', capital: 'Whitehorse', region: 'north' },
  { abbr: 'NT', name: 'Northwest Territories', kind: 'territory', capital: 'Yellowknife', region: 'north' },
  { abbr: 'NU', name: 'Nunavut', kind: 'territory', capital: 'Iqaluit', region: 'north',
    capitalNote: 'Nunavut is Canada’s newest and biggest territory (1999). Iqaluit is on Baffin Island.' },
];

export const CANADA_REGIONS: readonly { id: CanadaRegionId; label: string }[] = [
  { id: 'west', label: 'West Coast' },
  { id: 'prairies', label: 'Prairies' },
  { id: 'central', label: 'Central Canada' },
  { id: 'atlantic', label: 'Atlantic Canada' },
  { id: 'north', label: 'The North' },
];

export const PROVINCE_BY_ABBR: ReadonlyMap<string, ProvinceInfo> = new Map(PROVINCES.map((p) => [p.abbr, p]));
export const ALL_PROVINCE_ABBRS: readonly string[] = PROVINCES.map((p) => p.abbr);

/**
 * Small units that will want an enlarged tap target (like the US callout
 * boxes). PEI is only a few pixels across on a whole-Canada map.
 */
export const SMALL_PROVINCES: readonly string[] = ['PE'];

export function provinceName(abbr: string): string {
  return PROVINCE_BY_ABBR.get(abbr)?.name ?? abbr;
}

export function provinceCapital(abbr: string): string | undefined {
  return PROVINCE_BY_ABBR.get(abbr)?.capital;
}
