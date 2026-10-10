import type { Config } from '@netlify/functions';
import { z } from 'zod';

import { startSession } from './_lib/accountFlow';
import type { NetlifyHandler } from './_lib/api';
import { createRecoveryToken, RECOVERY_COOKIE, setCookie } from './_lib/auth';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { HttpError, redirect } from './_lib/http';
import { describeError, log } from './_lib/log';

// ACCT-2, ACCT-4: where the links in our emails land (token-hash flow, so no Supabase page is ever
// opened). A confirmation link logs the user in; a reset link logs them in and opens the page to
// choose a new password. Problems redirect to the login page with a short reason.

const linkSchema = z.object({
  token_hash: z.string().min(1).max(500),
  type: z.enum(['signup', 'recovery']),
});

export function createConfirmHandler(getDeps: () => ServerDeps): NetlifyHandler {
  return async (request) => {
    const link = linkSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!link.success) return redirect('/login?link=invalid');
    try {
      const deps = getDeps();
      const user = await deps.auth.verifyEmailLink(link.data.token_hash, link.data.type);
      const cookies = await startSession(deps, user.id);
      if (link.data.type === 'recovery') {
        const token = createRecoveryToken(deps.env.SESSION_SECRET, user.id, deps.clock());
        return redirect('/reset-password', [...cookies, setCookie(RECOVERY_COOKIE, token)]);
      }
      return redirect('/', cookies);
    } catch (error) {
      if (error instanceof HttpError && error.code === 'link_invalid') {
        return redirect('/login?link=expired');
      }
      log.error('unexpected_error', { route: 'auth/confirm', ...describeError(error) });
      return redirect('/login?link=error');
    }
  };
}

export default createConfirmHandler(serverDeps);

export const config: Config = {
  path: '/auth/confirm',
  method: 'GET',
};
