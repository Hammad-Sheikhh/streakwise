import { McpServer } from '@modelcontextprotocol/server';
import type { CallToolResult } from '@modelcontextprotocol/server';

import { DomainError, notFound } from '../../../../src/core/domain/errors';
import type { Session, TreeNode } from '../../../../src/core/domain/types';
import { localDate } from '../../../../src/core/logic/dates';
import { resolveDateRef } from '../../../../src/core/logic/dateRef';
import { resolveNodeRef } from '../../../../src/core/logic/nodeRef';
import { hiddenIds, nodePath } from '../../../../src/core/logic/tree';
import {
  addNodeToolSchema,
  deleteSessionToolSchema,
  findGapsToolSchema,
  getProgressToolSchema,
  getStructureToolSchema,
  listDeadlinesToolSchema,
  listSessionsToolSchema,
  logSessionToolSchema,
} from '../../../../src/core/schemas/mcp';
import { upcomingDeadlines } from '../../../../src/core/services/deadlines';
import { findGaps, getProgress } from '../../../../src/core/services/insights';
import { deleteSession, listSessions, logSession } from '../../../../src/core/services/sessions';
import { addNode, listTree } from '../../../../src/core/services/structure';
import type { ServerDeps } from '../deps';
import { describeError, log } from '../log';

// MCP-2–9: the Claude connection. A fresh server is built for every request (stateless), and every
// tool is a thin wrapper around the core services that returns compact JSON text.

export const MCP_SERVER_NAME = 'streakwise';
export const MCP_SERVER_VERSION = '1.0.0';

// MCP-3.
export const MCP_INSTRUCTIONS = `Streakwise is one student's personal study tracker.

Structure: a tree of up to 3 levels. Tracks (level 1, e.g. "Improvement Exams") contain subtasks
(level 2, e.g. "Maths"), which may contain topics (level 3, e.g. "Chapter 3"). Topics have a status:
not_started, in_progress, or done. Archived nodes are hidden from the app and can't take new time.
Refer to a node by its id or by a path such as "Improvement Exams > Maths > Chapter 3"
(case-insensitive); the end of a path or a unique partial name like "maths" also works. If a
reference is ambiguous or unknown, the error lists the closest matches: pick one and retry.

Sessions record study time on any node. Durations are always whole minutes (1.5 hours = 90).
Time rolls up: a session on a topic also counts for its subtask and track. Logging time on a
not-started topic marks it in progress. Sessions you log are marked as coming from Claude.

Dates are calendar days in Asia/Karachi (UTC+5). Weeks run Monday to Sunday. Dates accept "today",
"yesterday", or YYYY-MM-DD. Tracks can have a weekly target in minutes. A day counts toward the
streak when it has at least one session.

Tasks (to-dos, including weekly ones) and scores (past papers, quizzes, revision tests) are part
of the app but not yet available through this connection.

Lists return at most 50 items by default (up to 200 with "limit") and say "truncated": true when
more exist. Confirm with the student before deleting anything.`;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

function result(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function failure(code: string, message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: { code, message } }) }],
    isError: true,
  };
}

function cap<T>(items: readonly T[], limit: number): { items: T[]; truncated: boolean } {
  return { items: items.slice(0, limit), truncated: items.length > limit };
}

const KIND = { 1: 'track', 2: 'subtask', 3: 'topic' } as const;

const pathOf = (nodes: readonly TreeNode[], id: string) => nodePath(nodes, id).join(' > ');

function sessionView(nodes: readonly TreeNode[], session: Session) {
  return {
    id: session.id,
    date: session.studiedOn,
    minutes: session.minutes,
    nodeId: session.nodeId,
    path: pathOf(nodes, session.nodeId),
    note: session.note,
    source: session.source,
  };
}

interface StructureItem {
  id: string;
  name: string;
  kind: (typeof KIND)[keyof typeof KIND];
  archived?: true;
  weeklyTargetMinutes?: number;
  status?: string;
  children?: StructureItem[];
}

