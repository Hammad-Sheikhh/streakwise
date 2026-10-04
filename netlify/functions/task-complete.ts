import type { Config } from '@netlify/functions';

import { completeTaskInputSchema } from '../../src/core/schemas/inputs';
import { completeTask } from '../../src/core/services/tasks';
import { apiHandler, idParam } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';

// TASK-4–6: complete a task for this period, with a score if it's scored (atomic).
export function createTaskCompleteHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'tasks/:id/complete', auth: true }, getDeps, async (input) => {
    const body = await readJson(input.request, completeTaskInputSchema);
    const { repo, clock, newId } = input.deps;
    const completion = await completeTask(repo, clock, newId, idParam(input), body);
    return json({ completion }, { status: 201 });
  });
}

export default createTaskCompleteHandler(serverDeps);

export const config: Config = {
  path: '/api/tasks/:id/complete',
  method: 'POST',
};
