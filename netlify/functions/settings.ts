import type { Config } from '@netlify/functions';

import { updateSettingsInputSchema } from '../../src/core/schemas/inputs';
import { updateSettings } from '../../src/core/services/settings';
import { apiHandler, byMethod } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';

// SET-1: read and change the student name and neglect threshold.
export function createSettingsHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'settings', auth: true },
    getDeps,
    byMethod({
      GET: async ({ deps }) => json({ settings: await deps.repo.getSettings() }),
      PATCH: async ({ request, deps }) => {
        const body = await readJson(request, updateSettingsInputSchema);
        return json({ settings: await updateSettings(deps.repo, body) });
      },
    }),
  );
}

export default createSettingsHandler(serverDeps);

export const config: Config = {
  path: '/api/settings',
  method: ['GET', 'PATCH'],
};
