// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { seedIfEmpty } from '../../src/core/services/seed';
import { createAccountHandler } from '../functions/auth-account';
import { createConfirmHandler } from '../functions/auth-confirm';
import { createForgotHandler } from '../functions/auth-forgot';
import { createLoginHandler } from '../functions/auth-login';
import { createLogoutHandler } from '../functions/auth-logout';
import { createMeHandler } from '../functions/auth-me';
import { createPasscodeHandler } from '../functions/auth-passcode';
import { createPasswordHandler } from '../functions/auth-password';
import { createSignUpHandler } from '../functions/auth-signup';
import { createStatusHandler } from '../functions/auth-status';
import { createNodesHandler } from '../functions/nodes';
import { InMemoryRepository } from '../../src/core/repo/InMemoryRepository';
import {
  context,
  cookieFrom,
  get,
  LOGIN,
  post,
  TEST_EMAIL,
  TEST_PASSCODE,
  TEST_PASSWORD,
  testDeps,
} from './fakes';

function setup() {
  const t = testDeps();
  const getDeps = () => t.deps;
  return {
    ...t,
    login: createLoginHandler(getDeps),
    logout: createLogoutHandler(getDeps),
    me: createMeHandler(getDeps),
    signUp: createSignUpHandler(getDeps),
    confirm: createConfirmHandler(getDeps),
    forgot: createForgotHandler(getDeps),
    passcode: createPasscodeHandler(getDeps),
    status: createStatusHandler(getDeps),
    password: createPasswordHandler(getDeps),
    account: createAccountHandler(getDeps),
    nodes: createNodesHandler(getDeps),
  };
}

async function errorCode(response: Response): Promise<string> {
  const body = (await response.json()) as { error: { code: string } };
  return body.error.code;
}

const NEW_USER = { name: 'New Student', email: 'new@example.com', password: 'a good password' };

describe('POST /api/auth/login (ACCT-3)', () => {
  it('sets a secure 30-day session cookie for the right email and password', async () => {
    const { login } = setup();
    const response = await login(post('/api/auth/login', LOGIN), context);

    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^sw_session=[\w-]{36}\.\d{13}\.\d{13}\.[\w-]{43}; /);
    expect(cookie).toContain('Max-Age=2592000');
    for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) {
      expect(cookie).toContain(attribute);
    }
  });

  it('rejects wrong details with one calm message and no cookie', async () => {
    const { login } = setup();
    for (const body of [
      { email: TEST_EMAIL, password: 'nope' },
      { email: 'nobody@example.com', password: TEST_PASSWORD },
    ]) {
      const response = await login(post('/api/auth/login', body), context);
      expect(response.status).toBe(401);
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(await errorCode(response)).toBe('wrong_login');
    }
  });

  it('treats the email case-insensitively and validates the body', async () => {
    const { login } = setup();
    const upper = { email: ` ${TEST_EMAIL.toUpperCase()} `, password: TEST_PASSWORD };
    expect((await login(post('/api/auth/login', upper), context)).status).toBe(200);
    expect((await login(post('/api/auth/login', 'not json'), context)).status).toBe(400);
    const bad = await login(post('/api/auth/login', { email: 'x', password: '' }), context);
    expect(await errorCode(bad)).toBe('validation');
  });

  it('seeds a new account on its first login only (ACCT-6)', async () => {
    const { login, repo } = setup();
    await login(post('/api/auth/login', LOGIN), context);
    await login(post('/api/auth/login', LOGIN), context);
    expect(await repo.listNodes()).toHaveLength(7);
  });
});

describe('lockout (AUTH-5)', () => {
  const wrong = { email: TEST_EMAIL, password: 'wrong' };

  it('locks an IP for 15 minutes after 5 wrong passwords within 15 minutes', async () => {
    const { login, advance } = setup();
    for (let i = 0; i < 4; i++) {
      expect((await login(post('/api/auth/login', wrong), context)).status).toBe(401);
    }
    const fifth = await login(post('/api/auth/login', wrong), context);
    expect(fifth.status).toBe(429);
    expect(fifth.headers.get('retry-after')).toBe('900');

    advance(14 * 60_000);
    const right = await login(post('/api/auth/login', LOGIN), context);
    expect(await errorCode(right)).toBe('locked_out');

    advance(60_000);
    expect((await login(post('/api/auth/login', LOGIN), context)).status).toBe(200);
  });

  it('locks only the offending IP, stores it hashed, and clears it after a login', async () => {
    const { login, loginAttempts } = setup();
    for (let i = 0; i < 5; i++) await login(post('/api/auth/login', wrong), context);
    expect((await login(post('/api/auth/login', LOGIN), { ip: '198.51.100.1' })).status).toBe(200);
    expect(loginAttempts.rows.every((r) => /^[0-9a-f]{64}$/.test(r.ipHash))).toBe(true);
    expect(JSON.stringify(loginAttempts.rows)).not.toContain(context.ip);
  });
});

