import { reportQuerySchema } from '../../src/core/schemas/inputs.js';
import { buildReport } from '../../src/core/services/reports.js';
import { apiHandler } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';

// REP-1–9: builds a report for a period. POST, because the choice of period and notes is a body.
export function createReportsHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'reports', auth: true }, getDeps, async ({ request, deps }) => {
    const query = await readJson(request, reportQuerySchema);
    return json({ report: await buildReport(deps.repo, deps.clock, query) });
  });
}
