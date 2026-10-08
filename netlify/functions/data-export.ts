import type { Config } from '@netlify/functions';

import { exportData } from '../../src/core/services/exports';
import { apiHandler } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json } from './_lib/http';

// SET-2: all of the user's data as JSON; the browser makes the files (JSON, and sessions as CSV).
// POST, because every export records its time (SET-3).
export function createExportHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'export', auth: true }, getDeps, async ({ deps }) =>
    json(await exportData(deps.repo, deps.clock)),
  );
}

export default createExportHandler(serverDeps);

export const config: Config = {
  path: '/api/export',
  method: 'POST',
};
