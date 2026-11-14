// Builds src/data/world/countries-50m.json, the world map used by the
// (future) world screens. Re-run after changing src/data/world.ts:
//
//   node scripts/build-world-topo.mjs
//
// Source: world-atlas 2.x (Natural Earth 4.1.0 Admin 0 countries, 1:50m,
// public domain). Tuvalu is missing from the 50m file, so its shape comes from
// the 1:10m file.
//
// What it does:
//  1. Gives every Natural Earth shape the id of its catalog entry (ISO alpha-2).
//     Matching is by ISO numeric code, plus a few by-name rules for shapes
//     that have no code (see NAME_RULES).
//  2. Merges pieces that belong to one entry (Somaliland → Somalia,
//     N. Cyprus → Cyprus, Ashmore and Cartier Is. → Australia).
//  3. Re-builds the topology (shared borders), simplifies it and quantizes it.
// It fails loudly if any catalog entry ends up without a shape or any shape
// is left unmatched.
//
// Needs Node 22.18+ (loads world.ts with built-in TypeScript type stripping).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature, merge, quantize } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { geoArea } from 'd3-geo';
import { COUNTRIES, MAP_TERRITORIES } from '../src/data/world.ts';

const require = createRequire(import.meta.url);
const OUT = new URL('../src/data/world/countries-50m.json', import.meta.url);

/** Natural Earth shapes matched by name (no ISO numeric, or a duplicate one). */
const NAME_RULES = {
  Kosovo: 'XK',
  Somaliland: 'SO', // merged: recognized borders, as on UN maps
  'N. Cyprus': 'CY', // merged: recognized borders, as on UN maps
  'Ashmore and Cartier Is.': 'AU', // tiny uninhabited reefs; shares id 036 with Australia
  'Indian Ocean Ter.': 'CX',
  'Siachen Glacier': 'SIACHEN',
};

/** Shapes taken from the 1:10m file because the 1:50m file lacks them. */
const FROM_10M = { '798': 'TV' };

/** Simplification: keep this fraction of the most important points. */
const KEEP = 0.3;
/**
 * Rings (islands, micro-states) smaller than this (steradians, ≈ 2000 km²)
 * keep every point, so Monaco, Andorra or the islets of Tonga don't collapse
 * when simplified.
 */
const PROTECT_AREA = 5e-5;

const entries = [...COUNTRIES, ...MAP_TERRITORIES];
const idByNumeric = new Map(entries.filter((e) => e.numeric).map((e) => [e.numeric, e.id]));
const known = new Set(entries.map((e) => e.id));

function load(res) {
  return JSON.parse(readFileSync(require.resolve(`world-atlas/countries-${res}.json`), 'utf8'));
}

const atlas50 = load('50m');
const atlas10 = load('10m');

// 1. Group the 50m geometries by catalog id.
const groups = new Map();
for (const g of atlas50.objects.countries.geometries) {
  const name = g.properties.name;
  const id = NAME_RULES[name] ?? idByNumeric.get(g.id);
  if (!id) throw new Error(`No catalog entry for Natural Earth shape "${name}" (${g.id})`);
  if (!groups.has(id)) groups.set(id, []);
  groups.get(id).push(g);
}

// 2. One GeoJSON feature per catalog id (merging multi-piece groups).
const features = [];
for (const [id, geoms] of groups) {
  const geometry =
    geoms.length === 1 ? feature(atlas50, geoms[0]).geometry : merge(atlas50, geoms);
  features.push({ type: 'Feature', id, properties: {}, geometry });
}
for (const [numeric, id] of Object.entries(FROM_10M)) {
  if (groups.has(id)) throw new Error(`${id} is already in the 50m file; drop it from FROM_10M`);
  const g = atlas10.objects.countries.geometries.find((x) => x.id === numeric);
  if (!g) throw new Error(`10m file has no shape ${numeric}`);
  features.push({ type: 'Feature', id, properties: {}, geometry: feature(atlas10, g).geometry });
}

const missing = [...known].filter((id) => !features.some((f) => f.id === id));
if (missing.length) throw new Error(`Catalog entries without a shape: ${missing.join(', ')}`);

// 3. Topology → simplify → quantize. Simplification keeps every ring's
// endpoints, so even the tiniest island countries keep a (small) shape.
features.sort((a, b) => a.id.localeCompare(b.id));
let topo = topology({ countries: { type: 'FeatureCollection', features } }, 1e6);
topo = presimplify(topo);
const minWeight = quantile(topo, KEEP);
for (const g of topo.objects.countries.geometries) {
  for (const ring of rings(g)) {
    const ringArea = geoArea(feature(topo, { type: 'Polygon', arcs: [ring] }));
    // Inner rings (holes) wind the other way and measure ≈ 4π − area.
    if (Math.min(ringArea, 4 * Math.PI - ringArea) >= PROTECT_AREA) continue;
    for (const i of ring) for (const pt of topo.arcs[i < 0 ? ~i : i]) pt[2] = Infinity;
  }
}
topo = simplify(topo, minWeight);
topo = quantize(topo, 1e5);

// Sanity check: no shape collapsed to nothing.
for (const f of feature(topo, topo.objects.countries).features) {
  const area = f.geometry ? geoArea(f) : 0;
  // > 2π would mean a ring got turned inside out (it would cover the whole globe).
  if (!(area > 0 && area < 2 * Math.PI)) throw new Error(`${f.id} collapsed during simplification`);
}

/** Every ring (list of arc indexes) of a Polygon / MultiPolygon topology geometry. */
function rings(g) {
  if (g.type === 'Polygon') return g.arcs;
  if (g.type === 'MultiPolygon') return g.arcs.flat();
  return [];
}

mkdirSync(new URL('.', OUT), { recursive: true });
const json = JSON.stringify(topo);
writeFileSync(OUT, json);
console.log(`wrote ${OUT.pathname}: ${features.length} shapes, ${(json.length / 1024).toFixed(0)} KB`);
