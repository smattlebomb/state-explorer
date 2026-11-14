import { describe, expect, it } from 'vitest';
import {
  answer,
  canTakeHint,
  COMBO_BIG,
  COMBO_SMALL,
  createRound,
  TEST_ROUND_LENGTH,
  newlyMastered,
  reveal,
  currentQuestion,
  makeOptions,
  MAX_HINTS,
  nextQuestion,
  progressLabel,
  starsFor,
  summarize,
  takeHint,
  type Round,
} from './quiz';
import { seeded } from './seeded';
import { REGION_STATES } from '../data/regions';
import { ALL_ABBRS } from '../data/states';
import type { RecordMap } from './srs';

const NOW = 1_800_000_000_000;

function wrongPick(round: Round, exclude: string[] = []): string {
  const target = currentQuestion(round)!.state;
  return ALL_ABBRS.find((s) => s !== target && !exclude.includes(s))!;
}

describe('createRound', () => {
  it('makes 10 distinct questions from All 50', () => {
    const r = createRound({ mode: 'find', pool: ALL_ABBRS, records: {}, now: NOW, rng: seeded(1) });
    expect(r.questions).toHaveLength(10);
    expect(new Set(r.questions.map((q) => q.state)).size).toBe(10);
    expect(r.maxTries).toBe(3);
    expect(r.questions.every((q) => q.options.length === 0)).toBe(true);
  });

  it('uses only the region pool, and fewer questions for small regions', () => {
    const r = createRound({ mode: 'find', pool: REGION_STATES.southwest, records: {}, now: NOW, rng: seeded(1) });
    expect(r.questions).toHaveLength(4);
    for (const q of r.questions) expect(REGION_STATES.southwest).toContain(q.state);
  });

  it('Name It: 4 distinct options including the answer, 1 try', () => {
    const r = createRound({ mode: 'name', pool: ALL_ABBRS, records: {}, now: NOW, rng: seeded(5) });
    expect(r.maxTries).toBe(1);
    for (const q of r.questions) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.state);
    }
  });

  it('throws on an empty pool', () => {
    expect(() => createRound({ mode: 'find', pool: [], records: {}, now: NOW })).toThrow();
  });
});

describe('makeOptions', () => {
  it('draws distractors from the pool when possible', () => {
    const pool = REGION_STATES.midwest;
    for (let i = 0; i < 20; i++) {
      const opts = makeOptions('OH', pool, seeded(i));
      expect(opts).toContain('OH');
      for (const o of opts) expect(pool).toContain(o);
    }
  });

  it('fills up from all states when the pool is too small', () => {
    const opts = makeOptions('TX', ['TX', 'OK'], seeded(1));
    expect(opts).toHaveLength(4);
    expect(new Set(opts).size).toBe(4);
    expect(opts).toContain('TX');
    expect(opts).toContain('OK');
  });
});

