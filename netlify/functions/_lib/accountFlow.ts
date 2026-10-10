import { LOCKOUT_LOOKBACK_MS, lockedUntil } from '../../../src/core/logic/lockout';
import { seedIfEmpty } from '../../../src/core/services/seed';
import type { AuthRequestKind } from './accounts';
import type { ApiRequest } from './api';
import { createSessionToken, hashIp, setCookie, SESSION_COOKIE } from './auth';
import type { ServerDeps } from './deps';
import { HttpError } from './http';
import { log } from './log';

// Steps shared by the auth endpoints: starting a login session, the lockout (AUTH-5), and the
// sign-up/reset request limit (ACCT-10).

/** Logs the user in on this device: seeds a new account (ACCT-6) and returns the cookie to set. */
export async function startSession(deps: ServerDeps, userId: string): Promise<string[]> {
  const cookie = setCookie(
    SESSION_COOKIE,
    createSessionToken(deps.env.SESSION_SECRET, userId, deps.clock()),
  );
  const seeded = await seedIfEmpty(deps.repoFor(userId), deps.newId);
  log.info('session_started', { seeded });
  return [cookie];
}

function lockedOut(until: Date, now: Date): HttpError {
  const minutes = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
  return new HttpError(
    429,
    'locked_out',
    `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    { 'Retry-After': String(Math.ceil((until.getTime() - now.getTime()) / 1000)) },
  );
}

/**
 * AUTH-5 around a password check: refuses while this IP is locked out, records a
 * failure when `check` raises a 401, and clears the IP's failures on success.
 */
export async function withLockout<T>(
  deps: ServerDeps,
  ip: string,
  check: () => Promise<T>,
): Promise<T> {
  const now = deps.clock();
  const ipHash = hashIp(ip, deps.env.SESSION_SECRET);
  const failures = await deps.loginAttempts.failuresSince(
    ipHash,
    new Date(now.getTime() - LOCKOUT_LOOKBACK_MS),
  );
  const lockEnd = lockedUntil(failures, now);
  if (lockEnd) throw lockedOut(lockEnd, now);

  try {
    const result = await check();
    await deps.loginAttempts.clear(ipHash);
    return result;
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      await deps.loginAttempts.recordFailure(ipHash, now);
      const newLockEnd = lockedUntil([...failures, now], now);
      log.warn('login_failed', { lockedOut: newLockEnd !== null });
      if (newLockEnd) throw lockedOut(newLockEnd, now);
    }
    throw error;
  }
}

/** Checks the current password with the same lockout as login (AUTH-5). */
export async function checkPassword(
  { deps, ip }: ApiRequest,
  password: string | undefined,
): Promise<void> {
  if (!password) throw new HttpError(400, 'validation', 'Enter your current password.');
  const user = await deps.auth.getUser(deps.userId);
  if (!user) throw new HttpError(401, 'unauthenticated', 'Please log in.');
  await withLockout(deps, ip, async () => {
    try {
      await deps.auth.signIn(user.email, password);
    } catch (error) {
      if (error instanceof HttpError && error.code === 'wrong_login') {
        throw new HttpError(401, 'wrong_password', 'That password isn’t right.');
      }
      throw error;
    }
  });
}

/** ACCT-10: at most this many sign-ups (or reset emails) per IP per hour. */
export const AUTH_REQUESTS_PER_HOUR = 5;

export async function limitAuthRequests(
  deps: ServerDeps,
  ip: string,
  kind: AuthRequestKind,
): Promise<void> {
  const now = deps.clock();
  const ipHash = hashIp(ip, deps.env.SESSION_SECRET);
  const recent = await deps.accounts.authRequestsSince(
    ipHash,
    kind,
    new Date(now.getTime() - 60 * 60_000),
  );
  if (recent >= AUTH_REQUESTS_PER_HOUR) {
    throw new HttpError(429, 'rate_limited', 'Too many requests. Please try again in an hour.', {
      'Retry-After': '3600',
    });
  }
  await deps.accounts.recordAuthRequest(ipHash, kind, now);
}

/** The site's own origin, for email links, so a preview's emails open the preview. */
export function originOf(request: Request): string {
  return new URL(request.url).origin;
}
