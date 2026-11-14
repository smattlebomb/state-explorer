// Builds src/data/canada/provinces-50m.json, the map of Canada's 10
// provinces + 3 territories used by the (future) Canada screens.
//
// Source: Natural Earth 1:50m Admin 1 – States, Provinces (public domain).
// Download it once (to its own folder), then pass the path:
//
//   mkdir -p /tmp/ne-admin1 && curl -L -o /tmp/ne-admin1/ne_50m_admin_1.geojson \
//     https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson
//   node scripts/build-canada-topo.mjs /tmp/ne-admin1/ne_50m_admin_1.geojson
//
// What it does:
//  1. Picks the 13 Canadian features and ids them by postal abbreviation
//     (Natural Earth's `postal` field), checked against src/data/canada.ts.
//  2. Fixes ring winding for d3-geo (GeoJSON files often wind the other way).
//  3. Drops islets too small to see or tap (Nunavut alone has thousands),
//     but never a unit's largest piece.
//  4. Builds the topology (shared borders), simplifies it, quantizes it, and
//     fails if any shape collapsed.
//
// Needs Node 22.18+ (loads canada.ts with built-in TypeScript type stripping).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { feature, quantize } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { geoArea } from 'd3-geo';
import { PROVINCES } from '../src/data/canada.ts';

const OUT = new URL('../src/data/canada/provinces-50m.json', import.meta.url);
const KM2 = 1 / 6371 ** 2; // one km² in steradians

/** Islets smaller than this are dropped (unless they are the unit's largest piece). */
const DROP_AREA = 60 * KM2;
/** Rings smaller than this keep every point when simplifying, so PEI (≈ 5,700 km²) and small islands stay crisp. */
const PROTECT_AREA = 8000 * KM2;
/** Keep this fraction of the most important points. */
const KEEP = 0.3;

const src = process.argv[2];
if (!src) throw new Error('Usage: node scripts/build-canada-topo.mjs <ne_50m_admin_1_states_provinces.geojson>');
const ne = JSON.parse(readFileSync(src, 'utf8'));

const wanted = new Set(PROVINCES.map((p) => p.abbr));
const features = [];
let dropped = 0;
for (const f of ne.features) {
  const p = f.properties;
  if (p.adm0_a3 !== 'CAN') continue;
  if (!wanted.has(p.postal)) throw new Error(`Unexpected Canadian feature ${p.postal} ${p.name}`);
  if (p.iso_3166_2 !== `CA-${p.postal}`) throw new Error(`ISO code mismatch for ${p.postal}: ${p.iso_3166_2}`);

  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const sized = polys.map((rings) => {
    const fixed = windForD3(rings);
    return { rings: fixed, area: geoArea({ type: 'Polygon', coordinates: fixed }) };
  });
  const largest = Math.max(...sized.map((s) => s.area));
  const kept = sized.filter((s) => s.area === largest || s.area >= DROP_AREA);
  dropped += sized.length - kept.length;
  features.push({
    type: 'Feature',
    id: p.postal,
    properties: {},
    geometry: { type: 'MultiPolygon', coordinates: kept.map((s) => s.rings) },
  });
}
const missing = [...wanted].filter((id) => !features.some((f) => f.id === id));
if (missing.length) throw new Error(`No shape for: ${missing.join(', ')}`);

features.sort((a, b) => a.id.localeCompare(b.id));
let topo = topology({ provinces: { type: 'FeatureCollection', features } }, 1e6);
topo = presimplify(topo);
const minWeight = quantile(topo, KEEP);
for (const g of topo.objects.provinces.geometries) {
  for (const ring of g.arcs.flat()) {
    const a = geoArea(feature(topo, { type: 'Polygon', arcs: [ring] }));
    if (Math.min(a, 4 * Math.PI - a) >= PROTECT_AREA) continue;
    for (const i of ring) for (const pt of topo.arcs[i < 0 ? ~i : i]) pt[2] = Infinity;
  }
}
topo = simplify(topo, minWeight);
topo = quantize(topo, 1e5);

for (const f of feature(topo, topo.objects.provinces).features) {
  const area = f.geometry ? geoArea(f) : 0;
  if (!(area > 0 && area < 2 * Math.PI)) throw new Error(`${f.id} collapsed or turned inside out`);
}

mkdirSync(new URL('.', OUT), { recursive: true });
const json = JSON.stringify(topo);
writeFileSync(OUT, json);
console.log(`wrote ${OUT.pathname}: ${features.length} shapes, ${dropped} islets dropped, ${(json.length / 1024).toFixed(0)} KB`);

/**
 * d3-geo wants exterior rings clockwise (the polygon is the smaller side).
 * If the polygon as given covers more than half the globe, reverse every ring.
 */
function windForD3(rings) {
  const a = geoArea({ type: 'Polygon', coordinates: rings });
  return a > 2 * Math.PI ? rings.map((r) => [...r].reverse()) : rings;
}
