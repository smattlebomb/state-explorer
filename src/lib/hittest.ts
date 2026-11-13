/**
 * Planar hit testing in map (SVG viewBox) coordinates.
 * Pure functions so they can be unit-tested without a browser.
 */
export type Pt = readonly [number, number];
export type Ring = Pt[];

export interface HitShape {
  id: string;
  rings: Ring[];
  /** [minX, minY, maxX, maxY] for a fast reject. */
  bbox: [number, number, number, number];
}

export interface HitBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Even-odd rule over all rings, so holes work. */
export function pointInRings(p: Pt, rings: Ring[]): boolean {
  let inside = false;
  const [x, y] = p;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

function distToSegmentSq(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  let t = len === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * dx - p[0];
  const cy = a[1] + t * dy - p[1];
  return cx * cx + cy * cy;
}

/** Distance from p to the closest edge of the shape (0 if inside). */
export function distanceToShape(p: Pt, shape: HitShape): number {
  if (pointInRings(p, shape.rings)) return 0;
  let best = Infinity;
  for (const ring of shape.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const d = distToSegmentSq(p, ring[j], ring[i]);
      if (d < best) best = d;
    }
  }
  return Math.sqrt(best);
}

function inBox(p: Pt, b: HitBox, pad = 0): boolean {
  return p[0] >= b.x - pad && p[0] <= b.x + b.w + pad && p[1] >= b.y - pad && p[1] <= b.y + b.h + pad;
}

/**
 * Which state was tapped?
 * 1. Callout boxes (the enlarged targets for tiny states) win first.
 * 2. A point inside a state's outline.
 * 3. Otherwise the nearest state within `tolerance` (forgives near-misses).
 */
export function hitTest(p: Pt, shapes: readonly HitShape[], tolerance: number, boxes: readonly HitBox[] = []): string | null {
  for (const b of boxes) if (inBox(p, b)) return b.id;

  let bestId: string | null = null;
  let bestDist = tolerance;
  for (const s of shapes) {
    const [x0, y0, x1, y1] = s.bbox;
    if (p[0] < x0 - tolerance || p[0] > x1 + tolerance || p[1] < y0 - tolerance || p[1] > y1 + tolerance) continue;
    const d = distanceToShape(p, s);
    if (d === 0) return s.id;
    if (d <= bestDist) {
      bestDist = d;
      bestId = s.id;
    }
  }
  if (bestId) return bestId;

  // Slightly padded callout boxes as a last resort.
  for (const b of boxes) if (inBox(p, b, tolerance)) return b.id;
  return null;
}
