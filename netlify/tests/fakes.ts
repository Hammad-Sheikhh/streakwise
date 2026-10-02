import { InMemoryRepository } from '../../src/core/repo/InMemoryRepository';
import type { ServerDeps } from '../functions/_lib/deps';
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

export const TEST_PASSCODE = 'correct horse battery';

export function testDeps(overrides: Partial<ServerDeps> = {}) {
  let now = new Date('2026-10-03T10:00:00Z');
  let id = 0;
  const clock = () => now;
  const loginAttempts = new InMemoryLoginAttemptStore();
  const repo = new InMemoryRepository(clock);
  const deps: ServerDeps = {
    env: {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SECRET_KEY: 'test-secret-key',
      APP_PASSCODE: TEST_PASSCODE,
      SESSION_SECRET: 'test-session-secret-that-is-at-least-32-chars',
    },
    repo,
    loginAttempts,
    ping: async () => {},
    clock,
    newId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`,
    ...overrides,
  };
  return {
    deps,
    repo,
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

/** The `name=value` part of a Set-Cookie header, ready to send back as a Cookie header. */
export function cookieFrom(response: Response): string {
  return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}
