import { apiHandler } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json } from './_lib/http.js';

// OPS-2: called every 3 days by a GitHub Actions workflow so the free Supabase project isn't paused.
export function createKeepaliveHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'keepalive', auth: false }, getDeps, async ({ deps }) => {
    await deps.accounts.ping();
    return json({ ok: true });
  });
}
