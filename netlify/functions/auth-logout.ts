import type { Config } from '@netlify/functions';

import { apiHandler } from './_lib/api';
import { clearCookie, RECOVERY_COOKIE, SESSION_COOKIE } from './_lib/auth';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json } from './_lib/http';

// AUTH-4: clears this device's login. Works even with an expired cookie, so it never gets stuck.
export function createLogoutHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'auth/logout', auth: false }, getDeps, async () =>
    json(
      { authenticated: false },
      { cookies: [clearCookie(SESSION_COOKIE), clearCookie(RECOVERY_COOKIE)] },
    ),
  );
}

export default createLogoutHandler(serverDeps);

export const config: Config = {
  path: '/api/auth/logout',
  method: 'POST',
};
