/**
 * World map geometry, built once from the lazily loaded world TopoJSON.
 *
 * Projection: Natural Earth (geoNaturalEarth1), rotated 11° east so the
 * antimeridian cut runs through the empty Pacific without slicing Russia's
 * Chukotka or Fiji. It's the familiar "school atlas" look: continents keep
 * recognizable shapes, poles aren't blown up like Mercator. The view is
 * cropped just below the Antarctic coast, so Antarctica is a tappable strip
 * instead of a huge white band.
 *
 * Pure functions (no React), so they can be tested in Node.
 */
import { geoNaturalEarth1, geoPath, type GeoProjection } from 'd3-geo';
import { feature, neighbors as topoNeighbors } from 'topojson-client';
import type { Feature, Geometry } from 'geojson';
import type { WorldTopology } from '../data/worldGeo';
import {
  CONTINENTS,
  COUNTRY_BY_ID,
  SUBREGIONS,
  TERRITORY_BY_ID,
  continentOf,
  type ContinentId,
  type SubregionId,
} from '../data/world';
import { projectRings } from './geo';
import { hitTest, hitTestMarkers, type HitMarker, type HitShape, type Pt, type Ring } from './hittest';
import type { ViewBox } from './mapZoom';
import { colorGraph } from './regionColors';

export const WORLD_WIDTH = 1000;
/** Deepest zoom on the world map (the US map stops at 8×). */
export const WORLD_MAX_SCALE = 20;

/** Countries narrower than this (map units at the whole-world view) get a dot marker… */
const SMALL_SIZE = 9;
/** …and so do spread-out island groups with very little land (√area below this, e.g. Tuvalu, Kiribati). */
const SMALL_LAND = 3;
/** A piece counts toward a country's "main" area if it's at least this share of its biggest piece. */
const MAIN_PIECE_SHARE = 0.18;

export interface PlaceShape extends HitShape {
  name: string;
  kind: 'country' | 'territory';
  continent: ContinentId;
  subregion: SubregionId;
  /** SVG path. */
  d: string;
  /** Label / marker point: the center of the biggest piece (mainland France, not French Guiana). */
  anchor: Pt;
  /** The country's main pieces (drops far-away small islands), used to frame zoomed views. */
  mainBox: [number, number, number, number];
  /** Too small to tap reliably at world scale: draw a dot marker for it. */
  small: boolean;
}

export interface WorldGeometry {
  /** The whole-world view (cropped below Antarctica's coast). */
  view: ViewBox;
  shapes: PlaceShape[];
  byId: Map<string, PlaceShape>;
  /** Which places share a border (from the topology arcs). */
  neighbors: Map<string, Set<string>>;
  projection: GeoProjection;
}

/**
 * Where to label instead of the biggest piece's center. Kiribati's biggest
 * island is far east of its capital; Russia is labeled in its European part,
 * which is where it shows up when zoomed into Eastern Europe.
 */
const ANCHOR_LONLAT: Record<string, [number, number]> = {
  KI: [173.0, 1.4],
  RU: [42, 57],
};

/**
 * Frame only this lon/lat box when zooming in. Russia: the European part,
 * west of the Urals. Kiribati: the Gilbert Islands around the capital (its
 * islands straddle the date line, which would stretch the view across the
 * whole Pacific).
 */
const MAIN_LONLAT_BOX: Record<string, [[number, number], [number, number]]> = {
  RU: [[27, 41], [60, 70]],
  KI: [[172, -3], [177, 4]],
};

function ringArea(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return a / 2;
}

function ringCentroid(r: Ring): Pt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    a += f;
    cx += (r[j][0] + r[i][0]) * f;
    cy += (r[j][1] + r[i][1]) * f;
  }
  if (Math.abs(a) < 1e-9) return r[0];
  return [cx / (3 * a), cy / (3 * a)];
}

function ringBox(r: Ring): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of r) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

