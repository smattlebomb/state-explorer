// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  MATH_STORAGE_KEY,
  bestQuizKey,
  emptyMathData,
  loadMathData,
  mathWith,
  mathWithQuizScore,
  mathWithReset,
  parseMathData,
  saveMathData,
} from './mathStorage';
import { STORAGE_KEY, emptyData, loadData, saveData } from './storage';
import { CAPITALS_STORAGE_KEYS, LAYER_STORAGE_KEYS } from './layerProgress';

afterEach(() => localStorage.clear());

describe('math storage key', () => {
  it('is a new key, different from every geography key', () => {
    expect(MATH_STORAGE_KEY).toBe('state-explorer:math-mult:v1');
    const geo = [STORAGE_KEY, ...Object.values(LAYER_STORAGE_KEYS), ...Object.values(CAPITALS_STORAGE_KEYS)];
    expect(geo).not.toContain(MATH_STORAGE_KEY);
  });
});

describe('parseMathData', () => {
  it('defaults: geography subject, no zeros, all tables, keypad, 10-question quiz, timer off', () => {
    const d = parseMathData(null);
    expect(d).toEqual(emptyMathData());
    expect(d.subject).toBe('geography');
    expect(d.includeZero).toBe(false);
    expect(d.tables).toEqual([]);
    expect(d.relaxedTimer).toBe(false);
    expect(d.quizLength).toBe(10);
    expect(d.quizAnswerMode).toBe('keypad');
  });

  it('survives broken JSON and wrong types', () => {
    expect(parseMathData('{oops')).toEqual(emptyMathData());
    expect(parseMathData('[1,2]')).toEqual(emptyMathData());
    const d = parseMathData(JSON.stringify({ subject: 'art', includeZero: 'yes', tables: [3, 3, 0, 13, 2.5, 'x', 7], quizLength: 15, practiceMode: 'nope', relaxedTimer: 1 }));
    expect(d.subject).toBe('geography');
    expect(d.includeZero).toBe(false);
    expect(d.tables).toEqual([3, 7]);
    expect(d.quizLength).toBe(10);
    expect(d.practiceMode).toBe('keypad');
    expect(d.relaxedTimer).toBe(false);
  });

  it('fills in fields missing from an older/partial save and keeps the ones it has', () => {
    const d = parseMathData(JSON.stringify({ subject: 'math', facts: { '3x4': { streak: 2, correct: 2, wrong: 1, lastSeen: 5 }, junk: { streak: 9 } } }));
    expect(d.subject).toBe('math');
    expect(d.facts['3x4']).toEqual({ streak: 2, correct: 2, wrong: 1, lastSeen: 5 });
    expect(d.facts.junk).toBeUndefined();
    expect(d.bestQuizzes).toEqual({});
    expect(d.quizAnswerMode).toBe('keypad');
  });

  it('keeps only valid best quizzes', () => {
    const d = parseMathData(JSON.stringify({ bestQuizzes: { '10|keypad': { correct: 8, total: 10 }, bad: { correct: 12, total: 10 }, worse: 'x' } }));
    expect(d.bestQuizzes).toEqual({ '10|keypad': { correct: 8, total: 10 } });
  });
});

describe('save / load', () => {
  it('round-trips through localStorage', () => {
    const d = mathWith(mathWith(emptyMathData(), 'subject', 'math'), 'tables', [3, 4]);
    saveMathData(d);
    expect(loadMathData()).toEqual(d);
  });

  it('saving math never changes the geography save', () => {
    saveData({ ...emptyData(), totalStars: 7, explored: ['OH'] });
    const before = localStorage.getItem(STORAGE_KEY);
    saveMathData({ ...emptyMathData(), subject: 'math', facts: { '6x7': { streak: 3, correct: 3, wrong: 0, lastSeen: 1 } } });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(loadData().totalStars).toBe(7);
  });
});

describe('updaters', () => {
  it('mathWith returns the same object when nothing changes', () => {
    const d = emptyMathData();
    expect(mathWith(d, 'subject', 'geography')).toBe(d);
    expect(mathWith(d, 'subject', 'math').subject).toBe('math');
  });

  it('best quiz is kept per length + answer mode and only goes up', () => {
    let d = emptyMathData();
    d = mathWithQuizScore(d, 10, 'keypad', 7, 10);
    d = mathWithQuizScore(d, 10, 'keypad', 6, 10);
    d = mathWithQuizScore(d, 20, 'choices', 18, 20);
    expect(d.bestQuizzes[bestQuizKey(10, 'keypad')]).toEqual({ correct: 7, total: 10 });
    expect(d.bestQuizzes[bestQuizKey(20, 'choices')]).toEqual({ correct: 18, total: 20 });
    d = mathWithQuizScore(d, 10, 'keypad', 9, 10);
    expect(d.bestQuizzes[bestQuizKey(10, 'keypad')]).toEqual({ correct: 9, total: 10 });
  });

  it('reset erases math progress but keeps settings and the subject', () => {
    const d = { ...emptyMathData(), subject: 'math' as const, includeZero: true, facts: { '2x2': { streak: 1, correct: 1, wrong: 0, lastSeen: 0 } }, bestQuizzes: { '10|keypad': { correct: 5, total: 10 } } };
    const r = mathWithReset(d);
    expect(r.facts).toEqual({});
    expect(r.bestQuizzes).toEqual({});
    expect(r.subject).toBe('math');
    expect(r.includeZero).toBe(true);
  });
});
