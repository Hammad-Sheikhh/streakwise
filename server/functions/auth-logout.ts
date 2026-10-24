import { apiHandler } from './_lib/api.js';
import { clearCookie, RECOVERY_COOKIE, SESSION_COOKIE } from './_lib/auth.js';
import type { ServerDeps } from './_lib/deps.js';
import { json } from './_lib/http.js';

// AUTH-4: clears this device's login. Works even with an expired cookie, so it never gets stuck.
export function createLogoutHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'auth/logout', auth: false }, getDeps, async () =>
    json(
      { authenticated: false },
      { cookies: [clearCookie(SESSION_COOKIE), clearCookie(RECOVERY_COOKIE)] },
    ),
  );
}
