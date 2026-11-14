import { recordAnswer, recordPracticeAnswer, type AnswerKind, type RecordMap } from './srs';
import { EMPTY_STREAK, recordPractice, type StreakState } from './streak';

export interface Settings {
  /** Spoken narration (Web Speech API). Off by default, including for existing saves. */
  narration: boolean;
  /** Short Web Audio sound effects (ding / boop / fanfare). */
  sound: boolean;
  /** Color every state by its region. Off = plain blank map (harder). */
  regionColors: boolean;
  /** Keep correctly answered states labeled for the rest of the round (Find It / Name It). */
  keepNames: boolean;
  /** Learn mode: every state she taps keeps its name label (off = only the last-tapped name shows). */
  learnKeepNames: boolean;
  /** Last flavor picked on the setup screen. */
  practice: boolean;
}

export const DEFAULT_SETTINGS: Settings = { narration: false, sound: true, regionColors: true, keepNames: true, learnKeepNames: false, practice: false };

export interface SavedData {
  version: 1;
  records: RecordMap;
  /** States tapped in Learn mode. */
  explored: string[];
  streak: StreakState;
  totalStars: number;
  roundsPlayed: number;
  settings: Settings;
}

export const STORAGE_KEY = 'state-explorer:v1';

export function emptyData(): SavedData {
  return {
    version: 1,
    records: {},
    explored: [],
    streak: { ...EMPTY_STREAK },
    totalStars: 0,
    roundsPlayed: 0,
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Known boolean settings only; missing ones (e.g. from an older save) get defaults.
 *  The old `speech` key is ignored: narration always starts off unless this save
 *  already has a `narration` value (so an older "on" does not carry over). */
function parseSettings(raw: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS };
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === 'boolean') s[key] = v;
    }
  }
  return s;
}

/** Parse saved JSON defensively: anything missing or malformed falls back to defaults. */
export function parseData(raw: string | null): SavedData {
  const base = emptyData();
  if (!raw) return base;
  try {
    const d = JSON.parse(raw) as Partial<SavedData>;
    if (!d || typeof d !== 'object') return base;
    return {
      version: 1,
      records: d.records && typeof d.records === 'object' ? d.records : base.records,
      explored: Array.isArray(d.explored) ? d.explored.filter((s) => typeof s === 'string') : base.explored,
      streak: d.streak && typeof d.streak === 'object' ? { ...base.streak, ...d.streak } : base.streak,
      totalStars: typeof d.totalStars === 'number' ? d.totalStars : 0,
      roundsPlayed: typeof d.roundsPlayed === 'number' ? d.roundsPlayed : 0,
      settings: parseSettings(d.settings),
    };
  } catch {
    return base;
  }
}

export function loadData(): SavedData {
  try {
    return parseData(localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyData();
  }
}

export function saveData(data: SavedData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Private mode / storage full: the app still works, it just won't remember.
  }
}

// --- pure updaters -------------------------------------------------------

export function withAnswer(data: SavedData, state: string, kind: AnswerKind | boolean, now: number): SavedData {
  return { ...data, records: { ...data.records, [state]: recordAnswer(data.records[state], kind, now) } };
}

/** Practice answer: never changes mastery, stars or streak; a miss flags "needs work". */
export function withPracticeAnswer(data: SavedData, state: string, firstTry: boolean, now: number): SavedData {
  const rec = recordPracticeAnswer(data.records[state], firstTry, now);
  if (rec === data.records[state]) return data;
  return { ...data, records: { ...data.records, [state]: rec } };
}

export function withSetting<K extends keyof Settings>(data: SavedData, key: K, value: Settings[K]): SavedData {
  return { ...data, settings: { ...data.settings, [key]: value } };
}

export function withExplored(data: SavedData, state: string): SavedData {
  return data.explored.includes(state) ? data : { ...data, explored: [...data.explored, state] };
}

export function withRoundFinished(data: SavedData, stars: number, today: string): SavedData {
  return {
    ...data,
    totalStars: data.totalStars + stars,
    roundsPlayed: data.roundsPlayed + 1,
    streak: recordPractice(data.streak, today),
  };
}

/** Reset learning progress but keep settings (like the narration toggle). */
export function withReset(data: SavedData): SavedData {
  return { ...emptyData(), settings: data.settings };
}