describe('Find It flow', () => {
  const fresh = () => createRound({ mode: 'find', pool: ALL_ABBRS, records: {}, now: NOW, rng: seeded(9), length: 3 });

  it('correct on first try scores 1 and counts as first-try', () => {
    const r0 = fresh();
    const { round, outcome } = answer(r0, currentQuestion(r0)!.state);
    expect(outcome).toBe('correct');
    expect(round.status).toBe('correct');
    expect(round.results).toEqual([{ state: r0.questions[0].state, triesUsed: 1, firstTry: true, hintsUsed: 0, mastery: 'correct', score: 1, picked: r0.questions[0].state }]);
  });

  it('allows 3 tries, then reveals the answer', () => {
    let r = fresh();
    const w1 = wrongPick(r);
    let res = answer(r, w1);
    expect(res.outcome).toBe('wrong');
    r = res.round;
    expect(r.triesUsed).toBe(1);

    const w2 = wrongPick(r, [w1]);
    res = answer(r, w2);
    expect(res.outcome).toBe('wrong');
    r = res.round;

    res = answer(r, wrongPick(r, [w1, w2]));
    expect(res.outcome).toBe('revealed');
    r = res.round;
    expect(r.status).toBe('revealed');
    expect(r.results[0]).toMatchObject({ triesUsed: 3, firstTry: false, score: 0 });

    // Further taps are ignored until "next".
    expect(answer(r, currentQuestion(r)!.state).outcome).toBe('ignored');
  });

  it('tapping the same wrong state twice does not use up a try', () => {
    let r = fresh();
    const w = wrongPick(r);
    r = answer(r, w).round;
    const res = answer(r, w);
    expect(res.outcome).toBe('ignored');
    expect(res.round.triesUsed).toBe(1);
  });

  it('correct on second try is partial credit and not first-try', () => {
    let r = fresh();
    r = answer(r, wrongPick(r)).round;
    const res = answer(r, currentQuestion(r)!.state);
    expect(res.outcome).toBe('correct');
    expect(res.round.results[0]).toMatchObject({ triesUsed: 2, firstTry: false, score: 0.5 });
  });

  it('nextQuestion does nothing while still asking', () => {
    const r = fresh();
    expect(nextQuestion(r)).toBe(r);
  });

  it('a missed state is asked once more at the end, without affecting the score', () => {
    let r = fresh();
    const missed = currentQuestion(r)!.state;
    for (const w of ['x1', 'x2', 'x3']) r = answer(r, w).round;
    expect(r.status).toBe('revealed');
    r = nextQuestion(r, seeded(1));
    expect(r.questions).toHaveLength(4);
    expect(r.questions[3]).toMatchObject({ state: missed, retry: true });

    // Answer the remaining two originals correctly.
    for (let i = 0; i < 2; i++) {
      r = answer(r, currentQuestion(r)!.state).round;
      r = nextQuestion(r);
    }
    expect(progressLabel(r)).toEqual({ number: 3, total: 3, retry: true });

    // Miss the retry too: it should NOT be queued again or recorded.
    for (const w of ['x1', 'x2', 'x3']) r = answer(r, w).round;
    expect(r.results).toHaveLength(3);
    r = nextQuestion(r);
    expect(r.finished).toBe(true);
    expect(r.questions).toHaveLength(4);
    expect(currentQuestion(r)).toBeUndefined();

    const s = summarize(r);
    expect(s.total).toBe(3);
    expect(s.firstTry).toBe(2);
    expect(s.missed).toEqual([missed]);
    expect(s.accuracy).toBeCloseTo(2 / 3);
    expect(s.stars).toBe(2);
  });
});

describe('Name It flow', () => {
  it('one wrong pick reveals the answer', () => {
    const r0 = createRound({ mode: 'name', pool: ALL_ABBRS, records: {}, now: NOW, rng: seeded(11), length: 2 });
    const q = currentQuestion(r0)!;
    const wrong = q.options.find((o) => o !== q.state)!;
    const { round, outcome } = answer(r0, wrong);
    expect(outcome).toBe('revealed');
    expect(round.results[0]).toMatchObject({ state: q.state, firstTry: false, score: 0 });
    const next = nextQuestion(round, seeded(2));
    const retry = next.questions[next.questions.length - 1];
    expect(retry.retry).toBe(true);
    expect(retry.options).toHaveLength(4);
    expect(retry.options).toContain(q.state);
  });

  it('a perfect round earns 3 stars', () => {
    let r = createRound({ mode: 'name', pool: REGION_STATES.west, records: {}, now: NOW, rng: seeded(3) });
    while (!r.finished) {
      r = answer(r, currentQuestion(r)!.state).round;
      r = nextQuestion(r);
    }
    const s = summarize(r);
    expect(s).toMatchObject({ total: 10, firstTry: 10, accuracy: 1, stars: 3, missed: [] });
  });
});

