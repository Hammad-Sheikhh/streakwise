import type { Config } from '@netlify/functions';

import type { AuthStatus } from '../../src/core/schemas/auth';
import { apiHandler } from './_lib/api';
import { CLAIM_COOKIE, isValidClaimToken, readCookie } from './_lib/auth';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json } from './_lib/http';

// ACCT-7: tells the login page whether to offer "I have the old passcode".
export function createStatusHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'auth/status', auth: false }, getDeps, async ({ request, deps }) => {
    const claimAvailable =
      deps.env.APP_PASSCODE !== undefined && (await deps.accounts.hasUnclaimedData());
    const body: AuthStatus = {
      claimAvailable,
      claimReady:
        claimAvailable &&
        isValidClaimToken(
          deps.env.SESSION_SECRET,
          deps.env.APP_PASSCODE,
          readCookie(request, CLAIM_COOKIE),
          deps.clock(),
        ),
    };
    return json(body);
  });
}

export default createStatusHandler(serverDeps);

export const config: Config = {
  path: '/api/auth/status',
  method: 'GET',
};
