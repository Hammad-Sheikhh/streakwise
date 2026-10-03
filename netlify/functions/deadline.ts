import type { Config } from '@netlify/functions';

import { updateDeadlineInputSchema } from '../../src/core/schemas/inputs';
import { deleteDeadline, updateDeadline } from '../../src/core/services/deadlines';
import { apiHandler, byMethod, idParam } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';

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

export default createDeadlineHandler(serverDeps);

export const config: Config = {
  path: '/api/deadlines/:id',
  method: ['PATCH', 'DELETE'],
};
