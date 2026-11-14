// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  CAPITALS_STORAGE_KEYS,
  LAYER_STORAGE_KEYS,
  emptyLayerProgress,
  layerWithAnswer,
  layerWithReset,
  loadCapitalsProgress,
  loadLayerProgress,
  progressKey,
  saveCapitalsProgress,
  saveLayerProgress,
} from './layerProgress';
import { STORAGE_KEY, emptyData, loadData, parseData, saveData, withAnswer, withReset } from './storage';
import { masteryOf } from './srs';
import { createRound } from './quiz';
import { seeded } from './seeded';
import { CANADA_LAYER, USA_LAYER, WORLD_LAYER, scopeOf } from './layers';

afterEach(() => localStorage.clear());

describe('capitals storage keys', () => {
  it('capitals have their own keys on every layer, separate from place games and the US save', () => {
    expect(CAPITALS_STORAGE_KEYS).toEqual({
      usa: 'state-explorer:us-capitals:v1',
      world: 'state-explorer:world-capitals:v1',
      canada: 'state-explorer:canada-capitals:v1',
    });
    const all = [STORAGE_KEY, ...Object.values(LAYER_STORAGE_KEYS), ...Object.values(CAPITALS_STORAGE_KEYS)];
    expect(new Set(all).size).toBe(all.length);
    expect(progressKey('world', 'places')).toBe('state-explorer:world:v1');
    expect(progressKey('usa', 'capitals')).toBe('state-explorer:us-capitals:v1');
    expect(() => progressKey('usa', 'places')).toThrow();
  });
});

describe('capitals never touch place-finding progress', () => {
  it('playing US capitals leaves the US save (state-explorer:v1) byte-for-byte unchanged', () => {
    let us = emptyData();
    for (let i = 0; i < 3; i++) us = withAnswer(us, 'OH', 'correct', i); // Ohio mastered on the map
    saveData(us);
    const before = localStorage.getItem(STORAGE_KEY);

    let caps = emptyLayerProgress();
    caps = layerWithAnswer(caps, 'OH', 'wrong', 5); // but she missed Columbus
    saveCapitalsProgress('usa', caps);

    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(masteryOf(loadData().records.OH)).toBe('mastered');
    expect(masteryOf(loadCapitalsProgress('usa').records.OH)).toBe('learning');
  });

  it('an existing US save still loads every field unchanged next to capitals data', () => {
    const old = JSON.stringify({ ...emptyData(), totalStars: 9, explored: ['TX'], bestTests: { find: { correct: 40, total: 50 }, name: null } });
    localStorage.setItem(STORAGE_KEY, old);
    saveCapitalsProgress('usa', { ...emptyLayerProgress(), totalStars: 2 });
    expect(loadData()).toEqual(parseData(old));
    expect(loadData().totalStars).toBe(9);
  });

  it('resetting capitals keeps place progress, and resetting places keeps capitals', () => {
    saveData({ ...emptyData(), totalStars: 12 });
    saveLayerProgress('world', { ...emptyLayerProgress(), totalStars: 5 });
    saveCapitalsProgress('usa', { ...emptyLayerProgress(), totalStars: 3 });
    saveCapitalsProgress('world', { ...emptyLayerProgress(), totalStars: 4 });

    saveCapitalsProgress('world', layerWithReset(loadCapitalsProgress('world')));
    expect(loadCapitalsProgress('world').totalStars).toBe(0);
    expect(loadLayerProgress('world').totalStars).toBe(5);
    expect(loadCapitalsProgress('usa').totalStars).toBe(3);

    saveData(withReset(loadData()));
    saveLayerProgress('world', layerWithReset(loadLayerProgress('world')));
    expect(loadCapitalsProgress('usa').totalStars).toBe(3);
    expect(loadData().totalStars).toBe(0);
  });
});

describe("\"What's the capital of X?\" choices", () => {
  it('always gives 4 different capitals, one of them right', () => {
    for (const [cfg, pool] of [
      [USA_LAYER, USA_LAYER.allIds],
      [CANADA_LAYER, CANADA_LAYER.allIds],
      [WORLD_LAYER, scopeOf(WORLD_LAYER, 'c:africa').ids],
    ] as const) {
      const r = createRound({ mode: 'name', pool, records: {}, now: 0, rng: seeded(9), distractors: cfg.allIds });
      for (const q of r.questions) {
        const caps = q.options.map(cfg.capitalOf);
        expect(new Set(caps).size, cfg.id).toBe(4);
        expect(caps).toContain(cfg.capitalOf(q.state));
        for (const c of caps) expect(c.length).toBeGreaterThan(1);
      }
    }
  });

  it('a capitals test asks every place in the scope once', () => {
    const r = createRound({ mode: 'find', pool: USA_LAYER.allIds, records: {}, now: 0, rng: seeded(2), test: true });
    expect(r.questions).toHaveLength(50);
    expect(createRound({ mode: 'name', pool: CANADA_LAYER.allIds, records: {}, now: 0, test: true }).questions).toHaveLength(13);
  });
});
