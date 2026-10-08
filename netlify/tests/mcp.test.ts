import { beforeEach, describe, expect, it } from 'vitest';

import type { TreeNode } from '../../src/core/domain/types';
import { seedIfEmpty } from '../../src/core/services/seed';
import { addDeadline } from '../../src/core/services/deadlines';
import { logSession } from '../../src/core/services/sessions';
import { addNode, updateNode } from '../../src/core/services/structure';
import { generateMcpToken, hashMcpToken } from '../functions/_lib/mcpToken';
import { createMcpFunction } from '../functions/mcp';
import { testDeps } from './fakes';

// MCP-1–9 against the in-memory repository, through the real HTTP handler and SDK. Requests use
// the 2025 protocol (no handshake needed in stateless mode); one test covers the 2026 envelope.

// A fixed, well-formed test token (43 base64url characters).
const SECRET = 'test-mcp-token-0123456789abcdefghijklmnopqr';
let setup: ReturnType<typeof testDeps>;
let handler: ReturnType<typeof createMcpFunction>;
let rpcId = 0;

function mcpRequest(
  body: unknown,
  { secret = SECRET, method = 'POST', headers = {} as Record<string, string> } = {},
) {
  const request = new Request(`http://localhost/mcp/${secret}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
  return handler(request, { ip: '203.0.113.7', params: { secret } });
}

/** The JSON-RPC message in a response, whether sent as JSON or as one server-sent event. */
async function message(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  const data = text.startsWith('{')
    ? text
    : text
        .split('\n')
        .find((line) => line.startsWith('data: '))
        ?.slice(6);
  return JSON.parse(data ?? 'null') as Record<string, unknown>;
}

async function rpc(method: string, params: unknown = {}) {
  const response = await mcpRequest({ jsonrpc: '2.0', id: ++rpcId, method, params });
  expect(response.status).toBe(200);
  return message(response);
}

interface ToolResult {
  isError?: boolean;
  content: { type: string; text: string }[];
}

async function call(name: string, args: Record<string, unknown> = {}) {
  const reply = await rpc('tools/call', { name, arguments: args });
  const result = reply.result as ToolResult;
  const text = result.content[0]?.text ?? '';
  return {
    isError: result.isError ?? false,
    text,
    data: JSON.parse(text.startsWith('{') ? text : 'null'),
  };
}

async function byName(name: string): Promise<TreeNode> {
  const node = (await setup.repo.listNodes()).find((n) => n.name === name);
  if (!node) throw new Error(`no node ${name}`);
  return node;
}

beforeEach(async () => {
  setup = testDeps();
  await setup.accounts.setMcpTokenHash(setup.user.id, hashMcpToken(SECRET));
  handler = createMcpFunction(() => setup.deps);
  await seedIfEmpty(setup.repo, setup.deps.newId);
});

describe('the secret URL (MCP-1, ACCT-8)', () => {
  it('makes long random tokens and stores only their hash', () => {
    const token = generateMcpToken();
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(generateMcpToken()).not.toBe(token);
    expect(hashMcpToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect([...setup.accounts.mcpTokenHashes.values()]).not.toContain(SECRET);
  });

  it('answers 404 for a wrong token, before looking at the method or body', async () => {
    const wrong = await mcpRequest({}, { secret: 'wrong-token-0123456789abcdefghijklmnopqrstu' });
    expect(wrong.status).toBe(404);
    expect(await wrong.text()).toBe('Not found');
    expect((await mcpRequest({}, { secret: 'nope', method: 'GET' })).status).toBe(404);
  });

  it("reaches only the link owner's data", async () => {
    const other = setup.auth.addUser('other@example.com', 'other password');
    const otherToken = generateMcpToken();
    await setup.accounts.setMcpTokenHash(other.id, hashMcpToken(otherToken));
    const reply = await mcpRequest(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_structure', arguments: {} },
      },
      { secret: otherToken },
    );
    expect(reply.status).toBe(200);
    expect(await reply.text()).not.toContain('German');
  });

  it('only accepts POST', async () => {
    const response = await mcpRequest({}, { method: 'GET' });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });
});

describe('the server (MCP-2, MCP-3, MCP-8)', () => {
  it('introduces itself with instructions', async () => {
    const reply = await rpc('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    });
    const result = reply.result as { serverInfo: { name: string }; instructions: string };
    expect(result.serverInfo.name).toBe('streakwise');
    for (const phrase of [
      'Tracks',
      'subtasks',
      'topics',
      'whole minutes',
      'Asia/Karachi',
      'Tasks',
    ]) {
      expect(result.instructions).toContain(phrase);
    }
  });

  it('lists the tools with descriptions, schemas, and annotations', async () => {
    const reply = await rpc('tools/list');
    const tools = (reply.result as { tools: Record<string, unknown>[] }).tools;
    const byTool = Object.fromEntries(tools.map((t) => [t.name as string, t]));
    expect(Object.keys(byTool).sort()).toEqual([
      'add_node',
      'add_task',
      'complete_task',
      'delete_session',
      'find_gaps',
      'get_progress',
      'get_structure',
      'list_deadlines',
      'list_sessions',
      'list_tasks',
      'log_score',
      'log_session',
      'set_topic_status',
    ]);
    for (const tool of tools) {
      expect(String(tool.description).length).toBeGreaterThan(40);
      expect(tool.inputSchema).toMatchObject({ type: 'object' });
    }
    for (const name of [
      'get_structure',
      'list_sessions',
      'get_progress',
      'find_gaps',
      'list_deadlines',
      'list_tasks',
    ]) {
      expect(byTool[name]?.annotations).toMatchObject({ readOnlyHint: true });
    }
    for (const name of ['add_task', 'complete_task', 'log_score', 'set_topic_status']) {
      expect(byTool[name]?.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
      });
    }
    expect(byTool.delete_session?.annotations).toMatchObject({ destructiveHint: true });
    expect(byTool.log_session?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
    });
    expect(byTool.log_session?.inputSchema).toMatchObject({ required: ['node', 'minutes'] });
  });

  it('also serves the 2026-07-28 protocol', async () => {
    const meta = {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientCapabilities': {},
      'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1' },
    };
    const response = await mcpRequest(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_progress', arguments: {}, _meta: meta },
      },
      {
        headers: {
          'MCP-Protocol-Version': '2026-07-28',
          'Mcp-Method': 'tools/call',
          'Mcp-Name': 'get_progress',
        },
      },
    );
    expect(response.status).toBe(200);
    const result = (await message(response)).result as ToolResult;
    expect(JSON.parse(result.content[0]?.text ?? '')).toMatchObject({ today: '2026-10-03' });
  });
});

describe('log_session (MCP-5, MCP-6, MCP-7)', () => {
  it('logs by path and relative date, as coming from Claude', async () => {
    const maths = await byName('Maths');
    await addNode(setup.repo, setup.deps.newId, { parentId: maths.id, name: 'Chapter 3' });

    const { isError, data } = await call('log_session', {
      node: 'improvement exams > maths > chapter 3',
      minutes: 90,
      date: 'yesterday',
      note: 'Integration practice',
    });
    expect(isError).toBe(false);
    expect(data.session).toMatchObject({
      date: '2026-10-02',
      minutes: 90,
      path: 'Improvement Exams > Maths > Chapter 3',
      note: 'Integration practice',
      source: 'claude',
    });
    expect((await byName('Chapter 3')).topicStatus).toBe('in_progress');
    expect((await setup.repo.getSettings()).lastMcpCallAt).toBe('2026-10-03T10:00:00.000Z');
  });

  it('defaults to today', async () => {
    const { data } = await call('log_session', { node: 'self-study', minutes: 30 });
    expect(data.session).toMatchObject({
      date: '2026-10-03',
      path: 'German Language > Self-study',
    });
  });

  it('returns readable errors Claude can act on', async () => {
    const english = await byName('English');
    const maths = await byName('Maths');
    await addNode(setup.repo, setup.deps.newId, { parentId: english.id, name: 'Chapter 1' });
    await addNode(setup.repo, setup.deps.newId, { parentId: maths.id, name: 'Chapter 1' });

    const ambiguous = await call('log_session', { node: 'chapter 1', minutes: 30 });
    expect(ambiguous.isError).toBe(true);
    expect(ambiguous.data.error.code).toBe('node_ambiguous');
    expect(ambiguous.data.error.message).toContain('Improvement Exams > English > Chapter 1');

    const future = await call('log_session', { node: 'maths', minutes: 30, date: '2026-10-04' });
    expect(future.data.error).toEqual({
      code: 'future_date',
      message: 'You can’t log time in the future.',
    });

    const badDate = await call('log_session', { node: 'maths', minutes: 30, date: 'last week' });
    expect(badDate.data.error.code).toBe('invalid_date');

    // Schema validation happens in the SDK before the tool runs.
    const zero = await call('log_session', { node: 'maths', minutes: 0 });
    expect(zero.isError).toBe(true);
    const fraction = await call('log_session', { node: 'maths', minutes: 1.5 });
    expect(fraction.isError).toBe(true);
    expect(await setup.repo.listSessions({})).toEqual([]);
  });
});

describe('list_sessions and delete_session', () => {
  beforeEach(async () => {
    const { repo, deps } = setup;
    const at = async (
      name: string,
      studiedOn: string,
      minutes: number,
      source: 'app' | 'claude' = 'app',
    ) =>
      logSession(
        repo,
        deps.clock,
        deps.newId,
        { nodeId: (await byName(name)).id, studiedOn, minutes },
        source,
      );
    await at('Self-study', '2026-09-30', 10);
    await at('Class', '2026-10-01', 20, 'claude');
    await at('Maths', '2026-10-02', 30);
  });

  it('filters by node, dates, and source, and caps the list', async () => {
    const german = await call('list_sessions', { node: 'German Language' });
    expect(german.data.sessions.map((s: { minutes: number }) => s.minutes)).toEqual([20, 10]);
    expect(german.data.truncated).toBe(false);

    const ranged = await call('list_sessions', { from: '2026-10-01', to: 'yesterday' });
    expect(ranged.data.sessions.map((s: { minutes: number }) => s.minutes)).toEqual([30, 20]);

    const claude = await call('list_sessions', { source: 'claude' });
    expect(claude.data.sessions).toHaveLength(1);

    const capped = await call('list_sessions', { limit: 2 });
    expect(capped.data.sessions).toHaveLength(2);
    expect(capped.data.truncated).toBe(true);

    expect((await call('list_sessions', { limit: 500 })).isError).toBe(true);
  });

  it('deletes a session by id and reports what it deleted', async () => {
    const [newest] = await setup.repo.listSessions({});
    const deleted = await call('delete_session', { session_id: newest?.id });
    expect(deleted.data.deleted).toMatchObject({
      id: newest?.id,
      minutes: 30,
      path: 'Improvement Exams > Maths',
    });
    expect(await setup.repo.listSessions({})).toHaveLength(2);

    const again = await call('delete_session', { session_id: newest?.id });
    expect(again.data.error.code).toBe('session_not_found');
  });
});

describe('get_structure and add_node', () => {
  it('returns the tree, with archived nodes only on request', async () => {
    const claude = await byName('Claude Certification');
    await updateNode(setup.repo, setup.deps.clock, claude.id, { archived: true });
    await updateNode(setup.repo, setup.deps.clock, (await byName('German Language')).id, {
      weeklyTargetMinutes: 300,
    });

    const visible = await call('get_structure');
    expect(visible.data.tracks.map((t: { name: string }) => t.name)).toEqual([
      'German Language',
      'Improvement Exams',
    ]);
    expect(visible.data.tracks[0]).toMatchObject({
      kind: 'track',
      weeklyTargetMinutes: 300,
      children: [
        { name: 'Self-study', kind: 'subtask' },
        { name: 'Class', kind: 'subtask' },
      ],
    });

    const all = await call('get_structure', { include_archived: true });
    expect(all.data.tracks[2]).toEqual({
      id: claude.id,
      name: 'Claude Certification',
      kind: 'track',
      archived: true,
    });
  });

  it('adds topics under subtasks, but not below topics', async () => {
    const added = await call('add_node', { parent: 'maths', name: 'Chapter 4' });
    expect(added.data.node).toMatchObject({
      name: 'Chapter 4',
      kind: 'topic',
      path: 'Improvement Exams > Maths > Chapter 4',
      status: 'not_started',
    });

    const tooDeep = await call('add_node', { parent: 'chapter 4', name: 'Part A' });
    expect(tooDeep.data.error.code).toBe('max_depth');
    const duplicate = await call('add_node', { parent: 'maths', name: 'chapter 4' });
    expect(duplicate.data.error.code).toBe('duplicate');
  });
});

describe('get_progress, find_gaps, list_deadlines', () => {
  it('summarises progress', async () => {
    const { data } = await call('get_progress');
    expect(data).toMatchObject({ today: '2026-10-03', streak: { current: 0, longest: 0 } });
    expect(data.tracks).toHaveLength(3);
  });

  it('finds gaps and caps each list', async () => {
    const english = await byName('English');
    for (const name of ['Essay', 'Grammar', 'Poetry']) {
      await addNode(setup.repo, setup.deps.newId, { parentId: english.id, name });
    }
    setup.advance(10 * 86_400_000);

    const all = await call('find_gaps');
    expect(all.data.topicsNotStarted).toHaveLength(3);
    expect(all.data.neglected.length).toBeGreaterThan(2);
    expect(all.data.truncated).toBe(false);

    const capped = await call('find_gaps', { limit: 2 });
    expect(capped.data.topicsNotStarted).toHaveLength(2);
    expect(capped.data.truncated).toBe(true);
  });

  it('lists upcoming deadlines, and past ones on request', async () => {
    const maths = await byName('Maths');
    const { repo, deps } = setup;
    await addDeadline(repo, deps.newId, {
      nodeId: maths.id,
      title: 'Mock exam',
      dueOn: '2026-09-20',
    });
    await addDeadline(repo, deps.newId, {
      nodeId: maths.id,
      title: 'Final exam',
      dueOn: '2026-11-02',
    });

    const upcoming = await call('list_deadlines');
    expect(upcoming.data.deadlines).toEqual([
      expect.objectContaining({
        title: 'Final exam',
        daysLeft: 30,
        path: 'Improvement Exams > Maths',
      }),
    ]);

    const all = await call('list_deadlines', { include_past: true });
    expect(all.data.deadlines.map((d: { daysLeft: number }) => d.daysLeft)).toEqual([-13, 30]);
  });
});

describe('M5 tools: topics, tasks, and scores', () => {
  it('sets a topic’s status and refuses non-topics', async () => {
    const maths = await byName('Maths');
    await addNode(setup.repo, setup.deps.newId, { parentId: maths.id, name: 'Chapter 3' });

    const done = await call('set_topic_status', { topic: 'maths > chapter 3', status: 'done' });
    expect(done.data.topic).toMatchObject({
      path: 'Improvement Exams > Maths > Chapter 3',
      status: 'done',
    });
    const reopened = await call('set_topic_status', { topic: 'chapter 3', status: 'in_progress' });
    expect(reopened.data.topic.status).toBe('in_progress');

    const wrong = await call('set_topic_status', { topic: 'maths', status: 'done' });
    expect(wrong.isError).toBe(true);
    expect(wrong.data.error.code).toBe('topics_only');
  });

  it('adds tasks and sub-tasks, lists them by status, and completes a scored one', async () => {
    const added = await call('add_task', {
      title: 'Past paper 2023',
      node: 'maths',
      due_date: '2026-10-02',
      scored: true,
      default_max_score: 80,
    });
    expect(added.isError).toBe(false);
    expect(added.data.task).toMatchObject({
      path: 'Improvement Exams > Maths',
      dueOn: '2026-10-02',
      scored: true,
      done: false,
    });
    const child = await call('add_task', {
      title: 'Section A',
      node: 'maths',
      parent_task_id: added.data.task.id,
    });
    expect(child.data.task.parentTaskId).toBe(added.data.task.id);

    const invalid = await call('add_task', {
      title: 'Weekly',
      node: 'maths',
      weekly: true,
      due_date: 'today',
    });
    expect(invalid.isError).toBe(true);

    const due = await call('list_tasks', { status: 'due_this_week' });
    expect(due.data.tasks.map((t: { title: string }) => t.title)).toContain('Past paper 2023');
    const inMaths = await call('list_tasks', { node: 'Improvement Exams' });
    expect(inMaths.data.tasks).toHaveLength(2);

    const missingScore = await call('complete_task', { task_id: added.data.task.id });
    expect(missingScore.data.error.code).toBe('score_required');

    const completed = await call('complete_task', {
      task_id: added.data.task.id,
      score: 60,
      kind: 'past_paper',
    });
    expect(completed.data.task.done).toBe(true);
    expect(completed.data.score).toMatchObject({ score: 60, maxScore: 80, percent: 75 });

    const again = await call('complete_task', { task_id: added.data.task.id, score: 60 });
    expect(again.isError).toBe(true);

    const done = await call('list_tasks', { status: 'done' });
    expect(done.data.tasks).toHaveLength(1);
  });

  it('records a score, validating the date and the maximum', async () => {
    const saved = await call('log_score', {
      node: 'english',
      kind: 'quiz',
      title: 'Grammar quiz',
      score: 9,
      max_score: 12,
      date: 'yesterday',
    });
    expect(saved.data.score).toMatchObject({
      path: 'Improvement Exams > English',
      percent: 75,
      kind: 'quiz',
    });
    const over = await call('log_score', {
      node: 'english',
      kind: 'quiz',
      title: 'Too high',
      score: 13,
      max_score: 12,
    });
    expect(over.isError).toBe(true);
    const future = await call('log_score', {
      node: 'english',
      kind: 'quiz',
      title: 'Future',
      score: 1,
      max_score: 12,
      date: '2099-01-01',
    });
    expect(future.data.error.code).toBe('future_date');
  });

  it('adds an "Other" task when no node is given', async () => {
    const other = await call('add_task', { title: 'Renew library card' });
    expect(other.data.task).toMatchObject({ nodeId: null, path: 'Other', scored: false });
  });

  it('adds tasks due this week to find_gaps', async () => {
    const gaps = await call('find_gaps');
    expect(gaps.data.tasksDue).toEqual([
      expect.objectContaining({ title: 'Weekly recall / revision', weekly: true, overdue: false }),
    ]);
  });
});
