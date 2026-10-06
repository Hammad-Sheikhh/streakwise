// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { Score, TreeNode } from '../../src/core/domain/types';
import { createLoginHandler } from '../functions/auth-login';
import { createNodesHandler } from '../functions/nodes';
import { createScoreHandler } from '../functions/score';
import { createScoresHandler } from '../functions/scores';
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
  return {
    request,
    nodes,
    withId: (id: string) => ({ ...context, params: { id } }),
    scores: createScoresHandler(getDeps),
    score: createScoreHandler(getDeps),
  };
}

describe('/api/scores', () => {
  it('requires a session', async () => {
    const api = await setup();
    const response = await api.scores(api.request('GET', '/api/scores', undefined, false), context);
    expect(response.status).toBe(401);
  });

  it('records, lists, edits, and deletes a score', async () => {
    const api = await setup();
    const nodeId = api.nodes.find((n) => n.name === 'English')?.id;
    const body = {
      nodeId,
      kind: 'quiz',
      title: 'Quiz 1',
      takenOn: '2026-10-01',
      score: 8,
      maxScore: 10,
    };

    const bad = await api.scores(
      api.request('POST', '/api/scores', { ...body, score: 11 }),
      context,
    );
    expect(bad.status).toBe(400);

    const created = await api.scores(api.request('POST', '/api/scores', body), context);
    expect(created.status).toBe(201);
    const { score } = (await created.json()) as { score: Score };

    const list = await api.scores(api.request('GET', '/api/scores'), context);
    expect(((await list.json()) as { scores: Score[] }).scores).toHaveLength(1);

    const patched = await api.score(
      api.request('PATCH', `/api/scores/${score.id}`, { score: 9 }),
      api.withId(score.id),
    );
    expect(((await patched.json()) as { score: Score }).score.score).toBe(9);

    const path = `/api/scores/${score.id}`;
    const deleted = await api.score(api.request('DELETE', path), api.withId(score.id));
    expect(deleted.status).toBe(200);
    const missing = await api.score(api.request('DELETE', path), api.withId(score.id));
    expect(missing.status).toBe(404);
  });
});
