import { describe, expect, it } from 'vitest';
import { daysBetween, displayStreak, EMPTY_STREAK, playedToday, recordPractice, toDayKey } from './streak';

describe('daysBetween', () => {
  it('counts calendar days, including across months, years and leap days', () => {
    expect(daysBetween('2026-11-09', '2026-11-10')).toBe(1);
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2026-11-10', '2026-11-09')).toBe(-1);
  });

  it('is unaffected by DST changes (US: 2026-03-08 and 2026-11-01)', () => {
    expect(daysBetween('2026-03-07', '2026-03-08')).toBe(1);
    expect(daysBetween('2026-03-08', '2026-03-09')).toBe(1);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });
});

describe('toDayKey', () => {
  it('uses the local calendar date', () => {
    expect(toDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toDayKey(new Date(2026, 10, 9, 0, 1))).toBe('2026-11-09');
  });
});

describe('recordPractice', () => {
  it('starts a streak at 1', () => {
    expect(recordPractice(EMPTY_STREAK, '2026-11-09')).toEqual({ current: 1, best: 1, lastDay: '2026-11-09' });
  });

  it('does not double count the same day', () => {
    const s = recordPractice(EMPTY_STREAK, '2026-11-09');
    expect(recordPractice(s, '2026-11-09')).toEqual(s);
  });

  it('grows on consecutive days', () => {
    let s = recordPractice(EMPTY_STREAK, '2026-11-09');
    s = recordPractice(s, '2026-11-10');
    s = recordPractice(s, '2026-11-11');
    expect(s).toEqual({ current: 3, best: 3, lastDay: '2026-11-11' });
  });

  it('resets to 1 after a missed day but remembers the best', () => {
    let s = recordPractice(EMPTY_STREAK, '2026-11-09');
    s = recordPractice(s, '2026-11-10');
    s = recordPractice(s, '2026-11-12');
    expect(s).toEqual({ current: 1, best: 2, lastDay: '2026-11-12' });
  });

  it('continues across a month boundary', () => {
    let s = recordPractice(EMPTY_STREAK, '2026-11-30');
    s = recordPractice(s, '2026-12-01');
    expect(s.current).toBe(2);
  });

  it('ignores a clock that went backwards', () => {
    const s = { current: 4, best: 4, lastDay: '2026-11-09' };
    expect(recordPractice(s, '2026-11-08')).toEqual(s);
  });
});

describe('displayStreak', () => {
  const s = { current: 5, best: 7, lastDay: '2026-11-09' };
  it('shows the streak if played today or yesterday', () => {
    expect(displayStreak(s, '2026-11-09')).toBe(5);
    expect(displayStreak(s, '2026-11-10')).toBe(5);
  });
  it('shows 0 once a day has been missed', () => {
    expect(displayStreak(s, '2026-11-11')).toBe(0);
    expect(displayStreak(EMPTY_STREAK, '2026-11-11')).toBe(0);
  });
  it('playedToday', () => {
    expect(playedToday(s, '2026-11-09')).toBe(true);
    expect(playedToday(s, '2026-11-10')).toBe(false);
  });
});
