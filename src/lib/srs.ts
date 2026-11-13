/**
 * Simple spaced repetition (Leitner-style).
 *
 * Each state has a record. A "correct" answer means correct on the FIRST try.
 * Any miss resets the in-a-row counter. Three correct in a row = mastered.
 *
 * When building a round, states are drawn by weighted random sampling
 * (without replacement). Recently-missed states have the highest weight, so
 * they come up more often; mastered states still appear now and then.
 */
export interface StateRecord {
  /** Correct-on-first-try answers in a row. */
  streak: number;
  correct: number;
  wrong: number;
  /** Correct, but only with a hint. Neither advances nor resets `streak`. */
  assisted?: number;
  /** ms timestamp of last time it was asked in a graded Quiz. */
  lastSeen: number;
  /**
   * Set when she missed it in Practice. Practice never changes mastery, but
   * this flags the state as "needs work" so it comes up more until her next
   * graded answer for it (or a first-try Practice answer) clears it.
   */
  needsWorkAt?: number;
}

export type Mastery = 'new' | 'learning' | 'mastered';

/**
 * - 'correct': right on the first try with no hints → counts toward mastery.
 * - 'wrong': any miss → resets the in-a-row count.
 * - 'assisted': right on the first tap, but a hint was used → doesn't count
 *   toward mastery for this attempt, and doesn't reset progress either.
 */
export type AnswerKind = 'correct' | 'wrong' | 'assisted';

export const MASTERY_STREAK = 3;

export type RecordMap = Record<string, StateRecord | undefined>;

function attempts(rec: StateRecord): number {
  return rec.correct + rec.wrong + (rec.assisted ?? 0);
}

export function masteryOf(rec: StateRecord | undefined): Mastery {
  if (!rec || attempts(rec) === 0) return 'new';
  return rec.streak >= MASTERY_STREAK ? 'mastered' : 'learning';
}

export function recordAnswer(rec: StateRecord | undefined, kind: AnswerKind | boolean, now: number): StateRecord {
  const k: AnswerKind = kind === true ? 'correct' : kind === false ? 'wrong' : kind;
  const base: StateRecord = rec ?? { streak: 0, correct: 0, wrong: 0, lastSeen: 0 };
  switch (k) {
    case 'correct':
      return { ...base, streak: base.streak + 1, correct: base.correct + 1, lastSeen: now };
    case 'wrong':
      return { ...base, streak: 0, wrong: base.wrong + 1, lastSeen: now };
    case 'assisted':
      return { ...base, assisted: (base.assisted ?? 0) + 1, lastSeen: now };
  }
}

/**
 * Practice answers: never touch streak / counts / mastery. A miss marks the
 * state "needs work"; getting it on the first try in Practice clears that.
 */
export function recordPracticeAnswer(rec: StateRecord | undefined, firstTry: boolean, now: number): StateRecord | undefined {
  if (firstTry) {
    if (!rec?.needsWorkAt) return rec;
    const { needsWorkAt: _cleared, ...rest } = rec;
    void _cleared;
    return rest;
  }
  const base: StateRecord = rec ?? { streak: 0, correct: 0, wrong: 0, lastSeen: 0 };
  return { ...base, needsWorkAt: now };
}

export function needsWork(rec: StateRecord | undefined): boolean {
  return !!rec?.needsWorkAt && rec.needsWorkAt > rec.lastSeen;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Relative chance of a state being picked for a round. */
export function weightOf(rec: StateRecord | undefined, now: number): number {
  if (needsWork(rec)) return 8; // missed in Practice since her last graded answer
  if (!rec || attempts(rec) === 0) return 4; // new
  if (rec.streak === 0) return 8; // just missed (or only ever found with help): highest priority
  if (rec.streak === 1) return 4;
  if (rec.streak === 2) return 2;
  // Mastered. A little review bump if it hasn't been seen in a week.
  return now - rec.lastSeen > WEEK_MS ? 2 : 1;
}

export type Rng = () => number;

/**
 * Pick `count` distinct states from `pool`, weighted by spaced repetition.
 * Returns them in the order picked (which is also a sensible play order).
 */
export function pickStates(pool: readonly string[], records: RecordMap, count: number, now: number, rng: Rng = Math.random): string[] {
  const remaining = [...new Set(pool)];
  const picked: string[] = [];
  const n = Math.min(count, remaining.length);
  while (picked.length < n) {
    const weights = remaining.map((s) => weightOf(records[s], now));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    let idx = 0;
    while (idx < remaining.length - 1 && r >= weights[idx]) {
      r -= weights[idx];
      idx++;
    }
    picked.push(remaining[idx]);
    remaining.splice(idx, 1);
  }
  return picked;
}

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
