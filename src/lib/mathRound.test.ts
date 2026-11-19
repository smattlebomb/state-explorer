import { describe, expect, it } from 'vitest';
import { answerCard, createMathRound, currentCard, isFirstAnswer, nextCard, roundProgress, summarizeRound } from './mathRound';
import { seeded } from './seeded';

describe('math round', () => {
  it('main set, then each miss once more, then done', () => {
    const rng = seeded(1);
    let r = createMathRound('quiz', ['2x3', '4x5', '6x7']);
    expect(currentCard(r)).toBe('2x3');
    expect(roundProgress(r)).toEqual({ number: 1, total: 3, retry: false });
    r = nextCard(answerCard(r, true, 6), rng);
    r = nextCard(answerCard(r, false, 21), rng); // missed 4×5
    expect(isFirstAnswer(r)).toBe(true);
    r = nextCard(answerCard(r, false, null), rng); // missed 6×7 (timer / not yet)
    expect(r.phase).toBe('retry');
    expect([...r.retry].sort()).toEqual(['4x5', '6x7']);
    expect(isFirstAnswer(r)).toBe(false);
    expect(roundProgress(r)).toEqual({ number: 1, total: 2, retry: true });
    // Retry: get one right, miss one again; she still finishes.
    r = answerCard(r, currentCard(r) === '4x5', null);
    r = nextCard(r, rng);
    r = answerCard(r, currentCard(r) === '4x5', null);
    r = nextCard(r, rng);
    expect(r.phase).toBe('done');
    expect(currentCard(r)).toBeUndefined();
  });

  it('only main-set first answers are scored; retries are not', () => {
    let r = createMathRound('quiz', ['3x3', '3x4']);
    r = nextCard(answerCard(r, false, 8));
    r = nextCard(answerCard(r, true, 12));
    r = nextCard(answerCard(r, true, 9)); // retry of 3×3, right this time
    const s = summarizeRound(r);
    expect(s).toEqual({ kind: 'quiz', total: 2, correct: 1, missed: ['3x3'], stillLearning: [] });
  });

  it('facts missed again on the retry are "still learning"', () => {
    let r = createMathRound('practice', ['9x9']);
    r = nextCard(answerCard(r, false, 80));
    r = nextCard(answerCard(r, false, 82));
    expect(r.phase).toBe('done');
    expect(summarizeRound(r).stillLearning).toEqual(['9x9']);
  });

  it('a perfect round skips the retry pass', () => {
    let r = createMathRound('practice', ['1x1', '2x2']);
    r = nextCard(answerCard(r, true, 1));
    r = nextCard(answerCard(r, true, 4));
    expect(r.phase).toBe('done');
  });

  it("can't answer twice or move on before answering", () => {
    let r = createMathRound('quiz', ['5x5', '5x6']);
    expect(nextCard(r)).toBe(r);
    r = answerCard(r, true, 25);
    expect(answerCard(r, false, 1)).toBe(r);
    expect(r.results).toHaveLength(1);
  });

  it('an empty set is done at once', () => {
    expect(createMathRound('practice', []).phase).toBe('done');
  });
});
