/**
 * Pinch/button zoom math for the maps. Units are the SVG viewBox (map) coordinates.
 * Every function takes an optional `max` scale (default MAX_SCALE = 8, the US map);
 * the world map passes a deeper limit.
 */

export const MIN_SCALE = 1;
export const MAX_SCALE = 8;
/** Button +/- multiplies scale by this. */
export const ZOOM_STEP = 1.5;

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** k = scale (1–max). (cx, cy) is the center of the visible window, in map coordinates. */
export interface ZoomState {
  k: number;
  cx: number;
  cy: number;
}

export function parseViewBox(s: string): ViewBox {
  const parts = s.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`Invalid viewBox: ${s}`);
  }
  const [x, y, w, h] = parts;
  return { x, y, w, h };
}

export function formatViewBox(v: ViewBox): string {
  return `${v.x} ${v.y} ${v.w} ${v.h}`;
}

export function clampScale(k: number, max = MAX_SCALE): number {
  if (!Number.isFinite(k)) return MIN_SCALE;
  return Math.min(max, Math.max(MIN_SCALE, k));
}

export function identityZoom(base: ViewBox): ZoomState {
  return { k: 1, cx: base.x + base.w / 2, cy: base.y + base.h / 2 };
}

/** Visible window in map coordinates, always fully inside `base`. */
export function visibleWindow(base: ViewBox, zoom: ZoomState, max = MAX_SCALE): ViewBox {
  const k = clampScale(zoom.k, max);
  const w = base.w / k;
  const h = base.h / k;
  const x = Math.min(base.x + base.w - w, Math.max(base.x, zoom.cx - w / 2));
  const y = Math.min(base.y + base.h - h, Math.max(base.y, zoom.cy - h / 2));
  return { x, y, w, h };
}

export function fromVisible(base: ViewBox, vis: ViewBox, max = MAX_SCALE): ZoomState {
  const k = clampScale(base.w / vis.w, max);
  const clamped = visibleWindow(base, { k, cx: vis.x + vis.w / 2, cy: vis.y + vis.h / 2 }, max);
  return { k, cx: clamped.x + clamped.w / 2, cy: clamped.y + clamped.h / 2 };
}

/** Zoom by `factor` around an anchor point in map coordinates, keeping that point fixed. */
export function zoomAt(base: ViewBox, zoom: ZoomState, factor: number, anchorX: number, anchorY: number, max = MAX_SCALE): ZoomState {
  const vis = visibleWindow(base, zoom, max);
  const fx = vis.w === 0 ? 0.5 : (anchorX - vis.x) / vis.w;
  const fy = vis.h === 0 ? 0.5 : (anchorY - vis.y) / vis.h;
  const k = clampScale(zoom.k * factor, max);
  const w = base.w / k;
  const h = base.h / k;
  const x = Math.min(base.x + base.w - w, Math.max(base.x, anchorX - fx * w));
  const y = Math.min(base.y + base.h - h, Math.max(base.y, anchorY - fy * h));
  return { k, cx: x + w / 2, cy: y + h / 2 };
}

/** Pan the window by `dx`,`dy` map units (positive dx moves the view right, i.e. content left). */
export function panBy(base: ViewBox, zoom: ZoomState, dx: number, dy: number, max = MAX_SCALE): ZoomState {
  const vis = visibleWindow(base, zoom, max);
  return fromVisible(base, { x: vis.x + dx, y: vis.y + dy, w: vis.w, h: vis.h }, max);
}

export function zoomIn(base: ViewBox, zoom: ZoomState, step = ZOOM_STEP, max = MAX_SCALE): ZoomState {
  const vis = visibleWindow(base, zoom, max);
  return zoomAt(base, zoom, step, vis.x + vis.w / 2, vis.y + vis.h / 2, max);
}

export function zoomOut(base: ViewBox, zoom: ZoomState, step = ZOOM_STEP, max = MAX_SCALE): ZoomState {
  return zoomIn(base, zoom, 1 / step, max);
}

/** CSS pixels per map unit for an SVG using xMidYMid meet. */
export function meetScale(svgWidth: number, svgHeight: number, vis: ViewBox): number {
  if (vis.w <= 0 || vis.h <= 0 || svgWidth <= 0 || svgHeight <= 0) return 1;
  return Math.min(svgWidth / vis.w, svgHeight / vis.h);
}

/** Convert a client (screen) point to map/viewBox coordinates for an xMidYMid meet SVG. */
export function clientToMap(
  clientX: number,
  clientY: number,
  svg: { left: number; top: number; width: number; height: number },
  vis: ViewBox,
): { x: number; y: number } {
  const s = meetScale(svg.width, svg.height, vis);
  const ox = svg.left + (svg.width - vis.w * s) / 2;
  const oy = svg.top + (svg.height - vis.h * s) / 2;
  return { x: vis.x + (clientX - ox) / s, y: vis.y + (clientY - oy) / s };
}
