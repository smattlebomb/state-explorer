import { describe, expect, it } from 'vitest';
import { masteryOf, needsWork, pickStates, recordAnswer, recordPracticeAnswer, shuffle, weightOf, type RecordMap, type StateRecord } from './srs';
import { seeded } from './seeded';

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

describe('recordAnswer / masteryOf', () => {
  it('unseen states are new', () => {
    expect(masteryOf(undefined)).toBe('new');
  });

  it('becomes mastered after 3 correct in a row', () => {
    let r: StateRecord | undefined;
    r = recordAnswer(r, true, NOW);
    expect(masteryOf(r)).toBe('learning');
    r = recordAnswer(r, true, NOW);
    expect(masteryOf(r)).toBe('learning');
    r = recordAnswer(r, true, NOW);
    expect(masteryOf(r)).toBe('mastered');
    expect(r).toEqual({ streak: 3, correct: 3, wrong: 0, lastSeen: NOW });
  });

  it('a miss resets the in-a-row count (and un-masters)', () => {
    let r: StateRecord | undefined;
    for (let i = 0; i < 4; i++) r = recordAnswer(r, true, NOW);
    r = recordAnswer(r, false, NOW + 1);
    expect(r).toEqual({ streak: 0, correct: 4, wrong: 1, lastSeen: NOW + 1 });
    expect(masteryOf(r)).toBe('learning');
    r = recordAnswer(r, true, NOW);
    r = recordAnswer(r, true, NOW);
    expect(masteryOf(r)).toBe('learning');
    r = recordAnswer(r, true, NOW);
    expect(masteryOf(r)).toBe('mastered');
  });

  it('a first-ever miss is "learning", not "new"', () => {
    expect(masteryOf(recordAnswer(undefined, false, NOW))).toBe('learning');
  });

  it('an assisted (hinted) answer neither advances nor resets the in-a-row count', () => {
    let r: StateRecord | undefined;
    r = recordAnswer(r, 'correct', NOW);
    r = recordAnswer(r, 'correct', NOW);
    r = recordAnswer(r, 'assisted', NOW + 5);
    expect(r).toMatchObject({ streak: 2, correct: 2, wrong: 0, assisted: 1, lastSeen: NOW + 5 });
    expect(masteryOf(r)).toBe('learning');
    r = recordAnswer(r, 'correct', NOW);
    expect(masteryOf(r)).toBe('mastered');
  });

  it('a state only ever found with hints is "learning" and gets high priority', () => {
    const r = recordAnswer(undefined, 'assisted', NOW);
    expect(masteryOf(r)).toBe('learning');
    expect(weightOf(r, NOW)).toBe(8);
  });

  it('assisted answers can never master a state on their own', () => {
    let r: StateRecord | undefined;
    for (let i = 0; i < 10; i++) r = recordAnswer(r, 'assisted', NOW);
    expect(masteryOf(r)).toBe('learning');
  });
});

describe('practice answers ("needs work")', () => {
  it('a practice miss flags needs-work without changing mastery counts', () => {
    const before: StateRecord = { streak: 3, correct: 3, wrong: 0, lastSeen: NOW };
    const after = recordPracticeAnswer(before, false, NOW + 10)!;
    expect(after).toMatchObject({ streak: 3, correct: 3, wrong: 0, lastSeen: NOW, needsWorkAt: NOW + 10 });
    expect(masteryOf(after)).toBe('mastered');
    expect(needsWork(after)).toBe(true);
  });

  it('needs-work states get top priority, even if mastered', () => {
    const rec: StateRecord = { streak: 5, correct: 5, wrong: 0, lastSeen: NOW, needsWorkAt: NOW + 1 };
    expect(weightOf(rec, NOW + 2)).toBe(8);
  });

  it('a practice miss on a never-quizzed state keeps it "new" but boosts it', () => {
    const rec = recordPracticeAnswer(undefined, false, NOW);
    expect(masteryOf(rec)).toBe('new');
    expect(weightOf(rec, NOW)).toBe(8);
  });

  it('a later graded answer clears the needs-work boost', () => {
    let rec = recordPracticeAnswer({ streak: 3, correct: 3, wrong: 0, lastSeen: NOW }, false, NOW + 1);
    rec = recordAnswer(rec, 'correct', NOW + 2);
    expect(needsWork(rec)).toBe(false);
    expect(weightOf(rec, NOW + 3)).toBe(1);
  });

  it('getting it on the first try in practice clears needs-work', () => {
    const missed = recordPracticeAnswer(undefined, false, NOW);
    const fixed = recordPracticeAnswer(missed, true, NOW + 1);
    expect(fixed?.needsWorkAt).toBeUndefined();
    expect(needsWork(fixed)).toBe(false);
  });

  it('a first-try practice answer with no record changes nothing', () => {
    expect(recordPracticeAnswer(undefined, true, NOW)).toBeUndefined();
  });
});

