import { moveNodeInputSchema } from '../../src/core/schemas/inputs.js';
import { moveNode } from '../../src/core/services/structure.js';
import { apiHandler, idParam } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

// TREE-6: move a node up or down among its siblings.
export function createNodeMoveHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'nodes/:id/move', auth: true }, getDeps, async (input) => {
    const body = await readJson(input.request, moveNodeInputSchema);
    await moveNode(input.deps.repo, idParam(input), body);
    return json({ ok: true });
  });
}
