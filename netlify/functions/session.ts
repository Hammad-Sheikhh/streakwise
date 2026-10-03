import type { Config } from '@netlify/functions';

import { updateSessionInputSchema } from '../../src/core/schemas/inputs';
import { deleteSession, updateSession } from '../../src/core/services/sessions';
import { apiHandler, byMethod, idParam } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';

// HIST-2 (and LOG-9's undo): edit or delete one session.
export function createSessionHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'sessions/:id', auth: true },
    getDeps,
    byMethod({
      PATCH: async (input) => {
        const body = await readJson(input.request, updateSessionInputSchema);
        const { repo, clock } = input.deps;
        return json({ session: await updateSession(repo, clock, idParam(input), body) });
      },
      DELETE: async (input) => {
        await deleteSession(input.deps.repo, idParam(input));
        return json({ ok: true });
      },
    }),
  );
}

export default createSessionHandler(serverDeps);

export const config: Config = {
  path: '/api/sessions/:id',
  method: ['PATCH', 'DELETE'],
};
