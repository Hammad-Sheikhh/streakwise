import { historyQuerySchema, logSessionInputSchema } from '../../src/core/schemas/inputs.js';
import { getHistory, logSession } from '../../src/core/services/sessions.js';
import { apiHandler, byMethod } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson, readQuery } from './_lib/http.js';

// GET: a page of History (HIST-1, HIST-3). POST: log a session from the app (LOG).
export function createSessionsHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'sessions', auth: true },
    getDeps,
    byMethod({
      GET: async ({ request, deps }) => {
        const query = readQuery(request, historyQuerySchema);
        return json(await getHistory(deps.repo, deps.clock, query));
      },
      POST: async ({ request, deps }) => {
        const body = await readJson(request, logSessionInputSchema);
        const session = await logSession(deps.repo, deps.clock, deps.newId, body, 'app');
        return json({ session }, { status: 201 });
      },
    }),
  );
}
