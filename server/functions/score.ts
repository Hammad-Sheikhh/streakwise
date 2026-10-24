import { updateScoreInputSchema } from '../../src/core/schemas/inputs.js';
import { deleteScore, updateScore } from '../../src/core/services/scores.js';
import { apiHandler, byMethod, idParam } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

// SCORE-1: edit or delete one score.
export function createScoreHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'scores/:id', auth: true },
    getDeps,
    byMethod({
      PATCH: async (input) => {
        const body = await readJson(input.request, updateScoreInputSchema);
        const score = await updateScore(input.deps.repo, input.deps.clock, idParam(input), body);
        return json({ score });
      },
      DELETE: async (input) => {
        await deleteScore(input.deps.repo, idParam(input));
        return json({ ok: true });
      },
    }),
  );
}
