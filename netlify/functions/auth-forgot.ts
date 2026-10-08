import type { Config } from '@netlify/functions';

import { emailInputSchema } from '../../src/core/schemas/auth';
import { limitAuthRequests, originOf } from './_lib/accountFlow';
import { apiHandler } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';

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

export default createForgotHandler(serverDeps);

export const config: Config = {
  path: '/api/auth/forgot',
  method: 'POST',
};
