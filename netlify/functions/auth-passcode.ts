import type { Config } from '@netlify/functions';

import { passcodeInputSchema } from '../../src/core/schemas/auth';
import { withLockout } from './_lib/accountFlow';
import { apiHandler } from './_lib/api';
import { CLAIM_COOKIE, createClaimToken, passcodeMatches, setCookie } from './_lib/auth';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { HttpError, json, readJson } from './_lib/http';

// ACCT-7: the old passcode, entered once, lets this browser's next login or sign-up claim the data
// from before accounts. Same lockout as login (AUTH-5).
export function createPasscodeHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'auth/passcode', auth: false },
    getDeps,
    async ({ request, deps, ip }) => {
      const expected = deps.env.APP_PASSCODE;
      if (!expected || !(await deps.accounts.hasUnclaimedData())) {
        throw new HttpError(409, 'nothing_to_claim', 'There’s no old data to move any more.');
      }
      const { passcode } = await readJson(request, passcodeInputSchema);
      await withLockout(deps, ip, async () => {
        if (!passcodeMatches(passcode, expected)) {
          throw new HttpError(401, 'wrong_passcode', 'That passcode isn’t right.');
        }
      });
      const token = createClaimToken(deps.env.SESSION_SECRET, expected, deps.clock());
      return json({ claimReady: true }, { cookies: [setCookie(CLAIM_COOKIE, token)] });
    },
  );
}

export default createPasscodeHandler(serverDeps);

export const config: Config = {
  path: '/api/auth/passcode',
  method: 'POST',
};
