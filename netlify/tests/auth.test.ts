// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { createLoginHandler } from '../functions/auth-login';
import { createLogoutHandler } from '../functions/auth-logout';
import { createMeHandler } from '../functions/auth-me';
import { createNodesHandler } from '../functions/nodes';
import { createSettingsHandler } from '../functions/settings';
import { context, cookieFrom, get, post, TEST_PASSCODE, testDeps } from './fakes';

function setup() {
  const t = testDeps();
  return {
    ...t,
    login: createLoginHandler(() => t.deps),
    logout: createLogoutHandler(() => t.deps),
    me: createMeHandler(() => t.deps),
  };
}

async function errorCode(response: Response): Promise<string> {
  const body = (await response.json()) as { error: { code: string } };
  return body.error.code;
}

describe('POST /api/auth/login', () => {
  it('sets a secure 30-day session cookie for the right passcode (AUTH-2)', async () => {
    const { login } = setup();
    const response = await login(post('/api/auth/login', { passcode: TEST_PASSCODE }), context);

    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^sw_session=\d{13}\.[\w-]{43}; /);
    expect(cookie).toContain('Max-Age=2592000');
    for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) {
      expect(cookie).toContain(attribute);
    }
  });

  it('rejects a wrong passcode calmly, without hints or a cookie', async () => {
    const { login } = setup();
    const response = await login(post('/api/auth/login', { passcode: 'nope' }), context);
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.json()).toEqual({
      error: { code: 'wrong_passcode', message: 'That passcode isn’t right.' },
    });
  });

  it('validates the body', async () => {
    const { login } = setup();
    expect((await login(post('/api/auth/login', 'not json'), context)).status).toBe(400);
    const empty = await login(post('/api/auth/login', { passcode: '' }), context);
    expect(empty.status).toBe(400);
    expect(await errorCode(empty)).toBe('validation');
  });

  it('seeds the starting structure on the first successful login only', async () => {
    const { login, repo } = setup();
    await login(post('/api/auth/login', { passcode: 'wrong' }), context);
    expect(await repo.listNodes()).toHaveLength(0);

    await login(post('/api/auth/login', { passcode: TEST_PASSCODE }), context);
    await login(post('/api/auth/login', { passcode: TEST_PASSCODE }), context);
    expect(await repo.listNodes()).toHaveLength(7);
  });
});

describe('lockout (AUTH-5)', () => {
  it('locks an IP for 15 minutes after 5 wrong passcodes within 15 minutes', async () => {
    const { login, advance } = setup();
    const wrong = () => login(post('/api/auth/login', { passcode: 'wrong' }), context);

    for (let i = 0; i < 4; i++) expect((await wrong()).status).toBe(401);
    const fifth = await wrong();
    expect(fifth.status).toBe(429);
    expect(fifth.headers.get('retry-after')).toBe('900');

    // Even the right passcode is refused while locked.
    advance(14 * 60_000);
    const right = await login(post('/api/auth/login', { passcode: TEST_PASSCODE }), context);
    expect(right.status).toBe(429);
    expect(await errorCode(right)).toBe('locked_out');

    advance(60_000);
    expect(
      (await login(post('/api/auth/login', { passcode: TEST_PASSCODE }), context)).status,
    ).toBe(200);
  });

  it('locks only the offending IP and stores it hashed', async () => {
    const { login, loginAttempts } = setup();
    for (let i = 0; i < 5; i++)
      await login(post('/api/auth/login', { passcode: 'wrong' }), context);

    const other = await login(post('/api/auth/login', { passcode: TEST_PASSCODE }), {
      ip: '198.51.100.1',
    });
    expect(other.status).toBe(200);
    expect(loginAttempts.rows.every((r) => /^[0-9a-f]{64}$/.test(r.ipHash))).toBe(true);
    expect(JSON.stringify(loginAttempts.rows)).not.toContain(context.ip);
  });

  it('clears the failure count after a successful login', async () => {
    const { login, loginAttempts } = setup();
    for (let i = 0; i < 4; i++)
      await login(post('/api/auth/login', { passcode: 'wrong' }), context);
    await login(post('/api/auth/login', { passcode: TEST_PASSCODE }), context);
    expect(loginAttempts.rows).toHaveLength(0);
  });
});

describe('session checks (AUTH-3, AUTH-4)', () => {
  it('accepts the session cookie on protected routes and rejects requests without one', async () => {
    const { login, me, deps } = setup();
    const cookie = cookieFrom(
      await login(post('/api/auth/login', { passcode: TEST_PASSCODE }), context),
    );

    expect((await me(get('/api/auth/me', { cookie }), context)).status).toBe(200);
    expect((await me(get('/api/auth/me'), context)).status).toBe(401);

    const nodes = createNodesHandler(() => deps);
    const settings = createSettingsHandler(() => deps);
    expect((await nodes(get('/api/nodes'), context)).status).toBe(401);
    expect((await settings(get('/api/settings'), context)).status).toBe(401);
    const tree = (await (await nodes(get('/api/nodes', { cookie }), context)).json()) as {
      nodes: unknown[];
    };
    expect(tree.nodes).toHaveLength(7);
  });

  it('rejects tampered, expired, and old-passcode sessions', async () => {
    const { login, me, deps, advance } = setup();
    const cookie = cookieFrom(
      await login(post('/api/auth/login', { passcode: TEST_PASSCODE }), context),
    );

    const tampered = cookie.replace(/=(\d)/, (_, d: string) => `=${(Number(d) + 1) % 10}`);
    expect((await me(get('/api/auth/me', { cookie: tampered }), context)).status).toBe(401);

    const changedPasscode = createMeHandler(() => ({
      ...deps,
      env: { ...deps.env, APP_PASSCODE: 'new one' },
    }));
    expect((await changedPasscode(get('/api/auth/me', { cookie }), context)).status).toBe(401);

    advance(30 * 24 * 60 * 60_000);
    expect((await me(get('/api/auth/me', { cookie }), context)).status).toBe(401);
  });

  it('logout clears the cookie', async () => {
    const { login, logout } = setup();
    const cookie = cookieFrom(
      await login(post('/api/auth/login', { passcode: TEST_PASSCODE }), context),
    );
    const response = await logout(post('/api/auth/logout', {}, { cookie }), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(/^sw_session=; Max-Age=0; /);
  });
});

describe('logging (OPS-3)', () => {
  it('never logs the passcode or the IP', async () => {
    const { login } = setup();
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    await login(post('/api/auth/login', { passcode: 'my-wrong-guess' }), context);
    await login(post('/api/auth/login', { passcode: TEST_PASSCODE }), context);
    const output = [...spy.mock.calls, ...info.mock.calls].flat().join('\n');
    expect(output).toContain('login_failed');
    expect(output).not.toContain('my-wrong-guess');
    expect(output).not.toContain(TEST_PASSCODE);
    expect(output).not.toContain(context.ip);
    spy.mockRestore();
    info.mockRestore();
  });
});
