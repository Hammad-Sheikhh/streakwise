import type { Config } from '@netlify/functions';

import { signUpInputSchema } from '../../src/core/schemas/auth';
import type { SignUpResult } from '../../src/core/schemas/auth';
import { limitAuthRequests, originOf, startSession } from './_lib/accountFlow';
import { apiHandler } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';

// ACCT-1, ACCT-2: open sign-up, limited per IP (ACCT-10). With email confirmation on, the user
// gets a link and is logged in when they open it; without it (no SMTP yet), they're logged in now.
export function createSignUpHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'auth/signup', auth: false },
    getDeps,
    async ({ request, deps, ip }) => {
      const input = await readJson(request, signUpInputSchema);
      await limitAuthRequests(deps, ip, 'signup');
      const result = await deps.auth.signUp({ ...input, origin: originOf(request) });
      if (result.kind === 'confirm_email') {
        const body: SignUpResult = { status: 'confirm_email' };
        return json(body, { status: 201 });
      }
      const cookies = await startSession(deps, result.user.id);
      const body: SignUpResult = { status: 'signed_in' };
      return json(body, { status: 201, cookies });
    },
  );
}

export default createSignUpHandler(serverDeps);

export const config: Config = {
  path: '/api/auth/signup',
  method: 'POST',
};
