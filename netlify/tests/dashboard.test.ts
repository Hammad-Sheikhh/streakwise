// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { Dashboard, Deadline, TreeNode } from '../../src/core/domain/types';
import { createLoginHandler } from '../functions/auth-login';
import { createDashboardHandler } from '../functions/dashboard';
import { createDeadlineHandler } from '../functions/deadline';
import { createDeadlinesHandler } from '../functions/deadlines';
import { createNodeHandler } from '../functions/node';
import { createNodesHandler } from '../functions/nodes';
import { context, cookieFrom, post, LOGIN, testDeps } from './fakes';

async function setup() {
  const t = testDeps();
  const getDeps = () => t.deps;
  const cookie = cookieFrom(
    await createLoginHandler(getDeps)(post('/api/auth/login', LOGIN), context),
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
  const nodes = (
    (await (await createNodesHandler(getDeps)(request('GET', '/api/nodes'), context)).json()) as {
      nodes: TreeNode[];
    }
  ).nodes;
  const byName = (name: string) => {
    const node = nodes.find((n) => n.name === name);
    if (!node) throw new Error(`no node ${name}`);
    return node;
  };
  return {
    request,
    byName,
    withId: (id: string) => ({ ...context, params: { id } }),
    dashboard: createDashboardHandler(getDeps),
    deadlines: createDeadlinesHandler(getDeps),
    deadline: createDeadlineHandler(getDeps),
    node: createNodeHandler(getDeps),
  };
}

describe('/api/dashboard', () => {
  it('requires a session and returns the aggregated view', async () => {
    const api = await setup();
    expect(
      (await api.dashboard(api.request('GET', '/api/dashboard', undefined, false), context)).status,
    ).toBe(401);

    const german = api.byName('German Language');
    const target = await api.node(
      api.request('PATCH', `/api/nodes/${german.id}`, { weeklyTargetMinutes: 300 }),
      api.withId(german.id),
    );
    expect(target.status).toBe(200);

    const response = await api.dashboard(api.request('GET', '/api/dashboard'), context);
    const body = (await response.json()) as Dashboard;
    expect(body.today).toBe('2026-10-03');
    expect(body.targets[0]).toEqual({ trackId: german.id, minutes: 0, targetMinutes: 300 });
    expect(body.heatmap.start).toBe('2025-09-29');
  });

  it('rejects a target that is not in half-hour steps', async () => {
    const api = await setup();
    const german = api.byName('German Language');
    const response = await api.node(
      api.request('PATCH', `/api/nodes/${german.id}`, { weeklyTargetMinutes: 50 }),
      api.withId(german.id),
    );
    expect(response.status).toBe(400);
  });
});

describe('/api/deadlines', () => {
  it('creates, lists, edits, and deletes deadlines', async () => {
    const api = await setup();
    const maths = api.byName('Maths');
    const created = await api.deadlines(
      api.request('POST', '/api/deadlines', {
        nodeId: maths.id,
        title: 'Exam',
        dueOn: '2026-11-13',
      }),
      context,
    );
    expect(created.status).toBe(201);
    const { deadline } = (await created.json()) as { deadline: Deadline };

    const edited = await api.deadline(
      api.request('PATCH', `/api/deadlines/${deadline.id}`, { title: 'Final exam' }),
      api.withId(deadline.id),
    );
    expect(((await edited.json()) as { deadline: Deadline }).deadline.title).toBe('Final exam');

    const list = (await (
      await api.deadlines(api.request('GET', '/api/deadlines'), context)
    ).json()) as { deadlines: Deadline[] };
    expect(list.deadlines).toHaveLength(1);

    const deleted = await api.deadline(
      api.request('DELETE', `/api/deadlines/${deadline.id}`),
      api.withId(deadline.id),
    );
    expect(deleted.status).toBe(200);
  });

  it('validates input', async () => {
    const api = await setup();
    const response = await api.deadlines(
      api.request('POST', '/api/deadlines', { nodeId: 'nope', title: '', dueOn: 'soon' }),
      context,
    );
    expect(response.status).toBe(400);
  });
});
