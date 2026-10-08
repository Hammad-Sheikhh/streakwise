import type { Config } from '@netlify/functions';

import { changePasswordInputSchema } from '../../src/core/schemas/auth';
import { checkPassword } from './_lib/accountFlow';
import { apiHandler, forgetSessionCache } from './_lib/api';
import {
  clearCookie,
  createSessionToken,
  readCookie,
  RECOVERY_COOKIE,
  recoveryUserId,
  SESSION_COOKIE,
  setCookie,
} from './_lib/auth';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';
import { log } from './_lib/log';

// ACCT-4, ACCT-9: sets a new password. Needs the current one, except right after a reset link.
// Every other device is logged out; this one gets a fresh login cookie.

export function createPasswordHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'auth/password', auth: true }, getDeps, async (input) => {
    const { request, deps } = input;
    const { currentPassword, newPassword } = await readJson(request, changePasswordInputSchema);
    const now = deps.clock();
    const recovering =
      recoveryUserId(deps.env.SESSION_SECRET, readCookie(request, RECOVERY_COOKIE), now) ===
      deps.userId;
    if (!recovering) await checkPassword(input, currentPassword);

    await deps.auth.setPassword(deps.userId, newPassword);
    await deps.accounts.setSessionsValidAfter(deps.userId, now);
    forgetSessionCache(deps, deps.userId);
    log.info('password_changed', { viaResetLink: recovering });

    const token = createSessionToken(deps.env.SESSION_SECRET, deps.userId, now);
    return json(
      { ok: true },
      { cookies: [setCookie(SESSION_COOKIE, token), clearCookie(RECOVERY_COOKIE)] },
    );
  });
}

export default createPasswordHandler(serverDeps);

export const config: Config = {
  path: '/api/auth/password',
  method: 'POST',
};