describe('Find It hints', () => {
  const fresh = (length = 3) => createRound({ mode: 'find', pool: ALL_ABBRS, records: {}, now: NOW, rng: seeded(21), length });

  it('unlocks hints one at a time, up to 2 per question', () => {
    let r = fresh();
    expect(canTakeHint(r)).toBe(true);
    r = takeHint(r);
    expect(r.hintsUsed).toBe(1);
    r = takeHint(r);
    expect(r.hintsUsed).toBe(MAX_HINTS);
    expect(canTakeHint(r)).toBe(false);
    expect(takeHint(r)).toBe(r);
  });

  it('hints reset for the next question', () => {
    let r = takeHint(fresh());
    r = answer(r, currentQuestion(r)!.state).round;
    expect(canTakeHint(r)).toBe(false); // not while showing the answer
    r = nextQuestion(r);
    expect(r.hintsUsed).toBe(0);
    expect(canTakeHint(r)).toBe(true);
  });

  it('are not available in Name It', () => {
    const r = createRound({ mode: 'name', pool: ALL_ABBRS, records: {}, now: NOW, rng: seeded(1) });
    expect(canTakeHint(r)).toBe(false);
    expect(takeHint(r).hintsUsed).toBe(0);
  });

  it('a hinted first-tap answer is "assisted": first try, full score, but no mastery credit', () => {
    let r = takeHint(fresh());
    r = answer(r, currentQuestion(r)!.state).round;
    expect(r.results[0]).toMatchObject({ firstTry: true, hintsUsed: 1, mastery: 'assisted', score: 1 });
  });

  it('a hinted answer after a miss is still a miss for mastery', () => {
    let r = fresh();
    r = answer(r, 'x1').round;
    r = takeHint(takeHint(r));
    r = answer(r, currentQuestion(r)!.state).round;
    expect(r.results[0]).toMatchObject({ firstTry: false, hintsUsed: 2, mastery: 'wrong' });
  });

  it('caps a round at 2 stars if any hint was used', () => {
    let r = fresh(3);
    let first = true;
    while (!r.finished) {
      if (first) r = takeHint(r);
      first = false;
      r = answer(r, currentQuestion(r)!.state).round;
      r = nextQuestion(r);
    }
    const s = summarize(r);
    expect(s.accuracy).toBe(1);
    expect(s.usedHints).toBe(true);
    expect(s.stars).toBe(2);
  });

  it('a perfect round without hints still earns 3 stars', () => {
    let r = fresh(3);
    while (!r.finished) {
      r = answer(r, currentQuestion(r)!.state).round;
      r = nextQuestion(r);
    }
    expect(summarize(r)).toMatchObject({ usedHints: false, stars: 3 });
  });

  it('hints on a retry question do not cap the stars', () => {
    let r = fresh(2);
    for (const w of ['x1', 'x2', 'x3']) r = answer(r, w).round; // miss Q1 → retry queued
    r = nextQuestion(r);
    r = answer(r, currentQuestion(r)!.state).round; // Q2 correct
    r = nextQuestion(r);
    expect(currentQuestion(r)!.retry).toBe(true);
    r = takeHint(r);
    r = answer(r, currentQuestion(r)!.state).round;
    r = nextQuestion(r);
    expect(r.finished).toBe(true);
    expect(summarize(r).usedHints).toBe(false);
  });

  it('a poor hinted round still earns at least 1 star', () => {
    let r = takeHint(fresh(1));
    for (const w of ['x1', 'x2', 'x3']) r = answer(r, w).round;
    r = nextQuestion(r);
    r = answer(r, currentQuestion(r)!.state).round; // retry
    r = nextQuestion(r);
    expect(summarize(r).stars).toBe(1);
  });
});

