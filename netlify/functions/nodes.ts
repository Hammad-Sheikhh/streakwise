import type { Config } from '@netlify/functions';

import { listTree } from '../../src/core/services/structure';
import { apiHandler } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json } from './_lib/http';

// The structure tree, in display order. Editing arrives in M2 (TREE-1–7).
export function createNodesHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'nodes', auth: true }, getDeps, async ({ deps }) =>
    json({ nodes: await listTree(deps.repo) }),
  );
}

export default createNodesHandler(serverDeps);

export const config: Config = {
  path: '/api/nodes',
  method: 'GET',
};
