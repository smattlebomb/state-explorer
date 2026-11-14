/**
 * Quiz engine: pure functions, no React. Used by Find It and Name It.
 *
 * Three flavors:
 * - Quiz (graded): Find It gives up to 3 tries per state, then reveals the
 *   answer; Name It gives 1 pick from 4 names. Stars, streak and mastery count.
 * - Practice (`practice: true`): unlimited tries, plus a "Show me" reveal
 *   whenever she wants it. No score (the UI shows no stars or grade), and
 *   answers never count toward mastery.
 * - Test (`test: true`): all 50 states in random order, one try each, no hints
 *   or retries. First tap/choice is final. No in-round right/wrong feedback.
 *   Answers do not count toward mastery, stars or streak.
 *
 * Also:
 * - Find It hints (shape, then region) are free, but a graded round that used
 *   any hint earns at most 2 stars, and a hinted answer is recorded as
 *   'assisted', which doesn't count toward mastery.
 * - A state that ends up revealed (missed) is asked once more at the end of
 *   the round as a "retry". Retries don't change the score or mastery.
 * - `combo` counts first-try, no-hint answers in a row (for the combo badge).
 */
import { ALL_ABBRS } from '../data/states';
import { masteryOf, pickStates, recordAnswer, shuffle, type AnswerKind, type RecordMap, type Rng } from './srs';

export type QuizMode = 'find' | 'name';

export interface Question {
  state: string;
  /** Four answer choices (Name It only; empty for Find It). */
  options: string[];
  retry: boolean;
}

export interface QuestionResult {
  state: string;
  triesUsed: number;
  /** Correct on the first try (hints allowed). */
  firstTry: boolean;
  /** Number of hints taken for this question (Find It only). */
  hintsUsed: number;
  /** How this answer updates mastery: hinted answers don't count toward it. */
  mastery: AnswerKind;
  /** 0..1 */
  score: number;
  /** The state she picked (empty if the answer was revealed without a pick). */
  picked: string;
}

export type QuestionStatus = 'asking' | 'correct' | 'revealed';

export interface Round {
  mode: QuizMode;
  /** Practice: unlimited tries, no score, no mastery. */
  practice: boolean;
  /** Test: one try each, all 50, no hints/retries/feedback, no mastery. */
  test: boolean;
  /** Infinity in Practice. */
  maxTries: number;
  questions: Question[];
  index: number;
  triesUsed: number;
  /** Hints taken for the current question (0..MAX_HINTS). */
  hintsUsed: number;
  /** Wrong picks for the current question. */
  wrongPicks: string[];
  status: QuestionStatus;
  finished: boolean;
  /** One entry per non-retry question, in the order answered. */
  results: QuestionResult[];
  /** Pool of states used for distractors. */
  optionPool: string[];
  /** First-try, no-hint correct answers in a row. */
  combo: number;
  bestCombo: number;
}

export type Outcome = 'correct' | 'wrong' | 'revealed' | 'ignored';

export const DEFAULT_ROUND_LENGTH = 10;
export const TEST_ROUND_LENGTH = 50;
export const FIND_MAX_TRIES = 3;
/** Find It hints: 1 = shape card, 2 = region shading. */
export const MAX_HINTS = 2;
/** Best possible stars for a round in which any hint was used. */
export const HINTED_MAX_STARS = 2;
/** Combo milestones: a small badge at 3, a big celebration at 5. */
export const COMBO_SMALL = 3;
export const COMBO_BIG = 5;

export interface CreateRoundOptions {
  mode: QuizMode;
  pool: readonly string[];
  records: RecordMap;
  now: number;
  length?: number;
  rng?: Rng;
  practice?: boolean;
  test?: boolean;
}

export function makeOptions(answer: string, pool: readonly string[], rng: Rng = Math.random): string[] {
  const others = shuffle(pool.filter((s) => s !== answer), rng);
  if (others.length < 3) {
    const extra = shuffle(ALL_ABBRS.filter((s) => s !== answer && !others.includes(s)), rng);
    others.push(...extra);
  }
  return shuffle([answer, ...others.slice(0, 3)], rng);
}