describe('Practice flavor', () => {
  const practiceRound = (mode: 'find' | 'name' = 'find', length = 3) =>
    createRound({ mode, pool: ALL_ABBRS, records: {}, now: NOW, rng: seeded(31), length, practice: true });

  it('Find It practice: unlimited tries, never auto-reveals', () => {
    let r = practiceRound();
    expect(r.practice).toBe(true);
    const target = currentQuestion(r)!.state;
    const wrongs = ALL_ABBRS.filter((s) => s !== target).slice(0, 12);
    for (const w of wrongs) {
      const res = answer(r, w);
      expect(res.outcome).toBe('wrong');
      r = res.round;
    }
    expect(r.status).toBe('asking');
    expect(answer(r, target).outcome).toBe('correct');
  });

  it('Name It practice: can keep picking until right', () => {
    let r = practiceRound('name');
    const q = currentQuestion(r)!;
    const wrongs = q.options.filter((o) => o !== q.state);
    for (const w of wrongs) {
      const res = answer(r, w);
      expect(res.outcome).toBe('wrong');
      r = res.round;
    }
    expect(answer(r, q.state).outcome).toBe('correct');
  });

  it('"Show me" reveals the answer, records a miss, and queues a retry', () => {
    let r = practiceRound();
    const target = currentQuestion(r)!.state;
    r = answer(r, 'x1').round;
    r = reveal(r);
    expect(r.status).toBe('revealed');
    expect(r.results[0]).toMatchObject({ state: target, firstTry: false, mastery: 'wrong', score: 0 });
    r = nextQuestion(r);
    expect(r.questions[r.questions.length - 1]).toMatchObject({ state: target, retry: true });
  });

  it('reveal does nothing once a question is resolved', () => {
    let r = practiceRound();
    r = answer(r, currentQuestion(r)!.state).round;
    expect(reveal(r)).toBe(r);
  });

  it('summary is flagged practice and has no newly mastered states', () => {
    let r = practiceRound('find', 1);
    r = answer(r, currentQuestion(r)!.state).round;
    r = nextQuestion(r);
    const records = { [r.questions[0].state]: { streak: 2, correct: 2, wrong: 0, lastSeen: 0 } };
    const s = summarize(r, records, NOW);
    expect(s.practice).toBe(true);
    expect(s.newlyMastered).toEqual([]);
  });
});

describe('combo counter', () => {
  it('counts first-try, no-hint answers in a row and resets on a miss', () => {
    let r = createRound({ mode: 'find', pool: ALL_ABBRS, records: {}, now: NOW, rng: seeded(41), length: 8 });
    const correctOnce = () => {
      r = answer(r, currentQuestion(r)!.state).round;
      r = nextQuestion(r);
    };
    correctOnce();
    correctOnce();
    correctOnce();
    expect(r.combo).toBe(COMBO_SMALL);
    r = answer(r, 'x1').round; // a wrong tap breaks the combo
    expect(r.combo).toBe(0);
    r = answer(r, currentQuestion(r)!.state).round; // 2nd-try correct doesn't restart it
    expect(r.combo).toBe(0);
    r = nextQuestion(r);
    r = takeHint(r);
    r = answer(r, currentQuestion(r)!.state).round; // hinted: no combo credit
    expect(r.combo).toBe(0);
    r = nextQuestion(r);
    correctOnce();
    expect(r.combo).toBe(1);
    expect(r.bestCombo).toBe(3);
    expect(COMBO_BIG).toBe(5);
  });
});

describe('newlyMastered', () => {
  it('finds states that cross into mastered this round', () => {
    const before: RecordMap = {
      OH: { streak: 2, correct: 2, wrong: 0, lastSeen: 0 },
      TX: { streak: 3, correct: 3, wrong: 0, lastSeen: 0 }, // already mastered
      CA: { streak: 1, correct: 1, wrong: 0, lastSeen: 0 },
    };
    const res = (state: string, mastery: 'correct' | 'wrong' | 'assisted') => ({ state, triesUsed: 1, firstTry: mastery !== 'wrong', hintsUsed: 0, mastery, score: 1, picked: state });
    expect(newlyMastered(before, [res('OH', 'correct'), res('TX', 'correct'), res('CA', 'correct')], NOW)).toEqual(['OH']);
    expect(newlyMastered(before, [res('OH', 'assisted')], NOW)).toEqual([]);
    expect(newlyMastered(before, [res('OH', 'wrong')], NOW)).toEqual([]);
  });

  it('is part of a graded summary', () => {
    let r = createRound({ mode: 'find', pool: ['OH'], records: {}, now: NOW, rng: seeded(1), length: 1 });
    r = answer(r, 'OH').round;
    r = nextQuestion(r);
    const s = summarize(r, { OH: { streak: 2, correct: 2, wrong: 0, lastSeen: 0 } }, NOW);
    expect(s.newlyMastered).toEqual(['OH']);
    expect(s.practice).toBe(false);
  });
});

