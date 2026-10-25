import { createScoreInputSchema } from '../../src/core/schemas/inputs.js';
import { addScore, listScores } from '../../src/core/services/scores.js';
import { apiHandler, byMethod } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

// SCORE-1, SCORE-3: list scores (newest first) and record one.
export function createScoresHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'scores', auth: true },
    getDeps,
    byMethod({
      GET: async ({ deps }) => json({ scores: await listScores(deps.repo) }),
      POST: async ({ request, deps }) => {
        const input = await readJson(request, createScoreInputSchema);
        const score = await addScore(deps.repo, deps.clock, deps.newId, input);
        return json({ score }, { status: 201 });
      },
    }),
  );
}