export function createRound({ mode, pool, records, now, length, rng = Math.random, practice = false, test = false }: CreateRoundOptions): Round {
  if (pool.length === 0) throw new Error('Cannot create a round from an empty pool');
  if (test) practice = false;
  const size = length ?? (test ? Math.min(TEST_ROUND_LENGTH, pool.length) : DEFAULT_ROUND_LENGTH);
  // A test is a fair shuffle of the whole pool, not the usual "needs work" weighting.
  const states = test ? shuffle(pool, rng).slice(0, size) : pickStates(pool, records, size, now, rng);
  const optionPool = [...pool];
  return {
    mode,
    practice,
    test,
    maxTries: test ? 1 : practice ? Infinity : mode === 'find' ? FIND_MAX_TRIES : 1,
    questions: states.map((state) => ({
      state,
      options: mode === 'name' ? makeOptions(state, optionPool, rng) : [],
      retry: false,
    })),
    index: 0,
    triesUsed: 0,
    hintsUsed: 0,
    wrongPicks: [],
    status: 'asking',
    finished: false,
    results: [],
    optionPool,
    combo: 0,
    bestCombo: 0,
  };
}

export function canTakeHint(round: Round): boolean {
  return !round.test && round.mode === 'find' && !round.finished && round.status === 'asking' && round.hintsUsed < MAX_HINTS;
}

/** Unlock the next hint for the current question. Hints are free but cap stars (see summarize). */
export function takeHint(round: Round): Round {
  return canTakeHint(round) ? { ...round, hintsUsed: round.hintsUsed + 1 } : round;
}

export function currentQuestion(round: Round): Question | undefined {
  return round.finished ? undefined : round.questions[round.index];
}

export function scoreForTries(mode: QuizMode, triesUsed: number, correct: boolean): number {
  if (!correct) return 0;
  if (mode === 'name') return 1;
  return [1, 0.5, 0.25][triesUsed - 1] ?? 0;
}

function resolve(round: Round, q: Question, triesUsed: number, correct: boolean, wrongPicks: string[], picked: string): Round {
  const firstTry = correct && triesUsed === 1;
  const mastery: AnswerKind = !firstTry ? 'wrong' : round.hintsUsed > 0 ? 'assisted' : 'correct';
  const results = q.retry
    ? round.results
    : [
        ...round.results,
        {
          state: q.state,
          triesUsed,
          firstTry,
          hintsUsed: round.hintsUsed,
          mastery,
          score: scoreForTries(round.mode, triesUsed, correct),
          picked,
        },
      ];
  const combo = round.test ? 0 : mastery === 'correct' ? round.combo + 1 : 0;
  return {
    ...round,
    triesUsed,
    wrongPicks,
    status: correct ? 'correct' : 'revealed',
    results,
    combo,
    bestCombo: Math.max(round.bestCombo, combo),
  };
}

/** Answer the current question. Returns the new round and what happened. */
export function answer(round: Round, pick: string): { round: Round; outcome: Outcome } {
  const q = currentQuestion(round);
  if (!q || round.status !== 'asking') return { round, outcome: 'ignored' };
  // Tapping the same wrong state again doesn't burn another try.
  if (round.wrongPicks.includes(pick)) return { round, outcome: 'ignored' };

  const triesUsed = round.triesUsed + 1;
  const correct = pick === q.state;
  const outOfTries = !correct && triesUsed >= round.maxTries;

  if (!correct && !outOfTries) {
    return { round: { ...round, triesUsed, wrongPicks: [...round.wrongPicks, pick], combo: 0 }, outcome: 'wrong' };
  }
  const wrongPicks = correct ? round.wrongPicks : [...round.wrongPicks, pick];
  return { round: resolve(round, q, triesUsed, correct, wrongPicks, pick), outcome: correct ? 'correct' : 'revealed' };
}

/** "Show me": reveal the answer on request (Practice). Counts as not found. */
export function reveal(round: Round): Round {
  const q = currentQuestion(round);
  if (!q || round.status !== 'asking') return round;
  return resolve(round, q, Math.max(1, round.triesUsed), false, round.wrongPicks, '');
}

