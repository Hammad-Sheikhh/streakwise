import { invalid, notFound } from '../domain/errors';
import type {
  Clock,
  HistoryDay,
  HistoryPage,
  IdGenerator,
  Session,
  SessionSource,
  TreeNode,
} from '../domain/types';
import { addDays, localDate } from '../logic/dates';
import { hiddenIds, subtreeIds } from '../logic/tree';
import type { Repository, SessionFilter, SessionPatch } from '../repo/Repository';
import {
  historyQuerySchema,
  listSessionsQuerySchema,
  logSessionInputSchema,
  updateSessionInputSchema,
} from '../schemas/inputs';
import type {
  HistoryQuery,
  ListSessionsQuery,
  LogSessionInput,
  UpdateSessionInput,
} from '../schemas/inputs';
import { parseInput } from '../schemas/parse';

// LOG and HIST: logging, editing, and listing study sessions.

/** History loads this many days at a time (HIST-1). */
export const HISTORY_PAGE_DAYS = 30;
/** LOG-7: how many recently used nodes to offer as shortcuts. */
export const RECENT_NODE_LIMIT = 5;
/** LOG-10: a day above this many minutes gets a soft warning. */
export const DAY_WARNING_MINUTES = 16 * 60;

/** The node must exist and not be archived (B3.2); dates can't be in the future (LOG-3). */
async function checkTarget(
  repo: Repository,
  clock: Clock,
  nodeId: string,
  studiedOn: string,
): Promise<TreeNode> {
  const nodes = await repo.listNodes();
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) throw notFound('node_not_found');
  if (hiddenIds(nodes).has(nodeId)) {
    throw invalid('node_archived', 'That item is archived. Restore it to log time on it.');
  }
  if (studiedOn > localDate(clock())) {
    throw invalid('future_date', 'You can’t log time in the future.');
  }
  return node;
}

/** LOG-6: studying a topic that hasn't been started marks it as in progress. */
async function startTopic(repo: Repository, node: TreeNode): Promise<void> {
  if (node.depth === 3 && node.topicStatus === 'not_started') {
    await repo.updateNode(node.id, { topicStatus: 'in_progress' });
  }
}

export async function logSession(
  repo: Repository,
  clock: Clock,
  newId: IdGenerator,
  rawInput: LogSessionInput,
  source: SessionSource = 'app',
): Promise<Session> {
  const input = parseInput(logSessionInputSchema, rawInput);
  const node = await checkTarget(repo, clock, input.nodeId, input.studiedOn);
  const session = await repo.insertSession({ id: newId(), ...input, source });
  await startTopic(repo, node);
  return session;
}

/** HIST-2: any field can change. A session may stay on its node even if that was archived. */
export async function updateSession(
  repo: Repository,
  clock: Clock,
  id: string,
  rawInput: UpdateSessionInput,
): Promise<Session> {
  const input = parseInput(updateSessionInputSchema, rawInput);
  const existing = await repo.getSession(id);
  if (!existing) throw notFound('session_not_found');

  const nodeId = input.nodeId ?? existing.nodeId;
  const studiedOn = input.studiedOn ?? existing.studiedOn;
  let movedTo: TreeNode | undefined;
  if (nodeId !== existing.nodeId) {
    movedTo = await checkTarget(repo, clock, nodeId, studiedOn);
  } else if (studiedOn > localDate(clock())) {
    throw invalid('future_date', 'You can’t log time in the future.');
  }

  const patch: SessionPatch = {};
  if (input.nodeId !== undefined) patch.nodeId = input.nodeId;
  if (input.studiedOn !== undefined) patch.studiedOn = input.studiedOn;
  if (input.minutes !== undefined) patch.minutes = input.minutes;
  if (input.note !== undefined) patch.note = input.note;

  const session = await repo.updateSession(id, patch);
  if (movedTo) await startTopic(repo, movedTo);
  return session;
}

export async function deleteSession(repo: Repository, id: string): Promise<void> {
  await repo.deleteSession(id);
}

function groupByDay(sessions: readonly Session[]): HistoryDay[] {
  const days: HistoryDay[] = [];
  for (const session of sessions) {
    let day = days.at(-1);
    if (day?.date !== session.studiedOn) {
      day = { date: session.studiedOn, totalMinutes: 0, sessions: [] };
      days.push(day);
    }
    day.sessions.push(session);
    day.totalMinutes += session.minutes;
  }
  return days;
}

/**
 * HIST-1/HIST-3: up to 30 days ending at `to` (default today), newest first, grouped by day.
 * `nextTo` jumps straight to the next older day with sessions, so empty stretches aren't paged.
 */
export async function getHistory(
  repo: Repository,
  clock: Clock,
  rawQuery: HistoryQuery = {},
): Promise<HistoryPage> {
  const query = parseInput(historyQuerySchema, rawQuery);
  const to = query.to ?? localDate(clock());
  const windowStart = addDays(to, -(HISTORY_PAGE_DAYS - 1));
  const start = query.from && query.from > windowStart ? query.from : windowStart;

  const filter: SessionFilter = { source: query.source };
  if (query.nodeId) filter.nodeIds = subtreeIds(await repo.listNodes(), query.nodeId);

  if (start > to) return { days: [], nextTo: null };
  const sessions = await repo.listSessions({ ...filter, from: start, to });
  const nextTo = await repo.latestSessionDate({
    ...filter,
    from: query.from,
    to: addDays(start, -1),
  });
  return { days: groupByDay(sessions), nextTo };
}

/** Newest first, capped at `limit`; `truncated` says whether more sessions matched (MCP-4). */
export async function listSessions(
  repo: Repository,
  rawQuery: ListSessionsQuery = {},
): Promise<{ sessions: Session[]; truncated: boolean }> {
  const { nodeId, limit, ...rest } = parseInput(listSessionsQuerySchema, rawQuery);
  const filter: SessionFilter = { ...rest, limit: limit + 1 };
  if (nodeId) filter.nodeIds = subtreeIds(await repo.listNodes(), nodeId);
  const sessions = await repo.listSessions(filter);
  return { sessions: sessions.slice(0, limit), truncated: sessions.length > limit };
}

/** LOG-7: the most recently used visible nodes, from recent sessions so it works on any device. */
export async function recentNodeIds(repo: Repository): Promise<string[]> {
  const [sessions, nodes] = await Promise.all([repo.listRecentSessions(50), repo.listNodes()]);
  const hidden = hiddenIds(nodes);
  const ids: string[] = [];
  for (const { nodeId } of sessions) {
    if (!ids.includes(nodeId) && !hidden.has(nodeId)) ids.push(nodeId);
    if (ids.length === RECENT_NODE_LIMIT) break;
  }
  return ids;
}
