import type { Config } from '@netlify/functions';

import { loginInputSchema } from '../../src/core/schemas/auth';
import { startSession, withLockout } from './_lib/accountFlow';
import { apiHandler } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';

// ACCT-3: email + password login, with the AUTH-5 lockout. Seeds a new account (ACCT-6).
export function createLoginHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'auth/login', auth: false },
    getDeps,
    async ({ request, deps, ip }) => {
      const { email, password } = await readJson(request, loginInputSchema);
      const user = await withLockout(deps, ip, () => deps.auth.signIn(email, password));
      const cookies = await startSession(deps, user.id);
      return json({ authenticated: true }, { cookies });
    },
  );
}

export default createLoginHandler(serverDeps);

export const config: Config = {
  path: '/api/auth/login',
  method: 'POST',
};
