import { undoChange } from '../../src/core/services/changes.js';
import { apiHandler, idParam } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json } from './_lib/http.js';

// UNDO-5, UNDO-6: undo one change. 409 `changed_since` when a later change to the same item
// stands, 409 `cannot_undo` when it can't be put back.
export function createChangeUndoHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'changes/:id/undo', auth: true }, getDeps, async (input) =>
    json({ change: await undoChange(input.deps.repo, input.deps.clock, idParam(input)) }),
  );
}
