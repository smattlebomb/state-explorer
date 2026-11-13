// Dev helper: prints projected centroids/bounds/areas for every state.
// Usage: node scripts/probe-geo.mjs
import { geoAlbersUsa, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { readFileSync } from 'fs';

const us = JSON.parse(readFileSync('node_modules/us-atlas/states-10m.json', 'utf8'));
const fc = feature(us, us.objects.states);
fc.features = fc.features.filter((f) => f.id !== '11');
const p = geoAlbersUsa().fitExtent([[10, 10], [950, 600]], fc);
const path = geoPath(p);
console.log('scale', p.scale(), p.translate());
for (const f of fc.features) {
  const b = path.bounds(f);
  const c = path.centroid(f);
  console.log(f.id, f.properties.name, c.map(Math.round), b.map((a) => a.map(Math.round)), Math.round(path.area(f)));
}
