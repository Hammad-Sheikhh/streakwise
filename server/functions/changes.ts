import { listRecentChanges } from '../../src/core/services/changes.js';
import { apiHandler } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json } from './_lib/http.js';

// UNDO-4, UNDO-6: the changes from the last 7 days, newest first (made in the app or by Claude).
export function createChangesHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'changes', auth: true }, getDeps, async ({ deps }) =>
    json({ changes: await listRecentChanges(deps.repo, deps.clock) }),
  );
}
