/**
 * A practice or quiz round of multiplication facts. Pure state machine.
 *
 * 1. The main set: one card each. Only these first answers are scored (quiz)
 *    and recorded for mastery.
 * 2. Then each missed fact comes back ONCE more, in a new order ("retry").
 *    Retries are never scored. A fact missed again just shows its answer.
 * 3. Done: a calm end card. Nothing keeps her stuck in a loop.
 */
import type { Rng } from './srs';
import { retryQueue } from './mathFacts';

export type RoundKind = 'practice' | 'quiz';

export interface CardResult {
  id: string;
  correct: boolean;
  /** What she typed/picked (null for flip cards or when the timer ran out). */
  given: number | null;
}

export interface MathRound {
  kind: RoundKind;
  main: string[];
  retry: string[];
  phase: 'main' | 'retry' | 'done';
  index: number;
  /** 'asking' until answered, then 'right' or 'missed' (shows feedback). */
  status: 'asking' | 'right' | 'missed';
  given: number | null;
  /** First answers to the main set, in order. */
  results: CardResult[];
  /** Answers during the retry pass. */
  retryResults: CardResult[];
}

export function createMathRound(kind: RoundKind, ids: readonly string[]): MathRound {
  return { kind, main: [...ids], retry: [], phase: ids.length ? 'main' : 'done', index: 0, status: 'asking', given: null, results: [], retryResults: [] };
}

export function currentCard(r: MathRound): string | undefined {
  if (r.phase === 'main') return r.main[r.index];
  if (r.phase === 'retry') return r.retry[r.index];
  return undefined;
}

/** Answer the current card (only while asking). */
export function answerCard(r: MathRound, correct: boolean, given: number | null): MathRound {
  const id = currentCard(r);
  if (!id || r.status !== 'asking') return r;
  const res: CardResult = { id, correct, given };
  return {
    ...r,
    status: correct ? 'right' : 'missed',
    given,
    results: r.phase === 'main' ? [...r.results, res] : r.results,
    retryResults: r.phase === 'retry' ? [...r.retryResults, res] : r.retryResults,
  };
}

/** Is this answer the first (scored, mastery-counting) one? */
export function isFirstAnswer(r: MathRound): boolean {
  return r.phase === 'main';
}

/** Move on after feedback. After the main set, misses come back once each. */
export function nextCard(r: MathRound, rng: Rng = Math.random): MathRound {
  if (r.phase === 'done' || r.status === 'asking') return r;
  const base = { ...r, status: 'asking' as const, given: null };
  if (r.phase === 'main') {
    if (r.index + 1 < r.main.length) return { ...base, index: r.index + 1 };
    const retry = retryQueue(missedIds(r), rng);
    return retry.length ? { ...base, phase: 'retry', retry, index: 0 } : { ...base, phase: 'done', index: 0 };
  }
  if (r.index + 1 < r.retry.length) return { ...base, index: r.index + 1 };
  return { ...base, phase: 'done', index: 0 };
}

/** Facts missed on their first try (in order, no repeats). */
export function missedIds(r: MathRound): string[] {
  return [...new Set(r.results.filter((x) => !x.correct).map((x) => x.id))];
}

export interface RoundSummary {
  kind: RoundKind;
  total: number;
  correct: number;
  /** Missed on the first try. */
  missed: string[];
  /** Missed on the first try AND on the retry: good ones to practice next. */
  stillLearning: string[];
}

export function summarizeRound(r: MathRound): RoundSummary {
  const missed = missedIds(r);
  const gotOnRetry = new Set(r.retryResults.filter((x) => x.correct).map((x) => x.id));
  return {
    kind: r.kind,
    total: r.results.length,
    correct: r.results.filter((x) => x.correct).length,
    missed,
    stillLearning: missed.filter((id) => !gotOnRetry.has(id)),
  };
}

/** "Card 4 of 12" (main set) or "Try again 1 of 3" (retry pass). */
export function roundProgress(r: MathRound): { number: number; total: number; retry: boolean } {
  if (r.phase === 'retry') return { number: r.index + 1, total: r.retry.length, retry: true };
  return { number: Math.min(r.index + 1, r.main.length), total: r.main.length, retry: false };
}
