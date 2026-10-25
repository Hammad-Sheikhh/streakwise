import { getTrackOverview } from '../../src/core/services/tracks.js';
import { apiHandler, idParam } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json } from './_lib/http.js';

// TRACK-1: one track's time (this week and all time, per node) and its latest sessions.
export function createTrackHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'tracks/:id', auth: true }, getDeps, async (input) =>
    json(await getTrackOverview(input.deps.repo, input.deps.clock, idParam(input))),
  );
}
