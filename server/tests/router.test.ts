// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import type { RequestHandler } from '../functions/_lib/api';

// The single dispatch entry replaces the old per-file `config.path`/`method` exports. These tests
// pin the platform-level behavior: right params, right method rejection, unknown paths 404. Real
// deps are never built — `getDeps` throws — because only stubbed or trivial handlers should run.

const realUrl = (path: string, method = 'GET'): Request =>
  new Request(`https://streakwise.test${path}`, { method });

type Dispatcher = (request: Request, ip: string) => Promise<Response>;

/** A handler that records how it was called and answers `body`. */
function stubResponse(
  body = 'stub',
): RequestHandler & { calls: Array<{ ip: string; params: Record<string, string> }> } {
  const calls: Array<{ ip: string; params: Record<string, string> }> = [];
  const fn = async (
    _request: Request,
    context: { ip: string; params?: Record<string, string> },
  ) => {
    calls.push({ ip: context.ip, params: context.params ?? {} });
    return new Response(body);
  };
  return Object.assign(fn, { calls });
}

const neverDeps = (): never => {
  throw new Error('deps must not be built');
};

async function dispatcherWithStub(
  moduleName: string,
  factoryName: string,
): Promise<Dispatcher & { handler: ReturnType<typeof stubResponse> }> {
  const handler = stubResponse();
  vi.doMock(moduleName, () => ({ [factoryName]: () => handler }));
  vi.resetModules();
  const { createDispatcher: fresh } = await import('../functions/_lib/router');
  return Object.assign((request: Request, ip: string) => fresh(neverDeps)(request, ip), {
    handler,
  });
}

describe('router', () => {
  it('routes DELETE /api/shares/:id with the id in context.params', async () => {
    const d = await dispatcherWithStub('../functions/share', 'createShareHandler');
    const response = await d(realUrl('/api/shares/s9', 'DELETE'), '203.0.113.9');
    expect(await response.text()).toBe('stub');
    expect(d.handler.calls).toEqual([{ ip: '203.0.113.9', params: { id: 's9' } }]);
  });

  it('routes POST /api/nodes/:id/move with the id', async () => {
    const d = await dispatcherWithStub('../functions/node-move', 'createNodeMoveHandler');
    await d(realUrl('/api/nodes/n1/move', 'POST'), '203.0.113.9');
    expect(d.handler.calls[0]?.params).toEqual({ id: 'n1' });
  });

  it('routes /mcp/:secret with the secret and the request ip', async () => {
    const d = await dispatcherWithStub('../functions/mcp', 'createMcpFunction');
    await d(realUrl('/mcp/tok'), '198.51.100.9');
    expect(d.handler.calls[0]).toEqual({ ip: '198.51.100.9', params: { secret: 'tok' } });
  });

  it('answers 405 with Allow when the method is not on the route', async () => {
    vi.resetModules();
    const { createDispatcher: fresh } = await import('../functions/_lib/router');
    const response = await fresh(neverDeps)(realUrl('/api/health', 'POST'), '0.0.0.0');
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
  });

  it('answers the plain 404 for unknown /api, /auth and /mcp paths', async () => {
    vi.resetModules();
    const { createDispatcher: fresh } = await import('../functions/_lib/router');
    const d = fresh(neverDeps);
    for (const path of ['/', '/api/unknown', '/api/nodes/', '/auth/unknown', '/mcp/a/b']) {
      const response = await d(realUrl(path), '0.0.0.0');
      expect(response.status, `${path} answered ${response.status}`).toBe(404);
      expect(response.headers.get('content-type')).toContain('text/plain');
    }
  });

  it('routes GET /api/health to the trivial handler', async () => {
    vi.resetModules();
    const { createDispatcher: fresh } = await import('../functions/_lib/router');
    const response = await fresh(neverDeps)(realUrl('/api/health'), '0.0.0.0');
    expect(response.status).toBe(200);
  });

  it('does not match route patterns across segment counts', async () => {
    vi.resetModules();
    const { createDispatcher: fresh } = await import('../functions/_lib/router');
    const d = fresh(neverDeps);
    expect((await d(realUrl('/api/tasks/t1/undo'), '0.0.0.0')).status).toBe(404);
  });
});
