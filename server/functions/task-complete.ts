import { completeTaskInputSchema } from '../../src/core/schemas/inputs.js';
import { completeTask } from '../../src/core/services/tasks.js';
import { apiHandler, idParam } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

// TASK-4–6: complete a task for this period, with a score if it's scored (atomic).
export function createTaskCompleteHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'tasks/:id/complete', auth: true }, getDeps, async (input) => {
    const body = await readJson(input.request, completeTaskInputSchema);
    const { repo, clock, newId } = input.deps;
    const completion = await completeTask(repo, clock, newId, idParam(input), body);
    return json({ completion }, { status: 201 });
  });
}
