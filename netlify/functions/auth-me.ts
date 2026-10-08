import type { Config } from '@netlify/functions';

import type { Me } from '../../src/core/schemas/auth';
import { apiHandler } from './_lib/api';
import {
  clearCookie,
  readCookie,
  RECOVERY_COOKIE,
  recoveryUserId,
  SESSION_COOKIE,
} from './_lib/auth';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { errorJson, json } from './_lib/http';

// Lets the app check whether it is logged in, and as whom; 401 means "show the login page".
export function createMeHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'auth/me', auth: true }, getDeps, async ({ request, deps }) => {
    const user = await deps.auth.getUser(deps.userId);
    if (!user) {
      // The account was deleted on another device.
      const response = errorJson(401, 'unauthenticated', 'Please log in.');
      response.headers.append('Set-Cookie', clearCookie(SESSION_COOKIE));
      return response;
    }
    const recovering =
      recoveryUserId(
        deps.env.SESSION_SECRET,
        readCookie(request, RECOVERY_COOKIE),
        deps.clock(),
      ) === deps.userId;
    const body: Me = {
      authenticated: true,
      user: { email: user.email, name: user.name },
      recovering,
    };
    return json(body);
  });
}

export default createMeHandler(serverDeps);

export const config: Config = {
  path: '/api/auth/me',
  method: 'GET',
};
