import type { Config } from '@netlify/functions';

import { apiHandler } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json } from './_lib/http';

// Read-only for now; editing arrives with the Settings screen in M2 (SET-1).
export function createSettingsHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'settings', auth: true }, getDeps, async ({ deps }) =>
    json({ settings: await deps.repo.getSettings() }),
  );
}

export default createSettingsHandler(serverDeps);

export const config: Config = {
  path: '/api/settings',
  method: 'GET',
};
