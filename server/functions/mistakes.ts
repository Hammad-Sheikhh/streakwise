import { createMistakeInputSchema } from '../../src/core/schemas/inputs.js';
import { addMistake, getMistakesOverview } from '../../src/core/services/mistakes.js';
import { apiHandler, byMethod } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

// ERR-1, ERR-3, ERR-4: GET the Mistakes screen (due today, all, counts per module); POST adds one.
export function createMistakesHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'mistakes', auth: true },
    getDeps,
    byMethod({
      GET: async ({ deps }) => json(await getMistakesOverview(deps.repo, deps.clock)),
      POST: async ({ request, deps }) => {
        const input = await readJson(request, createMistakeInputSchema);
        const mistake = await addMistake(deps.repo, deps.clock, deps.newId, input, 'app');
        return json({ mistake }, { status: 201 });
      },
    }),
  );
}
