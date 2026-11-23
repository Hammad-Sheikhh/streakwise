import { createExamTargetInputSchema } from '../../src/core/schemas/inputs.js';
import { addExamTarget } from '../../src/core/services/exams.js';
import { apiHandler, idParam } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

// EXAM-3: add a score target to an exam deadline.
export function createExamTargetsHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'deadlines/:id/targets', auth: true }, getDeps, async (input) => {
    const body = await readJson(input.request, createExamTargetInputSchema);
    const { repo, newId } = input.deps;
    const target = await addExamTarget(repo, newId, idParam(input), body);
    return json({ target }, { status: 201 });
  });
}