describe('sign-up and email links (ACCT-1, ACCT-2)', () => {
  it('asks to confirm the email, then logs in from the link', async () => {
    const { signUp, login, confirm, me, auth, accounts } = setup();
    const response = await signUp(
      new Request('https://preview.example/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(NEW_USER),
      }),
      context,
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: 'confirm_email' });
    expect(response.headers.get('set-cookie')).toBeNull();

    const notYet = await login(post('/api/auth/login', NEW_USER), context);
    expect(await errorCode(notYet)).toBe('email_not_confirmed');

    const link = auth.sent[0];
    expect(link).toMatchObject({ type: 'signup', origin: 'https://preview.example' });
    const opened = await confirm(
      get(`/auth/confirm?token_hash=${link?.tokenHash}&type=signup`),
      context,
    );
    expect(opened.status).toBe(303);
    expect(opened.headers.get('location')).toBe('/');
    const cookie = cookieFrom(opened);
    expect(cookie).toMatch(/^sw_session=/);

    const who = await me(get('/api/auth/me', { cookie }), context);
    expect(await who.json()).toMatchObject({
      authenticated: true,
      user: { email: NEW_USER.email, name: NEW_USER.name },
    });
    // The new account got its own seed.
    const newId = auth.accounts.find((a) => a.email === NEW_USER.email)?.id ?? '';
    expect(await accounts.repoFor(newId).listNodes()).toHaveLength(7);
  });

  it('sends a used or unknown link back to the login page', async () => {
    const { confirm } = setup();
    const bad = await confirm(get('/auth/confirm?token_hash=nope&type=signup'), context);
    expect(bad.headers.get('location')).toBe('/login?link=expired');
    const malformed = await confirm(get('/auth/confirm?type=other'), context);
    expect(malformed.headers.get('location')).toBe('/login?link=invalid');
  });

  it('logs in at once when email confirmation is off', async () => {
    const { signUp, auth } = setup();
    auth.confirmEmails = false;
    const response = await signUp(post('/api/auth/signup', NEW_USER), context);
    expect(await response.json()).toEqual({ status: 'signed_in' });
    expect(cookieFrom(response)).toMatch(/^sw_session=/);
  });

  it('validates the sign-up form', async () => {
    const { signUp } = setup();
    const short = await signUp(
      post('/api/auth/signup', { ...NEW_USER, password: 'short' }),
      context,
    );
    expect(short.status).toBe(400);
    expect(await short.json()).toMatchObject({ error: { message: 'Use at least 8 characters.' } });
  });

  it('limits sign-ups to 5 per IP per hour (ACCT-10)', async () => {
    const { signUp, advance } = setup();
    for (let i = 0; i < 5; i++) {
      const body = { ...NEW_USER, email: `user${i}@example.com` };
      expect((await signUp(post('/api/auth/signup', body), context)).status).toBe(201);
    }
    const sixth = await signUp(post('/api/auth/signup', NEW_USER), context);
    expect(sixth.status).toBe(429);
    expect((await signUp(post('/api/auth/signup', NEW_USER), { ip: '198.51.100.1' })).status).toBe(
      201,
    );
    advance(60 * 60_000 + 1);
    expect((await signUp(post('/api/auth/signup', NEW_USER), context)).status).toBe(201);
  });
});

