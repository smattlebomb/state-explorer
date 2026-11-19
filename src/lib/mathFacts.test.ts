import { describe, expect, it } from 'vitest';
import {
  TABLES,
  allFacts,
  answerChoices,
  factId,
  factsForTables,
  isAllTables,
  isCorrect,
  normalizeTables,
  parseAnswer,
  parseFactId,
  product,
  retryQueue,
  spokenFact,
  toggleTable,
} from './mathFacts';
import { seeded } from './seeded';

describe('fact generation', () => {
  it('1×1 through 12×12 by default: 144 unique facts, with 3×4 and 4×3 both in', () => {
    const f = allFacts();
    expect(f).toHaveLength(144);
    expect(new Set(f.map((x) => x.id)).size).toBe(144);
    expect(f.map((x) => x.id)).toContain('3x4');
    expect(f.map((x) => x.id)).toContain('4x3');
    expect(f.every((x) => x.a >= 1 && x.a <= 12 && x.b >= 1 && x.b <= 12)).toBe(true);
    expect(f[0].id).toBe('1x1');
    expect(f[143].id).toBe('12x12');
  });

  it('with zeros: adds 0×0…0×12 and 1×0…12×0 (0×0 once) for 169', () => {
    const f = allFacts(true);
    expect(f).toHaveLength(169);
    expect(new Set(f.map((x) => x.id)).size).toBe(169);
    const zeros = f.filter((x) => x.a === 0 || x.b === 0);
    expect(zeros).toHaveLength(25);
    expect(zeros.filter((x) => x.id === '0x0')).toHaveLength(1);
    expect(allFacts(false).some((x) => x.a === 0 || x.b === 0)).toBe(false);
  });

  it('fact ids round-trip', () => {
    expect(parseFactId('12x7')).toEqual({ a: 12, b: 7, id: '12x7' });
    expect(factId(3, 4)).toBe('3x4');
    expect(product(parseFactId('6x7'))).toBe(42);
    expect(() => parseFactId('3*4')).toThrow();
    expect(spokenFact({ a: 3, b: 4 })).toBe('3 times 4');
  });
});

describe('times-table filter', () => {
  it('no tables (or all 12) means All', () => {
    expect(factsForTables([])).toHaveLength(144);
    expect(factsForTables([...TABLES])).toHaveLength(144);
    expect(isAllTables([])).toBe(true);
    expect(isAllTables(TABLES)).toBe(true);
    expect(isAllTables([3])).toBe(false);
  });

  it('one table: every fact with that factor on either side (23 facts)', () => {
    const f = factsForTables([3]);
    expect(f).toHaveLength(23); // 3×1…3×12 and 1×3…12×3, 3×3 once
    expect(f.every((x) => x.a === 3 || x.b === 3)).toBe(true);
    expect(f.map((x) => x.id)).toEqual(expect.arrayContaining(['3x7', '7x3', '3x3', '12x3']));
  });

  it('several tables: the union, no duplicates', () => {
    const f = factsForTables([2, 5]);
    expect(f).toHaveLength(23 + 23 - 2); // 2×5 and 5×2 are in both
    expect(new Set(f.map((x) => x.id)).size).toBe(f.length);
    expect(f.every((x) => [2, 5].includes(x.a) || [2, 5].includes(x.b))).toBe(true);
  });

  it('zeros join a table as the other factor when they are on', () => {
    const off = factsForTables([3], false).map((x) => x.id);
    const on = factsForTables([3], true).map((x) => x.id);
    expect(off).not.toContain('3x0');
    expect(on).toEqual(expect.arrayContaining(['3x0', '0x3']));
    expect(on).toHaveLength(25);
    expect(on).not.toContain('0x0'); // 0 is not a selectable table
  });

  it('normalizeTables / toggleTable: clean values and the All chip', () => {
    expect(normalizeTables([5, 3, 3, 0, 13, 2.5])).toEqual([3, 5]);
    expect(toggleTable([], 4)).toEqual([4]);
    expect(toggleTable([4], 4)).toEqual([]); // back to All
    expect(toggleTable([4, 7], 'all')).toEqual([]);
    expect(toggleTable(TABLES.filter((t) => t !== 9), 9)).toEqual([]); // picking every table = All
  });
});

describe('grading typed answers', () => {
  it('reads whole numbers and ignores stray spaces', () => {
    expect(parseAnswer('42')).toBe(42);
    expect(parseAnswer(' 4 2 ')).toBe(42);
    expect(parseAnswer('0')).toBe(0);
    for (const bad of ['', '  ', '4.2', '-3', 'abc', '12a', '99999']) expect(parseAnswer(bad), bad).toBeNull();
  });

  it('correct only when it equals a × b', () => {
    expect(isCorrect({ a: 6, b: 7 }, 42)).toBe(true);
    expect(isCorrect({ a: 6, b: 7 }, 43)).toBe(false);
    expect(isCorrect({ a: 6, b: 7 }, null)).toBe(false);
    expect(isCorrect({ a: 0, b: 9 }, 0)).toBe(true);
  });
});

describe('4-choice answers', () => {
  it('always 4 different numbers with exactly one correct, for every fact (zeros too)', () => {
    let seed = 1;
    for (const f of allFacts(true)) {
      const c = answerChoices(f, seeded(seed++));
      expect(c, f.id).toHaveLength(4);
      expect(new Set(c).size, f.id).toBe(4);
      expect(c.filter((n) => n === f.a * f.b), f.id).toHaveLength(1);
      expect(c.every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
    }
  });

  it('wrong choices are believable neighbors (6×7 → nearby table facts)', () => {
    const c = answerChoices({ a: 6, b: 7 }, seeded(4)).filter((n) => n !== 42);
    const believable = new Set([35, 49, 36, 48, 24, 56, 54, 41, 43, 52, 32]);
    for (const n of c) expect(believable.has(n), String(n)).toBe(true);
  });

  it('is the same for the same seed', () => {
    expect(answerChoices({ a: 8, b: 9 }, seeded(7))).toEqual(answerChoices({ a: 8, b: 9 }, seeded(7)));
  });
});

describe('retry queue', () => {
  it('has each missed fact once, reshuffled', () => {
    const q = retryQueue(['3x4', '6x7', '3x4', '9x9'], seeded(2));
    expect([...q].sort()).toEqual(['3x4', '6x7', '9x9']);
    expect(retryQueue([], seeded(1))).toEqual([]);
  });
});
