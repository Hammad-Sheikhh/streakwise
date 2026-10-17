import { ipAddress } from '@vercel/functions';

import { createDispatcher } from '../server/functions/_lib/router';
import { serverDeps } from '../server/functions/_lib/deps';

// The only function Vercel deploys (see the rewrites in vercel.json): every /api, /auth, /mcp and
// /.well-known request is rewritten here and dispatched to the per-route handlers (OPS-4). Vercel
// Functions use the web Request/Response API, so the handlers work unchanged. The dispatcher holds
// no per-request state; the deps inside it are built once and reused while the instance is warm.
const dispatch = createDispatcher(serverDeps);

export default {
  async fetch(request: Request) {
    return dispatch(request, ipAddress(request) ?? 'unknown');
  },
};
