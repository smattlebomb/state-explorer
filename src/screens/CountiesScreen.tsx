import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SavedData } from '../lib/storage';
import { loadCountyTopology, type CountyTopology } from '../data/countiesGeo';
import { STATE_BY_ABBR } from '../data/states';
import { getMapGeometry } from '../lib/geo';
import { hitTest, type Pt } from '../lib/hittest';
import {
  COUNTY_DOT_PX,
  COUNTY_MAX_SCALE,
  buildStateCounties,
  countyFills,
  countyMarkers,
  pickCounty,
  stateCountyView,
} from '../lib/counties';
import { ZoomMap, type MapView } from '../components/ZoomMap';
import { MapLoading } from '../components/MapLoading';
import { Mascot } from '../components/Mascot';
import { BigButton, IconButton, TopBar } from '../components/ui';
import { speak } from '../lib/speech';

const LAND = '#fef3c7';
const OTHER_STATE = '#e2e8f0';
const SELECTED = '#fb923c';
const BORDER = '#64748b';

interface Props {
  data: SavedData;
  /** The state to start in (postal abbr). */
  state: string;
  onHome: () => void;
  /** Back to the 50-state Learn map. */
  onBack: () => void;
}

/**
 * Tap-to-explore US counties for one state at a time. Not graded: no stars,
 * no mastery, nothing saved. Tapping a different state switches to its counties.
 */
export function CountiesScreen({ data, state: initialState, onHome, onBack }: Props) {
  const usGeo = getMapGeometry();
  const [topo, setTopo] = useState<CountyTopology | null>(null);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState(initialState);
  const [selected, setSelected] = useState<string | null>(null);
  const [popKey, setPopKey] = useState(0);
  const { regionColors, narration } = data.settings;
  const stateInfo = STATE_BY_ABBR.get(state)!;

  useEffect(() => {
    let alive = true;
    loadCountyTopology()
      .then((t) => alive && setTopo(t))
      .catch(() => alive && setFailed(true));
    speak(`Tap a county in ${STATE_BY_ABBR.get(initialState)?.name ?? 'the state'}!`);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sc = useMemo(() => (topo ? buildStateCounties(topo, state, usGeo.projection) : null), [topo, state, usGeo]);
  const fills = useMemo(() => (sc ? countyFills(sc) : null), [sc]);
  const stateShape = usGeo.byId.get(state)!;
  const base = useMemo(() => stateCountyView(stateShape.bbox, usGeo.width), [stateShape, usGeo]);

  const switchState = (abbr: string) => {
    setState(abbr);
    setSelected(null);
    setPopKey((k) => k + 1);
    speak(`${STATE_BY_ABBR.get(abbr)!.name}. Tap a county!`);
  };

  const selectCounty = (id: string) => {
    setSelected(id);
    setPopKey((k) => k + 1);
    speak(`${sc?.byId.get(id)?.label}, ${stateInfo.name}`);
  };

  const onTap = (pt: Pt, view: MapView) => {
    if (!sc) return;
    const county = pickCounty(sc, pt, view.pxPerUnit);
    if (county) return selectCounty(county);
    // Outside this state's counties: tapping another state shows its counties instead.
    const other = hitTest(pt, usGeo.shapes, 0);
    if (other && other !== state) switchState(other);
  };

  // Static layer: other states as faded context, this state's counties, and a bold state outline.
  const layer = useMemo(
    () => (
      <>
        {usGeo.shapes.map((s) => (
          <path key={s.id} data-state={s.id} d={s.d} style={{ fill: s.id === state ? LAND : OTHER_STATE }} stroke="#ffffff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        ))}
        {sc?.counties.map((c) => (
          <path
            key={c.id}
            data-county={c.id}
            d={c.d}
            className="state-path"
            style={{ fill: c.id === selected ? SELECTED : regionColors ? (fills?.get(c.id) ?? LAND) : LAND }}
            stroke={regionColors ? '#ffffff' : BORDER}
            strokeWidth={0.8}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={stateShape.d} fill="none" stroke="#334155" strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ pointerEvents: 'none' }} />
      </>
    ),
    [usGeo, sc, fills, state, selected, regionColors, stateShape],
  );

  const overlay = (view: MapView) => {
    if (!sc) return null;
    const px = view.pxPerUnit;
    const dots = countyMarkers(sc, px, COUNTY_DOT_PX.draw);
    const sel = selected ? sc.byId.get(selected) : undefined;
    return (
      <>
        {dots.map((m) => (
          <circle
            key={`dot-${m.id}`}
            data-county-dot={m.id}
            cx={m.x}
            cy={m.y}
            r={m.r}
            fill={m.id === selected ? SELECTED : regionColors ? (fills?.get(m.id) ?? LAND) : LAND}
            stroke={BORDER}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {sel && (
          <text className="map-label" x={sel.anchor[0]} y={sel.anchor[1] - (sel.size * px < 14 ? 16 / px : 0)} textAnchor="middle" fontSize={20 / px} style={{ strokeWidth: 5 / px }} fill="#0f172a">
            {sel.label}
          </text>
        )}
      </>
    );
  };

  const county = selected && sc ? sc.byId.get(selected) : undefined;
  let header: ReactNode;
  if (county) {
    header = (
      <div key={popKey} className="pop-in">
        <div className="truncate text-4xl font-black text-slate-900 sm:text-5xl">{county.label}</div>
        <div className="text-xl font-bold text-slate-500">{stateInfo.name}</div>
      </div>
    );
  } else {
    header = (
      <div key={popKey} className="pop-in flex items-center justify-center gap-3">
        <Mascot mood="idle" size={56} />
        <div>
          <div className="text-3xl font-black text-slate-900 sm:text-4xl">🔎 {stateInfo.name}</div>
          <div className="text-xl font-bold text-slate-500">{sc ? `${sc.counties.length} ${countWord(state)} · tap one!` : 'Tap a county!'}</div>
        </div>
      </div>
    );
  }

  return (
    <main className="flex h-full flex-col">
      <TopBar
        onHome={onHome}
        right={
          narration && county ? (
            <IconButton label="Say it again" onClick={() => speak(`${county.label}, ${stateInfo.name}`)}>
              🔊
            </IconButton>
          ) : undefined
        }
      >
        {header}
      </TopBar>

      <div className="min-h-0 flex-1 px-2">
        {topo ? (
          <ZoomMap base={base} maxScale={COUNTY_MAX_SCALE} ariaLabel={`Counties of ${stateInfo.name}`} overlay={overlay} onTap={onTap}>
            <rect x={-2000} y={-2000} width={6000} height={6000} fill="#dbeafe" />
            {layer}
          </ZoomMap>
        ) : failed ? (
          <MapLoading text="Oops, the counties didn't load. Go back and try again!" />
        ) : (
          <MapLoading text="Drawing the counties…" />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 p-3">
        <BigButton variant="secondary" onClick={onBack}>
          ◀ Back to the 50 states
        </BigButton>
        <span className="text-xl font-bold text-slate-600">Tap another state to see its {countWord('')} ✨</span>
      </div>
    </main>
  );
}

/** Louisiana has parishes and Alaska has boroughs; everywhere else, counties. */
function countWord(abbr: string): string {
  return abbr === 'LA' ? 'parishes' : abbr === 'AK' ? 'boroughs and areas' : 'counties';
}

export default CountiesScreen;
