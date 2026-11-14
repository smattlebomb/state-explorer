/**
 * US counties (tap-to-explore only, never graded). Counties are US-only.
 *
 * Shapes are projected with the exact AlbersUSA projection of the state map
 * (lib/geo.ts), so county outlines line up with the state outlines. Only the
 * focused state's counties are projected (Texas, the biggest, has 254), which
 * keeps it quick on an iPad.
 */
import { geoPath, type GeoProjection } from 'd3-geo';
import { feature, neighbors as topoNeighbors } from 'topojson-client';
import type { Feature, Geometry } from 'geojson';
import type { CountyTopology } from '../data/countiesGeo';
import { REGION_PALETTE } from '../data/regions';
import { STATE_BY_ABBR, STATE_BY_FIPS } from '../data/states';
import { projectRings } from './geo';
import { hitTest, hitTestMarkers, type HitMarker, type HitShape, type Pt } from './hittest';
import type { ViewBox } from './mapZoom';

/** Deepest zoom in the counties view, from the whole-state view. (The state games stay at 8×.) */
export const COUNTY_MAX_SCALE = 16;

export type CountyKind = 'county' | 'parish' | 'borough' | 'census area' | 'city' | 'municipality' | 'city and borough';

export interface CountyShape extends HitShape {
  /** 5-digit FIPS code. */
  id: string;
  /** Name as kids see it, e.g. "Franklin County", "Orleans Parish", "Richmond (city)". */
  label: string;
  kind: CountyKind;
  d: string;
  anchor: Pt;
  /** Biggest side of the bounding box, map units. */
  size: number;
}

export interface StateCounties {
  state: string;
  counties: CountyShape[];
  byId: Map<string, CountyShape>;
  neighbors: Map<string, Set<string>>;
}

/** Alaska's census areas (2017 boundaries, as in us-atlas 3). */
const AK_CENSUS_AREAS = new Set(['02016', '02050', '02070', '02105', '02158', '02180', '02198', '02240', '02261', '02290']);
const AK_CITY_AND_BOROUGH = new Set(['02110', '02220', '02275', '02282']);
/** Independent cities outside Virginia (Virginia's are every code from 510 up). */
const OTHER_INDEPENDENT_CITIES = new Set(['24510', '29510']);

/** The state (postal abbr) a county belongs to, or undefined for DC and the territories. */
export function stateOfCounty(fips: string): string | undefined {
  return STATE_BY_FIPS.get(fips.slice(0, 2))?.abbr;
}

export function countyKind(fips: string): CountyKind {
  const st = fips.slice(0, 2);
  const code = Number(fips.slice(2));
  if (st === '22') return 'parish';
  if (st === '02') {
    if (fips === '02020') return 'municipality';
    if (AK_CENSUS_AREAS.has(fips)) return 'census area';
    if (AK_CITY_AND_BOROUGH.has(fips)) return 'city and borough';
    return 'borough';
  }
  if ((st === '51' && code >= 510) || OTHER_INDEPENDENT_CITIES.has(fips)) return 'city';
  if (fips === '32510') return 'city'; // Carson City
  return 'county';
}

/** "Franklin" + 39049 → "Franklin County". */
export function countyLabel(fips: string, name: string): string {
  switch (countyKind(fips)) {
    case 'parish':
      return `${name} Parish`;
    case 'borough':
      return `${name} Borough`;
    case 'census area':
      return `${name} Census Area`;
    case 'city and borough':
      return `${name} City and Borough`;
    case 'municipality':
      return `${name} Municipality`;
    case 'city':
      return /city$/i.test(name) ? name : `${name} (city)`;
    default:
      return `${name} County`;
  }
}

/** All county geometries for the 50 states (drops DC and the territories). */
export function stateCountyGeometries(topo: CountyTopology) {
  return topo.objects.counties.geometries.filter((g) => stateOfCounty(String(g.id)) !== undefined);
}

function ringArea(r: readonly Pt[]): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return a / 2;
}

function ringCentroid(r: readonly Pt[]): Pt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    a += f;
    cx += (r[j][0] + r[i][0]) * f;
    cy += (r[j][1] + r[i][1]) * f;
  }
  return Math.abs(a) < 1e-9 ? r[0] : [cx / (3 * a), cy / (3 * a)];
}

const cache = new WeakMap<CountyTopology, Map<string, StateCounties>>();

