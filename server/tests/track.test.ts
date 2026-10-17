// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { TrackOverview, TreeNode } from '../../src/core/domain/types';
import { createLoginHandler } from '../functions/auth-login';
import { createNodesHandler } from '../functions/nodes';
import { createTrackHandler } from '../functions/track';
import { context, cookieFrom, post, LOGIN, testDeps } from './fakes';

describe('/api/tracks/:id (TRACK-1)', () => {
  it('needs a session, returns a track overview, and 404s for anything else', async () => {
    const t = testDeps();
    const getDeps = () => t.deps;
    const cookie = cookieFrom(
      await createLoginHandler(getDeps)(post('/api/auth/login', LOGIN), context),
    );
    const get = (id: string, withCookie = true) =>
      createTrackHandler(getDeps)(
        new Request(`http://localhost/api/tracks/${id}`, {
          headers: withCookie ? { cookie } : {},
        }),
        { ...context, params: { id } },
      );
    const nodesResponse = await createNodesHandler(getDeps)(
      new Request('http://localhost/api/nodes', { headers: { cookie } }),
      context,
    );
    const { nodes } = (await nodesResponse.json()) as { nodes: TreeNode[] };
    const track = nodes.find((n) => n.depth === 1);
    const subtask = nodes.find((n) => n.depth === 2);
    if (!track || !subtask) throw new Error('seed is missing nodes');

    expect((await get(track.id, false)).status).toBe(401);
    const ok = await get(track.id);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as TrackOverview).trackId).toBe(track.id);
    expect((await get(subtask.id)).status).toBe(404);
  });
});
