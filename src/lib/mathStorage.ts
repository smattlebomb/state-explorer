/**
 * Math (multiplication) progress and settings, plus the last chosen subject.
 *
 * Everything lives in ONE new localStorage key, `state-explorer:math-mult:v1`.
 * Nothing here reads or writes the geography saves (`state-explorer:v1` and
 * the world/canada/capitals keys), so math can never disturb geography
 * progress, and vice versa.
 *
 * Parsing is defensive: missing or malformed fields fall back to defaults, so
 * an older or partial save always loads.
 */
import type { StateRecord } from './srs';

export const MATH_STORAGE_KEY = 'state-explorer:math-mult:v1';

export type Subject = 'geography' | 'math';
export type PracticeMode = 'flip' | 'keypad';
export type QuizLength = 10 | 20 | 'all';
export type QuizAnswerMode = 'keypad' | 'choices';
/** Same shape as a geography mastery record (Leitner streak), but kept in the math store. */
export type FactRecord = StateRecord;

export interface BestQuiz {
  correct: number;
  total: number;
}

export interface MathData {
  version: 1;
  /** Last chosen Home subject. */
  subject: Subject;
  /** Add the 0 facts (0×0 … 12×0, 0×12). Off by default. */
  includeZero: boolean;
  /** Selected times tables (1–12). Empty (or all 12) means All. */
  tables: number[];
  practiceMode: PracticeMode;
  quizLength: QuizLength;
  quizAnswerMode: QuizAnswerMode;
  /** A gentle 25-second cue in quizzes. Off by default. */
  relaxedTimer: boolean;
  /** Best quiz per `${length}|${answerMode}` (see bestQuizKey). */
  bestQuizzes: Record<string, BestQuiz | null>;
  /** Mastery per fact id ("3x4"). */
  facts: Record<string, FactRecord | undefined>;
}

export function emptyMathData(): MathData {
  return {
    version: 1,
    subject: 'geography',
    includeZero: false,
    tables: [],
    practiceMode: 'keypad',
    quizLength: 10,
    quizAnswerMode: 'keypad',
    relaxedTimer: false,
    bestQuizzes: {},
    facts: {},
  };
}

export function bestQuizKey(length: QuizLength, mode: QuizAnswerMode): string {
  return `${length}|${mode}`;
}

const isFactId = (k: string) => /^\d{1,2}x\d{1,2}$/.test(k);

function parseRecord(v: unknown): FactRecord | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const r = v as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
  const rec: FactRecord = { streak: num(r.streak), correct: num(r.correct), wrong: num(r.wrong), lastSeen: num(r.lastSeen) };
  if (typeof r.assisted === 'number') rec.assisted = num(r.assisted);
  if (typeof r.needsWorkAt === 'number') rec.needsWorkAt = num(r.needsWorkAt);
  return rec;
}

/** Parse saved JSON defensively; anything missing or wrong falls back to defaults. */
export function parseMathData(raw: string | null): MathData {
  const base = emptyMathData();
  if (!raw) return base;
  let d: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return base;
    d = parsed as Record<string, unknown>;
  } catch {
    return base;
  }
  const tables = Array.isArray(d.tables)
    ? [...new Set(d.tables.filter((t): t is number => typeof t === 'number' && Number.isInteger(t) && t >= 1 && t <= 12))].sort((a, b) => a - b)
    : base.tables;
  const bestQuizzes: Record<string, BestQuiz | null> = {};
  if (d.bestQuizzes && typeof d.bestQuizzes === 'object') {
    for (const [k, v] of Object.entries(d.bestQuizzes as Record<string, unknown>)) {
      const b = v as Partial<BestQuiz> | null;
      if (b && typeof b.correct === 'number' && typeof b.total === 'number' && b.total > 0 && b.correct >= 0 && b.correct <= b.total) bestQuizzes[k] = { correct: b.correct, total: b.total };
    }
  }
  const facts: Record<string, FactRecord> = {};
  if (d.facts && typeof d.facts === 'object') {
    for (const [k, v] of Object.entries(d.facts as Record<string, unknown>)) {
      const rec = isFactId(k) ? parseRecord(v) : undefined;
      if (rec) facts[k] = rec;
    }
  }
  return {
    version: 1,
    subject: d.subject === 'math' ? 'math' : 'geography',
    includeZero: d.includeZero === true,
    tables,
    practiceMode: d.practiceMode === 'flip' ? 'flip' : 'keypad',
    quizLength: d.quizLength === 20 || d.quizLength === 'all' ? d.quizLength : 10,
    quizAnswerMode: d.quizAnswerMode === 'choices' ? 'choices' : 'keypad',
    relaxedTimer: d.relaxedTimer === true,
    bestQuizzes,
    facts,
  };
}

export function loadMathData(): MathData {
  try {
    return parseMathData(localStorage.getItem(MATH_STORAGE_KEY));
  } catch {
    return emptyMathData();
  }
}

export function saveMathData(d: MathData): void {
  try {
    localStorage.setItem(MATH_STORAGE_KEY, JSON.stringify(d));
  } catch {
    // Private mode / storage full: still usable, just not remembered.
  }
}

// --- pure updaters --------------------------------------------------------

export function mathWith<K extends Exclude<keyof MathData, 'version' | 'facts' | 'bestQuizzes'>>(d: MathData, key: K, value: MathData[K]): MathData {
  return d[key] === value ? d : { ...d, [key]: value };
}

/** Save a finished quiz if it beats the best for that length + answer mode. */
export function mathWithQuizScore(d: MathData, length: QuizLength, mode: QuizAnswerMode, correct: number, total: number): MathData {
  if (total <= 0) return d;
  const key = bestQuizKey(length, mode);
  const prev = d.bestQuizzes[key];
  // Higher score wins; for "All" (different totals), compare the share right.
  if (prev && prev.correct / prev.total >= correct / total) return d;
  return { ...d, bestQuizzes: { ...d.bestQuizzes, [key]: { correct, total } } };
}

/** Erase multiplication progress (mastery + best quizzes), keep settings and the subject. */
export function mathWithReset(d: MathData): MathData {
  return { ...d, facts: {}, bestQuizzes: {} };
}
