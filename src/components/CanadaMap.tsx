import { useMemo } from 'react';
import { ZoomMap, type MapView } from './ZoomMap';
import { CANADA_MAX_SCALE, canadaFills, pickProvince, type CanadaGeometry, type ProvinceCallout } from '../lib/canadaMap';

const LAND = '#fef3c7';
const SELECTED = '#fb923c';
const BORDER = '#64748b';

export interface CanadaMapProps {
  geo: CanadaGeometry;
  selected: string | null;
  regionColors: boolean;
  /** Without it the map is look-only (Name It, results). */
  onTap?: (id: string) => void;
  /** Color that wins over the normal fill (right/wrong feedback, results). */
  fillOverride?: (id: string) => string | undefined;
  /** Names printed on the map, besides the selected one. */
  labels?: readonly string[];
  /** Dashed "it's around here" circle near this province. */
  ring?: string | null;
  /** Provinces drawn strongly faded (outside the hinted region). */
  dim?: ReadonlySet<string>;
  /** Print the selected province's name (Learn: yes; Name It: no, that would give the answer away). */
  labelSelected?: boolean;
}

function CalloutText({ c, name }: { c: ProvinceCallout; name: string }) {
  // Fixed map-unit size inside the box (the box zooms with the map).
  const words = name.split(' ');
  const lines = words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : [name];
  return (
    <text className="map-label" textAnchor="middle" fontSize={17} fill="#0f172a">
      {lines.map((l, i) => (
        <tspan key={i} x={c.x + c.w / 2} y={c.y + c.h / 2 + 6 - ((lines.length - 1) * 18) / 2 + i * 18}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

/** Canada's 13 provinces and territories, with PEI's callout box. Shared by Learn and the games. */
export function CanadaMap({ geo, selected, regionColors, onTap, fillOverride, labels = [], ring = null, dim, labelSelected = true }: CanadaMapProps) {
  const fills = useMemo(() => canadaFills(geo), [geo]);
  const fillOf = (id: string) => fillOverride?.(id) ?? (id === selected ? SELECTED : regionColors ? (fills.get(id) ?? LAND) : LAND);
  const border = regionColors ? '#ffffff' : BORDER;

  const shapes = useMemo(
    () => (
      <>
        {geo.shapes.map((s) => (
          <path
            key={s.id}
            data-id={s.id}
            d={s.d}
            className="state-path"
            style={{ fill: fillOf(s.id), opacity: dim?.has(s.id) ? 0.25 : 1 }}
            stroke={border}
            strokeWidth={1.2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {geo.callouts.map((c) => (
          <g key={`callout-${c.id}`} data-callout={c.id} style={{ opacity: dim?.has(c.id) ? 0.35 : 1 }}>
            <line x1={c.anchor[0]} y1={c.anchor[1]} x2={c.x + 20} y2={c.y} stroke={BORDER} strokeWidth={1.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <circle cx={c.anchor[0]} cy={c.anchor[1]} r={2.5} fill={BORDER} />
            <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={14} style={{ fill: fillOf(c.id) }} stroke={regionColors ? '#94a3b8' : BORDER} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fillOf/border derive from these
    [geo, selected, regionColors, fills, fillOverride, dim],
  );

  const overlay = (view: MapView) => {
    const px = view.pxPerUnit;
    const named = [...new Set([...labels, ...(selected && labelSelected ? [selected] : [])])];
    const r = ring ? geo.byId.get(ring) : undefined;
    return (
      <>
        {r && (
          <circle
            key={`ring-${ring}`}
            className="hint-circle"
            cx={r.anchor[0] + 10 / px}
            cy={r.anchor[1] - 8 / px}
            r={Math.max(80 / px, (r.bbox[2] - r.bbox[0]) * 0.7)}
            fill="rgba(250, 204, 21, 0.15)"
            stroke="#eab308"
            strokeWidth={4}
            strokeDasharray="14 10"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {named.map((id) => {
          const s = geo.byId.get(id);
          if (!s) return null;
          const callout = geo.callouts.find((c) => c.id === id);
          if (callout) return <CalloutText key={`lbl-${id}`} c={callout} name={s.name} />;
          return (
            <text key={`lbl-${id}`} className="map-label" x={s.anchor[0]} y={s.anchor[1]} textAnchor="middle" fontSize={22 / px} style={{ strokeWidth: 5 / px }} fill="#0f172a">
              {s.name}
            </text>
          );
        })}
      </>
    );
  };

  return (
    <ZoomMap
      base={geo.view}
      maxScale={CANADA_MAX_SCALE}
      ariaLabel="Map of Canada"
      overlay={overlay}
      onTap={
        onTap
          ? (pt, view) => {
              const id = pickProvince(geo, pt, view.pxPerUnit);
              if (id) onTap(id);
            }
          : undefined
      }
    >
      <rect x={-2000} y={-2000} width={6000} height={6000} fill="#dbeafe" />
      {shapes}
    </ZoomMap>
  );
}
