import { describe, expect, it, vi } from 'vitest';

import { ApiDataSource } from './ApiDataSource';
import { DataSourceError } from './DataSource';

function respond(status: number, body: unknown) {
  return vi.fn<typeof fetch>(async () => Response.json(body, { status }));
}

const node = {
  id: '00000000-0000-4000-8000-000000000001',
  parentId: null,
  depth: 1,
  name: 'German Language',
  color: 'amber',
  sortOrder: 0,
  weeklyTargetMinutes: null,
  topicStatus: null,
  topicDoneAt: null,
  archivedAt: null,
  createdAt: '2026-10-03T10:00:00.000Z',
  updatedAt: '2026-10-03T10:00:00.000Z',
};

describe('ApiDataSource', () => {
  it('posts the passcode as JSON to /api/auth/login', async () => {
    const fetchFn = respond(200, { authenticated: true });
    await new ApiDataSource(fetchFn).login('secret');
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe('/api/auth/login');
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse(String(init?.body))).toEqual({ passcode: 'secret' });
  });

  it('turns API errors into DataSourceErrors with the server message', async () => {
    const fetchFn = respond(429, { error: { code: 'locked_out', message: 'Too many attempts.' } });
    const error = await new ApiDataSource(fetchFn).login('x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataSourceError);
    expect(error).toMatchObject({ status: 429, code: 'locked_out', message: 'Too many attempts.' });
  });

  it('treats 401 from /auth/me as logged out', async () => {
    const fetchFn = respond(401, { error: { code: 'unauthenticated', message: 'Please log in.' } });
    expect(await new ApiDataSource(fetchFn).isAuthenticated()).toBe(false);
  });

  it('reports network failures in plain words', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(new ApiDataSource(fetchFn).listTree()).rejects.toMatchObject({ code: 'network' });
  });

  it('validates the tree it receives', async () => {
    expect(await new ApiDataSource(respond(200, { nodes: [node] })).listTree()).toEqual([node]);
    await expect(
      new ApiDataSource(respond(200, { nodes: [{ ...node, depth: 4 }] })).listTree(),
    ).rejects.toThrow();
  });
});
