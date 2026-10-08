import { conflict } from '../../src/core/domain/errors';
import { InMemoryRepository } from '../../src/core/repo/InMemoryRepository';
import type { AccountStore, AuthRequestKind } from '../functions/_lib/accounts';
import type {
  AuthProvider,
  AuthUser,
  EmailLinkType,
  SignUpResult,
} from '../functions/_lib/authProvider';
import type { ServerDeps } from '../functions/_lib/deps';
import { HttpError } from '../functions/_lib/http';
import type { LoginAttemptStore } from '../functions/_lib/loginAttempts';

// In-memory stand-ins for the server's dependencies. Values here are test-only, never real secrets.

export class InMemoryLoginAttemptStore implements LoginAttemptStore {
  readonly rows: { ipHash: string; at: Date }[] = [];

  async failuresSince(ipHash: string, since: Date): Promise<Date[]> {
    return this.rows.filter((r) => r.ipHash === ipHash && r.at >= since).map((r) => r.at);
  }

  async recordFailure(ipHash: string, at: Date): Promise<void> {
    this.rows.push({ ipHash, at });
  }

  async clear(ipHash: string): Promise<void> {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i]?.ipHash === ipHash) this.rows.splice(i, 1);
    }
  }
}

interface FakeAccount extends AuthUser {
  password: string;
  confirmed: boolean;
}

/** Supabase Auth in memory. Email links are recorded in `sent` instead of being emailed. */
export class FakeAuthProvider implements AuthProvider {
  readonly accounts: FakeAccount[] = [];
  readonly sent: { type: EmailLinkType; email: string; tokenHash: string; origin: string }[] = [];
  /** Supabase's "Confirm email" setting (on once SMTP is set up). */
  confirmEmails = true;
  private count = 0;

  constructor(private readonly onDelete: (userId: string) => void) {}

  addUser(email: string, password: string, name = 'Test User'): AuthUser {
    const id = `00000000-0000-4000-9000-${String(++this.count).padStart(12, '0')}`;
    this.accounts.push({ id, email, name, password, confirmed: true });
    return { id, email, name };
  }

  private link(type: EmailLinkType, email: string, origin: string): void {
    this.sent.push({ type, email, tokenHash: `hash-${this.sent.length + 1}`, origin });
  }

  async signUp(input: {
    email: string;
    password: string;
    name: string;
    origin: string;
  }): Promise<SignUpResult> {
    const existing = this.accounts.find((a) => a.email === input.email);
    if (existing && !this.confirmEmails) {
      throw new HttpError(409, 'email_taken', 'An account with this email already exists.');
    }
    if (existing) return { kind: 'confirm_email' }; // Supabase hides duplicates
    const user = this.addUser(input.email, input.password, input.name);
    const account = this.accounts.find((a) => a.id === user.id);
    if (account) account.confirmed = !this.confirmEmails;
    if (!this.confirmEmails) return { kind: 'signed_in', user };
    this.link('signup', input.email, input.origin);
    return { kind: 'confirm_email' };
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const account = this.accounts.find((a) => a.email === email && a.password === password);
    if (!account) throw new HttpError(401, 'wrong_login', 'That email and password don’t match.');
    if (!account.confirmed) {
      throw new HttpError(403, 'email_not_confirmed', 'Please confirm your email first.');
    }
    return { id: account.id, email: account.email, name: account.name };
  }

  async verifyEmailLink(tokenHash: string, type: EmailLinkType): Promise<AuthUser> {
    const index = this.sent.findIndex((s) => s.tokenHash === tokenHash && s.type === type);
    const link = this.sent[index];
    const account = this.accounts.find((a) => a.email === link?.email);
    if (!link || !account) throw new HttpError(400, 'link_invalid', 'This link has expired.');
    this.sent.splice(index, 1); // one use only
    account.confirmed = true;
    return { id: account.id, email: account.email, name: account.name };
  }

  async sendPasswordReset(email: string, origin: string): Promise<void> {
    if (this.accounts.some((a) => a.email === email)) this.link('recovery', email, origin);
  }

  async resendConfirmation(email: string, origin: string): Promise<void> {
    if (this.accounts.some((a) => a.email === email && !a.confirmed)) {
      this.link('signup', email, origin);
    }
  }

  async getUser(userId: string): Promise<AuthUser | null> {
    const account = this.accounts.find((a) => a.id === userId);
    return account ? { id: account.id, email: account.email, name: account.name } : null;
  }

  async setPassword(userId: string, password: string): Promise<void> {
    const account = this.accounts.find((a) => a.id === userId);
    if (account) account.password = password;
  }

