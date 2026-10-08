import type { Config } from '@netlify/functions';

import { SLUG_PATTERN } from '../../src/core/logic/slug';
import { publicSnapshot } from '../../src/core/services/shares';
import { apiHandler } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { errorJson, json } from './_lib/http';

// SHARE-2, SHARE-4: the public read of a shared report (no login, AUTH-3). Unknown, expired, and
// revoked links all get the same answer, so the response never reveals which it was.

const NO_INDEX = { 'X-Robots-Tag': 'noindex, nofollow' };

export function createPublicShareHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'share/:slug', auth: false }, getDeps, async ({ params, deps }) => {
    const slug = params.slug ?? '';
    const share = SLUG_PATTERN.test(slug) ? await deps.shares.findBySlug(slug) : null;
    const report = publicSnapshot(share, deps.clock());
    if (!report) {
      return errorJson(404, 'share_unavailable', 'This report is no longer available.', NO_INDEX);
    }
    return json({ report }, { headers: NO_INDEX });
  });
}

export default createPublicShareHandler(serverDeps);

export const config: Config = {
  path: '/api/share/:slug',
  method: 'GET',
};
