import { useEffect, useState, type ReactNode } from 'react';
import type { SavedData } from '../lib/storage';
import { loadCanadaTopology } from '../data/canadaGeo';
import { CANADA_REGIONS, PROVINCES, PROVINCE_BY_ABBR } from '../data/canada';
import { buildCanadaGeometry, canadaRegionSolid, type CanadaGeometry } from '../lib/canadaMap';
import { CanadaMap } from '../components/CanadaMap';
import { Mascot } from '../components/Mascot';
import { IconButton, TopBar } from '../components/ui';
import { MapLoading } from '../components/MapLoading';
import { speak } from '../lib/speech';

interface Props {
  data: SavedData;
  onHome: () => void;
  /** Back to the world map (when she drilled in from there). */
  onBack?: () => void;
  /** Explored provinces from the Canada progress store (session-only if not given). */
  explored?: readonly string[];
  onExplore?: (abbr: string) => void;
}

export function CanadaScreen({ data, onHome, onBack, explored: savedExplored, onExplore }: Props) {
  const [geo, setGeo] = useState<CanadaGeometry | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [sessionExplored, setSessionExplored] = useState<ReadonlySet<string>>(new Set());
  const explored: ReadonlySet<string> = savedExplored ? new Set(savedExplored) : sessionExplored;
  const [popKey, setPopKey] = useState(0);
  const { regionColors, narration } = data.settings;

  useEffect(() => {
    let alive = true;
    loadCanadaTopology()
      .then((t) => alive && setGeo(buildCanadaGeometry(t)))
      .catch(() => alive && setFailed(true));
    speak('Tap a province or territory!');
    return () => {
      alive = false;
    };
  }, []);

  const select = (id: string) => {
    setSelected(id);
    setPopKey((k) => k + 1);
    setSessionExplored((s) => new Set(s).add(id));
    onExplore?.(id);
    speak(PROVINCE_BY_ABBR.get(id)?.name ?? id);
  };

  const info = selected ? PROVINCE_BY_ABBR.get(selected) : undefined;
  let header: ReactNode;
  if (info) {
    header = (
      <div key={popKey} className="pop-in">
        <div className="truncate text-4xl font-black text-slate-900 sm:text-5xl">{info.name}</div>
        <div className="text-xl font-bold text-slate-500">
          {info.kind === 'province' ? 'Province' : 'Territory'} · Capital: {info.capital}
        </div>
      </div>
    );
  } else {
    header = (
      <div className="flex items-center justify-center gap-3 text-3xl font-black text-slate-800 sm:text-4xl">
        <Mascot mood="idle" size={56} /> 🍁 Tap a province or territory!
      </div>
    );
  }

  return (
    <main className="flex h-full flex-col">
      <TopBar
        onHome={onHome}
        right={
          <>
            {narration && info && (
              <IconButton label="Say it again" onClick={() => speak(`${info.name}. The capital is ${info.capital}.`)}>
                🔊
              </IconButton>
            )}
            {onBack && (
              <button
                type="button"
                aria-label="Back to the world map"
                onClick={onBack}
                className="min-h-16 rounded-3xl bg-white px-5 text-xl font-extrabold text-slate-800 shadow-[0_4px_0_#94a3b8] transition active:translate-y-1"
              >
                🌍 World
              </button>
            )}
          </>
        }
      >
        {header}
      </TopBar>

      <div className="min-h-0 flex-1 px-2">
        {geo ? (
          <CanadaMap geo={geo} selected={selected} regionColors={regionColors} onTap={select} />
        ) : failed ? (
          <MapLoading text="Oops, the map didn't load. Go back and try again!" />
        ) : (
          <MapLoading />
        )}
      </div>

      {info?.capitalNote && <p className="px-4 pt-1 text-center text-xl font-bold text-slate-600">{info.capitalNote}</p>}

      {regionColors && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2 pt-1 text-lg font-bold text-slate-700" aria-label="Region colors">
          {CANADA_REGIONS.map((r) => (
            <span key={r.id} className="flex items-center gap-1.5">
              <span className="inline-block h-5 w-5 rounded-md border-2 border-white shadow" style={{ background: canadaRegionSolid(r.id) }} />
              {r.label}
            </span>
          ))}
        </div>
      )}

      {/* All 13 as buttons too (handy for PEI, and for finding a name she heard). */}
      <div className="flex gap-2 overflow-x-auto px-3 pt-2" aria-label="Provinces and territories">
        {PROVINCES.map((p) => (
          <button
            key={p.abbr}
            type="button"
            onClick={() => select(p.abbr)}
            className={`min-h-16 shrink-0 rounded-3xl px-4 text-xl font-extrabold transition active:translate-y-1 ${
              p.abbr === selected ? 'bg-orange-400 text-white shadow-[0_4px_0_#c2410c]' : 'bg-white text-slate-800 shadow-[0_4px_0_#94a3b8]'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <footer className="px-4 pb-4 pt-2 text-center text-2xl font-extrabold text-slate-700">
        {explored.size === 13 ? '🎉 You explored all 13!' : `You've explored ${explored.size} of 13 ✨`}
      </footer>
    </main>
  );
}

export default CanadaScreen;
