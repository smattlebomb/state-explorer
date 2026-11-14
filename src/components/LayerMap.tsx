import { useEffect, useState } from 'react';
import { loadWorldTopology } from '../data/worldGeo';
import { loadCanadaTopology } from '../data/canadaGeo';
import { buildWorldGeometry, type WorldGeometry, type WorldLevel } from '../lib/worldMap';
import { buildCanadaGeometry, type CanadaGeometry } from '../lib/canadaMap';
import type { GameLayer } from '../lib/layerProgress';
import type { ContinentId, SubregionId } from '../data/world';
import { WorldMap } from './WorldMap';
import { CanadaMap } from './CanadaMap';

/** Loaded map geometry for a game layer. */
export type LayerGeo = { kind: 'world'; geo: WorldGeometry } | { kind: 'canada'; geo: CanadaGeometry };

/** Lazily load (once) the map for a layer. */
export function useLayerGeo(layer: GameLayer): { lg: LayerGeo | null; failed: boolean } {
  const [lg, setLg] = useState<LayerGeo | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const p: Promise<LayerGeo> =
      layer === 'world'
        ? loadWorldTopology().then((t) => ({ kind: 'world' as const, geo: buildWorldGeometry(t) }))
        : loadCanadaTopology().then((t) => ({ kind: 'canada' as const, geo: buildCanadaGeometry(t) }));
    p.then((v) => alive && setLg(v)).catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [layer]);
  return { lg, failed };
}

/** A world game scope as a map level: 'all' → whole world, 'c:…' → continent, 's:…' → sub-region. */
export function scopeLevel(scopeId: string): WorldLevel {
  if (scopeId.startsWith('c:')) return { kind: 'continent', continent: scopeId.slice(2) as ContinentId };
  if (scopeId.startsWith('s:')) return { kind: 'subregion', subregion: scopeId.slice(2) as SubregionId };
  return { kind: 'world' };
}

export interface LayerMapProps {
  lg: LayerGeo;
  scopeId: string;
  regionColors: boolean;
  /** Highlighted item (orange, with a pulse ring for tiny countries). */
  selected?: string | null;
  onTap?: (id: string) => void;
  fillOverride?: (id: string) => string | undefined;
  labels?: readonly string[];
  ring?: string | null;
  dim?: ReadonlySet<string>;
  /** Print the selected item's name (off in the games: in Name It the selected one is the answer). */
  labelSelected?: boolean;
}

/** The World or Canada map, framed on a game scope. */
export function LayerMap({ lg, scopeId, regionColors, selected = null, onTap, fillOverride, labels, ring, dim, labelSelected = true }: LayerMapProps) {
  if (lg.kind === 'world') {
    return (
      <WorldMap
        geo={lg.geo}
        level={scopeLevel(scopeId)}
        selected={selected}
        regionColors={regionColors}
        onTapPlace={onTap}
        fillOverride={fillOverride}
        labels={labels}
        ring={ring}
        dim={dim}
        labelSelected={labelSelected}
      />
    );
  }
  return <CanadaMap geo={lg.geo} selected={selected} regionColors={regionColors} onTap={onTap} fillOverride={fillOverride} labels={labels} ring={ring} dim={dim} labelSelected={labelSelected} />;
}

/** Find It hint 1: the answer's outline on its own card (its main pieces, same projection as the map). */
export function OutlineCard({ lg, id, className = '' }: { lg: LayerGeo; id: string; className?: string }) {
  // World: frame the main pieces (mainland France, not French Guiana). Canada: the whole outline.
  const w0 = lg.kind === 'world' ? lg.geo.byId.get(id) : undefined;
  const c0 = lg.kind === 'canada' ? lg.geo.byId.get(id) : undefined;
  const shape = w0 ? { d: w0.d, box: w0.mainBox } : c0 ? { d: c0.d, box: c0.bbox } : null;
  if (!shape) return null;
  const [x0, y0, x1, y1] = shape.box;
  const w = Math.max(x1 - x0, 0.5);
  const h = Math.max(y1 - y0, 0.5);
  const pad = Math.max(w, h) * 0.1;
  return (
    <div className={`pop-in rounded-3xl border-4 border-amber-300 bg-white/95 p-3 shadow-xl ${className}`}>
      <div className="mb-1 text-center text-lg font-extrabold text-amber-700">Shape hint</div>
      <svg viewBox={`${x0 - pad} ${y0 - pad} ${w + pad * 2} ${h + pad * 2}`} preserveAspectRatio="xMidYMid meet" className="block h-32 w-32 sm:h-40 sm:w-40" role="img" aria-label="Shape to find">
        <path d={shape.d} fill="#f97316" stroke="#9a3412" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
