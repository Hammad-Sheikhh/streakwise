// AUTH-5: 5 wrong passwords from one IP within 15 minutes lock login from that IP for 15 minutes.

export const LOCKOUT_MAX_FAILURES = 5;
export const LOCKOUT_WINDOW_MS = 15 * 60_000;
export const LOCKOUT_DURATION_MS = 15 * 60_000;

/** How far back failures can matter: a full window plus a full lock. */
export const LOCKOUT_LOOKBACK_MS = LOCKOUT_WINDOW_MS + LOCKOUT_DURATION_MS;

/**
 * Returns when the lock ends, or null if login is allowed now. The lock starts at the failure that
 * completes any run of 5 failures within 15 minutes. Attempts made while locked are not recorded,
 * so they don't extend the lock.
 */
export function lockedUntil(failures: readonly Date[], now: Date): Date | null {
  const times = failures.map((f) => f.getTime()).sort((a, b) => a - b);
  let latestEnd: number | null = null;

  for (let last = LOCKOUT_MAX_FAILURES - 1; last < times.length; last++) {
    const first = times[last - (LOCKOUT_MAX_FAILURES - 1)];
    const lockStart = times[last];
    if (first === undefined || lockStart === undefined) continue;
    if (lockStart - first <= LOCKOUT_WINDOW_MS) {
      latestEnd = Math.max(latestEnd ?? 0, lockStart + LOCKOUT_DURATION_MS);
    }
  }

  return latestEnd !== null && latestEnd > now.getTime() ? new Date(latestEnd) : null;
}
