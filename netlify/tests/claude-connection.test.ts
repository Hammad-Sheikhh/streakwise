// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { hashMcpToken } from '../functions/_lib/mcpToken';
import { createLoginHandler } from '../functions/auth-login';
import { createClaudeConnectionHandler } from '../functions/claude-connection';
import { context, cookieFrom, LOGIN, post, testDeps } from './fakes';

async function setup() {
  const t = testDeps();
  const getDeps = () => t.deps;
  const cookie = cookieFrom(
    await createLoginHandler(getDeps)(post('/api/auth/login', LOGIN), context),
  );
  const handler = createClaudeConnectionHandler(getDeps);
  const call = (method: 'GET' | 'POST', withCookie = true) =>
    handler(
      new Request('https://preview--streakwise.example/api/claude-connection', {
        method,
        headers: withCookie ? { cookie } : {},
      }),
      context,
    );
  return { ...t, call };
}

describe('/api/claude-connection (SET-4, ACCT-8)', () => {
  it('needs a login', async () => {
    const { call } = await setup();
    expect((await call('GET', false)).status).toBe(401);
    expect((await call('POST', false)).status).toBe(401);
  });

  it('says there is no link yet, with the last MCP call', async () => {
    const { call, repo } = await setup();
    await repo.recordMcpCall('2026-10-03T09:00:00.000Z');
    const response = await call('GET');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      url: null,
      hasLink: false,
      lastMcpCallAt: '2026-10-03T09:00:00.000Z',
    });
  });

  it('creates a link for this site once, storing only its hash', async () => {
    const { call, accounts, user } = await setup();
    const created = (await (await call('POST')).json()) as { url: string; hasLink: boolean };
    expect(created.hasLink).toBe(true);
    const token = /^https:\/\/preview--streakwise\.example\/mcp\/([\w-]{43})$/.exec(
      created.url,
    )?.[1];
    expect(token).toBeDefined();
    expect(accounts.mcpTokenHashes.get(user.id)).toBe(hashMcpToken(token ?? ''));

    expect(await (await call('GET')).json()).toMatchObject({ url: null, hasLink: true });
  });

  it('replaces the old link when a new one is made', async () => {
    const { call, accounts, user } = await setup();
    await call('POST');
    const first = accounts.mcpTokenHashes.get(user.id);
    await call('POST');
    expect(accounts.mcpTokenHashes.get(user.id)).not.toBe(first);
  });
});
