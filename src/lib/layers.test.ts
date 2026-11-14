import { describe, expect, it } from 'vitest';
import { CANADA_LAYER, WORLD_LAYER, scopeOf } from './layers';
import { COUNTRIES, MAP_TERRITORIES } from '../data/world';
import { createRound } from './quiz';
import { seeded } from './seeded';

describe('World quiz pools', () => {
  it('"All" is exactly the 195 official countries', () => {
    expect(WORLD_LAYER.scopes[0].id).toBe('all');
    expect([...WORLD_LAYER.scopes[0].ids].sort()).toEqual(COUNTRIES.map((c) => c.id).sort());
  });

  it('display-only places (Taiwan, Kosovo, Greenland…) are in no pool', () => {
    const territories = new Set(MAP_TERRITORIES.map((t) => t.id));
    for (const s of WORLD_LAYER.scopes) for (const id of s.ids) expect(territories.has(id), `${id} in ${s.id}`).toBe(false);
    for (const id of ['TW', 'XK', 'GL', 'PR', 'EH']) expect(WORLD_LAYER.allIds).not.toContain(id);
  });

  it('6 continent scopes and 22 sub-region scopes; every country is in exactly one of each', () => {
    const continents = WORLD_LAYER.scopes.filter((s) => s.id.startsWith('c:'));
    const subs = WORLD_LAYER.scopes.filter((s) => s.id.startsWith('s:'));
    expect(continents).toHaveLength(6);
    expect(subs).toHaveLength(22);
    for (const c of COUNTRIES) {
      expect(continents.filter((s) => s.ids.includes(c.id)), c.id).toHaveLength(1);
      expect(subs.filter((s) => s.ids.includes(c.id)), c.id).toHaveLength(1);
    }
    expect(scopeOf(WORLD_LAYER, 'c:europe').ids).toHaveLength(44);
    expect(scopeOf(WORLD_LAYER, 's:caribbean').ids).toHaveLength(13);
    expect(scopeOf(WORLD_LAYER, 'nope').id).toBe('all');
  });

  it('hint 2 names the sub-region and shades its countries', () => {
    const h = WORLD_LAYER.hintRegion('FR');
    expect(h.display).toContain('Western Europe');
    expect(h.ids.has('DE')).toBe(true);
    expect(h.ids.has('ES')).toBe(false);
    // No "in Africa" when the region's name already says it; otherwise the continent is added.
    expect(WORLD_LAYER.hintRegion('KE').display).toBe("💡 It's in Eastern Africa.");
    expect(WORLD_LAYER.hintRegion('JM').display).toBe("💡 It's in the Caribbean, in North America.");
  });
});

describe('Canada quiz pool', () => {
  it('is all 13 provinces and territories', () => {
    expect(CANADA_LAYER.scopes).toHaveLength(1);
    expect(CANADA_LAYER.allIds).toHaveLength(13);
    expect(CANADA_LAYER.nameOf('PE')).toBe('Prince Edward Island');
    expect(CANADA_LAYER.hintRegion('NS').display).toContain('Atlantic Canada');
    expect(CANADA_LAYER.hintRegion('NU').display).toContain('the North');
  });
});

describe('test mode length', () => {
  it('a test asks every item in its scope exactly once', () => {
    for (const [pool, n] of [
      [WORLD_LAYER.scopes[0].ids, 195],
      [scopeOf(WORLD_LAYER, 'c:europe').ids, 44],
      [scopeOf(WORLD_LAYER, 's:australia-new-zealand').ids, 2],
      [CANADA_LAYER.allIds, 13],
    ] as const) {
      const r = createRound({ mode: 'find', pool, records: {}, now: 0, rng: seeded(3), test: true });
      expect(r.questions).toHaveLength(n);
      expect(new Set(r.questions.map((q) => q.state)).size).toBe(n);
      expect(r.maxTries).toBe(1);
    }
  });

  it('Name It in a tiny scope still gets 4 different choices (from the wider layer)', () => {
    const pool = scopeOf(WORLD_LAYER, 's:australia-new-zealand').ids;
    const oceania = scopeOf(WORLD_LAYER, 'c:oceania').ids;
    const r = createRound({ mode: 'name', pool, records: {}, now: 0, rng: seeded(5), distractors: oceania });
    for (const q of r.questions) {
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.state);
      for (const o of q.options) expect(oceania).toContain(o);
    }
  });
});
