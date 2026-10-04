// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { Task, TaskCompletion, TaskItem, TreeNode } from '../../src/core/domain/types';
import { createLoginHandler } from '../functions/auth-login';
import { createCompletionHandler } from '../functions/completion';
import { createNodeStatusHandler } from '../functions/node-status';
import { createNodesHandler } from '../functions/nodes';
import { createTaskHandler } from '../functions/task';
import { createTaskCompleteHandler } from '../functions/task-complete';
import { createTasksHandler } from '../functions/tasks';
import { context, cookieFrom, post, TEST_PASSCODE, testDeps } from './fakes';

async function setup() {
  const t = testDeps();
  const getDeps = () => t.deps;
  const cookie = cookieFrom(
    await createLoginHandler(getDeps)(
      post('/api/auth/login', { passcode: TEST_PASSCODE }),
      context,
    ),
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
  const nodesResponse = await createNodesHandler(getDeps)(request('GET', '/api/nodes'), context);
  const { nodes } = (await nodesResponse.json()) as { nodes: TreeNode[] };
  const byName = (name: string) => {
    const node = nodes.find((n) => n.name === name);
    if (!node) throw new Error(`no node ${name}`);
    return node;
  };
  return {
    request,
    byName,
    withId: (id: string) => ({ ...context, params: { id } }),
    tasks: createTasksHandler(getDeps),
    task: createTaskHandler(getDeps),
    complete: createTaskCompleteHandler(getDeps),
    completion: createCompletionHandler(getDeps),
    nodes: createNodesHandler(getDeps),
    status: createNodeStatusHandler(getDeps),
  };
}

describe('/api/tasks', () => {
  it('requires a session', async () => {
    const api = await setup();
    const response = await api.tasks(api.request('GET', '/api/tasks', undefined, false), context);
    expect(response.status).toBe(401);
  });

  it('creates, completes with a score, uncompletes, edits, and deletes a task', async () => {
    const api = await setup();
    const maths = api.byName('Maths');

    const created = await api.tasks(
      api.request('POST', '/api/tasks', {
        nodeId: maths.id,
        title: 'Past paper 2024',
        isScored: true,
        defaultMaxScore: 80,
      }),
      context,
    );
    expect(created.status).toBe(201);
    const { task } = (await created.json()) as { task: Task };

    const tooHigh = await api.complete(
      api.request('POST', `/api/tasks/${task.id}/complete`, { score: 81 }),
      api.withId(task.id),
    );
    expect(tooHigh.status).toBe(400);

    const done = await api.complete(
      api.request('POST', `/api/tasks/${task.id}/complete`, { score: 64, kind: 'past_paper' }),
      api.withId(task.id),
    );
    expect(done.status).toBe(201);
    const { completion } = (await done.json()) as { completion: TaskCompletion };

    const twice = await api.complete(
      api.request('POST', `/api/tasks/${task.id}/complete`, { score: 64 }),
      api.withId(task.id),
    );
    expect(twice.status).toBe(409);

    const list = await api.tasks(api.request('GET', '/api/tasks'), context);
    const { items } = (await list.json()) as { items: TaskItem[] };
    expect(items.find((i) => i.task.id === task.id)?.completion?.id).toBe(completion.id);

    const undone = await api.completion(
      api.request('DELETE', `/api/completions/${completion.id}`),
      api.withId(completion.id),
    );
    expect(undone.status).toBe(200);

    const edited = await api.task(
      api.request('PATCH', `/api/tasks/${task.id}`, { title: 'Past paper 2023' }),
      api.withId(task.id),
    );
    expect(((await edited.json()) as { task: Task }).task.title).toBe('Past paper 2023');

    const deleted = await api.task(
      api.request('DELETE', `/api/tasks/${task.id}`),
      api.withId(task.id),
    );
    expect(deleted.status).toBe(200);
  });

  it('rejects invalid input with 400', async () => {
    const api = await setup();
    const response = await api.tasks(
      api.request('POST', '/api/tasks', { nodeId: api.byName('Maths').id, title: '' }),
      context,
    );
    expect(response.status).toBe(400);
  });
});

describe('/api/nodes/:id/status (TOP-1)', () => {
  it('sets a topic status and refuses non-topics', async () => {
    const api = await setup();
    const maths = api.byName('Maths');
    const added = await api.nodes(
      api.request('POST', '/api/nodes', { parentId: maths.id, name: 'Chapter 1' }),
      context,
    );
    const { node: topic } = (await added.json()) as { node: TreeNode };

    const done = await api.status(
      api.request('POST', `/api/nodes/${topic.id}/status`, { status: 'done' }),
      api.withId(topic.id),
    );
    expect(((await done.json()) as { node: TreeNode }).node.topicStatus).toBe('done');

    const wrong = await api.status(
      api.request('POST', `/api/nodes/${maths.id}/status`, { status: 'done' }),
      api.withId(maths.id),
    );
    expect(wrong.status).toBe(400);
  });
});
