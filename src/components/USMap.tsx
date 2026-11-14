import { useEffect, useImperativeHandle, useMemo, useRef, useState, type PointerEvent, type Ref } from 'react';
import { getMapGeometry, type Callout, type StateShape } from '../lib/geo';
import { hitTest } from '../lib/hittest';
import {
  MAX_SCALE,
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
import { regionFills } from '../lib/regionColors';
import { SMALL_STATES } from '../data/states';

export const COLORS = {
  land: '#fef3c7',
  dim: '#e2e8f0',
  border: '#64748b',
  correct: '#22c55e',
  correctOutline: '#facc15',
  correctDark: '#14532d',
  wrong: '#f87171',
  target: '#f97316',
  selected: '#fb923c',
};

let fillsCache: Map<string, string> | null = null;
/** Region color for a state (its region's hue, tint chosen so neighbors differ). */
export function regionFill(abbr: string): string {
  fillsCache ??= regionFills(getMapGeometry().neighbors);
  return fillsCache.get(abbr) ?? COLORS.land;
}

/** Default fill: region color when region colors are on, otherwise the plain blank-map color. */
export function baseFill(abbr: string, regionColors: boolean): string {
  return regionColors ? regionFill(abbr) : COLORS.land;
}

/** Screen pixels of forgiveness around each state for near-miss taps. */
const TAP_TOLERANCE_PX = 16;
/** Taps that move more than this are treated as an accidental drag. */
const MAX_TAP_MOVE_PX = 24;

export interface MapApi {
  /** Client (screen) coordinates of a state's visual center (its callout box for tiny states). */
  screenPoint: (abbr: string) => { x: number; y: number } | null;
}

export interface USMapProps {
  /** Fill color for each state. */
  fillFor: (abbr: string) => string;
  onTap?: (abbr: string) => void;
  /** White borders (for region colors) instead of slate. */
  whiteBorders?: boolean;
  /** States that respond to taps (default: all). Others are faded and ignored. */
  tappable?: ReadonlySet<string>;
  /** States drawn strongly faded (e.g. "every other region" for the region hint). */
  dim?: ReadonlySet<string>;
  /** Zoom the view to fit these states (default: whole country). */
  focus?: readonly string[];
  /** Correct-answer feedback: pop + bright outline + ✓. Change `key` to replay. */
  correct?: { id: string; key: number } | null;
  /** Wrong-answer feedback: wobble + soft red flash. Change `key` to replay. */
  wrong?: { id: string; key: number } | null;
  /** State to draw attention to (pulsing fill + ring). */
  pulse?: string | null;
  /** Draw a dashed "it's around here" circle near this state. */
  hint?: string | null;
  /** Print the full name of these states on the map (in the callout box for tiny states). */
  labels?: readonly string[];
  apiRef?: Ref<MapApi>;
  className?: string;
}

function boundsOf(shapes: StateShape[], extra: { x: number; y: number; w: number; h: number }[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of shapes) {
    x0 = Math.min(x0, s.bbox[0]); y0 = Math.min(y0, s.bbox[1]);
    x1 = Math.max(x1, s.bbox[2]); y1 = Math.max(y1, s.bbox[3]);
  }
  for (const b of extra) {
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
  }
  return { x0, y0, x1, y1 };
}

/** Rough text width for a bold rounded font, in the same units as fontSize. */
const textWidth = (s: string, fontSize: number) => s.length * fontSize * 0.6;

/** Split a two-word name onto two lines when it's too wide for the space. */
function labelLines(name: string, fontSize: number, maxWidth: number): string[] {
  if (textWidth(name, fontSize) <= maxWidth || !name.includes(' ')) return [name];
  const i = name.indexOf(' ');
  return [name.slice(0, i), name.slice(i + 1)];
}

function CalloutLabel({ c, name }: { c: Callout; name: string }) {
  const fontSize = 15;
  const lines = labelLines(name, fontSize, c.w - 10);
  const lineH = fontSize * 1.05;
  const top = c.y + c.h / 2 - ((lines.length - 1) * lineH) / 2 + fontSize * 0.35;
  return (
    <text className="map-label" textAnchor="middle" fontSize={fontSize} fill="#0f172a">
      {lines.map((line, i) => {
        const fits = textWidth(line, fontSize) <= c.w - 8;
        return (
          <tspan key={i} x={c.x + c.w / 2} y={top + i * lineH} {...(fits ? {} : { textLength: c.w - 10, lengthAdjust: 'spacingAndGlyphs' })}>
            {line}
          </tspan>
        );
      })}
    </text>
  );
}

function StateLabel({ s, offsetY = 0 }: { s: StateShape; offsetY?: number }) {
  const fontSize = Math.max(13, Math.min(24, Math.sqrt(s.area) / 4.5));
  const width = s.bbox[2] - s.bbox[0];
  const lines = labelLines(s.name, fontSize, width * 1.1);
  const lineH = fontSize * 1.05;
  const top = s.centroid[1] + offsetY - ((lines.length - 1) * lineH) / 2 + fontSize * 0.35;
  return (
    <text className="map-label" textAnchor="middle" fontSize={fontSize} fill="#0f172a">
      {lines.map((line, i) => (
        <tspan key={i} x={s.centroid[0]} y={top + i * lineH}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function CheckBadge({ x, y, r = 13 }: { x: number; y: number; r?: number }) {
  return (
    <g className="pop-in-svg">
      <circle cx={x} cy={y} r={r} fill="white" stroke={COLORS.correctDark} strokeWidth={3} vectorEffect="non-scaling-stroke" />
      <path
        d={`M${x - r * 0.5} ${y} L${x - r * 0.12} ${y + r * 0.4} L${x + r * 0.55} ${y - r * 0.42}`}
        fill="none"
        stroke="#16a34a"
        strokeWidth={r * 0.32}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

export function USMap({
  fillFor,
  onTap,
  whiteBorders = false,
  tappable,
  dim,
  focus,
  correct,
  wrong,
  pulse,
  hint,
  labels = [],
  apiRef,
  className = '',
}: USMapProps) {
  const geo = getMapGeometry();
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { kind: 'none' }
    | { kind: 'one'; id: number; startX: number; startY: number; lastX: number; lastY: number; panned: boolean }
    | { kind: 'pinch'; startDist: number; startZoom: ZoomState; startAnchor: { x: number; y: number }; startMid: { x: number; y: number } }
  >({ kind: 'none' });

  const isTappable = (id: string) => !tappable || tappable.has(id);
  const opacityOf = (id: string) => (dim?.has(id) ? 0.25 : isTappable(id) ? 1 : 0.45);

  const callouts = useMemo(() => geo.callouts.filter((c) => !focus || focus.includes(c.id)), [geo, focus]);
  const calloutById = useMemo(() => new Map(callouts.map((c) => [c.id, c])), [callouts]);

  const baseViewBox = useMemo((): ViewBox => {
    if (!focus || focus.length === 0) return { x: 0, y: 0, w: geo.width, h: geo.height };
    const shapes = focus.map((id) => geo.byId.get(id)).filter((s): s is StateShape => !!s);
    const b = boundsOf(shapes, callouts);
    const pad = 24;
    let x = b.x0 - pad, y = b.y0 - pad, w = b.x1 - b.x0 + pad * 2, h = b.y1 - b.y0 + pad * 2;
    // Don't zoom the region-focus view in absurdly far: keep at least ~40% of the full width visible.
    const minW = geo.width * 0.4;
    if (w < minW) { x -= (minW - w) / 2; w = minW; }
    const minH = geo.height * 0.4;
    if (h < minH) { y -= (minH - h) / 2; h = minH; }
    return { x, y, w, h };
  }, [geo, focus, callouts]);
  const baseKey = formatViewBox(baseViewBox);
  const [zoom, setZoom] = useState<ZoomState>(() => identityZoom(baseViewBox));
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Reset pinch-zoom when the screen or focused region changes (new base view).
  useEffect(() => {
    setZoom(identityZoom(baseViewBox));
    gesture.current = { kind: 'none' };
    pointers.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the base view identity changes
  }, [baseKey]);

  const viewBox = formatViewBox(visibleWindow(baseViewBox, zoom));

  // Stop the page itself from pinch-zooming while fingers are on the map.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const stop = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, []);

  const svgBox = () => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  };

  const hitShapes = useMemo(() => geo.shapes.filter((s) => !tappable || tappable.has(s.id)), [geo, tappable]);
  const hitBoxes = useMemo(() => callouts.filter((c) => !tappable || tappable.has(c.id)), [callouts, tappable]);

  useImperativeHandle(
    apiRef,
    () => ({
      screenPoint: (abbr: string) => {
        const svg = svgRef.current;
        const ctm = svg?.getScreenCTM();
        const s = geo.byId.get(abbr);
        if (!svg || !ctm || !s) return null;
        const c = calloutById.get(abbr);
        const [x, y] = c ? [c.x + c.w / 2, c.y + c.h / 2] : s.centroid;
        const p = new DOMPoint(x, y).matrixTransform(ctm);
        return { x: p.x, y: p.y };
      },
    }),
    [geo, calloutById],
  );

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
      const vis = visibleWindow(baseViewBox, zoomRef.current);
      const startAnchor = box ? clientToMap(mid.x, mid.y, box, vis) : { x: vis.x + vis.w / 2, y: vis.y + vis.h / 2 };
      gesture.current = { kind: 'pinch', startDist: dist, startZoom: zoomRef.current, startAnchor, startMid: mid };
      return;
    }
    gesture.current = {
      kind: 'one',
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      panned: false,
    };
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
      const z1 = zoomAt(baseViewBox, g.startZoom, dist / g.startDist, g.startAnchor.x, g.startAnchor.y);
      const vis1 = visibleWindow(baseViewBox, z1);
      const s = meetScale(box.width, box.height, vis1) || 1;
      setZoom(panBy(baseViewBox, z1, -(mid.x - g.startMid.x) / s, -(mid.y - g.startMid.y) / s));
      return;
    }
    if (g.kind === 'one' && g.id === e.pointerId) {
      const travel = Math.hypot(e.clientX - g.startX, e.clientY - g.startY);
      if (travel > MAX_TAP_MOVE_PX) {
        g.panned = true;
        if (zoomRef.current.k > MIN_SCALE && box) {
          const vis = visibleWindow(baseViewBox, zoomRef.current);
          const s = meetScale(box.width, box.height, vis) || 1;
          const dx = e.clientX - g.lastX;
          const dy = e.clientY - g.lastY;
          setZoom((z) => panBy(baseViewBox, z, -dx / s, -dy / s));
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
      g.kind === 'one' &&
      g.id === e.pointerId &&
      !g.panned &&
      Math.hypot(e.clientX - g.startX, e.clientY - g.startY) <= MAX_TAP_MOVE_PX;

    if (pointers.current.size >= 2) {
      // still pinching with leftover fingers; leave gesture as-is
    } else if (pointers.current.size === 1) {
      const [id, pt] = [...pointers.current.entries()][0];
      gesture.current = { kind: 'one', id, startX: pt.x, startY: pt.y, lastX: pt.x, lastY: pt.y, panned: true };
    } else {
      gesture.current = { kind: 'none' };
    }

    if (!wasTap || !onTap) return;
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const tolerance = TAP_TOLERANCE_PX / ctm.a;
    const id = hitTest([pt.x, pt.y], hitShapes, tolerance, hitBoxes);
    if (id) onTap(id);
  };

  const handleCancel = (e: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gesture.current = { kind: 'none' };
  };

  const border = whiteBorders ? '#ffffff' : COLORS.border;
  const pulseShape = pulse ? geo.byId.get(pulse) : undefined;
  const hintShape = hint ? geo.byId.get(hint) : undefined;
  const correctShape = correct ? geo.byId.get(correct.id) : undefined;
  const wrongShape = wrong ? geo.byId.get(wrong.id) : undefined;
  const fillOf = (id: string) => (id === pulse ? COLORS.target : fillFor(id));
  const labelSet = new Set(labels);

  const atMin = zoom.k <= MIN_SCALE + 1e-6;
  const atMax = zoom.k >= MAX_SCALE - 1e-6;

  return (
    <div ref={wrapRef} className={`map-zoom-wrap relative h-full w-full ${className}`}>
    <svg
      ref={svgRef}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full touch-none"
      style={{ touchAction: 'none' }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleCancel}
      role="img"
      aria-label="Map of the United States"
    >
      {geo.shapes.map((s) => (
        <path
          key={s.id}
          d={s.d}
          className={`state-path ${s.id === pulse ? 'pulse-fill' : ''}`}
          style={{ fill: fillOf(s.id), opacity: opacityOf(s.id) }}
          stroke={border}
          strokeWidth={whiteBorders ? 1.6 : 1.25}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* Enlarged tap targets for the tiny northeastern states */}
      {callouts.map((c) => (
        <g key={c.id} style={{ opacity: opacityOf(c.id) }}>
          <line x1={c.anchor[0]} y1={c.anchor[1]} x2={c.x} y2={c.y + c.h / 2} stroke={COLORS.border} strokeWidth={1.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <circle cx={c.anchor[0]} cy={c.anchor[1]} r={2.5} fill={COLORS.border} />
          <rect
            x={c.x}
            y={c.y}
            width={c.w}
            height={c.h}
            rx={12}
            className={`state-path ${c.id === pulse ? 'pulse-fill' : ''}`}
            style={{ fill: fillOf(c.id) }}
            stroke={whiteBorders ? '#ffffff' : COLORS.border}
            strokeWidth={whiteBorders ? 3 : 2}
            vectorEffect="non-scaling-stroke"
          />
          {whiteBorders && <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={12} fill="none" stroke="#94a3b8" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        </g>
      ))}

      {/* Wrong: quick soft red flash + wobble on the tapped state */}
      {wrongShape && (
        <g key={`wrong-${wrong!.key}`} className="wrong-flash" style={{ pointerEvents: 'none' }}>
          <path d={wrongShape.d} fill={COLORS.wrong} stroke="#b91c1c" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          {calloutById.get(wrongShape.id) && (() => {
            const c = calloutById.get(wrongShape.id)!;
            return <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={12} fill={COLORS.wrong} stroke="#b91c1c" strokeWidth={2} vectorEffect="non-scaling-stroke" />;
          })()}
        </g>
      )}

      {/* Correct: pop + bright green fill with a gold outline (visible on any region color) */}
      {correctShape && (
        <g key={`ok-${correct!.key}`} style={{ pointerEvents: 'none' }}>
          <path className="pop-state" d={correctShape.d} fill={COLORS.correct} stroke={COLORS.correctDark} strokeWidth={7} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path className="pop-state" d={correctShape.d} fill={COLORS.correct} stroke={COLORS.correctOutline} strokeWidth={3.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {calloutById.get(correctShape.id) && (() => {
            const c = calloutById.get(correctShape.id)!;
            return (
              <rect className="pop-state" x={c.x} y={c.y} width={c.w} height={c.h} rx={12} fill={COLORS.correct} stroke={COLORS.correctOutline} strokeWidth={4} vectorEffect="non-scaling-stroke" />
            );
          })()}
        </g>
      )}

      {hintShape && (
        <circle
          key={`hint-${hint}`}
          className="hint-circle"
          cx={hintShape.centroid[0] + 18}
          cy={hintShape.centroid[1] - 12}
          r={Math.max(70, Math.sqrt(hintShape.area) * 1.2)}
          fill="rgba(250, 204, 21, 0.15)"
          stroke="#eab308"
          strokeWidth={4}
          strokeDasharray="14 10"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {pulseShape && (
        <>
          <circle key={`ring-${pulse}`} className="pulse-ring" cx={pulseShape.centroid[0]} cy={pulseShape.centroid[1]} r={Math.max(28, Math.sqrt(pulseShape.area) * 0.8)} fill="none" stroke={COLORS.target} strokeWidth={5} vectorEffect="non-scaling-stroke" />
          {SMALL_STATES.includes(pulseShape.id) &&
            callouts
              .filter((c) => c.id === pulseShape.id)
              .map((c) => (
                <rect key={`cring-${c.id}`} className="pulse-ring" x={c.x - 4} y={c.y - 4} width={c.w + 8} height={c.h + 8} rx={14} fill="none" stroke={COLORS.target} strokeWidth={4} vectorEffect="non-scaling-stroke" />
              ))}
        </>
      )}

      {/* Names (keep-names mode, Learn, reveals). Tiny states print inside their callout box. */}
      {[...labelSet].map((id) => {
        const s = geo.byId.get(id);
        if (!s) return null;
        const c = calloutById.get(id);
        const hasBadge = correctShape?.id === id;
        return (
          <g key={`label-${id}`}>
            {c ? <CalloutLabel c={c} name={s.name} /> : <StateLabel s={s} offsetY={hasBadge ? 12 : 0} />}
          </g>
        );
      })}

      {correctShape &&
        (() => {
          const c = calloutById.get(correctShape.id);
          const [x, y] = c ? [c.x + 2, c.y + 2] : [correctShape.centroid[0], correctShape.centroid[1] - (labelSet.has(correctShape.id) ? 14 : 0)];
          return <CheckBadge key={`badge-${correct!.key}`} x={x} y={y} />;
        })()}
    </svg>
      <div className="pointer-events-none absolute right-2 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          disabled={atMax}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setZoom((z) => zoomIn(baseViewBox, z))}
          className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-4xl font-black leading-none text-slate-800 shadow-[0_4px_0_#94a3b8] transition active:translate-y-1 active:shadow-[0_1px_0_#94a3b8] disabled:opacity-40 disabled:active:translate-y-0 disabled:active:shadow-[0_4px_0_#94a3b8]"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={atMin}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setZoom((z) => zoomOut(baseViewBox, z))}
          className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-4xl font-black leading-none text-slate-800 shadow-[0_4px_0_#94a3b8] transition active:translate-y-1 active:shadow-[0_1px_0_#94a3b8] disabled:opacity-40 disabled:active:translate-y-0 disabled:active:shadow-[0_4px_0_#94a3b8]"
        >
          −
        </button>
        <button
          type="button"
          aria-label="Reset zoom"
          title="Reset zoom"
          disabled={atMin}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setZoom(identityZoom(baseViewBox))}
          className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl font-black leading-none text-slate-800 shadow-[0_4px_0_#94a3b8] transition active:translate-y-1 active:shadow-[0_1px_0_#94a3b8] disabled:opacity-40 disabled:active:translate-y-0 disabled:active:shadow-[0_4px_0_#94a3b8]"
        >
          ↺
        </button>
      </div>
    </div>
  );
}
