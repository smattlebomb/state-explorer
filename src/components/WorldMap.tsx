import { useMemo } from 'react';
import { ZoomMap, type MapView } from './ZoomMap';
import {
  CONTINENT_LABEL_AT,
  WORLD_MAX_SCALE,
  inLevel,
  levelView,
  markerPx,
  markersFor,
  pickPlace,
  worldFills,
  type PlaceShape,
  type WorldGeometry,
  type WorldLevel,
} from '../lib/worldMap';
import { CONTINENTS, SUBREGION_BY_ID } from '../data/world';

const LAND = '#fef3c7';
const GREY = '#e2e8f0';
const SELECTED = '#fb923c';
const BORDER = '#64748b';

export interface WorldMapProps {
  geo: WorldGeometry;
  level: WorldLevel;
  selected: string | null;
  /** Continent/sub-region colors (the same Settings switch as the US map). Off = plain map. */
  regionColors: boolean;
  /** Without it the map is look-only (Name It, results). */
  onTapPlace?: (id: string) => void;
  // ---- game extras (Find It / Name It / results) ----
  /** Color that wins over the normal fill (right/wrong feedback, results). */
  fillOverride?: (id: string) => string | undefined;
  /** Names printed on the map, besides the selected place. */
  labels?: readonly string[];
  /** Dashed "it's around here" circle near this place. */
  ring?: string | null;
  /** Places drawn strongly faded (e.g. everything outside the hinted region). */
  dim?: ReadonlySet<string>;
  /** Print the selected place's name (Learn: yes; Name It: no, that would give the answer away). */
  labelSelected?: boolean;
}

/** Fill for one place at this level. */
function placeFill(s: PlaceShape, level: WorldLevel, fills: ReturnType<typeof worldFills>, regionColors: boolean): string {
  const focused = inLevel(s, level);
  if (!regionColors) return focused ? LAND : GREY;
  if (level.kind === 'world') return fills.byPlace.get(s.id) ?? LAND;
  if (level.kind === 'continent') return focused ? (fills.bySubregion.get(s.subregion) ?? LAND) : GREY;
  if (focused) return fills.byPlace.get(s.id) ?? LAND;
  // The rest of the same continent keeps its (faded) sub-region shade, so she sees where she is.
  const continent = SUBREGION_BY_ID.get(level.subregion)?.continent;
  return s.continent === continent ? (fills.bySubregion.get(s.subregion) ?? GREY) : GREY;
}

export function WorldMap({ geo, level, selected, regionColors, onTapPlace, fillOverride, labels = [], ring = null, dim, labelSelected = true }: WorldMapProps) {
  const fills = useMemo(() => worldFills(geo), [geo]);
  const base = useMemo(() => levelView(geo, level), [geo, level]);

  // Static layer: every place's outline. Re-rendered only when the level, selection or colors change,
  // not on every pan/zoom frame.
  const shapes = useMemo(
    () =>
      geo.shapes.map((s) => {
        const focused = inLevel(s, level);
        return (
          <path
            key={s.id}
            data-id={s.id}
            d={s.d}
            className="state-path"
            style={{ fill: fillOverride?.(s.id) ?? (s.id === selected ? SELECTED : placeFill(s, level, fills, regionColors)), opacity: dim?.has(s.id) ? 0.25 : focused ? 1 : 0.55 }}
            stroke={regionColors ? '#ffffff' : BORDER}
            strokeWidth={regionColors ? 0.9 : 0.7}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      }),
    [geo, level, selected, regionColors, fills, fillOverride, dim],
  );

  const overlay = (view: MapView) => {
    const px = view.pxPerUnit;
    const markers = markersFor(geo, level, px, markerPx(level).draw);
    const sel = selected ? geo.byId.get(selected) : undefined;
    return (
      <>
        {markers.map((m) => {
          const s = geo.byId.get(m.id)!;
          const isSel = m.id === selected;
          return (
            <circle
              key={`dot-${m.id}`}
              data-marker={m.id}
              cx={m.x}
              cy={m.y}
              r={m.r}
              fill={fillOverride?.(m.id) ?? (isSel ? SELECTED : placeFill(s, level, fills, regionColors))}
              opacity={dim?.has(m.id) ? 0.35 : 1}
              stroke={isSel ? '#9a3412' : BORDER}
              strokeWidth={isSel ? 3 : 1.5}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {level.kind === 'world' &&
          CONTINENTS.map((c) => {
            const p = geo.projection(CONTINENT_LABEL_AT[c.id]);
            if (!p) return null;
            return (
              <text key={`cl-${c.id}`} className="map-label" x={p[0]} y={p[1]} textAnchor="middle" fontSize={20 / px} style={{ strokeWidth: 5 / px }} fill="#0f172a">
                {c.name}
              </text>
            );
          })}

        {ring &&
          (() => {
            const r = geo.byId.get(ring);
            if (!r) return null;
            return (
              <circle
                key={`ring-${ring}`}
                className="hint-circle"
                cx={r.anchor[0] + 10 / px}
                cy={r.anchor[1] - 8 / px}
                r={Math.max(70 / px, (r.mainBox[2] - r.mainBox[0]) * 0.9)}
                fill="rgba(250, 204, 21, 0.15)"
                stroke="#eab308"
                strokeWidth={4}
                strokeDasharray="14 10"
                vectorEffect="non-scaling-stroke"
              />
            );
          })()}

        {labels
          .filter((id) => !(labelSelected && id === selected))
          .map((id) => {
            const p = geo.byId.get(id);
            if (!p) return null;
            return (
              <text key={`lbl-${id}`} className="map-label" x={p.anchor[0]} y={p.anchor[1] - (p.small ? 16 / px : 0)} textAnchor="middle" fontSize={18 / px} style={{ strokeWidth: 5 / px }} fill="#0f172a">
                {p.name}
              </text>
            );
          })}

        {sel && (
          <>
            {sel.small && <circle className="pulse-ring" cx={sel.anchor[0]} cy={sel.anchor[1]} r={24 / px} fill="none" stroke={SELECTED} strokeWidth={4} vectorEffect="non-scaling-stroke" />}
{labelSelected && (
                        <text className="map-label" x={sel.anchor[0]} y={sel.anchor[1] - (sel.small ? 28 / px : 0)} textAnchor="middle" fontSize={22 / px} style={{ strokeWidth: 5 / px }} fill="#0f172a">
              {sel.name}
            </text>
            )}
          </>
        )}
      </>
    );
  };

  return (
    <ZoomMap
      base={base}
      maxScale={WORLD_MAX_SCALE}
      ariaLabel="Map of the world"
      overlay={overlay}
      onTap={
        onTapPlace
          ? (pt, view) => {
              const id = pickPlace(geo, level, pt, view.pxPerUnit);
              if (id) onTapPlace(id);
            }
          : undefined
      }
    >
      <rect x={-2000} y={-2000} width={6000} height={6000} fill="#dbeafe" />
      {shapes}
    </ZoomMap>
  );
}
