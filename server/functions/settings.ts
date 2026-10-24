import { updateSettingsInputSchema } from '../../src/core/schemas/inputs.js';
import { updateSettings } from '../../src/core/services/settings.js';
import { apiHandler, byMethod } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

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
