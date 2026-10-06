import type { Config } from '@netlify/functions';

import { setTopicStatusInputSchema } from '../../src/core/schemas/inputs';
import { setTopicStatus } from '../../src/core/services/structure';
import { apiHandler, idParam } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';

// TOP-1: set a topic to not started, in progress, or done.
export function createNodeStatusHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'nodes/:id/status', auth: true }, getDeps, async (input) => {
    const body = await readJson(input.request, setTopicStatusInputSchema);
    const node = await setTopicStatus(input.deps.repo, input.deps.clock, idParam(input), body);
    return json({ node });
  });
}

export default createNodeStatusHandler(serverDeps);

export const config: Config = {
  path: '/api/nodes/:id/status',
  method: 'POST',
};
