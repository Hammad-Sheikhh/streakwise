import type { Config } from '@netlify/functions';

import { emailInputSchema } from '../../src/core/schemas/auth';
import { limitAuthRequests, originOf } from './_lib/accountFlow';
import { apiHandler } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';

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

export default createResendHandler(serverDeps);

export const config: Config = {
  path: '/api/auth/resend',
  method: 'POST',
};