function unionBox(boxes: readonly [number, number, number, number][]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]);
    x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
  }
  return [x0, y0, x1, y1];
}

let cached: { topo: WorldTopology; geo: WorldGeometry } | null = null;

export function buildWorldGeometry(topo: WorldTopology): WorldGeometry {
  if (cached?.topo === topo) return cached.geo;

  const projection = geoNaturalEarth1().rotate([-11, 0]).fitWidth(WORLD_WIDTH, { type: 'Sphere' });
  const path = geoPath(projection);
  const features = feature(topo, topo.objects.countries).features as Feature<Geometry>[];

  const shapes: PlaceShape[] = [];
  for (const f of features) {
    const id = String(f.id);
    const country = COUNTRY_BY_ID.get(id);
    const territory = TERRITORY_BY_ID.get(id);
    const info = country ?? territory;
    if (!info) continue; // every shape is in the catalog (world.test.ts), but stay safe
    const rings = projectRings(f, (sink) => projection.stream(sink));
    if (rings.length === 0) continue;

    const sized = rings.map((r) => ({ r, area: Math.abs(ringArea(r)), box: ringBox(r) }));
    const biggest = sized.reduce((a, b) => (b.area > a.area ? b : a));
    const override = ANCHOR_LONLAT[id] && projection(ANCHOR_LONLAT[id]);
    const anchor: Pt = override ? [override[0], override[1]] : ringCentroid(biggest.r);

    const lonlatBox = MAIN_LONLAT_BOX[id];
    let mainBox: [number, number, number, number];
    if (lonlatBox) {
      const a = projection(lonlatBox[0])!;
      const b = projection(lonlatBox[1])!;
      mainBox = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
    } else {
      mainBox = unionBox(sized.filter((s) => s.area >= biggest.area * MAIN_PIECE_SHARE).map((s) => s.box));
    }

    const [[x0, y0], [x1, y1]] = path.bounds(f);
    const mainW = mainBox[2] - mainBox[0];
    const mainH = mainBox[3] - mainBox[1];
    shapes.push({
      id,
      name: info.name,
      kind: country ? 'country' : 'territory',
      continent: continentOf(info),
      subregion: info.subregion,
      d: path(f) ?? '',
      rings,
      bbox: [x0, y0, x1, y1],
      anchor,
      mainBox,
      small: Math.max(mainW, mainH) < SMALL_SIZE || Math.sqrt(sized.reduce((a, s) => a + s.area, 0)) < SMALL_LAND,
    });
  }
  const byId = new Map(shapes.map((s) => [s.id, s]));

  const geoms = topo.objects.countries.geometries;
  const nbrIdx = topoNeighbors(geoms as Parameters<typeof topoNeighbors>[0]);
  const neighbors = new Map<string, Set<string>>(shapes.map((s) => [s.id, new Set<string>()]));
  nbrIdx.forEach((list, i) => {
    const a = String(geoms[i].id);
    for (const j of list) {
      const b = String(geoms[j].id);
      if (a !== b) neighbors.get(a)?.add(b);
    }
  });

  // Whole world, cropped: from the top of the land down to just below Antarctica's coast.
  const top = Math.min(...shapes.filter((s) => s.id !== 'AQ').map((s) => s.bbox[1])) - 6;
  const bottom = projection([0, -74])![1];
  const view: ViewBox = { x: 0, y: top, w: WORLD_WIDTH, h: bottom - top };

  const geo = { view, shapes, byId, neighbors, projection };
  cached = { topo, geo };
  return geo;
}

// ───────────── Levels: world → continent → sub-region ─────────────

export type WorldLevel =
  | { kind: 'world' }
  | { kind: 'continent'; continent: ContinentId }
  | { kind: 'subregion'; subregion: SubregionId };

export function subregionsOf(continent: ContinentId): SubregionId[] {
  return SUBREGIONS.filter((s) => s.continent === continent).map((s) => s.id);
}

