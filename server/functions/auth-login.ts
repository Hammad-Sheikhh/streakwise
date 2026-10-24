import { loginInputSchema } from '../../src/core/schemas/auth.js';
import { startSession, withLockout } from './_lib/accountFlow.js';
import { apiHandler } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

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
