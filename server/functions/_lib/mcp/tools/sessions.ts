import { DomainError, notFound } from '../../../../../src/core/domain/errors.js';
import type { LogSessionInput } from '../../../../../src/core/schemas/inputs.js';
import {
  deleteSessionToolSchema,
  getLatestNoteToolSchema,
  listSessionsToolSchema,
  logSessionsToolSchema,
  logSessionToolSchema,
  updateSessionToolSchema,
} from '../../../../../src/core/schemas/mcp.js';
import {
  deleteSession,
  latestNoteWithPrefix,
  listSessions,
  logSession,
  logSessions,
  updateSession,
} from '../../../../../src/core/services/sessions.js';
import { DELETE, READ_ONLY, WRITE } from '../tool.js';
import type { ToolContext } from '../tool.js';
import { compactSessionView, pathOf, sessionView } from '../views.js';

// Study sessions: log one or a batch, list (compact or full), find the latest "Day N" note,
// edit, and delete (MCP-9, MCP-16–18, MCP-20).

/** MCP-20: a batch error names the failing item, 0-based, and says nothing was saved. */
function forItem<T>(index: number, work: () => T): T {
  try {
    return work();
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    throw new DomainError(
      error.kind,
      error.code,
      `Session ${index + 1} (index ${index}): ${error.message} Nothing was saved.`,
      { index },
    );
  }
}

export function registerSessionTools(ctx: ToolContext): void {
  const { server, run } = ctx;
  const { repo, clock, newId } = ctx.deps;

  server.registerTool(
    'log_session',
    {
      title: 'Log a study session',
      description:
        'Records study time on a node (track, subtask, or topic). Use whole minutes. The date ' +
        'defaults to today and can’t be in the future. Returns the saved session with its id.',
      inputSchema: logSessionToolSchema,
      annotations: WRITE,
    },
    ({ node, minutes, date, note }) =>
      run('log_session', async () => {
        const nodes = await repo.listNodes();
        const target = ctx.node(nodes, node);
        const session = await logSession(
          repo,
          clock,
          newId,
          { nodeId: target.id, studiedOn: ctx.date(date), minutes, note: note ?? null },
          'claude',
        );
        return { session: sessionView(nodes, session) };
      }),
  );

  server.registerTool(
    'log_sessions',
    {
      title: 'Log several study sessions',
      description:
        'Records 1–10 sessions in one call, each with the log_session fields (node, minutes, ' +
        'date, note). Every item is checked first: if any is invalid, nothing is saved and the ' +
        'error gives its index (0-based). Returns all saved sessions in order.',
      inputSchema: logSessionsToolSchema,
      annotations: WRITE,
    },
    ({ sessions }) =>
      run('log_sessions', async () => {
        const nodes = await repo.listNodes();
        const inputs: LogSessionInput[] = sessions.map((item, index) =>
          forItem(index, () => ({
            nodeId: ctx.node(nodes, item.node).id,
            studiedOn: ctx.date(item.date),
            minutes: item.minutes,
            note: item.note ?? null,
          })),
        );
        const saved = await logSessions(repo, clock, newId, inputs, 'claude');
        return { sessions: saved.map((s) => sessionView(nodes, s)) };
      }),
  );

  server.registerTool(
    'list_sessions',
    {
      title: 'List study sessions',
      description:
        'Lists sessions newest first, optionally for one node (including everything under it), ' +
        'a date range, a source ("app" or "claude"), and text in the note. Minutes are whole ' +
        'minutes. compact: true gives a much smaller answer.',
      inputSchema: listSessionsToolSchema,
      annotations: READ_ONLY,
    },
    ({ node, from, to, source, note_contains, compact, limit }) =>
      run('list_sessions', async () => {
        const nodes = await repo.listNodes();
        const page = await listSessions(repo, {
          nodeId: node === undefined ? undefined : ctx.node(nodes, node).id,
          from: ctx.optionalDate(from),
          to: ctx.optionalDate(to),
          source,
          noteContains: note_contains,
          limit,
        });
        const view = compact ? compactSessionView : sessionView;
        return { sessions: page.sessions.map((s) => view(nodes, s)), truncated: page.truncated };
      }),
  );

  server.registerTool(
    'get_latest_note',
    {
      title: 'Get the latest note starting with…',
      description:
        'The newest session (by date) whose note starts with a prefix such as "Day", optionally ' +
        'within a node. Use it to work out which "Day N" comes next. Returns { session: null } ' +
        'when none matches.',
      inputSchema: getLatestNoteToolSchema,
      annotations: READ_ONLY,
    },
    ({ prefix, node }) =>
      run('get_latest_note', async () => {
        const nodes = await repo.listNodes();
        const nodeId = node === undefined ? undefined : ctx.node(nodes, node).id;
        const session = await latestNoteWithPrefix(repo, prefix, nodeId);
        return {
          session: session && {
            id: session.id,
            date: session.studiedOn,
            minutes: session.minutes,
            path: pathOf(nodes, session.nodeId),
            note: session.note,
          },
        };
      }),
  );

  server.registerTool(
    'update_session',
    {
      title: 'Edit a study session',
      description:
        'Changes a session’s minutes, note (null removes it), date (not in the future), or ' +
        'node. Sessions of any date can be edited. Returns the session as it is now.',
      inputSchema: updateSessionToolSchema,
      annotations: { ...WRITE, idempotentHint: true },
    },
    ({ session_id, minutes, note, date, node }) =>
      run('update_session', async () => {
        const nodes = await repo.listNodes();
        const session = await updateSession(repo, clock, session_id, {
          minutes,
          note,
          studiedOn: ctx.optionalDate(date),
          nodeId: node === undefined ? undefined : ctx.node(nodes, node).id,
        });
        return { session: sessionView(nodes, session) };
      }),
  );

  server.registerTool(
    'delete_session',
    {
      title: 'Delete a study session',
      description:
        'Deletes one session by id (from list_sessions or log_session). Confirm with the ' +
        'student first; they can undo it in the app’s Recent changes. Returns the deleted session.',
      inputSchema: deleteSessionToolSchema,
      annotations: DELETE,
    },
    ({ session_id }) =>
      run('delete_session', async () => {
        const session = await repo.getSession(session_id);
        if (!session) throw notFound('session_not_found');
        await deleteSession(repo, session_id);
        return { deleted: sessionView(await repo.listNodes(), session) };
      }),
  );
}