/**
 * Where tapping a continent leads. Continents with a single sub-region
 * (South America) skip straight to it; Antarctica has no countries, so it
 * stays on the world view.
 */
export function drillContinent(continent: ContinentId): WorldLevel {
  if (continent === 'antarctica') return { kind: 'world' };
  const subs = subregionsOf(continent);
  return subs.length === 1 ? { kind: 'subregion', subregion: subs[0] } : { kind: 'continent', continent };
}

/** One level up. */
export function parentLevel(level: WorldLevel): WorldLevel {
  if (level.kind === 'subregion') {
    const continent = SUBREGIONS.find((s) => s.id === level.subregion)!.continent;
    return subregionsOf(continent).length === 1 ? { kind: 'world' } : { kind: 'continent', continent };
  }
  return { kind: 'world' };
}

export function levelKey(level: WorldLevel): string {
  return level.kind === 'world' ? 'world' : level.kind === 'continent' ? `c:${level.continent}` : `s:${level.subregion}`;
}

/** Is this place part of the level's focus (tappable, full color)? */
export function inLevel(s: Pick<PlaceShape, 'continent' | 'subregion'>, level: WorldLevel): boolean {
  if (level.kind === 'world') return true;
  if (level.kind === 'continent') return s.continent === level.continent;
  return s.subregion === level.subregion;
}

/**
 * The view box for a level: the main pieces of its quiz countries, padded,
 * and widened to the screen's shape so it never looks squeezed.
 * Territories are left out on purpose (French Polynesia would stretch the
 * Polynesia view across the whole Pacific).
 */
