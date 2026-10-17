import { getDashboard } from '../../src/core/services/dashboard';
import { apiHandler } from './_lib/api';
import type { ServerDeps } from './_lib/deps';
import { json } from './_lib/http';

// DASH-1: everything Home needs in one request.
export function createDashboardHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'dashboard', auth: true }, getDeps, async ({ deps }) =>
    json(await getDashboard(deps.repo, deps.clock)),
  );
}
