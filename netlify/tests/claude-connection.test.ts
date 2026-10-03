// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createLoginHandler } from '../functions/auth-login';
import { createClaudeConnectionHandler } from '../functions/claude-connection';
import { context, cookieFrom, post, TEST_PASSCODE, testDeps } from './fakes';

const SECRET = 'test-mcp-secret-0123456789abcdefghijklmnop';

async function setup(secret: string | undefined) {
  const t = testDeps();
  t.deps.env.MCP_SECRET = secret;
  const getDeps = () => t.deps;
  const cookie = cookieFrom(
    await createLoginHandler(getDeps)(
      post('/api/auth/login', { passcode: TEST_PASSCODE }),
      context,
    ),
  );
  const handler = createClaudeConnectionHandler(getDeps);
  const fetchConnection = (withCookie = true) =>
    handler(
      new Request('https://preview--streakwise.example/api/claude-connection', {
        headers: withCookie ? { cookie } : {},
      }),
      context,
    );
  return { ...t, fetchConnection };
}

describe('GET /api/claude-connection (SET-4)', () => {
  it('needs a login', async () => {
    const { fetchConnection } = await setup(SECRET);
    expect((await fetchConnection(false)).status).toBe(401);
  });

  it('returns the connector URL for this site and the last MCP call', async () => {
    const { fetchConnection, repo } = await setup(SECRET);
    await repo.recordMcpCall('2026-10-03T09:00:00.000Z');
    const response = await fetchConnection();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      url: `https://preview--streakwise.example/mcp/${SECRET}`,
      lastMcpCallAt: '2026-10-03T09:00:00.000Z',
    });
  });

  it('returns no URL when the secret is missing or too short', async () => {
    for (const secret of [undefined, 'short']) {
      const { fetchConnection } = await setup(secret);
      expect(await (await fetchConnection()).json()).toEqual({ url: null, lastMcpCallAt: null });
    }
  });
});
