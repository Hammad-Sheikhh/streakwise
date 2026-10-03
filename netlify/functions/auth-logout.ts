import type { Config } from '@netlify/functions';

import { apiHandler } from './_lib/api';
import { clearedSessionCookie } from './_lib/auth';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json } from './_lib/http';

// AUTH-4: clears the session cookie.
export function createLogoutHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'auth/logout', auth: true }, getDeps, async () =>
    json({ authenticated: false }, { headers: { 'Set-Cookie': clearedSessionCookie() } }),
  );
}

export default createLogoutHandler(serverDeps);

export const config: Config = {
  path: '/api/auth/logout',
  method: 'POST',
};
