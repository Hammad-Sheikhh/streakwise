import { updateNodeInputSchema } from '../../src/core/schemas/inputs.js';
import { deleteNode, updateNode } from '../../src/core/services/structure.js';
import { apiHandler, byMethod, idParam } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

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
