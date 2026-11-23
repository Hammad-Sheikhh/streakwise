import { updateMistakeInputSchema } from '../../src/core/schemas/inputs.js';
import { deleteMistake, updateMistake } from '../../src/core/services/mistakes.js';
import { apiHandler, byMethod, idParam } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

// ERR-1: edit (text, node) or delete one mistake.
export function createMistakeHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'mistakes/:id', auth: true },
    getDeps,
    byMethod({
      PATCH: async (input) => {
        const body = await readJson(input.request, updateMistakeInputSchema);
        return json({ mistake: await updateMistake(input.deps.repo, idParam(input), body) });
      },
      DELETE: async (input) => {
        await deleteMistake(input.deps.repo, idParam(input));
        return json({ ok: true });
      },
    }),
  );
}
