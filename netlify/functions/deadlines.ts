import type { Config } from '@netlify/functions';

import { createDeadlineInputSchema } from '../../src/core/schemas/inputs';
import { addDeadline, listDeadlines } from '../../src/core/services/deadlines';
import { apiHandler, byMethod } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';

// DEAD-1: list and add deadlines.
export function createDeadlinesHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'deadlines', auth: true },
    getDeps,
    byMethod({
      GET: async ({ deps }) => json({ deadlines: await listDeadlines(deps.repo) }),
      POST: async ({ request, deps }) => {
        const input = await readJson(request, createDeadlineInputSchema);
        return json({ deadline: await addDeadline(deps.repo, deps.newId, input) }, { status: 201 });
      },
    }),
  );
}

export default createDeadlinesHandler(serverDeps);

export const config: Config = {
  path: '/api/deadlines',
  method: ['GET', 'POST'],
};
