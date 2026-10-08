import type { Config } from '@netlify/functions';

import { revokeShare } from '../../src/core/services/shares';
import { apiHandler, idParam } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json } from './_lib/http';

// SHARE-3: revoke one link. It stays in the list, marked revoked.
export function createShareHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'shares/:id', auth: true }, getDeps, async (input) =>
    json({ share: await revokeShare(input.deps.repo, input.deps.clock, idParam(input)) }),
  );
}

export default createShareHandler(serverDeps);

export const config: Config = {
  path: '/api/shares/:id',
  method: 'DELETE',
};
