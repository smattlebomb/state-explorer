/**
 * Progress for the World and Canada game layers, stored separately from the
 * US save. Each layer has its own localStorage key; nothing here reads or
 * writes the US key (`state-explorer:v1`), so a reset of one never touches
 * the others.
 *
 * Shared settings (narration, sound, region colors, keep names) still come
 * from the US save's settings, read-only. The one setting a layer needs to
 * remember for itself, the last Quiz/Practice choice, lives here.
 *
 * Kept free of map/catalog imports so it can live in the main bundle.
 */
import { recordAnswer, recordPracticeAnswer, type AnswerKind, type RecordMap } from './srs';
import { EMPTY_STREAK, recordPractice, type StreakState } from './streak';
import type { QuizMode } from './quiz';
import type { BestTestScore } from './storage';

export type GameLayer = 'world' | 'canada';

export const LAYER_STORAGE_KEYS: Record<GameLayer, string> = {
  world: 'state-explorer:world:v1',
  canada: 'state-explorer:canada:v1',
};

export interface LayerProgress {
  version: 1;
  /** Per item (country id / province abbr): mastery records, same rules as the US states. */
  records: RecordMap;
  /** Items tapped in Learn. */
  explored: string[];
  streak: StreakState;
  totalStars: number;
  roundsPlayed: number;
  /** Best completed test, keyed by `${scope}|${mode}` (e.g. "c:europe|find"). */
  bestTests: Record<string, BestTestScore>;
  /** Last Quiz/Practice choice on this layer's setup screen. */
  practice: boolean;
}

export function emptyLayerProgress(): LayerProgress {
  return { version: 1, records: {}, explored: [], streak: { ...EMPTY_STREAK }, totalStars: 0, roundsPlayed: 0, bestTests: {}, practice: false };
}

export function testKey(scope: string, mode: QuizMode): string {
  return `${scope}|${mode}`;
}

/** Parse defensively: anything missing or malformed falls back to defaults. */
export function parseLayerProgress(raw: string | null): LayerProgress {
  const base = emptyLayerProgress();
  if (!raw) return base;
  try {
    const d = JSON.parse(raw) as Partial<LayerProgress> | null;
    if (!d || typeof d !== 'object') return base;
    const bestTests: Record<string, BestTestScore> = {};
    if (d.bestTests && typeof d.bestTests === 'object') {
      for (const [k, v] of Object.entries(d.bestTests)) {
        if (v && typeof v.correct === 'number' && typeof v.total === 'number' && v.total > 0 && v.correct >= 0) bestTests[k] = { correct: v.correct, total: v.total };
      }
    }
    return {
      version: 1,
      records: d.records && typeof d.records === 'object' ? d.records : base.records,
      explored: Array.isArray(d.explored) ? d.explored.filter((s): s is string => typeof s === 'string') : base.explored,
      streak: d.streak && typeof d.streak === 'object' ? { ...base.streak, ...d.streak } : base.streak,
      totalStars: typeof d.totalStars === 'number' ? d.totalStars : 0,
      roundsPlayed: typeof d.roundsPlayed === 'number' ? d.roundsPlayed : 0,
      bestTests,
      practice: d.practice === true,
    };
  } catch {
    return base;
  }
}

export function loadLayerProgress(layer: GameLayer): LayerProgress {
  try {
    return parseLayerProgress(localStorage.getItem(LAYER_STORAGE_KEYS[layer]));
  } catch {
    return emptyLayerProgress();
  }
}

export function saveLayerProgress(layer: GameLayer, p: LayerProgress): void {
  try {
    localStorage.setItem(LAYER_STORAGE_KEYS[layer], JSON.stringify(p));
  } catch {
    // Private mode / storage full: still playable, just not remembered.
  }
}

// --- pure updaters (same rules as the US ones in storage.ts) ---------------

export function layerWithAnswer(p: LayerProgress, id: string, kind: AnswerKind, now: number): LayerProgress {
  return { ...p, records: { ...p.records, [id]: recordAnswer(p.records[id], kind, now) } };
}

export function layerWithPracticeAnswer(p: LayerProgress, id: string, firstTry: boolean, now: number): LayerProgress {
  const rec = recordPracticeAnswer(p.records[id], firstTry, now);
  return rec === p.records[id] ? p : { ...p, records: { ...p.records, [id]: rec } };
}

export function layerWithRoundFinished(p: LayerProgress, stars: number, today: string): LayerProgress {
  return { ...p, totalStars: p.totalStars + stars, roundsPlayed: p.roundsPlayed + 1, streak: recordPractice(p.streak, today) };
}

export function layerWithExplored(p: LayerProgress, id: string): LayerProgress {
  return p.explored.includes(id) ? p : { ...p, explored: [...p.explored, id] };
}

export function layerWithPractice(p: LayerProgress, practice: boolean): LayerProgress {
  return p.practice === practice ? p : { ...p, practice };
}

/** Save a completed test (every item in the scope answered) if it beats the best for that scope + mode. */
export function layerWithTestScore(p: LayerProgress, scope: string, scopeSize: number, mode: QuizMode, correct: number, total: number): LayerProgress {
  if (total !== scopeSize) return p;
  const key = testKey(scope, mode);
  const prev = p.bestTests[key];
  if (prev && prev.correct >= correct) return p;
  return { ...p, bestTests: { ...p.bestTests, [key]: { correct, total } } };
}

/** Reset this layer's learning progress (keeps the Quiz/Practice choice). */
export function layerWithReset(p: LayerProgress): LayerProgress {
  return { ...emptyLayerProgress(), practice: p.practice };
}
