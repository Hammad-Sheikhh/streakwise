// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { HistoryPage, Session, Settings, TreeNode } from '../../src/core/domain/types';
import { createLoginHandler } from '../functions/auth-login';
import { createNodeHandler } from '../functions/node';
import { createNodeMoveHandler } from '../functions/node-move';
import { createNodesHandler } from '../functions/nodes';
import { createRecentNodesHandler } from '../functions/recent-nodes';
import { createSessionHandler } from '../functions/session';
import { createSessionsHandler } from '../functions/sessions';
import { createSettingsHandler } from '../functions/settings';
import { context, cookieFrom, post, TEST_PASSCODE, testDeps } from './fakes';

// The M2 endpoints, end to end on the in-memory repository: auth → validation → service → JSON.

async function setup() {
  const t = testDeps();
  const getDeps = () => t.deps;
  const login = createLoginHandler(getDeps);
  const cookie = cookieFrom(
    await login(post('/api/auth/login', { passcode: TEST_PASSCODE }), context),
  );

  const request = (method: string, path: string, body?: unknown, withCookie = true) =>
    new Request(`http://localhost${path}`, {
      method,
      headers: {
        ...(withCookie ? { cookie } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const withId = (id: string) => ({ ...context, params: { id } });

  const handlers = {
    nodes: createNodesHandler(getDeps),
    node: createNodeHandler(getDeps),
    move: createNodeMoveHandler(getDeps),
    sessions: createSessionsHandler(getDeps),
    session: createSessionHandler(getDeps),
    recent: createRecentNodesHandler(getDeps),
    settings: createSettingsHandler(getDeps),
  };

  const tree = async () =>
    (
      (await (await handlers.nodes(request('GET', '/api/nodes'), context)).json()) as {
        nodes: TreeNode[];
      }
    ).nodes;
  const byName = async (name: string) => {
    const node = (await tree()).find((n) => n.name === name);
    if (!node) throw new Error(`no node ${name}`);
    return node;
  };

  return { ...t, request, withId, tree, byName, ...handlers };
}

async function errorCode(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code;
}

describe('auth on the new routes (AUTH-3)', () => {
  it('rejects every route without a session', async () => {
    const api = await setup();
    const id = '00000000-0000-4000-8000-000000000001';
    const responses = await Promise.all([
      api.nodes(api.request('POST', '/api/nodes', { parentId: null, name: 'X' }, false), context),
      api.node(api.request('DELETE', `/api/nodes/${id}`, undefined, false), api.withId(id)),
      api.move(api.request('POST', `/api/nodes/${id}/move`, {}, false), api.withId(id)),
      api.sessions(api.request('GET', '/api/sessions', undefined, false), context),
      api.session(api.request('DELETE', `/api/sessions/${id}`, undefined, false), api.withId(id)),
      api.recent(api.request('GET', '/api/recent-nodes', undefined, false), context),
      api.settings(api.request('PATCH', '/api/settings', {}, false), context),
    ]);
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 401, 401]);
  });
});

describe('/api/nodes', () => {
  it('creates, renames, moves, archives, and deletes nodes', async () => {
    const api = await setup();
    const created = await api.nodes(
      api.request('POST', '/api/nodes', { parentId: null, name: 'Piano' }),
      context,
    );
    expect(created.status).toBe(201);
    const { node } = (await created.json()) as { node: TreeNode };
    expect(node).toMatchObject({ name: 'Piano', depth: 1, color: 'emerald' });

    const renamed = await api.node(
      api.request('PATCH', `/api/nodes/${node.id}`, { name: 'Keys' }),
      api.withId(node.id),
    );
    expect(((await renamed.json()) as { node: TreeNode }).node.name).toBe('Keys');

    const moved = await api.move(
      api.request('POST', `/api/nodes/${node.id}/move`, { direction: 'up' }),
      api.withId(node.id),
    );
    expect(moved.status).toBe(200);
    const tracks = (await api.tree()).filter((n) => n.depth === 1).map((n) => n.name);
    expect(tracks.at(-2)).toBe('Keys');

    const archived = await api.node(
      api.request('PATCH', `/api/nodes/${node.id}`, { archived: true }),
      api.withId(node.id),
    );
    expect(((await archived.json()) as { node: TreeNode }).node.archivedAt).not.toBeNull();

    const deleted = await api.node(
      api.request('DELETE', `/api/nodes/${node.id}`),
      api.withId(node.id),
    );
    expect(deleted.status).toBe(200);
    expect((await api.tree()).some((n) => n.id === node.id)).toBe(false);
  });

  it('maps rule violations to 400, 404, and 409', async () => {
    const api = await setup();
    const blank = await api.nodes(
      api.request('POST', '/api/nodes', { parentId: null, name: '' }),
      context,
    );
    expect(blank.status).toBe(400);

    const duplicate = await api.nodes(
      api.request('POST', '/api/nodes', { parentId: null, name: 'german language' }),
      context,
    );
    expect(duplicate.status).toBe(409);
    expect(await errorCode(duplicate)).toBe('duplicate');

    const german = await api.byName('German Language');
    const inUse = await api.node(
      api.request('DELETE', `/api/nodes/${german.id}`),
      api.withId(german.id),
    );
    expect(inUse.status).toBe(409);
    expect(await errorCode(inUse)).toBe('node_in_use');

    const missing = '00000000-0000-4000-8000-0000000000ff';
    const notFound = await api.node(
      api.request('PATCH', `/api/nodes/${missing}`, { name: 'X' }),
      api.withId(missing),
    );
    expect(notFound.status).toBe(404);
  });

  it('rejects a fourth level', async () => {
    const api = await setup();
    const maths = await api.byName('Maths');
    const topic = (await (
      await api.nodes(api.request('POST', '/api/nodes', { parentId: maths.id, name: 'T' }), context)
    ).json()) as { node: TreeNode };
    const tooDeep = await api.nodes(
      api.request('POST', '/api/nodes', { parentId: topic.node.id, name: 'Deeper' }),
      context,
    );
    expect(tooDeep.status).toBe(409);
    expect(await errorCode(tooDeep)).toBe('max_depth');
  });
});

describe('/api/sessions', () => {
  it('logs, lists, edits, and deletes sessions', async () => {
    const api = await setup();
    const maths = await api.byName('Maths');
    const created = await api.sessions(
      api.request('POST', '/api/sessions', {
        nodeId: maths.id,
        studiedOn: '2026-10-03',
        minutes: 45,
        note: 'Past paper',
        source: 'claude', // ignored: the app always logs as "app"
      }),
      context,
    );
    expect(created.status).toBe(201);
    const { session } = (await created.json()) as { session: Session };
    expect(session).toMatchObject({ minutes: 45, source: 'app', note: 'Past paper' });

    const page = (await (
      await api.sessions(api.request('GET', `/api/sessions?nodeId=${maths.id}`), context)
    ).json()) as HistoryPage;
    expect(page.days).toHaveLength(1);
    expect(page.days[0]?.totalMinutes).toBe(45);

    const edited = await api.session(
      api.request('PATCH', `/api/sessions/${session.id}`, { minutes: 60 }),
      api.withId(session.id),
    );
    expect(((await edited.json()) as { session: Session }).session.minutes).toBe(60);

    const recent = (await (
      await api.recent(api.request('GET', '/api/recent-nodes'), context)
    ).json()) as { nodeIds: string[] };
    expect(recent.nodeIds).toEqual([maths.id]);

    const deleted = await api.session(
      api.request('DELETE', `/api/sessions/${session.id}`),
      api.withId(session.id),
    );
    expect(deleted.status).toBe(200);
    const again = await api.session(
      api.request('DELETE', `/api/sessions/${session.id}`),
      api.withId(session.id),
    );
    expect(again.status).toBe(404);
  });

  it('validates the body and the query', async () => {
    const api = await setup();
    const maths = await api.byName('Maths');
    const future = await api.sessions(
      api.request('POST', '/api/sessions', {
        nodeId: maths.id,
        studiedOn: '2026-12-01',
        minutes: 30,
      }),
      context,
    );
    expect(future.status).toBe(400);
    expect(await errorCode(future)).toBe('future_date');

    const tooLong = await api.sessions(
      api.request('POST', '/api/sessions', {
        nodeId: maths.id,
        studiedOn: '2026-10-03',
        minutes: 2000,
      }),
      context,
    );
    expect(tooLong.status).toBe(400);

    const badQuery = await api.sessions(api.request('GET', '/api/sessions?to=yesterday'), context);
    expect(badQuery.status).toBe(400);
  });

  it('answers 405 for an unsupported method', async () => {
    const api = await setup();
    const response = await api.sessions(api.request('PUT', '/api/sessions', {}), context);
    expect(response.status).toBe(405);
  });
});

describe('/api/settings', () => {
  it('updates the student name and neglect threshold (SET-1)', async () => {
    const api = await setup();
    const response = await api.settings(
      api.request('PATCH', '/api/settings', { studentName: 'Demo Student', neglectDays: 4 }),
      context,
    );
    expect(((await response.json()) as { settings: Settings }).settings).toMatchObject({
      studentName: 'Demo Student',
      neglectDays: 4,
    });
    const invalid = await api.settings(
      api.request('PATCH', '/api/settings', { neglectDays: 20 }),
      context,
    );
    expect(invalid.status).toBe(400);
  });
});
