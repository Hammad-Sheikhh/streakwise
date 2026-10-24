import { getDashboard } from '../../src/core/services/dashboard.js';
import { apiHandler } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json } from './_lib/http.js';

// DASH-1: everything Home needs in one request.
export function createDashboardHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'dashboard', auth: true }, getDeps, async ({ deps }) =>
    json(await getDashboard(deps.repo, deps.clock)),
  );
}