function structure(nodes: readonly TreeNode[], includeArchived: boolean): StructureItem[] {
  const hidden = hiddenIds(nodes);
  const build = (parentId: string | null): StructureItem[] =>
    nodes
      .filter((n) => n.parentId === parentId && (includeArchived || !hidden.has(n.id)))
      .map((n) => {
        const item: StructureItem = { id: n.id, name: n.name, kind: KIND[n.depth] };
        if (n.archivedAt) item.archived = true;
        if (n.weeklyTargetMinutes) item.weeklyTargetMinutes = n.weeklyTargetMinutes;
        if (n.topicStatus) item.status = n.topicStatus;
        const children = build(n.id);
        if (children.length > 0) item.children = children;
        return item;
      });
  return build(null);
}

/** Builds the server for one request. Each tool call also stamps the "last MCP call" time. */
export function buildMcpServer(deps: ServerDeps): McpServer {
  const { repo, clock, newId } = deps;
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { instructions: MCP_INSTRUCTIONS },
  );

  const run = async (tool: string, work: () => Promise<unknown>): Promise<CallToolResult> => {
    const started = Date.now();
    let outcome: CallToolResult;
    try {
      outcome = result(await work());
    } catch (error) {
      if (error instanceof DomainError) {
        outcome = failure(error.code, error.message);
      } else {
        log.error('mcp_tool_failed', { tool, ...describeError(error) });
        outcome = failure('internal', 'Something went wrong. Please try again.');
      }
    }
    try {
      await repo.recordMcpCall(clock().toISOString());
    } catch (error) {
      log.warn('mcp_record_call_failed', describeError(error));
    }
    log.info('mcp_tool', { tool, ok: !outcome.isError, ms: Date.now() - started });
    return outcome;
  };

  server.registerTool(
    'get_structure',
    {
      title: 'Get structure',
      description:
        'Returns the study tree (tracks > subtasks > topics) with ids, kinds, weekly targets ' +
        '(minutes, tracks only), and topic statuses. Call this first to learn the names and ids ' +
        'to use in other tools.',
      inputSchema: getStructureToolSchema,
      annotations: READ_ONLY,
    },
    ({ include_archived }) =>
      run('get_structure', async () => ({
        tracks: structure(await listTree(repo), include_archived),
      })),
  );

  server.registerTool(
    'log_session',
    {
      title: 'Log a study session',
      description:
        'Records study time on a node (track, subtask, or topic). Use whole minutes. The date ' +
        'defaults to today and can’t be in the future. Returns the saved session with its id.',
      inputSchema: logSessionToolSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    ({ node, minutes, date, note }) =>
      run('log_session', async () => {
        const nodes = await repo.listNodes();
        const target = resolveNodeRef(nodes, node);
        const studiedOn = resolveDateRef(date, localDate(clock()));
        const session = await logSession(
          repo,
          clock,
          newId,
          { nodeId: target.id, studiedOn, minutes, note: note ?? null },
          'claude',
        );
        return { session: sessionView(nodes, session) };
      }),
  );

  server.registerTool(
    'list_sessions',
    {
      title: 'List study sessions',
      description:
        'Lists sessions newest first, optionally for one node (including everything under it), ' +
        'a date range, and a source ("app" or "claude"). Minutes are whole minutes.',
      inputSchema: listSessionsToolSchema,
      annotations: READ_ONLY,
    },
    ({ node, from, to, source, limit }) =>
      run('list_sessions', async () => {
        const nodes = await repo.listNodes();
        const today = localDate(clock());
        const page = await listSessions(repo, {
          nodeId: node === undefined ? undefined : resolveNodeRef(nodes, node).id,
          from: from === undefined ? undefined : resolveDateRef(from, today),
          to: to === undefined ? undefined : resolveDateRef(to, today),
          source,
          limit,
        });
        return {
          sessions: page.sessions.map((s) => sessionView(nodes, s)),
          truncated: page.truncated,
        };
      }),
  );

  server.registerTool(
    'delete_session',
    {
      title: 'Delete a study session',
      description:
        'Permanently deletes one session by id (from list_sessions or log_session). This can’t ' +
        'be undone, so confirm with the student first. Returns the deleted session.',
      inputSchema: deleteSessionToolSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ session_id }) =>
      run('delete_session', async () => {
        const session = await repo.getSession(session_id);
        if (!session) throw notFound('session_not_found');
        await deleteSession(repo, session_id);
        return { deleted: sessionView(await repo.listNodes(), session) };
      }),
  );

  server.registerTool(
    'get_progress',
    {
      title: 'Get progress',
      description:
        'This week’s minutes per track and subtask against weekly targets (with a behind-pace ' +
        'flag), today’s minutes, the current and longest streak in days, syllabus % (done ' +
        'topics ÷ topics; null when a node has no topics), and upcoming deadlines with days left.',
      inputSchema: getProgressToolSchema,
      annotations: READ_ONLY,
    },
    () => run('get_progress', () => getProgress(repo, clock)),
  );

  server.registerTool(
    'find_gaps',
    {
      title: 'Find gaps',
      description:
        'What needs attention: tracks and subtasks not studied for at least the neglect ' +
        'threshold (in days), tracks behind pace on their weekly target, and topics not ' +
        'started yet. "truncated" is true when any list was cut to the limit.',
      inputSchema: findGapsToolSchema,
      annotations: READ_ONLY,
    },
    ({ limit }) =>
      run('find_gaps', async () => {
        const gaps = await findGaps(repo, clock);
        const neglected = cap(gaps.neglected, limit);
        const behindPace = cap(gaps.behindPace, limit);
        const topics = cap(gaps.topicsNotStarted, limit);
        return {
          ...gaps,
          neglected: neglected.items,
          behindPace: behindPace.items,
          topicsNotStarted: topics.items,
          truncated: neglected.truncated || behindPace.truncated || topics.truncated,
        };
      }),
  );

  server.registerTool(
    'add_node',
    {
      title: 'Add a subtask or topic',
      description:
        'Creates a subtask under a track, or a topic under a subtask. Names must be unique ' +
        'among siblings. New topics start as not_started. Returns the new node with its id.',
      inputSchema: addNodeToolSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    ({ parent, name }) =>
      run('add_node', async () => {
        const nodes = await repo.listNodes();
        const parentNode = resolveNodeRef(nodes, parent);
        const created = await addNode(repo, newId, { parentId: parentNode.id, name });
        return {
          node: {
            id: created.id,
            name: created.name,
            kind: KIND[created.depth],
            path: [...nodePath(nodes, parentNode.id), created.name].join(' > '),
            status: created.topicStatus ?? undefined,
          },
        };
      }),
  );

  server.registerTool(
    'list_deadlines',
    {
      title: 'List deadlines',
      description:
        'Deadlines (exams, submissions) by due date, with days left and the share of the ' +
        'node’s syllabus not yet done (null when it has no topics). Upcoming only by default.',
      inputSchema: listDeadlinesToolSchema,
      annotations: READ_ONLY,
    },
    ({ include_past, limit }) =>
      run('list_deadlines', async () => {
        const [nodes, deadlines] = await Promise.all([
          repo.listNodes(),
          upcomingDeadlines(repo, clock, { includePast: include_past }),
        ]);
        const page = cap(deadlines, limit);
        return {
          today: localDate(clock()),
          deadlines: page.items.map((d) => ({
            id: d.id,
            title: d.title,
            dueOn: d.dueOn,
            daysLeft: d.daysLeft,
            nodeId: d.nodeId,
            path: pathOf(nodes, d.nodeId),
            syllabusLeftPercent: d.syllabusLeftPercent,
          })),
          truncated: page.truncated,
        };
      }),
  );

  return server;
}
