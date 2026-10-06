import type { Config } from '@netlify/functions';

import { getTrackOverview } from '../../src/core/services/tracks';
import { apiHandler, idParam } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json } from './_lib/http';

// TRACK-1: one track's time (this week and all time, per node) and its latest sessions.
export function createTrackHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'tracks/:id', auth: true }, getDeps, async (input) =>
    json(await getTrackOverview(input.deps.repo, input.deps.clock, idParam(input))),
  );
}

export default createTrackHandler(serverDeps);

export const config: Config = {
  path: '/api/tracks/:id',
  method: 'GET',
};
