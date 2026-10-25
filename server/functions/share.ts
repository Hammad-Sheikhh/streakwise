import { revokeShare } from '../../src/core/services/shares.js';
import { apiHandler, idParam } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json } from './_lib/http.js';

// SHARE-3: revoke one link. It stays in the list, marked revoked.
export function createShareHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'shares/:id', auth: true }, getDeps, async (input) =>
    json({ share: await revokeShare(input.deps.repo, input.deps.clock, idParam(input)) }),
  );
}