describe('forgot and change password (ACCT-4, ACCT-9)', () => {
  it('gives the same answer for known and unknown emails', async () => {
    const { forgot, auth } = setup();
    const known = await forgot(post('/api/auth/forgot', { email: TEST_EMAIL }), context);
    const unknown = await forgot(post('/api/auth/forgot', { email: 'no@example.com' }), context);
    expect(await known.json()).toEqual(await unknown.json());
    expect(auth.sent.map((s) => s.email)).toEqual([TEST_EMAIL]);
  });

  it('lets a reset link set a new password without the old one, once', async () => {
    const { forgot, confirm, password, me, login, auth } = setup();
    await forgot(post('/api/auth/forgot', { email: TEST_EMAIL }), context);
    const opened = await confirm(
      get(`/auth/confirm?token_hash=${auth.sent[0]?.tokenHash}&type=recovery`),
      context,
    );
    expect(opened.headers.get('location')).toBe('/reset-password');
    const cookie = cookieFrom(opened);
    expect(cookie).toContain('sw_recovery=');
    expect(await (await me(get('/api/auth/me', { cookie }), context)).json()).toMatchObject({
      recovering: true,
    });

    const changed = await password(
      post('/api/auth/password', { newPassword: 'brand new password' }, { cookie }),
      context,
    );
    expect(changed.status).toBe(200);
    expect(changed.headers.getSetCookie().some((c) => c.startsWith('sw_recovery=;'))).toBe(true);
    const fresh = { email: TEST_EMAIL, password: 'brand new password' };
    expect((await login(post('/api/auth/login', fresh), context)).status).toBe(200);
    expect((await login(post('/api/auth/login', LOGIN), context)).status).toBe(401);
  });

  it('needs the current password otherwise, and logs out other devices', async () => {
    const { login, password, me, advance } = setup();
    const other = cookieFrom(await login(post('/api/auth/login', LOGIN), context));
    advance(1000);
    const cookie = cookieFrom(await login(post('/api/auth/login', LOGIN), context));

    const missing = await password(
      post('/api/auth/password', { newPassword: 'brand new password' }, { cookie }),
      context,
    );
    expect(missing.status).toBe(400);
    const wrong = await password(
      post(
        '/api/auth/password',
        { currentPassword: 'wrong', newPassword: 'brand new password' },
        { cookie },
      ),
      context,
    );
    expect(await errorCode(wrong)).toBe('wrong_password');

    advance(1000);
    const changed = await password(
      post(
        '/api/auth/password',
        { currentPassword: TEST_PASSWORD, newPassword: 'brand new password' },
        { cookie },
      ),
      context,
    );
    expect(changed.status).toBe(200);
    const renewed = cookieFrom(changed);
    expect((await me(get('/api/auth/me', { cookie: renewed }), context)).status).toBe(200);
    expect((await me(get('/api/auth/me', { cookie: other }), context)).status).toBe(401);
  });
});

describe('claiming the data from before accounts (ACCT-7)', () => {
  async function withOldData() {
    const t = setup();
    const old = new InMemoryRepository(t.deps.clock);
    await seedIfEmpty(old, t.deps.newId);
    await old.updateSettings({ studentName: 'Demo Student' });
    t.accounts.unclaimed = old;
    return { ...t, old };
  }

  it('moves the old data to the account that logs in after the passcode', async () => {
    const { status, passcode, login, nodes, accounts, user, old } = await withOldData();
    expect(await (await status(get('/api/auth/status'), context)).json()).toEqual({
      claimAvailable: true,
      claimReady: false,
    });

    const wrong = await passcode(post('/api/auth/passcode', { passcode: 'nope' }), context);
    expect(await errorCode(wrong)).toBe('wrong_passcode');
    const right = await passcode(post('/api/auth/passcode', { passcode: TEST_PASSCODE }), context);
    const claimCookie = cookieFrom(right);
    expect(right.headers.get('set-cookie')).toContain('SameSite=Lax');
    expect(
      await (await status(get('/api/auth/status', { cookie: claimCookie }), context)).json(),
    ).toEqual({ claimAvailable: true, claimReady: true });

    const loggedIn = await login(post('/api/auth/login', LOGIN, { cookie: claimCookie }), context);
    expect(await loggedIn.json()).toEqual({ authenticated: true, claimed: true });
    expect(loggedIn.headers.getSetCookie().some((c) => c.startsWith('sw_claim=;'))).toBe(true);
    expect(accounts.repos.get(user.id)).toBe(old);
    expect((await old.getSettings()).studentName).toBe('Demo Student');

    const cookie = cookieFrom(loggedIn);
    const tree = (await (await nodes(get('/api/nodes', { cookie }), context)).json()) as {
      nodes: unknown[];
    };
    expect(tree.nodes).toHaveLength(7);
    expect(await (await status(get('/api/auth/status'), context)).json()).toEqual({
      claimAvailable: false,
      claimReady: false,
    });
  });

  it('does nothing without the passcode step', async () => {
    const { login, accounts, user, old } = await withOldData();
    await login(post('/api/auth/login', LOGIN), context);
    expect(accounts.repos.get(user.id)).not.toBe(old);
    expect(accounts.unclaimed).toBe(old);
  });

  it('refuses the passcode once nothing is left to claim', async () => {
    const { passcode } = setup();
    const response = await passcode(
      post('/api/auth/passcode', { passcode: TEST_PASSCODE }),
      context,
    );
    expect(await errorCode(response)).toBe('nothing_to_claim');
  });
});

