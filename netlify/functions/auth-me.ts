import type { Config } from '@netlify/functions';

import { apiHandler } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json } from './_lib/http';

// Lets the app check whether the session cookie is still valid; 401 means "show the login page".
export function createMeHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'auth/me', auth: true }, getDeps, async () =>
    json({ authenticated: true }),
  );
}

export default createMeHandler(serverDeps);

export const config: Config = {
  path: '/api/auth/me',
  method: 'GET',
};
