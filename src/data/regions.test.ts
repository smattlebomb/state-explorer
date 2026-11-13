import { describe, expect, it } from 'vitest';
import { REGION_STATES, REGIONS } from './regions';
import { ALL_ABBRS, SMALL_STATES, STATES, STATE_BY_ABBR } from './states';

describe('state list', () => {
  it('has exactly 50 states with unique abbreviations, names and FIPS codes', () => {
    expect(STATES).toHaveLength(50);
    expect(new Set(STATES.map((s) => s.abbr)).size).toBe(50);
    expect(new Set(STATES.map((s) => s.name)).size).toBe(50);
    expect(new Set(STATES.map((s) => s.fips)).size).toBe(50);
  });

  it('does not include DC or territories', () => {
    expect(STATE_BY_ABBR.has('DC')).toBe(false);
    expect(STATES.some((s) => ['11', '60', '66', '69', '72', '78'].includes(s.fips))).toBe(false);
  });

  it('small-state callouts are all real states', () => {
    for (const s of SMALL_STATES) expect(STATE_BY_ABBR.has(s)).toBe(true);
  });
});

describe('regions', () => {
  const lists = Object.values(REGION_STATES);
  const flat = lists.flat();

  it('has 5 regions', () => {
    expect(Object.keys(REGION_STATES).sort()).toEqual(['midwest', 'northeast', 'southeast', 'southwest', 'west']);
  });

  it('covers all 50 states exactly once', () => {
    expect(flat).toHaveLength(50);
    expect(new Set(flat).size).toBe(50);
    expect([...flat].sort()).toEqual([...ALL_ABBRS].sort());
  });

  it('agrees with the region field on each state', () => {
    for (const [region, list] of Object.entries(REGION_STATES)) {
      for (const abbr of list) expect(STATE_BY_ABBR.get(abbr)?.region).toBe(region);
    }
  });

  it('has the expected sizes for the standard 5-region split', () => {
    expect(REGION_STATES.northeast).toHaveLength(11);
    expect(REGION_STATES.southeast).toHaveLength(12);
    expect(REGION_STATES.midwest).toHaveLength(12);
    expect(REGION_STATES.southwest).toHaveLength(4);
    expect(REGION_STATES.west).toHaveLength(11);
  });

  it('the "All 50" option contains every state, and every region has at least 4 states (for Name It)', () => {
    const all = REGIONS.find((r) => r.id === 'all')!;
    expect([...all.states].sort()).toEqual([...ALL_ABBRS].sort());
    for (const r of REGIONS) expect(r.states.length).toBeGreaterThanOrEqual(4);
  });
});
