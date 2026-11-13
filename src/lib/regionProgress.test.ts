import { describe, expect, it } from 'vitest';
import { REGION_IDS, regionChoices, regionProgress, suggestRegion, tourOrder } from './regionProgress';
import { hintText } from './hints';
import { getMapGeometry } from './geo';
import { REGION_COMPASS, REGION_STATES, REGION_TINT } from '../data/regions';
import { ALL_ABBRS } from '../data/states';
import type { RecordMap, StateRecord } from './srs';

const mastered: StateRecord = { streak: 3, correct: 3, wrong: 0, lastSeen: 0 };
const learning: StateRecord = { streak: 1, correct: 1, wrong: 1, lastSeen: 0 };

function masterAll(states: readonly string[], into: RecordMap = {}): RecordMap {
  for (const s of states) into[s] = mastered;
  return into;
}

describe('regionProgress', () => {
  it('counts mastered / learning / new per region', () => {
    const records: RecordMap = { ME: mastered, VT: mastered, NY: learning, TX: mastered };
    expect(regionProgress('northeast', records)).toEqual({ id: 'northeast', total: 11, mastered: 2, learning: 1, fresh: 8, fraction: 2 / 11 });
    expect(regionProgress('southwest', records)).toMatchObject({ total: 4, mastered: 1, fraction: 0.25 });
  });
});

describe('suggestRegion', () => {
  it('with no progress, suggests the first region in the list', () => {
    expect(suggestRegion({})).toBe('northeast');
  });

  it('suggests the region with the smallest share of mastered states', () => {
    const records = masterAll(['ME', 'VT', 'NH', 'MA', 'CT', 'RI'], {}); // Northeast 6/11
    masterAll(['TX'], records); // Southwest 1/4
    masterAll(['FL', 'GA'], records); // Southeast 2/12
    masterAll(['OH', 'IN', 'IL'], records); // Midwest 3/12
    masterAll(['CA', 'OR', 'WA'], records); // West 3/11
    expect(suggestRegion(records)).toBe('southeast');
  });

  it('uses a share, so a finished small region is never suggested', () => {
    const records = masterAll(REGION_STATES.southwest, {});
    expect(suggestRegion(records)).not.toBe('southwest');
  });

  it('breaks ties toward the region with fewer states started', () => {
    const records: RecordMap = { ME: learning, FL: learning, OH: learning, CA: learning };
    // Southwest is the only region with nothing started.
    expect(suggestRegion(records)).toBe('southwest');
  });

  it('returns "all" once every state is mastered', () => {
    expect(suggestRegion(masterAll(ALL_ABBRS))).toBe('all');
  });
});

describe('regionChoices (home card "Pick a different region")', () => {
  it('lists all 5 regions in order, then All 50', () => {
    expect(regionChoices({}).map((c) => c.id)).toEqual(['northeast', 'southeast', 'midwest', 'southwest', 'west', 'all']);
  });

  it('carries emoji, region color and mastered / total counts', () => {
    const records = masterAll(['TX', 'OK'], masterAll(['ME']));
    const byId = new Map(regionChoices(records).map((c) => [c.id, c]));
    expect(byId.get('southwest')).toMatchObject({ label: 'Southwest', emoji: '🌵', color: 'bg-[#b35500]', mastered: 2, total: 4 });
    expect(byId.get('northeast')).toMatchObject({ mastered: 1, total: 11 });
    expect(byId.get('all')).toMatchObject({ label: 'All 50', mastered: 3, total: 50 });
  });

  it('marks exactly one chip as the suggested region', () => {
    const choices = regionChoices({});
    expect(choices.filter((c) => c.suggested).map((c) => c.id)).toEqual([suggestRegion({})]);
    const done = regionChoices(masterAll(ALL_ABBRS));
    expect(done.filter((c) => c.suggested).map((c) => c.id)).toEqual(['all']);
  });
});

describe('region compass, tint and tour order', () => {
  it('every region has a compass phrase and a tint', () => {
    for (const id of REGION_IDS) {
      expect(REGION_COMPASS[id]).toMatch(/map/);
      expect(REGION_TINT[id]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('the West is described as the left side, the Northeast as the top right', () => {
    expect(REGION_COMPASS.west).toContain('left');
    expect(REGION_COMPASS.northeast).toContain('top right');
  });

  const geo = getMapGeometry();
  const centroid = (s: string) => geo.byId.get(s)!.centroid;

  it('tour visits every state in each region exactly once', () => {
    for (const id of REGION_IDS) {
      const order = tourOrder(REGION_STATES[id], centroid);
      expect([...order].sort()).toEqual([...REGION_STATES[id]].sort());
    }
  });

  it('tour reads top-to-bottom: the first state is further north than the last', () => {
    for (const id of REGION_IDS) {
      const order = tourOrder(REGION_STATES[id], centroid);
      expect(centroid(order[0])[1]).toBeLessThan(centroid(order[order.length - 1])[1]);
    }
  });

  it('within a band, tour goes west to east', () => {
    const order = tourOrder(['B', 'A'], (s) => (s === 'A' ? [10, 5] : [20, 6]));
    expect(order).toEqual(['A', 'B']);
  });
});

describe('hintText', () => {
  it('hint 1 talks about the shape and does not say the region', () => {
    const h = hintText('OH', 1);
    expect(h.display).toContain('shape');
    expect(h.spoken).toContain('Ohio');
    expect(h.spoken).not.toContain('Midwest');
  });

  it('hint 2 names the region and where it is on the map', () => {
    const h = hintText('CA', 2);
    expect(h.display).toContain('West');
    expect(h.display).toContain('left side of the map');
    expect(h.spoken).toContain('California is in the West');
  });

  it('works for every state', () => {
    for (const s of ALL_ABBRS) {
      expect(hintText(s, 1).spoken.length).toBeGreaterThan(10);
      expect(hintText(s, 2).display).toMatch(/Northeast|Southeast|Midwest|Southwest|West/);
    }
  });
});
