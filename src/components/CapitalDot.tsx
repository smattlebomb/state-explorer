/** A capital's position on a map, in map units, with its name. */
export interface CapitalMark {
  x: number;
  y: number;
  label: string;
}

/**
 * The capital dot: a gold star-in-a-circle with the capital's name beside it.
 * `px` = screen pixels per map unit, so it stays the same size at any zoom.
 */
export function CapitalDot({ mark, px = 1 }: { mark: CapitalMark; px?: number }) {
  const r = 9 / px;
  const star = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r * 0.75 : r * 0.32;
    return `${mark.x + rr * Math.cos(a)},${mark.y + rr * Math.sin(a)}`;
  }).join(' ');
  return (
    <g data-capital={mark.label} style={{ pointerEvents: 'none' }}>
      <circle className="pop-in-svg" cx={mark.x} cy={mark.y} r={r} fill="#fde047" stroke="#854d0e" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      <polygon points={star} fill="#b91c1c" />
      <text className="map-label" x={mark.x + r * 1.4} y={mark.y + 7 / px} fontSize={20 / px} style={{ strokeWidth: 5 / px }} fill="#7c2d12">
        {mark.label}
      </text>
    </g>
  );
}
