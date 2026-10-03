import type { Config } from '@netlify/functions';

import { updateNodeInputSchema } from '../../src/core/schemas/inputs';
import { deleteNode, updateNode } from '../../src/core/services/structure';
import { apiHandler, byMethod, idParam } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';

// PATCH: rename, recolor, archive, or restore (TREE-1, 2, 5). DELETE: delete a subtree (TREE-3).
export function createNodeHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'nodes/:id', auth: true },
    getDeps,
    byMethod({
      PATCH: async (input) => {
        const body = await readJson(input.request, updateNodeInputSchema);
        const { repo, clock } = input.deps;
        return json({ node: await updateNode(repo, clock, idParam(input), body) });
      },
      DELETE: async (input) => {
        await deleteNode(input.deps.repo, idParam(input));
        return json({ ok: true });
      },
    }),
  );
}

export default createNodeHandler(serverDeps);

export const config: Config = {
  path: '/api/nodes/:id',
  method: ['PATCH', 'DELETE'],
};
