import type { Config } from '@netlify/functions';

import { historyQuerySchema, logSessionInputSchema } from '../../src/core/schemas/inputs';
import { getHistory, logSession } from '../../src/core/services/sessions';
import { apiHandler, byMethod } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson, readQuery } from './_lib/http';

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

export default createSessionsHandler(serverDeps);

export const config: Config = {
  path: '/api/sessions',
  method: ['GET', 'POST'],
};
