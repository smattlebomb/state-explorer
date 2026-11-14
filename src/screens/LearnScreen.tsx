import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UpdateData } from '../App';
import { withExplored, withSetting, type SavedData } from '../lib/storage';
import { keepLabel, keptAfterToggle, learnMapLabels } from '../lib/learnLabels';
import { STATE_BY_ABBR, STATES, type RegionId } from '../data/states';
import { getRegion, REGION_COMPASS, REGION_TINT } from '../data/regions';
import { REGION_IDS, tourOrder } from '../lib/regionProgress';
import { getMapGeometry } from '../lib/geo';
import { COLORS, regionFill, USMap } from '../components/USMap';
import { RegionLegend } from '../components/RegionLegend';
import { BigButton, IconButton, TopBar } from '../components/ui';
import { speak } from '../lib/speech';

/** Cheerful colors for states she has explored. */
const PALETTE = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb7185', '#2dd4bf', '#a3e635', '#38bdf8', '#f59e0b'];
const exploredColor = new Map(STATES.map((s, i) => [s.abbr, PALETTE[(i * 7) % PALETTE.length]]));

interface Props {
  data: SavedData;
  update: UpdateData;
  onHome: () => void;
  /** Start straight into a tour of this region (e.g. from the home-screen suggestion). */
  initialTour?: RegionId;
  /** Jump to Find It with this region. */
  onPlay: (region: RegionId) => void;
  /** Open the (US-only) counties view for a state. Optional so older callers/tests keep working. */
  onCounties?: (abbr: string) => void;
}

/** step -1 = region intro (whole map, region shaded); 0..n-1 = each state; n = done. */
interface Tour {
  region: RegionId;
  order: string[];
  step: number;
}

function startTour(region: RegionId): Tour {
  const geo = getMapGeometry();
  return { region, order: tourOrder(getRegion(region).states, (s) => geo.byId.get(s)!.centroid), step: -1 };
}

function introSpeech(region: RegionId): string {
  const r = getRegion(region);
  return `This is the ${r.label}. It's ${REGION_COMPASS[region]}. It has ${r.states.length} states. Let's meet them!`;
}

