import type { Config } from '@netlify/functions';

import { reportQuerySchema } from '../../src/core/schemas/inputs';
import { buildReport } from '../../src/core/services/reports';
import { apiHandler } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';

// REP-1–9: builds a report for a period. POST, because the choice of period and notes is a body.
export function createReportsHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'reports', auth: true }, getDeps, async ({ request, deps }) => {
    const query = await readJson(request, reportQuerySchema);
    return json({ report: await buildReport(deps.repo, deps.clock, query) });
  });
}

export default createReportsHandler(serverDeps);

export const config: Config = {
  path: '/api/reports',
  method: 'POST',
};
