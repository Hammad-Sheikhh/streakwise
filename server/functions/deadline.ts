import { updateDeadlineInputSchema } from '../../src/core/schemas/inputs.js';
import { deleteDeadline, updateDeadline } from '../../src/core/services/deadlines.js';
import { apiHandler, byMethod, idParam } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

// DEAD-1: edit or delete one deadline.
export function createDeadlineHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'deadlines/:id', auth: true },
    getDeps,
    byMethod({
      PATCH: async (input) => {
        const body = await readJson(input.request, updateDeadlineInputSchema);
        return json({ deadline: await updateDeadline(input.deps.repo, idParam(input), body) });
      },
      DELETE: async (input) => {
        await deleteDeadline(input.deps.repo, idParam(input));
        return json({ ok: true });
      },
    }),
  );
}
