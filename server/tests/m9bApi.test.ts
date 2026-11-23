// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type {
  ExamTarget,
  ExamView,
  Mistake,
  MistakesOverview,
  TreeNode,
} from '../../src/core/domain/types.js';
import { createLoginHandler } from '../functions/auth-login.js';
import { createDispatcher } from '../functions/_lib/router.js';
import { context, cookieFrom, LOGIN, post, testDeps } from './fakes.js';

// The M9b API, through the route table: mistakes (ERR-1–4), the exam view and targets (EXAM-2/3).

async function setup() {
  const t = testDeps();
  const getDeps = () => t.deps;
  const cookie = cookieFrom(
    await createLoginHandler(getDeps)(post('/api/auth/login', LOGIN), context),
  );
  const dispatch = createDispatcher(getDeps);
  const call = async <T>(method: string, path: string, body?: unknown) => {
    const response = await dispatch(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          cookie,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      context.ip,
    );
    return { status: response.status, body: (await response.json()) as T };
  };
  const { body } = await call<{ nodes: TreeNode[] }>('GET', '/api/nodes');
  const byName = (name: string) => {
    const node = body.nodes.find((n) => n.name === name);
    if (!node) throw new Error(`no node ${name}`);
    return node;
  };
  return { call, byName };
}

describe('/api/mistakes', () => {
  it('adds, lists, reviews, edits, and deletes mistakes', async () => {
    const { call, byName } = await setup();
    const added = await call<{ mistake: Mistake }>('POST', '/api/mistakes', {
      nodeId: byName('Maths').id,
      text: 'sign error',
      createdOn: '2026-10-02',
    });
    expect(added.status).toBe(201);
    const id = added.body.mistake.id;

    const overview = await call<MistakesOverview>('GET', '/api/mistakes');
    expect(overview.body.due.map((m) => m.id)).toEqual([id]);

    const reviewed = await call<{ mistake: Mistake }>('POST', `/api/mistakes/${id}/review`, {
      result: 'right',
    });
    expect(reviewed.body.mistake).toMatchObject({ step: 2, nextDueOn: '2026-10-05' });
    const bad = await call('POST', `/api/mistakes/${id}/review`, { result: 'maybe' });
    expect(bad.status).toBe(400);

    const edited = await call<{ mistake: Mistake }>('PATCH', `/api/mistakes/${id}`, {
      text: 'sign slip',
    });
    expect(edited.body.mistake.text).toBe('sign slip');
    expect((await call('DELETE', `/api/mistakes/${id}`)).status).toBe(200);
    expect((await call('DELETE', `/api/mistakes/${id}`)).status).toBe(404);
  });
});

describe('/api/exam and targets', () => {
  it('shows the next exam and manages its targets', async () => {
    const { call, byName } = await setup();
    const none = await call<ExamView>('GET', '/api/exam');
    expect(none.body.exam).toBeNull();

    const { body } = await call<{ deadline: { id: string } }>('POST', '/api/deadlines', {
      nodeId: byName('School Subjects').id,
      title: 'Finals',
      dueOn: '2026-10-26',
      isExam: true,
    });
    const deadline = body.deadline.id;
    const target = await call<{ target: ExamTarget }>(
      'POST',
      `/api/deadlines/${deadline}/targets`,
      {
        label: 'Mock 1',
        targetOn: '2026-10-10',
        minPercent: 60,
      },
    );
    expect(target.status).toBe(201);
    const view = await call<ExamView>('GET', `/api/exam?deadline=${deadline}`);
    expect(view.body.exam).toMatchObject({
      summary: { title: 'Finals', daysLeft: 23 },
      targets: [{ label: 'Mock 1', minPercent: 60 }],
      modules: [{ name: 'Maths' }, { name: 'English' }],
    });

    const id = target.body.target.id;
    const edited = await call<{ target: ExamTarget }>('PATCH', `/api/exam-targets/${id}`, {
      minPercent: 65,
    });
    expect(edited.body.target.minPercent).toBe(65);
    expect((await call('PATCH', `/api/exam-targets/${id}`, { minPercent: 120 })).status).toBe(400);
    expect((await call('DELETE', `/api/exam-targets/${id}`)).status).toBe(200);
    expect((await call('GET', '/api/exam?deadline=not-a-uuid')).status).toBe(400);
  });
});
