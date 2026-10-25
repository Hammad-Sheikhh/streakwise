import { createDeadlineInputSchema } from '../../src/core/schemas/inputs.js';
import { addDeadline, listDeadlines } from '../../src/core/services/deadlines.js';
import { apiHandler, byMethod } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

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
