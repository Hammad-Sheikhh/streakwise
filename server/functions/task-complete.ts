import {
  completeTaskInputSchema,
  uncompleteTaskQuerySchema,
} from '../../src/core/schemas/inputs.js';
import { completeTask, uncompleteTaskOn } from '../../src/core/services/tasks.js';
import { apiHandler, byMethod, idParam } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson, readQuery } from './_lib/http.js';

// POST: TASK-4–6, TASK-11: complete a task for the period of `completedOn` (default today), with a
// score if it's scored (atomic). DELETE: untick the period containing `?date=` (default today) and
// remove its score (atomic).
export function createTaskCompleteHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'tasks/:id/complete', auth: true },
    getDeps,
    byMethod({
      POST: async (input) => {
        const body = await readJson(input.request, completeTaskInputSchema);
        const { repo, clock, newId } = input.deps;
        const completion = await completeTask(repo, clock, newId, idParam(input), body);
        return json({ completion }, { status: 201 });
      },
      DELETE: async (input) => {
        const { date } = readQuery(input.request, uncompleteTaskQuerySchema);
        const { repo, clock } = input.deps;
        return json(await uncompleteTaskOn(repo, clock, idParam(input), date));
      },
    }),
  );
}
