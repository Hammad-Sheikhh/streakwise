import { uncompleteTask } from '../../src/core/services/tasks';
import { apiHandler, idParam } from './_lib/api';
import type { ServerDeps } from './_lib/deps';
import { json } from './_lib/http';

// TASK-6: uncomplete a task by deleting its completion and any linked score (atomic).
export function createCompletionHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'completions/:id', auth: true }, getDeps, async (input) => {
    await uncompleteTask(input.deps.repo, idParam(input));
    return json({ ok: true });
  });
}
