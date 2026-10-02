import type { Config } from '@netlify/functions';

import { LOCKOUT_LOOKBACK_MS, lockedUntil } from '../../src/core/logic/lockout';
import { loginInputSchema } from '../../src/core/schemas/auth';
import { seedIfEmpty } from '../../src/core/services/seed';
import { apiHandler } from './_lib/api';
import { createSessionToken, hashIp, passcodeMatches, sessionCookie } from './_lib/auth';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { HttpError, json, readJson } from './_lib/http';
import { log } from './_lib/log';

// AUTH-2, AUTH-5, and the first-login seed (SPEC §B4).

function lockedOut(until: Date, now: Date): HttpError {
  const minutes = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
  return new HttpError(
    429,
    'locked_out',
    `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    { 'Retry-After': String(Math.ceil((until.getTime() - now.getTime()) / 1000)) },
  );
}

export function createLoginHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'auth/login', auth: false },
    getDeps,
    async ({ request, deps, ip }) => {
      const now = deps.clock();
      const ipHash = hashIp(ip, deps.env.SESSION_SECRET);
      const failures = await deps.loginAttempts.failuresSince(
        ipHash,
        new Date(now.getTime() - LOCKOUT_LOOKBACK_MS),
      );
      const lockEnd = lockedUntil(failures, now);
      if (lockEnd) throw lockedOut(lockEnd, now);

      const { passcode } = await readJson(request, loginInputSchema);

      if (!passcodeMatches(passcode, deps.env.APP_PASSCODE)) {
        await deps.loginAttempts.recordFailure(ipHash, now);
        const newLockEnd = lockedUntil([...failures, now], now);
        log.warn('login_failed', { lockedOut: newLockEnd !== null });
        if (newLockEnd) throw lockedOut(newLockEnd, now);
        throw new HttpError(401, 'wrong_passcode', 'That passcode isn’t right.');
      }

      await deps.loginAttempts.clear(ipHash);
      const seeded = await seedIfEmpty(deps.repo, deps.newId);
      log.info('login_succeeded', { seeded });

      const token = createSessionToken(
        { sessionSecret: deps.env.SESSION_SECRET, passcode: deps.env.APP_PASSCODE },
        now,
      );
      return json({ authenticated: true }, { headers: { 'Set-Cookie': sessionCookie(token) } });
    },
  );
}

export default createLoginHandler(serverDeps);

export const config: Config = {
  path: '/api/auth/login',
  method: 'POST',
};
