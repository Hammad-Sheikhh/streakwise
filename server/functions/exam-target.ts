import { updateExamTargetInputSchema } from '../../src/core/schemas/inputs.js';
import { deleteExamTarget, updateExamTarget } from '../../src/core/services/exams.js';
import { apiHandler, byMethod, idParam } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

// EXAM-3: edit or delete one exam target.
export function createExamTargetHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'exam-targets/:id', auth: true },
    getDeps,
    byMethod({
      PATCH: async (input) => {
        const body = await readJson(input.request, updateExamTargetInputSchema);
        return json({ target: await updateExamTarget(input.deps.repo, idParam(input), body) });
      },
      DELETE: async (input) => {
        await deleteExamTarget(input.deps.repo, idParam(input));
        return json({ ok: true });
      },
    }),
  );
}
