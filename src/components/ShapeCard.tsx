import { getMapGeometry } from '../lib/geo';

/**
 * The target state's outline on its own, as a filled silhouette with no label.
 * It uses the same projected path as the map, so orientation and proportions
 * match what she sees on the map (only the size changes to fit the card).
 */
export function ShapeCard({ abbr, className = '' }: { abbr: string; className?: string }) {
  const shape = getMapGeometry().byId.get(abbr);
  if (!shape) return null;
  const [x0, y0, x1, y1] = shape.bbox;
  const w = x1 - x0;
  const h = y1 - y0;
  const pad = Math.max(w, h) * 0.08;
  return (
    <div className={`pop-in rounded-3xl border-4 border-amber-300 bg-white/95 p-3 shadow-xl ${className}`}>
      <div className="mb-1 text-center text-lg font-extrabold text-amber-700">Shape hint</div>
      <svg
        viewBox={`${x0 - pad} ${y0 - pad} ${w + pad * 2} ${h + pad * 2}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-32 w-32 sm:h-40 sm:w-40"
        role="img"
        aria-label="Shape of the state to find"
      >
        <path d={shape.d} fill="#f97316" stroke="#9a3412" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
