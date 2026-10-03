import type { Config } from '@netlify/functions';

import { moveNodeInputSchema } from '../../src/core/schemas/inputs';
import { moveNode } from '../../src/core/services/structure';
import { apiHandler, idParam } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';

// TREE-6: move a node up or down among its siblings.
export function createNodeMoveHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'nodes/:id/move', auth: true }, getDeps, async (input) => {
    const body = await readJson(input.request, moveNodeInputSchema);
    await moveNode(input.deps.repo, idParam(input), body);
    return json({ ok: true });
  });
}

export default createNodeMoveHandler(serverDeps);

export const config: Config = {
  path: '/api/nodes/:id/move',
  method: 'POST',
};
