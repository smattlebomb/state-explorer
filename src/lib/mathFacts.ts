/**
 * Multiplication facts: generation, the times-table filter, answer parsing
 * and the 4-choice answers. Pure functions (no React), unit-tested.
 *
 * A fact is "a × b" with id "axb". 3×4 and 4×3 are different facts.
 * Facts run 1×1 to 12×12 (144). With "Include 0s" on, the 25 zero facts are
 * added too: 0×0, 0×1 … 0×12 and 1×0 … 12×0 (169 in all).
 */
import { shuffle, type Rng } from './srs';

export const MIN_TABLE = 1;
export const MAX_TABLE = 12;
export const TABLES: readonly number[] = Array.from({ length: MAX_TABLE }, (_, i) => i + 1);

export interface Fact {
  a: number;
  b: number;
  id: string;
}

export function factId(a: number, b: number): string {
  return `${a}x${b}`;
}

export function makeFact(a: number, b: number): Fact {
  return { a, b, id: factId(a, b) };
}

/** "3x4" → {a: 3, b: 4}. Throws on anything else (ids only come from this module). */
export function parseFactId(id: string): Fact {
  const m = /^(\d{1,2})x(\d{1,2})$/.exec(id);
  if (!m) throw new Error(`Not a fact id: ${id}`);
  return makeFact(Number(m[1]), Number(m[2]));
}

export function product(f: Pick<Fact, 'a' | 'b'>): number {
  return f.a * f.b;
}

/** Every fact in play, ordered by a then b. */
export function allFacts(includeZero = false): Fact[] {
  const lo = includeZero ? 0 : MIN_TABLE;
  const out: Fact[] = [];
  for (let a = lo; a <= MAX_TABLE; a++) for (let b = lo; b <= MAX_TABLE; b++) out.push(makeFact(a, b));
  return out;
}

/** Clean a table selection: whole numbers 1–12, no repeats, sorted. */
export function normalizeTables(tables: readonly number[]): number[] {
  return [...new Set(tables.filter((t) => Number.isInteger(t) && t >= MIN_TABLE && t <= MAX_TABLE))].sort((a, b) => a - b);
}

/** No tables picked, or all 12, both mean "All". */
export function isAllTables(tables: readonly number[]): boolean {
  const t = normalizeTables(tables);
  return t.length === 0 || t.length === TABLES.length;
}

/**
 * Facts for the chosen tables: every fact where at least one factor is a
 * chosen table (so the 3s table includes both 3×7 and 7×3). Zeros join in as
 * the other factor when "Include 0s" is on (3×0 and 0×3 for the 3s table).
 */
export function factsForTables(tables: readonly number[], includeZero = false): Fact[] {
  const all = allFacts(includeZero);
  if (isAllTables(tables)) return all;
  const chosen = new Set(normalizeTables(tables));
  return all.filter((f) => chosen.has(f.a) || chosen.has(f.b));
}

/** "Toggle one table chip" with the All chip semantics: picking All clears the list. */
export function toggleTable(tables: readonly number[], t: number | 'all'): number[] {
  if (t === 'all') return [];
  const cur = isAllTables(tables) ? [] : normalizeTables(tables);
  const next = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
  return isAllTables(next) ? [] : normalizeTables(next);
}

/** Read a typed answer: a whole number, ignoring stray spaces. Anything else is null. */
export function parseAnswer(text: string): number | null {
  const t = text.replace(/\s+/g, '');
  if (!/^\d{1,4}$/.test(t)) return null;
  return Number(t);
}

export function isCorrect(f: Pick<Fact, 'a' | 'b'>, given: number | null): boolean {
  return given !== null && given === product(f);
}

/**
 * Four different answers for multiple choice, exactly one of them right.
 * Wrong ones are believable: one factor off by one (6×7 → 42 vs 35, 48, 36,
 * 49), the digits swapped (42 → 24), and the same table nearby. Shuffled with
 * `rng` so a seed gives the same order every time.
 */
export function answerChoices(f: Pick<Fact, 'a' | 'b'>, rng: Rng = Math.random): number[] {
  const right = product(f);
  const { a, b } = f;
  const candidates = [
    (a + 1) * b,
    (a - 1) * b,
    a * (b + 1),
    a * (b - 1),
    Number(String(right).split('').reverse().join('')),
    (a + 2) * b,
    a * (b + 2),
    right + 1,
    right - 1,
    right + 10,
    right - 10,
  ];
  const wrong = shuffle(
    [...new Set(candidates)].filter((n) => Number.isInteger(n) && n >= 0 && n !== right),
    rng,
  ).slice(0, 3);
  // Tiny facts (like 0×0) may not have 3 believable neighbors: top up with small numbers.
  for (let n = 1; wrong.length < 3; n++) if (n !== right && !wrong.includes(n)) wrong.push(n);
  return shuffle([right, ...wrong], rng);
}

/** Missed facts again, once each, in a new order. */
export function retryQueue(missed: readonly string[], rng: Rng = Math.random): string[] {
  return shuffle([...new Set(missed)], rng);
}

/** Words for read-aloud: "3 times 4". */
export function spokenFact(f: Pick<Fact, 'a' | 'b'>): string {
  return `${f.a} times ${f.b}`;
}
