import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, emptyData, parseData, withAnswer, withExplored, withPracticeAnswer, withReset, withRoundFinished, withSetting } from './storage';
import { masteryOf } from './srs';

describe('storage', () => {
  it('falls back to defaults on missing or corrupt data', () => {
    expect(parseData(null)).toEqual(emptyData());
    expect(parseData('not json')).toEqual(emptyData());
    expect(parseData('null')).toEqual(emptyData());
    expect(parseData('{"explored":"oops","totalStars":"x"}')).toEqual(emptyData());
  });

  it('round-trips saved data', () => {
    let d = emptyData();
    d = withAnswer(d, 'OH', true, 1);
    d = withExplored(d, 'TX');
    d = withExplored(d, 'TX');
    d = withRoundFinished(d, 3, '2026-11-09');
    d = withSetting(d, 'regionColors', false);
    const parsed = parseData(JSON.stringify(d));
    expect(parsed).toEqual(d);
    expect(parsed.explored).toEqual(['TX']);
    expect(parsed.totalStars).toBe(3);
    expect(parsed.streak.current).toBe(1);
    expect(parsed.records.OH?.streak).toBe(1);
    expect(parsed.settings.regionColors).toBe(false);
  });

  it('default settings: narration off, sound / region colors / keep-names on; Quiz (not Practice)', () => {
    expect(emptyData().settings).toEqual({ narration: false, sound: true, regionColors: true, keepNames: true, learnKeepNames: false, practice: false });
  });

  it('Learn keep-names is its own setting: default OFF, saved, and independent of the quiz one', () => {
    expect(emptyData().settings.learnKeepNames).toBe(false);
    const d = withSetting(emptyData(), 'learnKeepNames', true);
    const parsed = parseData(JSON.stringify(d));
    expect(parsed.settings.learnKeepNames).toBe(true);
    expect(parsed.settings.keepNames).toBe(true);
    // A save from before this setting existed gets the OFF default.
    expect(parseData(JSON.stringify({ settings: { keepNames: false } })).settings).toMatchObject({ keepNames: false, learnKeepNames: false });
  });

  it('an older save missing newer keys gets those filled in with defaults', () => {
    const old = JSON.stringify({ version: 1, records: {}, explored: [], settings: { sound: false } });
    expect(parseData(old).settings).toEqual({ ...DEFAULT_SETTINGS, sound: false });
  });

  it('ignores a saved speech:true (and speech:false) and defaults narration to off', () => {
    const on = JSON.stringify({ version: 1, records: {}, explored: [], settings: { speech: true, sound: true } });
    expect(parseData(on).settings.narration).toBe(false);
    expect('speech' in parseData(on).settings).toBe(false);
    const off = JSON.stringify({ settings: { speech: false } });
    expect(parseData(off).settings.narration).toBe(false);
  });

  it('persists narration once the new key is present', () => {
    const d = withSetting(emptyData(), 'narration', true);
    expect(parseData(JSON.stringify(d)).settings.narration).toBe(true);
  });

  it('ignores unknown or wrongly-typed settings', () => {
    const raw = JSON.stringify({ settings: { sound: 'yes', keepNames: false, evil: true } });
    const s = parseData(raw).settings;
    expect(s.sound).toBe(true);
    expect(s.keepNames).toBe(false);
    expect('evil' in s).toBe(false);
  });

  it('reset clears progress but keeps settings', () => {
    let d = withRoundFinished(withAnswer(emptyData(), 'OH', true, 1), 2, '2026-11-09');
    d = withSetting(withSetting(d, 'narration', true), 'sound', false);
    const r = withReset(d);
    expect(r.records).toEqual({});
    expect(r.totalStars).toBe(0);
    expect(r.streak.current).toBe(0);
    expect(r.settings.narration).toBe(true);
    expect(r.settings.sound).toBe(false);
  });

  it('practice answers never touch stars, streak or mastery', () => {
    let d = emptyData();
    for (let i = 0; i < 3; i++) d = withAnswer(d, 'OH', 'correct', 100 + i);
    expect(masteryOf(d.records.OH)).toBe('mastered');
    const before = d;
    d = withPracticeAnswer(d, 'OH', false, 500);
    expect(masteryOf(d.records.OH)).toBe('mastered');
    expect(d.records.OH?.streak).toBe(3);
    expect(d.totalStars).toBe(before.totalStars);
    expect(d.streak).toEqual(before.streak);
    expect(d.records.OH?.needsWorkAt).toBe(500);
  });

  it('a first-try practice answer with nothing to clear leaves data unchanged', () => {
    const d = emptyData();
    expect(withPracticeAnswer(d, 'OH', true, 1)).toBe(d);
  });
});