  async deleteUser(userId: string): Promise<void> {
    const index = this.accounts.findIndex((a) => a.id === userId);
    if (index >= 0) this.accounts.splice(index, 1);
    this.onDelete(userId);
  }
}

/** Per-user repositories plus the account-level tables, mirroring 0003's rules. */
export class InMemoryAccountStore implements AccountStore {
  readonly repos = new Map<string, InMemoryRepository>();
  /** Data from before accounts; null once claimed. */
  unclaimed: InMemoryRepository | null = null;
  readonly mcpTokenHashes = new Map<string, string>();
  readonly validAfter = new Map<string, Date>();
  readonly requests: { ipHash: string; kind: AuthRequestKind; at: Date }[] = [];
  pings = 0;

  constructor(private readonly newRepo: () => InMemoryRepository) {}

  repoFor(userId: string): InMemoryRepository {
    let repo = this.repos.get(userId);
    if (!repo) {
      repo = this.newRepo();
      this.repos.set(userId, repo);
    }
    return repo;
  }

  async hasUnclaimedData(): Promise<boolean> {
    return this.unclaimed !== null && (await this.unclaimed.listNodes()).length > 0;
  }

  async claimUnclaimedData(userId: string): Promise<void> {
    if (!this.unclaimed || !(await this.hasUnclaimedData())) throw conflict('nothing_to_claim');
    if ((await this.repoFor(userId).listNodes()).length > 0) throw conflict('account_has_data');
    this.repos.set(userId, this.unclaimed);
    this.unclaimed = null;
  }

  async userIdForMcpTokenHash(tokenHash: string): Promise<string | null> {
    for (const [userId, hash] of this.mcpTokenHashes) if (hash === tokenHash) return userId;
    return null;
  }

  async hasMcpToken(userId: string): Promise<boolean> {
    return this.mcpTokenHashes.has(userId);
  }

  async setMcpTokenHash(userId: string, tokenHash: string): Promise<void> {
    this.mcpTokenHashes.set(userId, tokenHash);
  }

  async sessionsValidAfter(userId: string): Promise<Date | null> {
    return this.validAfter.get(userId) ?? null;
  }

  async setSessionsValidAfter(userId: string, at: Date): Promise<void> {
    this.validAfter.set(userId, at);
  }

  async authRequestsSince(ipHash: string, kind: AuthRequestKind, since: Date): Promise<number> {
    return this.requests.filter((r) => r.ipHash === ipHash && r.kind === kind && r.at >= since)
      .length;
  }

  async recordAuthRequest(ipHash: string, kind: AuthRequestKind, at: Date): Promise<void> {
    this.requests.push({ ipHash, kind, at });
  }

  async ping(): Promise<void> {
    this.pings++;
  }
}

export const TEST_PASSCODE = 'correct horse battery';
export const TEST_EMAIL = 'student@example.com';
export const TEST_PASSWORD = 'test password 123';
/** The body that logs the default test user in. */
export const LOGIN = { email: TEST_EMAIL, password: TEST_PASSWORD };

export function testDeps(overrides: Partial<ServerDeps> = {}) {
  let now = new Date('2026-10-03T10:00:00Z');
  let id = 0;
  let slug = 0;
  const clock = () => now;
  const loginAttempts = new InMemoryLoginAttemptStore();
  const accounts = new InMemoryAccountStore(() => new InMemoryRepository(clock));
  const auth = new FakeAuthProvider((userId) => accounts.repos.delete(userId));
  const user = auth.addUser(TEST_EMAIL, TEST_PASSWORD);
  const deps: ServerDeps = {
    env: {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SECRET_KEY: 'test-secret-key',
      APP_PASSCODE: TEST_PASSCODE,
      SESSION_SECRET: 'test-session-secret-that-is-at-least-32-chars',
    },
    repoFor: (userId) => accounts.repoFor(userId),
    auth,
    accounts,
    loginAttempts,
    shares: {
      // Looks through every user's in-memory data, like the database's cross-user lookup.
      async findBySlug(slug) {
        for (const repo of accounts.repos.values()) {
          const share = await repo.findSharedReport(slug);
          if (share) return share;
        }
        return null;
      },
    },
    clock,
    newId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`,
    newSlug: () => `test-slug-${String(++slug).padStart(24, '0')}`,
    ...overrides,
  };
  return {
    deps,
    auth,
    accounts,
    user,
    /** The default test user's data. */
    repo: accounts.repoFor(user.id),
    loginAttempts,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
}

export const context = { ip: '203.0.113.7' };

export function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export function get(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost${path}`, { headers });
}

/** The `name=value` parts of all Set-Cookie headers, ready to send back as a Cookie header. */
export function cookieFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0] ?? '')
    .filter((pair) => !pair.endsWith('='))
    .join('; ');
}
