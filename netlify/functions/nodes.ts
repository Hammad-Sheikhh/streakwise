import type { Config } from '@netlify/functions';

import { createNodeInputSchema } from '../../src/core/schemas/inputs';
import { addNode, listTree } from '../../src/core/services/structure';
import { apiHandler, byMethod } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';

// GET: the structure tree in display order. POST: add a track, subtask, or topic (TREE-1).
export function createNodesHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'nodes', auth: true },
    getDeps,
    byMethod({
      GET: async ({ deps }) => json({ nodes: await listTree(deps.repo) }),
      POST: async ({ request, deps }) => {
        const input = await readJson(request, createNodeInputSchema);
        return json({ node: await addNode(deps.repo, deps.newId, input) }, { status: 201 });
      },
    }),
  );
}

export default createNodesHandler(serverDeps);

export const config: Config = {
  path: '/api/nodes',
  method: ['GET', 'POST'],
};
