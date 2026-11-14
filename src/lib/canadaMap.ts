/**
 * Canada map geometry (10 provinces + 3 territories), built once from the
 * lazily loaded TopoJSON.
 *
 * Projection: Lambert conformal conic centered on 96°W with standard
 * parallels 49°N and 77°N, the usual projection for maps of Canada (Statistics
 * Canada uses a similar one). The north doesn't balloon like Mercator.
 *
 * Prince Edward Island gets a callout box out in the Atlantic, like the tiny
 * US Northeast states, so it is always easy to tap.
 */
import { geoConicConformal, geoPath, type GeoProjection } from 'd3-geo';
import { feature, neighbors as topoNeighbors } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { CanadaTopology } from '../data/canadaGeo';
import { CANADA_REGIONS, PROVINCES, PROVINCE_BY_ABBR, SMALL_PROVINCES, type CanadaRegionId } from '../data/canada';
import { REGION_PALETTE } from '../data/regions';
import type { RegionId } from '../data/states';
import { projectRings } from './geo';
import { hitTest, type HitBox, type HitShape, type Pt } from './hittest';
import type { ViewBox } from './mapZoom';
import { colorGraph } from './regionColors';

export const CANADA_WIDTH = 1000;
/** A bit deeper than the US map's 8×: the Arctic islands are worth a close look. */
export const CANADA_MAX_SCALE = 12;

export interface ProvinceShape extends HitShape {
  name: string;
  d: string;
  /** Label point: center of the biggest piece. */
  anchor: Pt;
}

export interface ProvinceCallout extends HitBox {
  anchor: Pt;
}

export interface CanadaGeometry {
  view: ViewBox;
  shapes: ProvinceShape[];
  byId: Map<string, ProvinceShape>;
  callouts: ProvinceCallout[];
  neighbors: Map<string, Set<string>>;
  /** The map's projection (to place capital dots). */
  projection: GeoProjection;
}

const CALLOUT = { w: 190, h: 56 };

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

let cached: { topo: CanadaTopology; geo: CanadaGeometry } | null = null;

export function buildCanadaGeometry(topo: CanadaTopology): CanadaGeometry {
  if (cached?.topo === topo) return cached.geo;
  const fc = feature(topo, topo.objects.provinces) as FeatureCollection<Geometry>;
  const projection = geoConicConformal().rotate([96, 0]).parallels([49, 77]).fitWidth(CANADA_WIDTH - 20, fc);
  projection.translate([projection.translate()[0] + 10, projection.translate()[1] + 10]);
  const path = geoPath(projection);

  const shapes: ProvinceShape[] = (fc.features as Feature<Geometry>[]).map((f) => {
    const id = String(f.id);
    const rings = projectRings(f, (sink) => projection.stream(sink));
    const biggest = rings.reduce((a, b) => (Math.abs(ringArea(b)) > Math.abs(ringArea(a)) ? b : a));
    const [[x0, y0], [x1, y1]] = path.bounds(f);
    return { id, name: PROVINCE_BY_ABBR.get(id)?.name ?? id, d: path(f) ?? '', rings, bbox: [x0, y0, x1, y1], anchor: ringCentroid(biggest) };
  });
  const byId = new Map(shapes.map((s) => [s.id, s]));

  const [[bx0, by0], [bx1, by1]] = path.bounds(fc);
  // Callouts sit in the Atlantic, below and to the right of their province.
  const callouts: ProvinceCallout[] = SMALL_PROVINCES.map((id) => {
    const a = byId.get(id)!.anchor;
    const x = Math.min(bx1 + 10 - CALLOUT.w, a[0] + 40);
    return { id, x, y: a[1] + 90, w: CALLOUT.w, h: CALLOUT.h, anchor: a };
  });

  const x0 = Math.min(bx0, ...callouts.map((c) => c.x)) - 10;
  const y0 = Math.min(by0, ...callouts.map((c) => c.y)) - 10;
  const x1 = Math.max(bx1, ...callouts.map((c) => c.x + c.w)) + 10;
  const y1 = Math.max(by1, ...callouts.map((c) => c.y + c.h)) + 10;
  const view: ViewBox = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };

  const geoms = topo.objects.provinces.geometries;
  const nbrIdx = topoNeighbors(geoms as Parameters<typeof topoNeighbors>[0]);
  const neighbors = new Map<string, Set<string>>(shapes.map((s) => [s.id, new Set<string>()]));
  nbrIdx.forEach((list, i) => {
    for (const j of list) neighbors.get(String(geoms[i].id))?.add(String(geoms[j].id));
  });

  const geo = { view, shapes, byId, callouts, neighbors, projection };
  cached = { topo, geo };
  return geo;
}

/** Which province/territory a tap at `p` (map units) means: the PEI box first, then shapes. */
export function pickProvince(geo: CanadaGeometry, p: Pt, pxPerUnit: number, tolerancePx = 16): string | null {
  return hitTest(p, geo.shapes, tolerancePx / pxPerUnit, geo.callouts);
}

/** Canada's regions borrow the US region hues so the whole app feels like one atlas. */
export const CANADA_REGION_HUE: Record<CanadaRegionId, RegionId> = {
  west: 'west',
  prairies: 'midwest',
  central: 'southwest',
  atlantic: 'northeast',
  north: 'southeast',
};

export function canadaRegionSolid(id: CanadaRegionId): string {
  return REGION_PALETTE[CANADA_REGION_HUE[id]].solid;
}

/** Province → fill: its region's hue, tint picked so neighbors in the region differ. */
export function canadaFills(geo: CanadaGeometry): Map<string, string> {
  const fills = new Map<string, string>();
  for (const r of CANADA_REGIONS) {
    const ids = PROVINCES.filter((p) => p.region === r.id).map((p) => p.abbr);
    const tints = REGION_PALETTE[CANADA_REGION_HUE[r.id]].tints;
    for (const [id, i] of colorGraph(ids, geo.neighbors, tints.length)) fills.set(id, tints[i % tints.length]);
  }
  return fills;
}
