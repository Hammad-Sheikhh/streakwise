import { reviewMistakeInputSchema } from '../../src/core/schemas/inputs.js';
import { reviewMistake } from '../../src/core/services/mistakes.js';
import { apiHandler, idParam } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

// ERR-2: a review, right or wrong (SPEC §B9.13).
export function createMistakeReviewHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'mistakes/:id/review', auth: true }, getDeps, async (input) => {
    const body = await readJson(input.request, reviewMistakeInputSchema);
    const { repo, clock } = input.deps;
    return json({ mistake: await reviewMistake(repo, clock, idParam(input), body) });
  });
}
