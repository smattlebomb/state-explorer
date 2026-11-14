import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Settings } from '../lib/storage';
import type { AnyLayer } from '../lib/layerProgress';
import { layerConfig, scopeOf } from '../lib/layers';
import { TERRITORY_BY_ID } from '../data/world';
import { LayerMap, capitalMark, useLayerGeo } from '../components/LayerMap';
import { MapLoading } from '../components/MapLoading';
import { Mascot } from '../components/Mascot';
import { IconButton, TopBar } from '../components/ui';
import { speak } from '../lib/speech';

interface Props {
  layer: AnyLayer;
  settings: Settings;
  onHome: () => void;
}

/**
 * Capitals Learn (USA, Canada or World): tap a place to see and hear its
 * capital, with a capital dot on the map and a note for unusual cases
 * (South Africa's three capitals, Bolivia's Sucre and La Paz…). It is its own
 * screen, so studying capitals never mixes with learning the places.
 */
export function CapitalsLearnScreen({ layer, settings, onHome }: Props) {
  const cfg = layerConfig(layer);
  const { lg, failed } = useLayerGeo(layer);
  const [scopeId, setScopeId] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [popKey, setPopKey] = useState(0);
  const { regionColors, narration } = settings;
  const scope = scopeOf(cfg, scopeId);

  useEffect(() => speak(`Tap a ${cfg.itemWord} to see its capital!`), [cfg]);

  const sayIt = (id: string) => {
    const cap = cfg.capitalOf(id);
    speak(cap ? `The capital of ${cfg.nameOf(id)} is ${cap}.` : cfg.nameOf(id));
  };

  const select = (id: string) => {
    setSelected(id);
    setPopKey((k) => k + 1);
    sayIt(id);
  };

  // Scope chips: World → continents; USA → regions; Canada has just one.
  const scopeChips = useMemo(() => cfg.scopes.filter((s) => s.id === 'all' || s.id.startsWith('c:') || s.id.startsWith('r:')), [cfg]);
  // Place chips (handy for tiny places like Vatican City or PEI), except for all 195 countries at once.
  const placeChips = layer === 'world' && scope.id === 'all' ? [] : [...scope.ids].sort((a, b) => cfg.nameOf(a).localeCompare(cfg.nameOf(b)));

  const capital = selected ? cfg.capitalOf(selected) : '';
  const note = selected ? (cfg.capitalNote(selected) ?? (TERRITORY_BY_ID.has(selected) ? TERRITORY_BY_ID.get(selected)!.note : undefined)) : undefined;

  let header: ReactNode;
  if (selected && capital) {
    header = (
      <div key={popKey} className="pop-in">
        <div className="truncate text-4xl font-black text-slate-900 sm:text-5xl">🏛️ {capital}</div>
        <div className="text-xl font-bold text-slate-500">Capital of {cfg.nameOf(selected)}</div>
      </div>
    );
  } else if (selected) {
    header = (
      <div key={popKey} className="pop-in">
        <div className="truncate text-4xl font-black text-slate-900 sm:text-5xl">{cfg.nameOf(selected)}</div>
        <div className="text-xl font-bold text-slate-500">No capital to learn here</div>
      </div>
    );
  } else {
    header = (
      <div className="flex items-center justify-center gap-3 text-3xl font-black text-slate-800 sm:text-4xl">
        <Mascot mood="idle" size={56} /> 🏛️ Tap a {cfg.itemWord} to see its capital!
      </div>
    );
  }

  return (
    <main className="flex h-full flex-col">
      <TopBar
        onHome={onHome}
        right={
          narration && selected ? (
            <IconButton label="Say it again" onClick={() => sayIt(selected)}>
              🔊
            </IconButton>
          ) : undefined
        }
      >
        {header}
      </TopBar>

      <div className="min-h-0 flex-1 px-2">
        {lg ? (
          <LayerMap
            lg={lg}
            scopeId={scope.id}
            regionColors={regionColors}
            selected={selected}
            onTap={select}
            // The header already names the place; the map shows the capital dot and name instead.
            labelSelected={false}
            capital={selected ? capitalMark(lg, cfg, selected) : null}
          />
        ) : (
          <MapLoading text={failed ? "Oops, the map didn't load. Go back and try again!" : undefined} />
        )}
      </div>

      {note && <p className="px-4 pt-1 text-center text-xl font-bold text-slate-600">💡 {note}</p>}

      {scopeChips.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-3 pt-2" aria-label="Zoom to">
          {scopeChips.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === scope.id}
              onClick={() => {
                setScopeId(s.id);
                setSelected(null);
              }}
              style={s.id === scope.id ? { background: s.color } : { borderColor: s.color, color: s.color }}
              className={`min-h-16 shrink-0 rounded-3xl border-4 px-4 text-xl font-black transition active:translate-y-1 ${s.id === scope.id ? 'border-transparent text-white' : 'bg-white'}`}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>
      )}

      {placeChips.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-3 pt-2" aria-label="Places">
          {placeChips.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => select(id)}
              className={`min-h-16 shrink-0 rounded-3xl px-4 text-xl font-extrabold transition active:translate-y-1 ${
                id === selected ? 'bg-orange-400 text-white shadow-[0_4px_0_#c2410c]' : 'bg-white text-slate-800 shadow-[0_4px_0_#94a3b8]'
              }`}
            >
              {cfg.nameOf(id)}
            </button>
          ))}
        </div>
      )}
      <div className="h-3" />
    </main>
  );
}
