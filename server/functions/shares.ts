import { createShareInputSchema } from '../../src/core/schemas/inputs';
import { createShare, listShares } from '../../src/core/services/shares';
import { apiHandler, byMethod } from './_lib/api';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';

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