describe('starsFor', () => {
  it('maps accuracy to 1-3 stars, always at least 1', () => {
    expect(starsFor(1)).toBe(3);
    expect(starsFor(0.9)).toBe(3);
    expect(starsFor(0.89)).toBe(2);
    expect(starsFor(0.6)).toBe(2);
    expect(starsFor(0.59)).toBe(1);
    expect(starsFor(0)).toBe(1);
  });
});

describe('test mode', () => {
  const testRound = (mode: 'find' | 'name' = 'find', rng = seeded(101)) =>
    createRound({ mode, pool: ALL_ABBRS, records: {}, now: NOW, rng, test: true });

  it('asks all 50 states once, in shuffled order, with one try and no retries', () => {
    const a = testRound('find', seeded(101));
    const b = testRound('find', seeded(202));
    expect(a.test).toBe(true);
    expect(a.practice).toBe(false);
    expect(a.maxTries).toBe(1);
    expect(a.questions).toHaveLength(TEST_ROUND_LENGTH);
    expect(new Set(a.questions.map((q) => q.state)).size).toBe(50);
    expect(a.questions.every((q) => !q.retry)).toBe(true);
    // Different seeds produce different orders.
    expect(a.questions.map((q) => q.state).join()).not.toBe(b.questions.map((q) => q.state).join());
  });

  it('the first Find It tap is final, even when wrong, and records what she picked', () => {
    let r = testRound('find');
    const target = r.questions[0].state;
    const wrong = ALL_ABBRS.find((s) => s !== target)!;
    const { round, outcome } = answer(r, wrong);
    expect(outcome).toBe('revealed');
    expect(round.status).toBe('revealed');
    expect(round.results[0]).toMatchObject({ state: target, picked: wrong, firstTry: false, score: 0, triesUsed: 1 });
    expect(round.combo).toBe(0);
    // A second tap is ignored.
    expect(answer(round, target).outcome).toBe('ignored');
    const next = nextQuestion(round);
    expect(next.questions).toHaveLength(50); // no retry appended
    expect(next.index).toBe(1);
    expect(canTakeHint(round)).toBe(false);
  });

  it('the first Name It choice is final', () => {
    let r = testRound('name');
    const q = r.questions[0];
    const wrong = q.options.find((s) => s !== q.state)!;
    const { round, outcome } = answer(r, wrong);
    expect(outcome).toBe('revealed');
    expect(round.results[0]).toMatchObject({ picked: wrong, score: 0 });
    expect(answer(round, q.state).outcome).toBe('ignored');
  });

  it('summarize reports score, misses with the picked answer, and no newly mastered states', () => {
    let r = testRound('find', seeded(3));
    const first = r.questions[0].state;
    const second = r.questions[1].state;
    const wrong = ALL_ABBRS.find((s) => s !== first)!;
    r = answer(r, first).round;
    r = nextQuestion(r);
    r = answer(r, wrong).round;
    r = nextQuestion(r);
    const s = summarize(r);
    expect(s.test).toBe(true);
    expect(s.practice).toBe(false);
    expect(s.completed).toBe(false);
    expect(s.total).toBe(2);
    expect(s.firstTry).toBe(1);
    expect(s.accuracy).toBe(0.5);
    expect(s.missed).toEqual([second]);
    expect(s.misses).toEqual([{ state: second, picked: wrong }]);
    expect(s.newlyMastered).toEqual([]);
  });

  it('a finished 50-state test is marked completed with x/50', () => {
    let r = createRound({ mode: 'find', pool: ALL_ABBRS, records: {}, now: NOW, rng: seeded(7), test: true });
    for (let i = 0; i < 50; i++) {
      const q = r.questions[i];
      r = answer(r, i % 5 === 0 ? ALL_ABBRS.find((s) => s !== q.state)! : q.state).round;
      r = nextQuestion(r);
    }
    expect(r.finished).toBe(true);
    const s = summarize(r);
    expect(s.completed).toBe(true);
    expect(s.total).toBe(50);
    expect(s.firstTry).toBe(40);
    expect(s.accuracy).toBe(0.8);
    expect(s.misses).toHaveLength(10);
  });
});
