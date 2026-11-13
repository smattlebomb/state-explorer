import { STATES, type RegionId } from './states';

export interface Region {
  id: RegionId | 'all';
  label: string;
  emoji: string;
  /** Tailwind background class for the picker button. */
  color: string;
  states: readonly string[];
}

/** Where each region sits on the map, in kid words (used by hints and the region tour). */
export const REGION_COMPASS: Record<RegionId, string> = {
  northeast: 'the top right of the map',
  southeast: 'the bottom right of the map',
  midwest: 'the top middle of the map',
  southwest: 'the bottom middle of the map',
  west: 'the left side of the map',
};

/**
 * Region color coding. Five hues based on the Okabe–Ito colorblind-safe
 * palette: blue, bluish green, warm yellow, orange and purple. That avoids
 * any red-vs-green-only contrast. Each region has 3 tints of its hue
 * (alternated so neighbors differ) and a dark "solid" for buttons/legend
 * that keeps white text readable.
 */
export interface RegionPalette {
  hue: string;
  tints: readonly [string, string, string];
  solid: string;
}

export const REGION_PALETTE: Record<RegionId, RegionPalette> = {
  northeast: { hue: 'blue', tints: ['#8fc9ee', '#b5dcf6', '#68b3e3'], solid: '#0072b2' },
  southeast: { hue: 'green', tints: ['#7fd3b5', '#a9e3cd', '#55c19b'], solid: '#00805f' },
  midwest: { hue: 'yellow', tints: ['#f3e47a', '#f9efab', '#e8d244'], solid: '#8a6d00' },
  southwest: { hue: 'orange', tints: ['#f5bd5a', '#f9d595', '#eea52c'], solid: '#b35500' },
  west: { hue: 'purple', tints: ['#c3aee8', '#d9cbf2', '#b39be0'], solid: '#6a4fb0' },
};

/** Soft map tint for shading a whole region (hint 2 / region tour when region colors are off). */
export const REGION_TINT: Record<RegionId, string> = {
  northeast: REGION_PALETTE.northeast.tints[1],
  southeast: REGION_PALETTE.southeast.tints[1],
  midwest: REGION_PALETTE.midwest.tints[1],
  southwest: REGION_PALETTE.southwest.tints[1],
  west: REGION_PALETTE.west.tints[1],
};

/** Explicit lists (kept explicit on purpose so they are easy to read and test). */
export const REGION_STATES: Record<RegionId, readonly string[]> = {
  northeast: ['CT', 'DE', 'ME', 'MD', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
  southeast: ['AL', 'AR', 'FL', 'GA', 'KY', 'LA', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV'],
  midwest: ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'],
  southwest: ['AZ', 'NM', 'OK', 'TX'],
  west: ['AK', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'OR', 'UT', 'WA', 'WY'],
};

export const REGIONS: readonly Region[] = [
  { id: 'all', label: 'All 50', emoji: '🇺🇸', color: 'bg-sky-600', states: STATES.map((s) => s.abbr) },
  // Button colors match REGION_PALETTE[...].solid so tiles, legend and map agree.
  { id: 'northeast', label: 'Northeast', emoji: '🦞', color: 'bg-[#0072b2]', states: REGION_STATES.northeast },
  { id: 'southeast', label: 'Southeast', emoji: '🍑', color: 'bg-[#00805f]', states: REGION_STATES.southeast },
  { id: 'midwest', label: 'Midwest', emoji: '🌽', color: 'bg-[#8a6d00]', states: REGION_STATES.midwest },
  { id: 'southwest', label: 'Southwest', emoji: '🌵', color: 'bg-[#b35500]', states: REGION_STATES.southwest },
  { id: 'west', label: 'West', emoji: '🏔️', color: 'bg-[#6a4fb0]', states: REGION_STATES.west },
];

export function getRegion(id: Region['id']): Region {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0];
}