describe('sessions, logout, and deleting the account (AUTH-3, AUTH-4, ACCT-5, ACCT-9)', () => {
  it('keeps each user to their own data', async () => {
    const { login, nodes, auth, accounts } = setup();
    const other = auth.addUser('other@example.com', 'other password');
    await accounts.repoFor(other.id).insertNode({
      id: '00000000-0000-4000-8000-0000000000ff',
      parentId: null,
      name: 'Private track',
      color: 'blue',
      sortOrder: 0,
      topicStatus: null,
    });
    const cookie = cookieFrom(await login(post('/api/auth/login', LOGIN), context));
    const body = await (await nodes(get('/api/nodes', { cookie }), context)).text();
    expect(body).not.toContain('Private track');
    expect((await nodes(get('/api/nodes'), context)).status).toBe(401);
  });

  it('rejects tampered and expired sessions', async () => {
    const { login, me, advance } = setup();
    const cookie = cookieFrom(await login(post('/api/auth/login', LOGIN), context));
    const tampered = cookie.replace(/=([0-9a-f])/, (_, d: string) => `=${d === '0' ? '1' : '0'}`);
    expect((await me(get('/api/auth/me', { cookie: tampered }), context)).status).toBe(401);
    advance(30 * 24 * 60 * 60_000);
    expect((await me(get('/api/auth/me', { cookie }), context)).status).toBe(401);
  });

  it('logout clears the cookie, even without a valid session', async () => {
    const { logout } = setup();
    const response = await logout(post('/api/auth/logout', {}), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(/^sw_session=; Max-Age=0; /);
  });

  it('deletes the account and its data after the password and DELETE', async () => {
    const { login, account, me, accounts, user } = setup();
    const cookie = cookieFrom(await login(post('/api/auth/login', LOGIN), context));
    const remove = (body: unknown) =>
      account(
        new Request('http://localhost/api/auth/account', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify(body),
        }),
        context,
      );
    expect((await remove({ password: TEST_PASSWORD, confirm: 'delete' })).status).toBe(400);
    expect(await errorCode(await remove({ password: 'wrong', confirm: 'DELETE' }))).toBe(
      'wrong_password',
    );
    expect((await remove({ password: TEST_PASSWORD, confirm: 'DELETE' })).status).toBe(200);
    expect(accounts.repos.has(user.id)).toBe(false);
    expect((await me(get('/api/auth/me', { cookie }), context)).status).toBe(401);
  });
});

describe('logging (OPS-3)', () => {
  it('never logs passwords, the passcode, emails, or the IP', async () => {
    const { login, passcode } = setup();
    const spies = (['warn', 'info', 'error'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {}),
    );
    await login(
      post('/api/auth/login', { email: TEST_EMAIL, password: 'my-wrong-guess' }),
      context,
    );
    await login(post('/api/auth/login', LOGIN), context);
    await passcode(post('/api/auth/passcode', { passcode: TEST_PASSCODE }), context);
    const output = spies.flatMap((spy) => spy.mock.calls.flat()).join('\n');
    expect(output).toContain('login_failed');
    for (const secret of ['my-wrong-guess', TEST_PASSWORD, TEST_PASSCODE, TEST_EMAIL, context.ip]) {
      expect(output).not.toContain(secret);
    }
    for (const spy of spies) spy.mockRestore();
  });
});
