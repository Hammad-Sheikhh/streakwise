import { daysBetween, weekStart } from './dates';

// SPEC §B9.4.

/** Share of the weekly target reached (1 = 100%), or null when there's no target. */
export function targetProgress(minutes: number, targetMinutes: number | null): number | null {
  if (targetMinutes === null || targetMinutes <= 0) return null;
  return minutes / targetMinutes;
}

/**
 * Behind pace: with `expected = target × days elapsed this week (including today) ÷ 7`,
 * a track is behind if it has a target and `actual < 0.75 × expected`.
 */
export function isBehindPace(
  minutes: number,
  targetMinutes: number | null,
  today: string,
): boolean {
  if (targetMinutes === null || targetMinutes <= 0) return false;
  const daysElapsed = daysBetween(weekStart(today), today) + 1;
  const expected = (targetMinutes * daysElapsed) / 7;
  return minutes < 0.75 * expected;
}
