import { updateSessionInputSchema } from '../../src/core/schemas/inputs.js';
import { deleteSession, updateSession } from '../../src/core/services/sessions.js';
import { apiHandler, byMethod, idParam } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

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
