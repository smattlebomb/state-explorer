/**
 * Multiplication mastery and spaced repetition.
 *
 * Uses the same Leitner rules as the geography games (srs.ts), but on the
 * math store's own `facts` records (never the geography records):
 *
 * - Only the FIRST answer to a card counts. Retries never change mastery.
 * - Right on the first answer → streak +1. Any miss (or "Not yet" on a flip
 *   card, or a quiz timer running out) → streak back to 0.
 * - 3 right in a row = mastered.
 * - Practice and Quiz BOTH count (simplest for a 9-year-old: every honest
 *   try helps), with the same rule.
 *
 * Building a set picks facts by weighted random sampling: just-missed facts
 * ×8, unseen ×4, learning ×4/×2, mastered ×1 (×2 if not seen for a week). So
 * practice leans on facts that need work but still mixes in some review.
 */
import { masteryOf, pickStates, recordAnswer, type Mastery, type Rng } from './srs';
import type { FactRecord, QuizLength } from './mathStorage';
import { allFacts, type Fact } from './mathFacts';

export type FactRecords = Record<string, FactRecord | undefined>;

export const MASTERED_IN_A_ROW = 3;
/** Cards in a practice round (fewer if fewer facts are selected). */
export const PRACTICE_ROUND = 12;

export function factMastery(rec: FactRecord | undefined): Mastery {
  return masteryOf(rec);
}

/** Record a first answer for a fact. */
export function recordFact(records: FactRecords, id: string, correct: boolean, now: number): FactRecords {
  return { ...records, [id]: recordAnswer(records[id], correct ? 'correct' : 'wrong', now) };
}

/**
 * The facts for a round: `length` of them (or all for 'all'), favoring facts
 * that need work. No fact repeats unless the pool is smaller than `length`;
 * then the pool is used again (never the same fact twice in a row).
 */
export function buildFactSet(pool: readonly string[], records: FactRecords, length: number | 'all', now: number, rng: Rng = Math.random): string[] {
  const unique = [...new Set(pool)];
  if (unique.length === 0) return [];
  if (length === 'all') return pickStates(unique, records, unique.length, now, rng);
  const out = pickStates(unique, records, Math.min(length, unique.length), now, rng);
  while (out.length < length) {
    const more = pickStates(unique, records, Math.min(length - out.length, unique.length), now, rng);
    // Don't put the same fact back to back across the seam.
    if (more.length > 1 && more[0] === out[out.length - 1]) [more[0], more[1]] = [more[1], more[0]];
    out.push(...more);
  }
  return out;
}

export function quizSet(pool: readonly string[], records: FactRecords, length: QuizLength, now: number, rng: Rng = Math.random): string[] {
  return buildFactSet(pool, records, length, now, rng);
}

/** Up to 12 cards; a small selection (say, 2 facts) is just practiced once each, no padding. */
export function practiceSet(pool: readonly string[], records: FactRecords, now: number, rng: Rng = Math.random): string[] {
  return buildFactSet(pool, records, Math.min(PRACTICE_ROUND, new Set(pool).size), now, rng);
}

export interface GridCell extends Fact {
  product: number;
  mastery: Mastery;
}

export interface FactGrid {
  /** Factors shown on each side: 1–12, or 0–12 with zeros. */
  factors: number[];
  /** rows[i][j] = factors[i] × factors[j] */
  rows: GridCell[][];
  counts: Record<Mastery, number> & { total: number };
}

/** The My Facts grid. */
export function factGrid(records: FactRecords, includeZero = false): FactGrid {
  const facts = allFacts(includeZero);
  const factors = [...new Set(facts.map((f) => f.a))];
  const counts = { new: 0, learning: 0, mastered: 0, total: facts.length };
  const rows = factors.map((a) =>
    factors.map((b) => {
      const f = facts.find((x) => x.a === a && x.b === b)!;
      const mastery = factMastery(records[f.id]);
      counts[mastery]++;
      return { ...f, product: a * b, mastery };
    }),
  );
  return { factors, rows, counts };
}

/** Mastered count among a set of fact ids (e.g. the facts in play). */
export function masteredCount(records: FactRecords, ids: readonly string[]): number {
  return ids.filter((id) => factMastery(records[id]) === 'mastered').length;
}

