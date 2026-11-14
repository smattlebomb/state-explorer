import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SavedData } from '../lib/storage';
import { loadWorldTopology } from '../data/worldGeo';
import {
  CONTINENTS,
  CONTINENT_BY_ID,
  COUNTRY_BY_ID,
  SUBREGION_BY_ID,
  TERRITORY_BY_ID,
  countriesInContinent,
  countriesInSubregion,
  type ContinentId,
  type SubregionId,
} from '../data/world';
import {
  CONTINENT_PALETTE,
  buildWorldGeometry,
  drillContinent,
  inLevel,
  parentLevel,
  subregionsOf,
  type WorldGeometry,
  type WorldLevel,
} from '../lib/worldMap';
import { WorldMap } from '../components/WorldMap';
import { Mascot } from '../components/Mascot';
import { MapLoading } from '../components/MapLoading';
import { BigButton, IconButton, TopBar } from '../components/ui';
import { speak } from '../lib/speech';

export interface WorldStart {
  level: WorldLevel;
  selected?: string | null;
}

interface Props {
  data: SavedData;
  onHome: () => void;
  /** Open the Canada provinces/territories map. */
  onOpenCanada: () => void;
  /** Open the existing USA Learn map (50 states). */
  onOpenUSA: () => void;
  /** Where to start (e.g. back from the Canada map → Northern America with Canada picked). */
  start?: WorldStart;
  /** Record a country she tapped (World progress store). */
  onExplore?: (id: string) => void;
}

function continentOfSub(id: SubregionId): ContinentId {
  return SUBREGION_BY_ID.get(id)!.continent;
}

