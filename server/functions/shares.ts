import { createShareInputSchema } from '../../src/core/schemas/inputs.js';
import { createShare, listShares } from '../../src/core/services/shares.js';
import { apiHandler, byMethod } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

// SHARE-1, SHARE-3: create a share link, and list the user's links.
export function createSharesHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'shares', auth: true },
    getDeps,
    byMethod({
      GET: async ({ deps }) => json({ shares: await listShares(deps.repo) }),
      POST: async ({ request, deps }) => {
        const input = await readJson(request, createShareInputSchema);
        const share = await createShare(deps.repo, deps.clock, deps, input);
        return json({ share }, { status: 201 });
      },
    }),
  );
}
