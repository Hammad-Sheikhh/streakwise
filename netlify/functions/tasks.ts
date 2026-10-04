import type { Config } from '@netlify/functions';

import { createTaskInputSchema } from '../../src/core/schemas/inputs';
import { createTask, listTaskItems } from '../../src/core/services/tasks';
import { apiHandler, byMethod } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';

// TASK-1, TASK-2: list tasks with their state as of today, and create tasks or sub-tasks.
export function createTasksHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'tasks', auth: true },
    getDeps,
    byMethod({
      GET: async ({ request, deps }) => {
        const includeArchived = new URL(request.url).searchParams.get('archived') === 'true';
        return json({ items: await listTaskItems(deps.repo, deps.clock, { includeArchived }) });
      },
      POST: async ({ request, deps }) => {
        const input = await readJson(request, createTaskInputSchema);
        return json({ task: await createTask(deps.repo, deps.newId, input) }, { status: 201 });
      },
    }),
  );
}

export default createTasksHandler(serverDeps);

export const config: Config = {
  path: '/api/tasks',
  method: ['GET', 'POST'],
};
