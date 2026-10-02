import type { Config } from '@netlify/functions';

import { apiHandler } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json } from './_lib/http';

// OPS-2: called every 3 days by a GitHub Actions workflow so the free Supabase project isn't paused.
export function createKeepaliveHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'keepalive', auth: false }, getDeps, async ({ deps }) => {
    await deps.ping();
    return json({ ok: true });
  });
}

export default createKeepaliveHandler(serverDeps);

export const config: Config = {
  path: '/api/keepalive',
  method: 'GET',
};
