/**
 * Region color coding: each state gets its region's hue, in one of 3 tints,
 * chosen so that no two bordering states in the same region share a tint.
 */
import { REGION_PALETTE, REGION_STATES } from '../data/regions';
import { STATE_BY_ABBR, type RegionId } from '../data/states';

export type Adjacency = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * Color `nodes` with at most `k` colors so neighbors differ (backtracking;
 * nodes with the most neighbors go first). Falls back to the greedy answer
 * (which may need more than k colors) if no k-coloring exists.
 */
export function colorGraph(nodes: readonly string[], adj: Adjacency, k = 3): Map<string, number> {
  const inSet = new Set(nodes);
  const nbrs = (n: string) => [...(adj.get(n) ?? [])].filter((m) => inSet.has(m));
  const order = [...nodes].sort((a, b) => nbrs(b).length - nbrs(a).length || a.localeCompare(b));
  const color = new Map<string, number>();

  const solve = (i: number): boolean => {
    if (i === order.length) return true;
    const n = order[i];
    const used = new Set(nbrs(n).map((m) => color.get(m)));
    for (let c = 0; c < k; c++) {
      if (used.has(c)) continue;
      color.set(n, c);
      if (solve(i + 1)) return true;
    }
    color.delete(n);
    return false;
  };

  if (solve(0)) return color;

  // Greedy fallback.
  color.clear();
  for (const n of order) {
    const used = new Set(nbrs(n).map((m) => color.get(m)));
    let c = 0;
    while (used.has(c)) c++;
    color.set(n, c);
  }
  return color;
}

/** State abbreviation → fill color (its region's hue, tint picked so neighbors differ). */
export function regionFills(adj: Adjacency): Map<string, string> {
  const fills = new Map<string, string>();
  for (const region of Object.keys(REGION_STATES) as RegionId[]) {
    const tints = REGION_PALETTE[region].tints;
    const colors = colorGraph(REGION_STATES[region], adj, tints.length);
    for (const [abbr, c] of colors) fills.set(abbr, tints[c % tints.length]);
  }
  return fills;
}

export function regionOfState(abbr: string): RegionId | undefined {
  return STATE_BY_ABBR.get(abbr)?.region;
}
