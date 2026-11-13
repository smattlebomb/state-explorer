/**
 * Daily streak logic. Dates are local calendar days as 'YYYY-MM-DD' strings so
 * that time zones / DST never matter: we only ever compare calendar days.
 */
export interface StreakState {
  current: number;
  best: number;
  /** Last calendar day (YYYY-MM-DD) on which a round was finished. */
  lastDay: string | null;
}

export const EMPTY_STREAK: StreakState = { current: 0, best: 0, lastDay: null };

/** Local calendar day for a Date, e.g. '2026-11-09'. */
export function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole calendar days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** Record that she practiced on `today`. Practicing twice in one day doesn't double count. */
export function recordPractice(state: StreakState, today: string): StreakState {
  if (state.lastDay === null) {
    return { current: 1, best: Math.max(1, state.best), lastDay: today };
  }
  const gap = daysBetween(state.lastDay, today);
  if (gap <= 0) {
    // Same day (or clock went backwards): keep things as they are.
    return state;
  }
  const current = gap === 1 ? state.current + 1 : 1;
  return { current, best: Math.max(current, state.best), lastDay: today };
}

/**
 * The streak to display today. A streak is still "alive" if she played today
 * or yesterday (she can still keep it going today); otherwise it shows 0.
 */
export function displayStreak(state: StreakState, today: string): number {
  if (state.lastDay === null) return 0;
  const gap = daysBetween(state.lastDay, today);
  return gap <= 1 ? state.current : 0;
}

export function playedToday(state: StreakState, today: string): boolean {
  return state.lastDay === today;
}
