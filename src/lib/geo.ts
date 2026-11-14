/**
 * Builds the static map geometry once, in a fixed SVG coordinate space.
 * The us-atlas TopoJSON is bundled (imported as JSON), so this is fully offline.
 */
import { geoAlbersUsa, geoPath, type GeoProjection, type GeoStream } from 'd3-geo';
import { feature, neighbors as topoNeighbors } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import usAtlas from 'us-atlas/states-10m.json';
import { SMALL_STATES, STATE_BY_FIPS } from '../data/states';
import type { HitBox, HitShape, Pt, Ring } from './hittest';

export const MAP_WIDTH = 1060;
export const MAP_HEIGHT = 610;

/** Area to the right of the map reserved for the small-state callout boxes. */
const MAP_EXTENT: [[number, number], [number, number]] = [
  [8, 8],
  [925, 602],
];
/** Wide enough to print "Massachusetts" / "New Hampshire" inside (keep-names mode). */
const CALLOUT = { x: 938, w: 116, h: 42, step: 50, top: 172 };

export interface StateShape extends HitShape {
  name: string;
  d: string;
  centroid: Pt;
  /** Rough size, used to decide whether to draw a locator ring. */
  area: number;
}

export interface Callout extends HitBox {
  anchor: Pt;
}

export interface MapGeometry {
  width: number;
  height: number;
  shapes: StateShape[];
  byId: Map<string, StateShape>;
  callouts: Callout[];
  /** Which states share a border (from the TopoJSON arcs). */
  neighbors: Map<string, Set<string>>;
  /** The AlbersUSA projection used for the map, so other layers (counties) line up exactly. */
  projection: GeoProjection;
}

/** Collects projected rings by streaming a feature through the projection. */
export function projectRings(f: Feature<Geometry>, stream: (s: GeoStream) => GeoStream): Ring[] {
  const rings: Ring[] = [];
  let current: Pt[] | null = null;
  const sink: GeoStream = {
    point(x, y) {
      current?.push([x, y]);
    },
    lineStart() {
      current = [];
    },
    lineEnd() {
      if (current && current.length > 2) rings.push(current);
      current = null;
    },
    polygonStart() {},
    polygonEnd() {},
    sphere() {},
  };
  const s = stream(sink);
  // geoStream isn't exported in the types we import, so walk the geometry by hand.
  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  for (const poly of polys) {
    s.polygonStart();
    for (const ring of poly) {
      s.lineStart();
      // GeoJSON rings repeat the first point at the end; streams expect it dropped.
      for (let i = 0; i < ring.length - 1; i++) s.point(ring[i][0], ring[i][1]);
      s.lineEnd();
    }
    s.polygonEnd();
  }
  return rings;
}

let cached: MapGeometry | null = null;

export function getMapGeometry(): MapGeometry {
  if (cached) return cached;
  const topo = usAtlas as unknown as Topology<{ states: GeometryCollection<{ name: string }> }>;
  const all = feature(topo, topo.objects.states) as FeatureCollection<Geometry, { name: string }>;
  const features = all.features.filter((f) => STATE_BY_FIPS.has(String(f.id)));
  const fc: FeatureCollection<Geometry> = { type: 'FeatureCollection', features };

  const projection = geoAlbersUsa().fitExtent(MAP_EXTENT, fc);
  const path = geoPath(projection);

  const shapes: StateShape[] = features.map((f) => {
    const info = STATE_BY_FIPS.get(String(f.id))!;
    const [[x0, y0], [x1, y1]] = path.bounds(f);
    const c = path.centroid(f);
    return {
      id: info.abbr,
      name: info.name,
      d: path(f) ?? '',
      centroid: [c[0], c[1]] as Pt,
      area: path.area(f),
      bbox: [x0, y0, x1, y1],
      rings: projectRings(f, (sink) => projection.stream(sink)),
    };
  });
  const byId = new Map(shapes.map((s) => [s.id, s]));

  const callouts: Callout[] = SMALL_STATES.map((abbr, i) => {
    const s = byId.get(abbr)!;
    return {
      id: abbr,
      x: CALLOUT.x,
      y: CALLOUT.top + i * CALLOUT.step,
      w: CALLOUT.w,
      h: CALLOUT.h,
      anchor: s.centroid,
    };
  });

  // Shared borders, from the topology (indices refer to the full geometry list).
  const geoms = topo.objects.states.geometries;
  const nbrIdx = topoNeighbors(geoms as Parameters<typeof topoNeighbors>[0]);
  const abbrAt = geoms.map((g) => STATE_BY_FIPS.get(String(g.id))?.abbr);
  const neighbors = new Map<string, Set<string>>(shapes.map((s) => [s.id, new Set<string>()]));
  nbrIdx.forEach((list, i) => {
    const a = abbrAt[i];
    if (!a) return;
    for (const j of list) {
      const b = abbrAt[j];
      if (b && b !== a) neighbors.get(a)!.add(b);
    }
  });

  cached = { width: MAP_WIDTH, height: MAP_HEIGHT, shapes, byId, callouts, neighbors, projection };
  return cached;
}
