// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { ChangeEntry, Settings, Task, TreeNode } from '../../src/core/domain/types.js';
import { createChangeUndoHandler } from '../functions/change-undo.js';
import { createChangesHandler } from '../functions/changes.js';
import { createLoginHandler } from '../functions/auth-login.js';
import { createNodesHandler } from '../functions/nodes.js';
import { createSessionsHandler } from '../functions/sessions.js';
import { createSettingsHandler } from '../functions/settings.js';
import { createTaskCompleteHandler } from '../functions/task-complete.js';
import { createTasksHandler } from '../functions/tasks.js';
import { createDispatcher } from '../functions/_lib/router.js';
import { context, cookieFrom, LOGIN, post, testDeps } from './fakes.js';

// The v1.1 API (SPEC §B8): settings take dayEndsAtMinutes, completions take a date and untick by
// date, and the change history can be listed and undone (UNDO-6).

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
  const nodesResponse = await createNodesHandler(getDeps)(request('GET', '/api/nodes'), context);
  const { nodes } = (await nodesResponse.json()) as { nodes: TreeNode[] };
  const byName = (name: string) => {
    const node = nodes.find((n) => n.name === name);
    if (!node) throw new Error(`no node ${name}`);
    return node;
  };
  return {
    t,
    request,
    byName,
    withId: (id: string) => ({ ...context, params: { id } }),
    settings: createSettingsHandler(getDeps),
    sessions: createSessionsHandler(getDeps),
    tasks: createTasksHandler(getDeps),
    complete: createTaskCompleteHandler(getDeps),
    changes: createChangesHandler(getDeps),
    undo: createChangeUndoHandler(getDeps),
    dispatch: createDispatcher(getDeps),
  };
}

describe('settings (DAY-1)', () => {
  it('saves "My day ends at" and rejects times outside 00:00–06:00 in half hours', async () => {
    const api = await setup();
    const saved = await api.settings(
      api.request('PATCH', '/api/settings', { dayEndsAtMinutes: 240 }),
      context,
    );
    expect(((await saved.json()) as { settings: Settings }).settings.dayEndsAtMinutes).toBe(240);
    for (const bad of [45, 390, -30]) {
      const response = await api.settings(
        api.request('PATCH', '/api/settings', { dayEndsAtMinutes: bad }),
        context,
      );
      expect(response.status).toBe(400);
    }
  });
});

describe('completion dates (TASK-11)', () => {
  it('completes for an earlier day and unticks the week of a date', async () => {
    const api = await setup();
    const { items } = (await (
      await api.tasks(api.request('GET', '/api/tasks'), context)
    ).json()) as { items: { task: Task }[] };
    const weekly = items[0]?.task;
    if (!weekly) throw new Error('no weekly task');

    const done = await api.complete(
      api.request('POST', `/api/tasks/${weekly.id}/complete`, {
        score: 12,
        completedOn: '2026-09-23',
      }),
      api.withId(weekly.id),
    );
    expect(done.status).toBe(201);
    expect(await done.json()).toMatchObject({
      completion: { completedOn: '2026-09-23', periodStart: '2026-09-21' },
    });

    const future = await api.complete(
      api.request('POST', `/api/tasks/${weekly.id}/complete`, {
        score: 12,
        completedOn: '2026-10-04',
      }),
      api.withId(weekly.id),
    );
    expect(future.status).toBe(400);

    const undone = await api.complete(
      api.request('DELETE', `/api/tasks/${weekly.id}/complete?date=2026-09-25`),
      api.withId(weekly.id),
    );
    expect(await undone.json()).toMatchObject({
      completion: { completedOn: '2026-09-23' },
      score: { score: 12 },
    });
    const again = await api.complete(
      api.request('DELETE', `/api/tasks/${weekly.id}/complete?date=2026-09-25`),
      api.withId(weekly.id),
    );
    expect(again.status).toBe(409);
  });
});

describe('/api/changes (UNDO-4–6)', () => {
  it('lists app changes and undoes one', async () => {
    const api = await setup();
    const maths = api.byName('Maths');
    await api.sessions(
      api.request('POST', '/api/sessions', {
        nodeId: maths.id,
        studiedOn: '2026-10-03',
        minutes: 45,
      }),
      context,
    );
    const listed = (await (
      await api.changes(api.request('GET', '/api/changes'), context)
    ).json()) as { changes: ChangeEntry[] };
    expect(listed.changes).toEqual([
      expect.objectContaining({
        source: 'app',
        action: 'create',
        summary: 'Logged 45m · School Subjects > Maths',
      }),
    ]);

    const id = listed.changes[0]?.id ?? '';
    const undone = await api.undo(api.request('POST', `/api/changes/${id}/undo`), api.withId(id));
    expect(await undone.json()).toMatchObject({ change: { id, undoneAt: expect.any(String) } });
    expect(await api.t.repo.listSessions({})).toEqual([]);

    const twice = await api.undo(api.request('POST', `/api/changes/${id}/undo`), api.withId(id));
    expect(twice.status).toBe(409);
    expect(await twice.json()).toMatchObject({ error: { code: 'already_undone' } });
  });

  it('needs a session, and is in the route table', async () => {
    const api = await setup();
    const response = await api.dispatch(
      api.request('GET', '/api/changes', undefined, false),
      context.ip,
    );
    expect(response.status).toBe(401);
    const wrongMethod = await api.dispatch(
      api.request('GET', '/api/changes/00000000-0000-4000-8000-000000000001/undo'),
      context.ip,
    );
    expect(wrongMethod.status).toBe(405);
    const untick = await api.dispatch(
      api.request('DELETE', '/api/tasks/00000000-0000-4000-8000-000000000001/complete'),
      context.ip,
    );
    expect(untick.status).toBe(404);
  });
});
