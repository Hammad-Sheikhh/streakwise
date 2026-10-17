import { recentNodeIds } from '../../src/core/services/sessions';
import { apiHandler } from './_lib/api';
import type { ServerDeps } from './_lib/deps';
import { json } from './_lib/http';

// LOG-7: the most recently used nodes, for one-tap shortcuts on the Log screen.
export function createRecentNodesHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'recent-nodes', auth: true }, getDeps, async ({ deps }) =>
    json({ nodeIds: await recentNodeIds(deps.repo) }),
  );
}
