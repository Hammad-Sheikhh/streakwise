import type { Config } from '@netlify/functions';

import { updateScoreInputSchema } from '../../src/core/schemas/inputs';
import { deleteScore, updateScore } from '../../src/core/services/scores';
import { apiHandler, byMethod, idParam } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';

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

export default createScoreHandler(serverDeps);

export const config: Config = {
  path: '/api/scores/:id',
  method: ['PATCH', 'DELETE'],
};