export function levelView(geo: WorldGeometry, level: WorldLevel, aspect = 1.6): ViewBox {
  if (level.kind === 'world') return geo.view;
  const boxes = geo.shapes.filter((s) => s.kind === 'country' && inLevel(s, level)).map((s) => s.mainBox);
  if (boxes.length === 0) return geo.view;
  const [x0, y0, x1, y1] = unionBox(boxes);
  const pad = Math.max(8, 0.08 * Math.max(x1 - x0, y1 - y0));
  let w = x1 - x0 + pad * 2;
  let h = y1 - y0 + pad * 2;
  // Tiny groups (e.g. a few islands) still show some of their surroundings.
  const minW = geo.view.w * 0.12;
  if (w < minW) w = minW;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Dot markers for small places in focus. `pxPerUnit` keeps them a constant size on screen. */
export function markersFor(geo: WorldGeometry, level: WorldLevel, pxPerUnit: number, radiusPx: number): HitMarker[] {
  const r = radiusPx / pxPerUnit;
  return geo.shapes
    // Territories only get dots once zoomed into their sub-region (where they can be picked).
    .filter((s) => s.small && inLevel(s, level) && (level.kind === 'subregion' || s.kind === 'country'))
    // Once zoomed in far enough that the real shape is big on screen, the dot isn't needed.
    .filter((s) => Math.max(s.mainBox[2] - s.mainBox[0], s.mainBox[3] - s.mainBox[1]) * pxPerUnit < 36)
    .map((s) => ({ id: s.id, x: s.anchor[0], y: s.anchor[1], r }));
}

/** Dot size on screen (px): drawn radius and the (bigger, finger-sized) tap radius. */
export function markerPx(level: WorldLevel): { draw: number; hit: number } {
  return level.kind === 'world' ? { draw: 4, hit: 12 } : { draw: 9, hit: 22 };
}

/**
 * Which place a tap at `p` (map units) means at this level:
 * 1. the nearest dot marker under the finger (tiny countries win over the
 *    big neighbor they sit in or next to, e.g. Vatican City inside Italy);
 * 2. a shape in focus under the finger;
 * 3. the nearest shape in focus within `tolerancePx` (forgives near-misses).
 */
export function pickPlace(geo: WorldGeometry, level: WorldLevel, p: Pt, pxPerUnit: number, tolerancePx = 16): string | null {
  const marker = hitTestMarkers(p, markersFor(geo, level, pxPerUnit, markerPx(level).hit));
  if (marker) return marker;
  const shapes = level.kind === 'world' ? geo.shapes : geo.shapes.filter((s) => inLevel(s, level));
  return hitTest(p, shapes, tolerancePx / pxPerUnit);
}

// ───────────── Colors ─────────────

export interface ContinentPalette {
  /** Dark color for buttons with white text. */
  solid: string;
  tints: readonly string[];
}

/**
 * Continent hues reuse the colorblind-friendly Okabe–Ito family from the US
 * regions (blue, green, yellow, orange, purple) plus pink for Oceania and
 * slate for Antarctica.
 */
export const CONTINENT_PALETTE: Record<ContinentId, ContinentPalette> = {
  'north-america': { solid: '#0072b2', tints: ['#8fc9ee', '#b5dcf6', '#68b3e3', '#a2d2f2'] },
  'south-america': { solid: '#00805f', tints: ['#7fd3b5', '#a9e3cd', '#55c19b', '#94dbc1'] },
  africa: { solid: '#8a6d00', tints: ['#f3e47a', '#f9efab', '#e8d244', '#efe08f'] },
  asia: { solid: '#b35500', tints: ['#f5bd5a', '#f9d595', '#eea52c', '#f7c97a'] },
  europe: { solid: '#6a4fb0', tints: ['#c3aee8', '#d9cbf2', '#b39be0', '#cdbdee'] },
  oceania: { solid: '#b8336a', tints: ['#f4a6c6', '#f8c6dc', '#ee88b2', '#f6b6d1'] },
  antarctica: { solid: '#475569', tints: ['#e2e8f0', '#f1f5f9', '#cbd5e1', '#e2e8f0'] },
};

export const CONTINENT_EMOJI: Record<ContinentId, string> = Object.fromEntries(CONTINENTS.map((c) => [c.id, c.emoji])) as Record<ContinentId, string>;

/** Where to print each continent's name on the whole-world view (lon, lat). */
export const CONTINENT_LABEL_AT: Record<ContinentId, [number, number]> = {
  'north-america': [-102, 44],
  'south-america': [-60, -14],
  africa: [18, 6],
  asia: [92, 48],
  europe: [18, 54],
  oceania: [134, -26],
  antarctica: [-45, -77],
};

export interface WorldFills {
  /** Per place: continent hue, tint chosen so bordering places differ. */
  byPlace: Map<string, string>;
  /** Per sub-region: one tint, chosen so bordering sub-regions differ. */
  bySubregion: Map<SubregionId, string>;
}

export function worldFills(geo: WorldGeometry): WorldFills {
  const byPlace = new Map<string, string>();
  for (const c of CONTINENTS) {
    const ids = geo.shapes.filter((s) => s.continent === c.id).map((s) => s.id);
    const colors = colorGraph(ids, geo.neighbors, 3);
    const tints = CONTINENT_PALETTE[c.id].tints;
    for (const [id, i] of colors) byPlace.set(id, tints[i % tints.length]);
  }

  // Sub-region adjacency, from the place borders.
  const subAdj = new Map<string, Set<string>>();
  for (const s of geo.shapes) {
    for (const n of geo.neighbors.get(s.id) ?? []) {
      const other = geo.byId.get(n);
      if (!other || other.subregion === s.subregion) continue;
      if (!subAdj.has(s.subregion)) subAdj.set(s.subregion, new Set());
      subAdj.get(s.subregion)!.add(other.subregion);
    }
  }
  const bySubregion = new Map<SubregionId, string>();
  for (const c of CONTINENTS) {
    const subs = subregionsOf(c.id);
    const colors = colorGraph(subs, subAdj, 4);
    const tints = CONTINENT_PALETTE[c.id].tints;
    for (const [id, i] of colors) bySubregion.set(id as SubregionId, tints[i % tints.length]);
  }
  return { byPlace, bySubregion };
}
