import { describe, expect, it } from 'vitest';
import { PRACTICE_ROUND, buildFactSet, factGrid, factMastery, masteredCount, practiceSet, quizSet, recordFact, type FactRecords } from './mathMastery';
import { allFacts, factsForTables } from './mathFacts';
import { seeded } from './seeded';

const ids = (tables: number[], zero = false) => factsForTables(tables, zero).map((f) => f.id);
const DAY = 86_400_000;

describe('mastery per fact', () => {
  it('3 right in a row (first answers) = mastered', () => {
    let r: FactRecords = {};
    expect(factMastery(r['3x4'])).toBe('new');
    r = recordFact(r, '3x4', true, 1);
    expect(factMastery(r['3x4'])).toBe('learning');
    r = recordFact(r, '3x4', true, 2);
    expect(factMastery(r['3x4'])).toBe('learning');
    r = recordFact(r, '3x4', true, 3);
    expect(factMastery(r['3x4'])).toBe('mastered');
  });

  it('a miss resets the streak', () => {
    let r: FactRecords = {};
    for (let i = 0; i < 3; i++) r = recordFact(r, '7x8', true, i);
    r = recordFact(r, '7x8', false, 4);
    expect(factMastery(r['7x8'])).toBe('learning');
    expect(r['7x8']!.streak).toBe(0);
    expect(r['7x8']!.wrong).toBe(1);
  });

  it('facts are tracked separately (3×4 is not 4×3)', () => {
    let r: FactRecords = {};
    for (let i = 0; i < 3; i++) r = recordFact(r, '3x4', true, i);
    expect(factMastery(r['3x4'])).toBe('mastered');
    expect(factMastery(r['4x3'])).toBe('new');
  });
});

describe('building a set', () => {
  it('quiz of 10 or 20: that many, no repeats when there are enough facts', () => {
    for (const len of [10, 20] as const) {
      const s = quizSet(ids([]), {}, len, 0, seeded(len));
      expect(s).toHaveLength(len);
      expect(new Set(s).size).toBe(len);
    }
  });

  it('"All" has every selected fact exactly once', () => {
    const pool = ids([3, 4]);
    const s = quizSet(pool, {}, 'all', 0, seeded(1));
    expect([...s].sort()).toEqual([...pool].sort());
  });

  it('only repeats when the pool is too small, and never back to back', () => {
    const pool = ['2x2', '2x3', '3x2'];
    const s = buildFactSet(pool, {}, 10, 0, seeded(3));
    expect(s).toHaveLength(10);
    for (const id of pool) expect(s).toContain(id);
    for (let i = 1; i < s.length; i++) expect(s[i]).not.toBe(s[i - 1]);
  });

  it('is the same for the same seed', () => {
    expect(quizSet(ids([]), {}, 20, 0, seeded(9))).toEqual(quizSet(ids([]), {}, 20, 0, seeded(9)));
  });

  it('practice rounds are 12 cards (fewer if fewer facts)', () => {
    expect(practiceSet(ids([]), {}, 0, seeded(1))).toHaveLength(PRACTICE_ROUND);
    expect([...practiceSet(['5x5', '5x6'], {}, 0, seeded(1))].sort()).toEqual(['5x5', '5x6']);
  });

  it('favors missed facts over mastered ones, but still mixes in mastered review', () => {
    const pool = ids([]);
    const now = 10 * DAY;
    let records: FactRecords = {};
    // Every fact mastered…
    for (const id of pool) for (let i = 0; i < 3; i++) records = recordFact(records, id, true, now - 1000);
    // …except 10 just missed.
    const missed = pool.slice(0, 10);
    for (const id of missed) records = recordFact(records, id, false, now - 500);

    let missedPicks = 0;
    let masteredPicks = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const s = quizSet(pool, records, 10, now, seeded(seed));
      missedPicks += s.filter((id) => missed.includes(id)).length;
      masteredPicks += s.filter((id) => !missed.includes(id)).length;
    }
    // 10 missed of 144 facts would be ~7% by chance; weighting makes it far more.
    expect(missedPicks / 500).toBeGreaterThan(0.25);
    expect(masteredPicks).toBeGreaterThan(0);
  });
});

describe('My Facts grid', () => {
  it('12×12 by default, 13×13 with zeros, with mastery counts', () => {
    let r: FactRecords = {};
    for (let i = 0; i < 3; i++) r = recordFact(r, '6x7', true, i);
    r = recordFact(r, '2x2', false, 0);
    const g = factGrid(r);
    expect(g.factors).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(g.rows).toHaveLength(12);
    expect(g.rows[5][6]).toMatchObject({ id: '6x7', product: 42, mastery: 'mastered' });
    expect(g.counts).toEqual({ new: 142, learning: 1, mastered: 1, total: 144 });
    const z = factGrid(r, true);
    expect(z.factors[0]).toBe(0);
    expect(z.rows).toHaveLength(13);
    expect(z.counts.total).toBe(169);
  });

  it('masteredCount counts only the given facts', () => {
    let r: FactRecords = {};
    for (let i = 0; i < 3; i++) r = recordFact(r, '0x5', true, i);
    expect(masteredCount(r, allFacts(false).map((f) => f.id))).toBe(0);
    expect(masteredCount(r, allFacts(true).map((f) => f.id))).toBe(1);
  });
});
