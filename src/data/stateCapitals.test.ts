import { describe, expect, it } from 'vitest';
import { STATE_CAPITALS, stateCapital } from './stateCapitals';
import { ALL_ABBRS } from './states';

describe('state capitals', () => {
  it('has a capital for exactly the 50 states', () => {
    expect(Object.keys(STATE_CAPITALS).sort()).toEqual([...ALL_ABBRS].sort());
  });

  it('every capital is a non-empty name', () => {
    for (const abbr of ALL_ABBRS) {
      const cap = stateCapital(abbr);
      expect(cap?.trim(), abbr).toBeTruthy();
      expect(cap).toBe(cap?.trim());
    }
    expect(new Set(Object.values(STATE_CAPITALS)).size).toBe(50);
  });

  it('spot-checks the ones kids often mix up', () => {
    expect(stateCapital('NY')).toBe('Albany');
    expect(stateCapital('CA')).toBe('Sacramento');
    expect(stateCapital('IL')).toBe('Springfield');
    expect(stateCapital('FL')).toBe('Tallahassee');
    expect(stateCapital('PA')).toBe('Harrisburg');
    expect(stateCapital('WA')).toBe('Olympia');
    expect(stateCapital('TX')).toBe('Austin');
    expect(stateCapital('DC')).toBeUndefined();
  });
});
