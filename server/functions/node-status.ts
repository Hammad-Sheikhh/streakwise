import { setTopicStatusInputSchema } from '../../src/core/schemas/inputs.js';
import { setTopicStatus } from '../../src/core/services/structure.js';
import { apiHandler, idParam } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

// TOP-1: set a topic to not started, in progress, or done.
export function createNodeStatusHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'nodes/:id/status', auth: true }, getDeps, async (input) => {
    const body = await readJson(input.request, setTopicStatusInputSchema);
    const node = await setTopicStatus(input.deps.repo, input.deps.clock, idParam(input), body);
    return json({ node });
  });
}
