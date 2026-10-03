import { addDays } from './dates';

// SPEC §B9.6.

/**
 * Consecutive days with at least one session, counting back from today if today has a session,
 * otherwise from yesterday (so the streak doesn't drop to 0 before today's study is logged).
 */
export function currentStreak(activeDates: ReadonlySet<string>, today: string): number {
  let day = activeDates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (activeDates.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

/** The longest run of consecutive active days in the whole history. */
export function longestStreak(activeDates: Iterable<string>): number {
  const sorted = [...new Set(activeDates)].sort();
  let longest = 0;
  let run = 0;
  let previous: string | undefined;
  for (const date of sorted) {
    run = previous !== undefined && addDays(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }
  return longest;
}