/** Project one state's counties (cached per topology + state). */
export function buildStateCounties(topo: CountyTopology, abbr: string, projection: GeoProjection): StateCounties {
  let perTopo = cache.get(topo);
  if (!perTopo) cache.set(topo, (perTopo = new Map()));
  const hit = perTopo.get(abbr);
  if (hit) return hit;

  const fips = STATE_BY_ABBR.get(abbr)?.fips;
  const geoms = topo.objects.counties.geometries.filter((g) => String(g.id).slice(0, 2) === fips);
  const path = geoPath(projection);
  const counties: CountyShape[] = [];
  for (const g of geoms) {
    const f = feature(topo, g) as Feature<Geometry, { name: string }>;
    const id = String(g.id);
    const rings = projectRings(f, (sink) => projection.stream(sink));
    if (rings.length === 0) continue;
    const biggest = rings.reduce((a, b) => (Math.abs(ringArea(b)) > Math.abs(ringArea(a)) ? b : a));
    const [[x0, y0], [x1, y1]] = path.bounds(f);
    counties.push({
      id,
      label: countyLabel(id, f.properties.name),
      kind: countyKind(id),
      d: path(f) ?? '',
      rings,
      bbox: [x0, y0, x1, y1],
      anchor: ringCentroid(biggest),
      size: Math.max(x1 - x0, y1 - y0),
    });
  }
  const byId = new Map(counties.map((c) => [c.id, c]));

  const nbrIdx = topoNeighbors(geoms as Parameters<typeof topoNeighbors>[0]);
  const neighbors = new Map<string, Set<string>>(counties.map((c) => [c.id, new Set<string>()]));
  nbrIdx.forEach((list, i) => {
    const a = String(geoms[i].id);
    // A county can share an arc with itself (e.g. Hardin County, Illinois); that isn't a neighbor.
    for (const j of list) if (String(geoms[j].id) !== a) neighbors.get(a)?.add(String(geoms[j].id));
  });

  const result = { state: abbr, counties, byId, neighbors };
  perTopo.set(abbr, result);
  return result;
}

/** View box for the counties of one state: its outline, padded, widened to the screen's shape. */
export function stateCountyView(bbox: readonly [number, number, number, number], mapWidth: number, aspect = 1.6): ViewBox {
  const [x0, y0, x1, y1] = bbox;
  const pad = Math.max(6, 0.06 * Math.max(x1 - x0, y1 - y0));
  let w = Math.max(x1 - x0 + pad * 2, mapWidth * 0.1);
  let h = y1 - y0 + pad * 2;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h };
}

/** Dots for counties too small to tap at the current zoom (they hide once the real shape is big enough). */
export function countyMarkers(sc: StateCounties, pxPerUnit: number, radiusPx: number): HitMarker[] {
  return sc.counties
    .filter((c) => c.size * pxPerUnit < 14)
    .map((c) => ({ id: c.id, x: c.anchor[0], y: c.anchor[1], r: radiusPx / pxPerUnit }));
}

export const COUNTY_DOT_PX = { draw: 6, hit: 16 };

/**
 * Which county a tap means: a dot under the finger first (tiny cities), then
 * the county under the finger, then the nearest county within `tolerancePx`.
 */
export function pickCounty(sc: StateCounties, p: Pt, pxPerUnit: number, tolerancePx = 8): string | null {
  return hitTestMarkers(p, countyMarkers(sc, pxPerUnit, COUNTY_DOT_PX.hit)) ?? hitTest(p, sc.counties, tolerancePx / pxPerUnit);
}

/** Mix two #rrggbb colors (t = 0 → a, 1 → b). */
function mix(a: string, b: string, t: number): string {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((na >> shift) & 255) * (1 - t) + ((nb >> shift) & 255) * t);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Greedy "DSatur" coloring: always color the county with the most differently
 * colored neighbors next. Fast (no backtracking, which could take forever on
 * Texas's 254 counties). On real county maps it needs at most 5 colors.
 */
export function greedyColors(ids: readonly string[], adj: ReadonlyMap<string, ReadonlySet<string>>): Map<string, number> {
  const color = new Map<string, number>();
  const left = new Set(ids);
  while (left.size) {
    let best = '';
    let bestSat = -1;
    let bestDeg = -1;
    for (const id of left) {
      const nb = [...(adj.get(id) ?? [])];
      const sat = new Set(nb.map((n) => color.get(n)).filter((c) => c !== undefined)).size;
      const deg = nb.filter((n) => left.has(n)).length;
      if (sat > bestSat || (sat === bestSat && (deg > bestDeg || (deg === bestDeg && id < best)))) {
        best = id;
        bestSat = sat;
        bestDeg = deg;
      }
    }
    const used = new Set([...(adj.get(best) ?? [])].map((n) => color.get(n)));
    let c = 0;
    while (used.has(c)) c++;
    color.set(best, c);
    left.delete(best);
  }
  return color;
}

/** County → fill: the state's region hue, in 5 tints chosen so bordering counties differ. */
export function countyFills(sc: StateCounties): Map<string, string> {
  const region = STATE_BY_ABBR.get(sc.state)?.region ?? 'west';
  const { tints: t, solid } = REGION_PALETTE[region];
  // The region's 3 tints, plus a very light and a slightly deeper one (DSatur needs 5 in a few states).
  const tints = [t[0], t[1], t[2], mix(t[1], '#ffffff', 0.55), mix(t[2], solid, 0.3)];
  const colors = greedyColors(sc.counties.map((c) => c.id), sc.neighbors);
  return new Map([...colors].map(([id, i]) => [id, tints[i % tints.length]]));
}
