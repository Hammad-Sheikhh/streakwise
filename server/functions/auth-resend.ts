import { emailInputSchema } from '../../src/core/schemas/auth.js';
import { limitAuthRequests, originOf } from './_lib/accountFlow.js';
import { apiHandler } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

// ACCT-2: sends the confirmation email again. Counts toward the sign-up limit (ACCT-10).
export function createResendHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'auth/resend', auth: false },
    getDeps,
    async ({ request, deps, ip }) => {
      const { email } = await readJson(request, emailInputSchema);
      await limitAuthRequests(deps, ip, 'signup');
      await deps.auth.resendConfirmation(email, originOf(request));
      return json({ ok: true });
    },
  );
}
