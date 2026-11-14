import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import {
  MIN_SCALE,
  clientToMap,
  formatViewBox,
  identityZoom,
  meetScale,
  panBy,
  visibleWindow,
  zoomAt,
  zoomIn,
  zoomOut,
  type ViewBox,
  type ZoomState,
} from '../lib/mapZoom';
import type { Pt } from '../lib/hittest';

/**
 * A pinch/pan/zoom SVG map shell for the World and Canada maps. It uses the
 * same gesture rules as USMap (which is left untouched): a tap only counts if
 * the finger moved ≤ 24px and no second finger joined; drags pan; two
 * fingers pinch. Zoom resets whenever `base` changes (new level or focus).
 */

/** Screen pixels of forgiveness around shapes for near-miss taps. */
export const TAP_TOLERANCE_PX = 16;
/** Taps that move more than this are treated as a drag. */
const MAX_TAP_MOVE_PX = 24;

export interface MapView {
  /** Visible window in map units. */
  vis: ViewBox;
  /** Current zoom factor (1 = base view). */
  k: number;
  /** CSS pixels per map unit right now (use it to keep dots/labels a constant screen size). */
  pxPerUnit: number;
}

export interface ZoomMapProps {
  base: ViewBox;
  maxScale: number;
  /** A real tap (not a pan or pinch), in map units, with the current view. */
  onTap?: (pt: Pt, view: MapView) => void;
  ariaLabel: string;
  /** Static layer (shapes). Memoize it in the parent so panning doesn't re-render every path. */
  children: ReactNode;
  /** Layer that depends on the zoom (markers, labels). */
  overlay?: (view: MapView) => ReactNode;
  className?: string;
}

const ZOOM_BUTTON =
  'pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full bg-white font-black leading-none text-slate-800 shadow-[0_4px_0_#94a3b8] transition active:translate-y-1 active:shadow-[0_1px_0_#94a3b8] disabled:opacity-40 disabled:active:translate-y-0 disabled:active:shadow-[0_4px_0_#94a3b8]';

/** Size used before layout (and in jsdom, which has no layout). */
const FALLBACK_SIZE = { width: 1000, height: 600 };

export function ZoomMap({ base, maxScale, onTap, ariaLabel, children, overlay, className = '' }: ZoomMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { kind: 'none' }
    | { kind: 'one'; id: number; startX: number; startY: number; lastX: number; lastY: number; panned: boolean }
    | { kind: 'pinch'; startDist: number; startZoom: ZoomState; startAnchor: { x: number; y: number }; startMid: { x: number; y: number } }
  >({ kind: 'none' });

  const [zoom, setZoom] = useState<ZoomState>(() => identityZoom(base));
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const [size, setSize] = useState(FALLBACK_SIZE);

  const baseKey = formatViewBox(base);
  // New level/focus → start un-zoomed on the new base view.
  useEffect(() => {
    setZoom(identityZoom(base));
    gesture.current = { kind: 'none' };
    pointers.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the base view changes
  }, [baseKey]);

  // Track the on-screen size so overlays can stay a constant pixel size.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const r = svg.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ width: r.width, height: r.height });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  // Stop the page itself from pinch-zooming while fingers are on the map.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const stop = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, []);

  const vis = visibleWindow(base, zoom, maxScale);
  const view: MapView = { vis, k: zoom.k, pxPerUnit: meetScale(size.width, size.height, vis) };

  const svgBox = () => {
    const r = svgRef.current?.getBoundingClientRect();
    return r && r.width > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
  };

  const handleDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture can throw if the pointer is already gone.
    }
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const box = svgBox();
      const v = visibleWindow(base, zoomRef.current, maxScale);
      const startAnchor = box ? clientToMap(mid.x, mid.y, box, v) : { x: v.x + v.w / 2, y: v.y + v.h / 2 };
      gesture.current = { kind: 'pinch', startDist: dist, startZoom: zoomRef.current, startAnchor, startMid: mid };
      return;
    }
    gesture.current = { kind: 'one', id: e.pointerId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, panned: false };
  };

  const handleMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const box = svgBox();
    if (g.kind === 'pinch' && pointers.current.size >= 2 && box) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const z1 = zoomAt(base, g.startZoom, dist / g.startDist, g.startAnchor.x, g.startAnchor.y, maxScale);
      const s = meetScale(box.width, box.height, visibleWindow(base, z1, maxScale)) || 1;
      setZoom(panBy(base, z1, -(mid.x - g.startMid.x) / s, -(mid.y - g.startMid.y) / s, maxScale));
      return;
    }
    if (g.kind === 'one' && g.id === e.pointerId) {
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > MAX_TAP_MOVE_PX) {
        g.panned = true;
        if (zoomRef.current.k > MIN_SCALE && box) {
          const s = meetScale(box.width, box.height, visibleWindow(base, zoomRef.current, maxScale)) || 1;
          const dx = e.clientX - g.lastX;
          const dy = e.clientY - g.lastY;
          setZoom((z) => panBy(base, z, -dx / s, -dy / s, maxScale));
        }
        g.lastX = e.clientX;
        g.lastY = e.clientY;
      }
    }
  };

  const handleUp = (e: PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
    const wasTap =
      g.kind === 'one' && g.id === e.pointerId && !g.panned && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) <= MAX_TAP_MOVE_PX;

    if (pointers.current.size >= 2) {
      // still pinching with leftover fingers
    } else if (pointers.current.size === 1) {
      // A pinch ended with one finger still down: it can pan, but never becomes a tap.
      const [id, pt] = [...pointers.current.entries()][0];
      gesture.current = { kind: 'one', id, startX: pt.x, startY: pt.y, lastX: pt.x, lastY: pt.y, panned: true };
    } else {
      gesture.current = { kind: 'none' };
    }

    if (!wasTap || !onTap) return;
    const box = svgBox();
    if (!box) return;
    const p = clientToMap(e.clientX, e.clientY, box, vis);
    onTap([p.x, p.y], { ...view, pxPerUnit: meetScale(box.width, box.height, vis) });
  };

  const handleCancel = (e: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gesture.current = { kind: 'none' };
  };

  const atMin = zoom.k <= MIN_SCALE + 1e-6;
  const atMax = zoom.k >= maxScale - 1e-6;
  const stop = (e: PointerEvent) => e.stopPropagation();

  return (
    <div ref={wrapRef} className={`map-zoom-wrap relative h-full w-full ${className}`}>
      <svg
        ref={svgRef}
        viewBox={formatViewBox(vis)}
        preserveAspectRatio="xMidYMid meet"
        className="block h-full w-full touch-none"
        style={{ touchAction: 'none' }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleCancel}
        role="img"
        aria-label={ariaLabel}
      >
        {children}
        {overlay?.(view)}
      </svg>
      <div className="pointer-events-none absolute right-2 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
        <button type="button" aria-label="Zoom in" title="Zoom in" disabled={atMax} onPointerDown={stop} onClick={() => setZoom((z) => zoomIn(base, z, undefined, maxScale))} className={`${ZOOM_BUTTON} text-4xl`}>
          +
        </button>
        <button type="button" aria-label="Zoom out" title="Zoom out" disabled={atMin} onPointerDown={stop} onClick={() => setZoom((z) => zoomOut(base, z, undefined, maxScale))} className={`${ZOOM_BUTTON} text-4xl`}>
          −
        </button>
        <button type="button" aria-label="Reset zoom" title="Reset zoom" disabled={atMin} onPointerDown={stop} onClick={() => setZoom(identityZoom(base))} className={`${ZOOM_BUTTON} text-3xl`}>
          ↺
        </button>
      </div>
    </div>
  );
}
