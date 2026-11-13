import { REGION_PALETTE } from '../data/regions';
import { getRegion } from '../data/regions';
import { REGION_IDS } from '../lib/regionProgress';

/** Small "which color is which region" key, shown under the map when region colors are on. */
export function RegionLegend({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-lg font-bold text-slate-700 ${className}`} aria-label="Region colors">
      {REGION_IDS.map((id) => (
        <span key={id} className="flex items-center gap-1.5">
          <span className="inline-block h-5 w-5 rounded-md border-2 border-white shadow" style={{ background: REGION_PALETTE[id].tints[0] }} />
          {getRegion(id).label}
        </span>
      ))}
    </div>
  );
}
