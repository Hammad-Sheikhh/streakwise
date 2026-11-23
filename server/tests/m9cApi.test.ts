// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type {
  BackupSummary,
  DataExport,
  HistoryPage,
  TreeNode,
} from '../../src/core/domain/types.js';
import { createLoginHandler } from '../functions/auth-login.js';
import { createDispatcher } from '../functions/_lib/router.js';
import { context, cookieFrom, LOGIN, post, testDeps } from './fakes.js';

// DATA-1–4 through the route table: notes search in history, export v2, and restore.

async function setup() {
  const t = testDeps();
  const getDeps = () => t.deps;
  const cookie = cookieFrom(
    await createLoginHandler(getDeps)(post('/api/auth/login', LOGIN), context),
  );
  const dispatch = createDispatcher(getDeps);
  const send = async (method: string, path: string, body?: string, headers = {}) => {
    const response = await dispatch(
      new Request(`http://localhost${path}`, {
        method,
        headers: { cookie, 'Content-Type': 'application/json', ...headers },
        body,
      }),
      context.ip,
    );
    return { status: response.status, body: (await response.json()) as unknown };
  };
  const { body } = await send('GET', '/api/nodes');
  const maths = (body as { nodes: TreeNode[] }).nodes.find((n) => n.name === 'Maths');
  if (!maths) throw new Error('no Maths');
  return { send, maths };
}

describe('/api/restore (DATA-3, DATA-4)', () => {
  it('restores an export and refuses broken or oversized files', async () => {
    const { send, maths } = await setup();
    await send(
      'POST',
      '/api/sessions',
      JSON.stringify({ nodeId: maths.id, studiedOn: '2026-10-02', minutes: 40, note: 'Day 1' }),
    );
    const exported = (await send('POST', '/api/export')).body as DataExport;
    expect(exported.formatVersion).toBe(2);

    await send(
      'POST',
      '/api/sessions',
      JSON.stringify({ nodeId: maths.id, studiedOn: '2026-10-03', minutes: 5 }),
    );
    const restored = await send('POST', '/api/restore', JSON.stringify(exported));
    expect(restored.status).toBe(200);
    expect((restored.body as { summary: BackupSummary }).summary.counts.sessions).toBe(1);

    const history = (await send('GET', '/api/sessions?noteContains=day')).body as HistoryPage;
    expect(history.days.flatMap((d) => d.sessions.map((s) => s.minutes))).toEqual([40]);

    expect((await send('POST', '/api/restore', 'not json')).status).toBe(400);
    const broken = await send('POST', '/api/restore', JSON.stringify({ ...exported, nodes: [] }));
    expect(broken).toMatchObject({ status: 400, body: { error: { code: 'backup_invalid' } } });
    const huge = await send('POST', '/api/restore', '{}', {
      'Content-Length': String(5 * 1024 * 1024),
    });
    expect(huge.status).toBe(413);
  });
});
