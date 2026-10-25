import { emailInputSchema } from '../../src/core/schemas/auth.js';
import { limitAuthRequests, originOf } from './_lib/accountFlow.js';
import { apiHandler } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

// ACCT-4: emails a reset link. The answer is the same whether or not the email has an account.
export function createForgotHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'auth/forgot', auth: false },
    getDeps,
    async ({ request, deps, ip }) => {
      const { email } = await readJson(request, emailInputSchema);
      await limitAuthRequests(deps, ip, 'reset');
      await deps.auth.sendPasswordReset(email, originOf(request));
      return json({ ok: true });
    },
  );
}
