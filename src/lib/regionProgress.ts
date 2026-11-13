/** Per-region progress, the "practice this region next" suggestion, and region tour order. */
import { getRegion, REGION_STATES, type Region } from '../data/regions';
import type { RegionId } from '../data/states';
import { masteryOf, type RecordMap } from './srs';

export interface RegionProgress {
  id: RegionId;
  total: number;
  mastered: number;
  learning: number;
  fresh: number;
  /** mastered / total, 0..1 */
  fraction: number;
}

export const REGION_IDS: readonly RegionId[] = ['northeast', 'southeast', 'midwest', 'southwest', 'west'];

export function regionProgress(id: RegionId, records: RecordMap): RegionProgress {
  const states = REGION_STATES[id];
  let mastered = 0;
  let learning = 0;
  for (const s of states) {
    const m = masteryOf(records[s]);
    if (m === 'mastered') mastered++;
    else if (m === 'learning') learning++;
  }
  return { id, total: states.length, mastered, learning, fresh: states.length - mastered - learning, fraction: mastered / states.length };
}

/**
 * The region to practice next: the one with the smallest share of mastered
 * states. (A share, not a raw count, so the 4-state Southwest isn't always
 * picked first and isn't suggested again once it's done.) Ties go to the
 * region with fewer states started, then to the order regions are listed.
 * Returns 'all' once every state is mastered (time for a mixed review).
 */
export function suggestRegion(records: RecordMap): Region['id'] {
  const all = REGION_IDS.map((id) => regionProgress(id, records));
  const candidates = all.filter((p) => p.fraction < 1);
  if (candidates.length === 0) return 'all';
  candidates.sort((a, b) => a.fraction - b.fraction || a.learning / a.total - b.learning / b.total || REGION_IDS.indexOf(a.id) - REGION_IDS.indexOf(b.id));
  return candidates[0].id;
}

export interface RegionChoice {
  id: Region['id'];
  label: string;
  emoji: string;
  /** Tailwind background class (the region's solid color). */
  color: string;
  mastered: number;
  total: number;
  /** True for the auto-suggested region (the card's big default button). */
  suggested: boolean;
}

/**
 * Chips for the home card's "Pick a different region" row: all 5 regions in
 * list order, then All 50, each with its mastered count.
 */
export function regionChoices(records: RecordMap): RegionChoice[] {
  const suggested = suggestRegion(records);
  const regions = REGION_IDS.map((id) => {
    const r = getRegion(id);
    const p = regionProgress(id, records);
    return { id, label: r.label, emoji: r.emoji, color: r.color, mastered: p.mastered, total: p.total, suggested: suggested === id };
  });
  const all = getRegion('all');
  const masteredAll = regions.reduce((a, r) => a + r.mastered, 0);
  return [...regions, { id: 'all', label: all.label, emoji: all.emoji, color: all.color, mastered: masteredAll, total: all.states.length, suggested: suggested === 'all' }];
}

/**
 * Order for the region tour: north to south in bands, west to east within a
 * band, so it reads across the map like a book. `centroidOf` gives map
 * coordinates (y grows downward).
 */
export function tourOrder(states: readonly string[], centroidOf: (abbr: string) => readonly [number, number], band = 60): string[] {
  return [...states].sort((a, b) => {
    const [ax, ay] = centroidOf(a);
    const [bx, by] = centroidOf(b);
    const rowA = Math.floor(ay / band);
    const rowB = Math.floor(by / band);
    return rowA - rowB || ax - bx;
  });
}
