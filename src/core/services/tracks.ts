import { notFound } from '../domain/errors.js';
import type { Clock, TrackOverview } from '../domain/types.js';
import { localDate, weekStart } from '../logic/dates.js';
import { minutesByNode } from '../logic/rollup.js';
import { subtreeIds } from '../logic/tree.js';
import type { Repository } from '../repo/Repository.js';

/** TRACK-1 shows the latest few sessions. */
export const TRACK_RECENT_SESSIONS = 10;

/**
 * TRACK-1: time this week and all time for the track and everything in it, plus its latest
 * sessions. Names, syllabus %, tasks, scores, and deadlines come from their own lists.
 */
export async function getTrackOverview(
  repo: Repository,
  clock: Clock,
  trackId: string,
): Promise<TrackOverview> {
  const nodes = await repo.listNodes();
  const track = nodes.find((n) => n.id === trackId);
  if (!track || track.depth !== 1) throw notFound('track_not_found');

  const today = localDate(clock());
  const ids = subtreeIds(nodes, trackId);
  const [facts, recentSessions] = await Promise.all([
    repo.listSessionFacts(),
    repo.listSessions({ nodeIds: ids, limit: TRACK_RECENT_SESSIONS }),
  ]);
  const total = minutesByNode(nodes, facts);
  const week = minutesByNode(nodes, facts, { from: weekStart(today), to: today });

  return {
    trackId,
    today,
    nodes: ids.map((nodeId) => ({
      nodeId,
      weekMinutes: week.get(nodeId) ?? 0,
      totalMinutes: total.get(nodeId) ?? 0,
    })),
    recentSessions,
  };
}
