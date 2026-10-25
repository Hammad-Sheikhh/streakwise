import { updateTaskInputSchema } from '../../src/core/schemas/inputs.js';
import { deleteTask, updateTask } from '../../src/core/services/tasks.js';
import { apiHandler, byMethod, idParam } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

// TASK-8: edit, archive, restore, or delete one task (deleting removes its sub-tasks too).
export function createTaskHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'tasks/:id', auth: true },
    getDeps,
    byMethod({
      PATCH: async (input) => {
        const body = await readJson(input.request, updateTaskInputSchema);
        const task = await updateTask(input.deps.repo, input.deps.clock, idParam(input), body);
        return json({ task });
      },
      DELETE: async (input) => {
        await deleteTask(input.deps.repo, idParam(input));
        return json({ ok: true });
      },
    }),
  );
}