export function WorldScreen({ data, onHome, onOpenCanada, onOpenUSA, start, onExplore }: Props) {
  const [geo, setGeo] = useState<WorldGeometry | null>(null);
  const [failed, setFailed] = useState(false);
  const [level, setLevel] = useState<WorldLevel>(start?.level ?? { kind: 'world' });
  const [selected, setSelected] = useState<string | null>(start?.selected ?? null);
  const [popKey, setPopKey] = useState(0);
  const { regionColors, narration } = data.settings;

  useEffect(() => {
    let alive = true;
    loadWorldTopology()
      .then((t) => alive && setGeo(buildWorldGeometry(t)))
      .catch(() => alive && setFailed(true));
    speak('Tap a continent to zoom in!');
    return () => {
      alive = false;
    };
  }, []);

  const goTo = (next: WorldLevel, say?: string) => {
    setLevel(next);
    setSelected(null);
    setPopKey((k) => k + 1);
    if (say) speak(say);
  };

  const openContinent = (c: ContinentId) => {
    if (c === 'antarctica') {
      setSelected('AQ');
      setPopKey((k) => k + 1);
      speak('Antarctica');
      return;
    }
    const next = drillContinent(c);
    goTo(next, next.kind === 'subregion' ? SUBREGION_BY_ID.get(next.subregion)!.name : CONTINENT_BY_ID.get(c)!.name);
  };

  const openSubregion = (id: SubregionId) => goTo({ kind: 'subregion', subregion: id }, SUBREGION_BY_ID.get(id)!.name);

  const select = (id: string) => {
    setSelected(id);
    setPopKey((k) => k + 1);
    speak(COUNTRY_BY_ID.get(id)?.name ?? TERRITORY_BY_ID.get(id)?.name ?? id);
    if (COUNTRY_BY_ID.has(id)) onExplore?.(id);
  };

  const onTapPlace = (id: string) => {
    const s = geo?.byId.get(id);
    if (!s) return;
    if (level.kind === 'world') openContinent(s.continent);
    else if (level.kind === 'continent') openSubregion(s.subregion);
    else if (inLevel(s, level)) select(id);
  };

  const up = () => goTo(parentLevel(level));

  // ---- header ----
  const country = selected ? COUNTRY_BY_ID.get(selected) : undefined;
  const territory = selected ? TERRITORY_BY_ID.get(selected) : undefined;
  let header: ReactNode;
  if (country || territory) {
    const name = country?.name ?? territory!.name;
    const sub = country
      ? `Capital: ${country.capital}${country.aka?.length ? ` · also called ${country.aka[0]}` : ''}`
      : territory!.capital
        ? `Capital: ${territory!.capital}`
        : territory!.status === 'continent'
          ? 'A continent with no countries'
          : 'Not one of the 195 countries';
    header = (
      <div key={popKey} className="pop-in">
        <div className="truncate text-4xl font-black text-slate-900 sm:text-5xl">{name}</div>
        <div className="text-xl font-bold text-slate-500">{sub}</div>
      </div>
    );
  } else if (level.kind === 'world') {
    header = (
      <div className="flex items-center justify-center gap-3 text-3xl font-black text-slate-800 sm:text-4xl">
        <Mascot mood="idle" size={56} /> 🌍 Tap a continent!
      </div>
    );
  } else if (level.kind === 'continent') {
    const c = CONTINENT_BY_ID.get(level.continent)!;
    header = (
      <div key={popKey} className="pop-in">
        <div className="text-4xl font-black text-slate-900 sm:text-5xl">
          {c.emoji} {c.name}
        </div>
        <div className="text-xl font-bold text-slate-500">
          {countriesInContinent(c.id).length} countries · tap a part of {c.name} to zoom in
        </div>
      </div>
    );
  } else {
    const s = SUBREGION_BY_ID.get(level.subregion)!;
    const c = CONTINENT_BY_ID.get(s.continent)!;
    header = (
      <div key={popKey} className="pop-in">
        <div className="text-4xl font-black text-slate-900 sm:text-5xl">{s.name}</div>
        <div className="text-xl font-bold text-slate-500">
          {c.emoji} {c.name} · {countriesInSubregion(s.id).length} countries · tap one!
        </div>
      </div>
    );
  }

  const sayAgain = () => {
    if (country) speak(`${country.name}. The capital is ${country.capital}.`);
    else if (territory) speak(`${territory.name}. ${territory.note}`);
  };

  // ---- bottom panel ----
  const placesHere = useMemo(() => {
    if (!geo || level.kind !== 'subregion') return [];
    return geo.shapes
      .filter((s) => s.subregion === level.subregion)
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'country' ? -1 : 1));
  }, [geo, level]);

  let panel: ReactNode = null;
  if (level.kind === 'world') {
    panel = (
      <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4 landscape:grid-cols-7">
        {CONTINENTS.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-label={`Explore ${c.name}`}
            onClick={() => openContinent(c.id)}
            style={{ background: CONTINENT_PALETTE[c.id].solid }}
            className="flex min-h-20 flex-col items-center justify-center rounded-3xl px-2 py-1 text-white shadow-[0_5px_0_rgba(0,0,0,0.25)] transition active:translate-y-1 active:shadow-none"
          >
            <span className="text-2xl font-black leading-tight">
              {c.emoji} {c.name}
            </span>
            <span className="text-base font-bold opacity-95">{c.id === 'antarctica' ? 'no countries' : `${countriesInContinent(c.id).length} countries`}</span>
          </button>
        ))}
      </div>
    );
  } else if (level.kind === 'continent') {
    const solid = CONTINENT_PALETTE[level.continent].solid;
    panel = (
      <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 landscape:grid-cols-5">
        {subregionsOf(level.continent).map((id) => (
          <button
            key={id}
            type="button"
            aria-label={`Explore ${SUBREGION_BY_ID.get(id)!.name}`}
            onClick={() => openSubregion(id)}
            style={{ background: solid }}
            className="flex min-h-20 flex-col items-center justify-center rounded-3xl px-2 py-1 text-white shadow-[0_5px_0_rgba(0,0,0,0.25)] transition active:translate-y-1 active:shadow-none"
          >
            <span className="text-2xl font-black leading-tight">{SUBREGION_BY_ID.get(id)!.name}</span>
            <span className="text-base font-bold opacity-95">{countriesInSubregion(id).length} countries</span>
          </button>
        ))}
      </div>
    );
  } else {
    const solid = CONTINENT_PALETTE[continentOfSub(level.subregion)].solid;
    panel = (
      <div className="flex flex-col gap-2 p-3">
        {selected === 'CA' && (
          <BigButton variant="success" className="mx-auto text-3xl" onClick={onOpenCanada}>
            🇨🇦 Explore Canada's provinces ➜
          </BigButton>
        )}
        {selected === 'US' && (
          <BigButton variant="success" className="mx-auto text-3xl" onClick={onOpenUSA}>
            🇺🇸 Explore the 50 states ➜
          </BigButton>
        )}
        {territory && territory.status !== 'continent' && (
          <p className="text-center text-xl font-bold text-slate-600">{territory.note}</p>
        )}
        {/* Every place here as a button too: handy for the tiniest islands. */}
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Places here">
          {placesHere.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => select(s.id)}
              style={s.id === selected ? undefined : { borderColor: solid }}
              className={`min-h-16 shrink-0 rounded-3xl border-4 px-4 text-xl font-extrabold transition active:translate-y-1 ${
                s.id === selected ? 'border-orange-500 bg-orange-400 text-white' : s.kind === 'country' ? 'bg-white text-slate-800' : 'border-dashed bg-white/80 text-slate-600'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (level.kind === 'world' && selected === 'AQ') {
    panel = (
      <>
        <p className="px-4 pt-2 text-center text-xl font-bold text-slate-600">🐧 {TERRITORY_BY_ID.get('AQ')!.note}</p>
        {panel}
      </>
    );
  }

  return (
    <main className="flex h-full flex-col">
      <TopBar
        onHome={onHome}
        right={
          <>
            {narration && (country || territory) && (
              <IconButton label="Say it again" onClick={sayAgain}>
                🔊
              </IconButton>
            )}
            {level.kind !== 'world' && (
              <button
                type="button"
                aria-label="Back up a level"
                onClick={up}
                className="min-h-16 rounded-3xl bg-white px-5 text-xl font-extrabold text-slate-800 shadow-[0_4px_0_#94a3b8] transition active:translate-y-1"
              >
                ⬆ Back
              </button>
            )}
          </>
        }
      >
        {header}
      </TopBar>

      <div className="min-h-0 flex-1 px-2">
        {geo ? (
          <WorldMap geo={geo} level={level} selected={selected} regionColors={regionColors} onTapPlace={onTapPlace} />
        ) : failed ? (
          <MapLoading text="Oops, the map didn't load. Go back and try again!" />
        ) : (
          <MapLoading />
        )}
      </div>

      {panel}
    </main>
  );
}

export default WorldScreen;