/** Move on after a question is resolved. Missed states get one retry at the end. */
export function nextQuestion(round: Round, rng: Rng = Math.random): Round {
  if (round.finished || round.status === 'asking') return round;
  const q = round.questions[round.index];
  let questions = round.questions;
  if (round.status === 'revealed' && !q.retry && !round.test) {
    questions = [
      ...questions,
      { state: q.state, options: round.mode === 'name' ? makeOptions(q.state, round.optionPool, rng) : [], retry: true },
    ];
  }
  const index = round.index + 1;
  return {
    ...round,
    questions,
    index,
    triesUsed: 0,
    hintsUsed: 0,
    wrongPicks: [],
    status: 'asking',
    finished: index >= questions.length,
  };
}

export interface TestMiss {
  state: string;
  picked: string;
}

export interface RoundSummary {
  practice: boolean;
  test: boolean;
  /** True when every planned question was answered (a full 50 for a standard test). */
  completed: boolean;
  total: number;
  firstTry: number;
  accuracy: number;
  stars: 1 | 2 | 3;
  missed: string[];
  /** Test misses with what she picked (empty picked = skipped/revealed). */
  misses: TestMiss[];
  /** True if any hint was used on a scored question (retries don't count). */
  usedHints: boolean;
  bestCombo: number;
  /** States that became mastered thanks to this round (graded rounds only). */
  newlyMastered: string[];
  /** Every answered question, in order (used by the test results map). */
  answers: { state: string; picked: string; correct: boolean }[];
}

/** Finishing a round always earns at least 1 star. */
export function starsFor(accuracy: number): 1 | 2 | 3 {
  if (accuracy >= 0.9) return 3;
  if (accuracy >= 0.6) return 2;
  return 1;
}

/** Which states go from not-mastered to mastered when this round's results are applied. */
export function newlyMastered(before: RecordMap, results: readonly QuestionResult[], now: number): string[] {
  const after: RecordMap = { ...before };
  for (const r of results) after[r.state] = recordAnswer(after[r.state], r.mastery, now);
  return [...new Set(results.map((r) => r.state))].filter((s) => masteryOf(before[s]) !== 'mastered' && masteryOf(after[s]) === 'mastered');
}

/** `recordsAtStart` is only needed to work out newly mastered states. */
export function summarize(round: Round, recordsAtStart: RecordMap = {}, now = 0): RoundSummary {
  const total = round.results.length;
  const sum = round.results.reduce((a, r) => a + r.score, 0);
  const accuracy = total === 0 ? 0 : sum / total;
  const usedHints = round.results.some((r) => r.hintsUsed > 0);
  const stars = starsFor(accuracy);
  const missedResults = round.results.filter((r) => r.score === 0 || !r.firstTry);
  // For a test, "missed" is any incorrect answer (one try, so score === 0).
  const testMissed = round.results.filter((r) => r.score === 0);
  const missed = round.test ? testMissed : missedResults;
  const planned = round.questions.filter((q) => !q.retry).length;
  return {
    practice: round.practice,
    test: round.test,
    completed: round.results.length >= planned,
    total,
    firstTry: round.results.filter((r) => r.firstTry).length,
    accuracy,
    stars: usedHints ? (Math.min(stars, HINTED_MAX_STARS) as 1 | 2) : stars,
    missed: missed.map((r) => r.state),
    misses: missed.map((r) => ({ state: r.state, picked: r.picked })),
    usedHints,
    bestCombo: round.bestCombo,
    newlyMastered: round.practice || round.test ? [] : newlyMastered(recordsAtStart, round.results, now),
    answers: round.results.map((r) => ({ state: r.state, picked: r.picked, correct: r.score > 0 })),
  };
}

/** Progress shown as "question X of N" — counts only the original questions. */
export function progressLabel(round: Round): { number: number; total: number; retry: boolean } {
  const originals = round.questions.filter((q) => !q.retry).length;
  const q = currentQuestion(round);
  return {
    number: Math.min(round.index + 1, originals),
    total: originals,
    retry: q?.retry ?? false,
  };
}