describe('weightOf', () => {
  const rec = (streak: number, lastSeen = NOW): StateRecord => ({ streak, correct: streak + 1, wrong: 1, lastSeen });

  it('missed states outrank new, which outrank learning, which outrank mastered', () => {
    const missed = weightOf(rec(0), NOW);
    const fresh = weightOf(undefined, NOW);
    const two = weightOf(rec(2), NOW);
    const mastered = weightOf(rec(3), NOW);
    expect(missed).toBeGreaterThan(fresh);
    expect(fresh).toBeGreaterThan(two);
    expect(two).toBeGreaterThan(mastered);
    expect(mastered).toBeGreaterThan(0);
  });

  it('mastered states not seen for over a week get a review bump', () => {
    expect(weightOf(rec(5, NOW - 8 * DAY), NOW)).toBeGreaterThan(weightOf(rec(5, NOW - DAY), NOW));
  });
});

describe('pickStates', () => {
  const pool = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID'];

  it('returns distinct states from the pool', () => {
    const picked = pickStates(pool, {}, 10, NOW, seeded(1));
    expect(picked).toHaveLength(10);
    expect(new Set(picked).size).toBe(10);
    for (const s of picked) expect(pool).toContain(s);
  });

  it('never returns more than the pool size', () => {
    expect(pickStates(['TX', 'OK'], {}, 10, NOW, seeded(2)).sort()).toEqual(['OK', 'TX']);
  });

  it('dedupes the pool', () => {
    expect(pickStates(['TX', 'TX', 'OK'], {}, 10, NOW, seeded(2))).toHaveLength(2);
  });

  it('missed states come up much more often than mastered ones', () => {
    const records: RecordMap = {};
    for (const s of pool) records[s] = { streak: 5, correct: 5, wrong: 0, lastSeen: NOW };
    records.CA = { streak: 0, correct: 1, wrong: 2, lastSeen: NOW };
    const rng = seeded(42);
    let caCount = 0;
    let alCount = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i++) {
      const picked = pickStates(pool, records, 3, NOW, rng);
      if (picked.includes('CA')) caCount++;
      if (picked.includes('AL')) alCount++;
    }
    // CA has weight 8 vs 1 for each mastered state.
    expect(caCount).toBeGreaterThan(alCount * 2.5);
    expect(caCount / trials).toBeGreaterThan(0.8);
  });

  it('missed states tend to be asked first', () => {
    const records: RecordMap = { CA: { streak: 0, correct: 0, wrong: 3, lastSeen: NOW } };
    for (const s of pool) if (s !== 'CA') records[s] = { streak: 3, correct: 3, wrong: 0, lastSeen: NOW };
    const rng = seeded(7);
    let first = 0;
    for (let i = 0; i < 500; i++) if (pickStates(pool, records, 5, NOW, rng)[0] === 'CA') first++;
    expect(first / 500).toBeGreaterThan(0.3); // 8 / (8 + 11) ≈ 0.42 expected
  });
});

describe('shuffle', () => {
  it('keeps every element and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, seeded(3));
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});