export function LearnScreen({ data, update, onHome, initialTour, onPlay, onCounties }: Props) {
  const [mode, setMode] = useState<'explore' | 'tour'>(initialTour ? 'tour' : 'explore');
  const [tour, setTour] = useState<Tour | null>(() => (initialTour ? startTour(initialTour) : null));
  const [selected, setSelected] = useState<string | null>(null);
  const [popKey, setPopKey] = useState(0);
  /** Names kept on the map this session (Learn "Keep names" ON). */
  const [kept, setKept] = useState<string[]>([]);
  const keepNames = data.settings.learnKeepNames;
  const explored = useMemo(() => new Set(data.explored), [data.explored]);

  useEffect(() => {
    speak(initialTour ? introSpeech(initialTour) : 'Tap any state to hear its name!');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showState = (abbr: string) => {
    setSelected(abbr);
    setPopKey((k) => k + 1);
    if (keepNames) setKept((list) => keepLabel(list, abbr));
    speak(STATE_BY_ABBR.get(abbr)!.name);
    update((d) => withExplored(d, abbr));
  };

  const toggleKeepNames = () => {
    const on = !keepNames;
    update((d) => withSetting(d, 'learnKeepNames', on));
    setKept(keptAfterToggle(on, selected));
    speak(on ? 'Names will stay on the map.' : 'Names will not stay.');
  };

  // ---- tour navigation ----
  const goToStep = (t: Tour, step: number) => {
    const next = { ...t, step };
    setTour(next);
    setPopKey((k) => k + 1);
    if (step < 0) {
      setSelected(null);
      speak(introSpeech(t.region));
    } else if (step >= t.order.length) {
      setSelected(null);
      speak(`Great job! You toured the ${getRegion(t.region).label}!`);
    } else {
      showState(t.order[step]);
    }
  };

  const beginTour = (region: RegionId) => {
    const t = startTour(region);
    setTour(t);
    goToStep(t, -1);
  };

  const switchMode = (m: 'explore' | 'tour') => {
    setMode(m);
    setTour(null);
    setSelected(null);
    speak(m === 'tour' ? 'Pick a region to tour!' : 'Tap any state to hear its name!');
  };

  const onTap = (abbr: string) => {
    if (mode === 'tour' && tour) {
      const idx = tour.order.indexOf(abbr);
      if (idx >= 0) goToStep(tour, idx);
      return;
    }
    showState(abbr);
  };

  // ---- map appearance ----
  const tourRegion = mode === 'tour' ? tour?.region : undefined;
  const regionStates = tourRegion ? getRegion(tourRegion).states : undefined;
  const regionSet = useMemo(() => (regionStates ? new Set(regionStates) : undefined), [regionStates]);
  const intro = !!tour && tour.step < 0;
  const seenInTour = new Set(tour && tour.step >= 0 ? tour.order.slice(0, tour.step) : []);

  const { regionColors, narration } = data.settings;
  /** "Lit up" color: the state's region color (or a cheerful palette color when region colors are off). */
  const litColor = (id: string) => (regionColors ? regionFill(id) : exploredColor.get(id)!);

  const fillFor = (id: string) => {
    if (id === selected) return COLORS.selected;
    if (tourRegion && regionSet) {
      if (!regionSet.has(id)) return regionColors ? regionFill(id) : COLORS.land;
      if (tour && tour.step >= tour.order.length) return litColor(id);
      if (regionColors) return regionFill(id);
      return seenInTour.has(id) ? litColor(id) : REGION_TINT[tourRegion];
    }
    return explored.has(id) ? litColor(id) : COLORS.land;
  };
  // During a tour with region colors on, fade the other regions so this one stands out.
  const tourDim = useMemo(
    () => (tourRegion && regionColors ? new Set(STATES.filter((s) => s.region !== tourRegion).map((s) => s.abbr)) : undefined),
    [tourRegion, regionColors],
  );

  const info = selected ? STATE_BY_ABBR.get(selected) : undefined;
  const region = tourRegion ? getRegion(tourRegion) : undefined;

  // ---- header text ----
  let header: ReactNode;
  if (mode === 'tour' && !tour) {
    header = <div className="text-3xl font-black text-slate-800 sm:text-4xl">🧭 Pick a region to tour!</div>;
  } else if (tour && region && intro) {
    header = (
      <div key={popKey} className="pop-in">
        <div className="text-4xl font-black text-slate-900 sm:text-5xl">{region.emoji} The {region.label}</div>
        <div className="text-2xl font-bold text-slate-600">
          {REGION_COMPASS[tour.region].replace(/^the /, 'The ')} · {region.states.length} states
        </div>
      </div>
    );
  } else if (tour && region && tour.step >= tour.order.length) {
    header = <div className="pop-in text-4xl font-black text-green-600">🎉 You toured the {region.label}!</div>;
  } else if (info) {
    header = (
      <div key={popKey} className="pop-in">
        <div className="truncate text-4xl font-black text-slate-900 sm:text-5xl">{info.name}</div>
        <div className="text-xl font-bold text-slate-500">
          {getRegion(info.region).emoji} {getRegion(info.region).label}
          {tour && ` · state ${tour.step + 1} of ${tour.order.length}`}
        </div>
      </div>
    );
  } else {
    header = <div className="text-3xl font-black text-slate-800 sm:text-4xl">Tap any state! 👆</div>;
  }

  const sayAgain = () => {
    if (tour && intro) speak(introSpeech(tour.region));
    else if (info) speak(info.name);
  };

  return (
    <main className="flex h-full flex-col">
      <TopBar
        onHome={onHome}
        right={
          <>
            {narration && (info || intro) && (
              <IconButton label="Say it again" onClick={sayAgain}>
                🔊
              </IconButton>
            )}
            <button
              type="button"
              onClick={() => switchMode(mode === 'tour' ? 'explore' : 'tour')}
              className="min-h-16 rounded-3xl bg-white px-4 text-xl font-extrabold text-slate-800 shadow-[0_4px_0_#94a3b8] transition active:translate-y-1"
            >
              {mode === 'tour' ? '🔍 Explore' : '🧭 Region tour'}
            </button>
          </>
        }
      >
        {header}
      </TopBar>

      <div className="min-h-0 flex-1 px-2">
        <USMap
          onTap={onTap}
          fillFor={fillFor}
          whiteBorders={regionColors}
          dim={tourDim}
          // Intro shows the whole country so she sees where the region sits; then zoom in.
          focus={tour && !intro ? regionStates : undefined}
          tappable={tour && !intro ? regionSet : undefined}
          pulse={tour && !intro && selected ? selected : null}
          labels={learnMapLabels(keepNames, kept, selected)}
        />
      </div>

      {regionColors && <RegionLegend className="px-2 pt-1" />}

      {/* Quick "keep names" switch for Learn (also in Settings) */}
      <div className="flex flex-wrap items-center justify-center gap-3 px-3 pt-2">
        <button
          type="button"
          role="switch"
          aria-checked={keepNames}
          onClick={toggleKeepNames}
          className={`min-h-16 rounded-3xl px-5 text-xl font-extrabold transition active:translate-y-1 ${
            keepNames ? 'bg-green-500 text-white shadow-[0_4px_0_#15803d]' : 'bg-white text-slate-700 shadow-[0_4px_0_#94a3b8]'
          }`}
        >
          🏷️ Keep names on the map: {keepNames ? 'ON' : 'OFF'}
        </button>
        {onCounties && info && (
          <button
            type="button"
            onClick={() => onCounties(info.abbr)}
            className="min-h-16 rounded-3xl bg-teal-600 px-5 text-xl font-extrabold text-white shadow-[0_4px_0_#115e59] transition active:translate-y-1"
          >
            🔎 Counties in {info.name}
          </button>
        )}
        {keepNames && kept.some((s) => s !== selected) && (
          <button
            type="button"
            // Clears the built-up names; the state she's on right now keeps its name (like OFF).
            onClick={() => setKept([])}
            className="min-h-16 rounded-3xl bg-white px-5 text-xl font-extrabold text-slate-700 shadow-[0_4px_0_#94a3b8] transition active:translate-y-1"
          >
            🧹 Clear names
          </button>
        )}
      </div>

      {mode === 'explore' && (
        <footer className="px-4 pb-4 pt-1 text-center text-2xl font-extrabold text-slate-700">
          {explored.size === 50 ? '🎉 You explored all 50 states!' : `You've explored ${explored.size} of 50 states ✨`}
        </footer>
      )}

      {mode === 'tour' && !tour && (
        <div className="grid grid-cols-2 gap-3 p-3 landscape:grid-cols-5">
          {REGION_IDS.map((id) => {
            const r = getRegion(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => beginTour(id)}
                className={`min-h-20 rounded-3xl px-3 text-2xl font-black text-white shadow-[0_6px_0_rgba(0,0,0,0.25)] transition active:translate-y-1 ${r.color}`}
              >
                {r.emoji} {r.label}
              </button>
            );
          })}
        </div>
      )}

      {tour && tour.step < tour.order.length && (
        <div className="flex justify-center gap-4 p-3">
          <BigButton variant="secondary" className="min-w-40" disabled={tour.step < 0} onClick={() => goToStep(tour, tour.step - 1)}>
            ◀ Back
          </BigButton>
          <BigButton variant="success" className="min-w-56 text-3xl" onClick={() => goToStep(tour, tour.step + 1)}>
            {intro ? "Let's go ▶" : tour.step === tour.order.length - 1 ? 'Finish ▶' : 'Next ▶'}
          </BigButton>
        </div>
      )}

      {tour && tour.step >= tour.order.length && (
        <div className="flex flex-wrap justify-center gap-4 p-3">
          <BigButton variant="success" className="text-3xl" onClick={() => onPlay(tour.region)}>
            👆 Play Find It here
          </BigButton>
          <BigButton variant="primary" onClick={() => beginTour(REGION_IDS[(REGION_IDS.indexOf(tour.region) + 1) % REGION_IDS.length])}>
            Next region ➜
          </BigButton>
          <BigButton variant="secondary" onClick={() => goToStep(tour, -1)}>
            🔁 Tour again
          </BigButton>
        </div>
      )}
    </main>
  );
}
