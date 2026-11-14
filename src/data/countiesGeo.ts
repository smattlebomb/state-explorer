/**
 * Lazy loader for US county shapes (us-atlas counties-10m, ~3,200 features,
 * ~840 KB). Loaded through a dynamic import only when she opens the counties
 * view, so it is never in the initial bundle. The service worker does NOT
 * precache it; it caches the chunk at runtime the first time it loads
 * (see vite.config.ts), so counties work offline after one visit.
 *
 * Feature ids are 5-digit county FIPS codes: the first 2 digits are the
 * state's FIPS code (the same `fips` as in states.ts).
 */
import type { GeometryCollection, Topology } from 'topojson-specification';

export type CountyTopology = Topology<{
  counties: GeometryCollection<{ name: string }>;
  states: GeometryCollection<{ name: string }>;
  nation: GeometryCollection;
}>;

let cached: Promise<CountyTopology> | null = null;

export function loadCountyTopology(): Promise<CountyTopology> {
  cached ??= import('us-atlas/counties-10m.json')
    .then((m) => m.default as unknown as CountyTopology)
    .catch((err: unknown) => {
      cached = null; // let a later visit retry (e.g. it was offline the first time)
      throw err;
    });
  return cached;
}
