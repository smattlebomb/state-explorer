// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  LAYER_STORAGE_KEYS,
  emptyLayerProgress,
  layerWithAnswer,
  layerWithExplored,
  layerWithReset,
  layerWithRoundFinished,
  layerWithTestScore,
  loadLayerProgress,
  parseLayerProgress,
  saveLayerProgress,
  testKey,
} from './layerProgress';
import { STORAGE_KEY, emptyData, loadData, saveData, withReset } from './storage';
import { masteryOf } from './srs';

afterEach(() => localStorage.clear());

describe('layer progress storage keys', () => {
  it('World and Canada use their own new keys, never the US key', () => {
    expect(LAYER_STORAGE_KEYS.world).toBe('state-explorer:world:v1');
    expect(LAYER_STORAGE_KEYS.canada).toBe('state-explorer:canada:v1');
    expect(Object.values(LAYER_STORAGE_KEYS)).not.toContain(STORAGE_KEY);
    expect(STORAGE_KEY).toBe('state-explorer:v1');
  });
});

describe('storage isolation', () => {
  it('saving World and Canada progress leaves the US save byte-for-byte unchanged', () => {
    const us = { ...emptyData(), totalStars: 12, explored: ['OH'] };
    saveData(us);
    const before = localStorage.getItem(STORAGE_KEY);
    saveLayerProgress('world', { ...emptyLayerProgress(), totalStars: 5, explored: ['FR'] });
    saveLayerProgress('canada', { ...emptyLayerProgress(), totalStars: 3 });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(loadData()).toEqual(us);
  });

  it('a US reset does not touch World or Canada, and a World reset does not touch the US or Canada', () => {
    saveData({ ...emptyData(), totalStars: 12 });
    saveLayerProgress('world', { ...emptyLayerProgress(), totalStars: 5 });
    saveLayerProgress('canada', { ...emptyLayerProgress(), totalStars: 3 });

    saveData(withReset(loadData()));
    expect(loadData().totalStars).toBe(0);
    expect(loadLayerProgress('world').totalStars).toBe(5);
    expect(loadLayerProgress('canada').totalStars).toBe(3);

    saveData({ ...emptyData(), totalStars: 12 });
    saveLayerProgress('world', layerWithReset(loadLayerProgress('world')));
    expect(loadLayerProgress('world').totalStars).toBe(0);
    expect(loadData().totalStars).toBe(12);
    expect(loadLayerProgress('canada').totalStars).toBe(3);
  });

  it('World and Canada do not share progress', () => {
    saveLayerProgress('world', layerWithExplored(emptyLayerProgress(), 'FR'));
    expect(loadLayerProgress('canada').explored).toEqual([]);
    expect(loadLayerProgress('world').explored).toEqual(['FR']);
  });
});

describe('parseLayerProgress', () => {
  it('falls back to defaults for missing or broken data', () => {
    expect(parseLayerProgress(null)).toEqual(emptyLayerProgress());
    expect(parseLayerProgress('not json')).toEqual(emptyLayerProgress());
    const p = parseLayerProgress(JSON.stringify({ totalStars: 'x', explored: ['FR', 3], bestTests: { 'all|find': { correct: 10, total: 195 }, bad: { correct: 1 } }, practice: true }));
    expect(p.totalStars).toBe(0);
    expect(p.explored).toEqual(['FR']);
    expect(p.bestTests).toEqual({ 'all|find': { correct: 10, total: 195 } });
    expect(p.practice).toBe(true);
  });

  it('round-trips through save/load', () => {
    let p = layerWithAnswer(emptyLayerProgress(), 'JP', 'correct', 1);
    p = layerWithRoundFinished(p, 3, '2026-11-13');
    saveLayerProgress('world', p);
    expect(loadLayerProgress('world')).toEqual(p);
  });
});

describe('per-layer mastery, stars and tests', () => {
  it('mastery works like the US: 3 first-try answers in a row', () => {
    let p = emptyLayerProgress();
    for (let i = 0; i < 3; i++) p = layerWithAnswer(p, 'PE', 'correct', i);
    expect(masteryOf(p.records.PE)).toBe('mastered');
  });

  it('only a completed test (every item in the scope) that beats the best is saved, per scope and mode', () => {
    let p = emptyLayerProgress();
    p = layerWithTestScore(p, 'c:europe', 44, 'find', 30, 20); // stopped early: not saved
    expect(p.bestTests).toEqual({});
    p = layerWithTestScore(p, 'c:europe', 44, 'find', 30, 44);
    p = layerWithTestScore(p, 'c:europe', 44, 'find', 25, 44); // worse: kept 30
    p = layerWithTestScore(p, 'c:europe', 44, 'name', 40, 44);
    expect(p.bestTests[testKey('c:europe', 'find')]).toEqual({ correct: 30, total: 44 });
    expect(p.bestTests[testKey('c:europe', 'name')]).toEqual({ correct: 40, total: 44 });
  });

  it('the stars and streak go to the layer, not the US', () => {
    const p = layerWithRoundFinished(emptyLayerProgress(), 2, '2026-11-13');
    expect(p.totalStars).toBe(2);
    expect(p.roundsPlayed).toBe(1);
    expect(p.streak.current).toBe(1);
  });
});
