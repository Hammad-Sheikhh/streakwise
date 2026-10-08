import type { AccountApi } from '@/data/AccountApi';
import type { DataSource } from '@/data/DataSource';
import { DataSourceError } from '@/data/DataSource';
import { DemoDataSource } from '@/data/DemoDataSource';

export const TEST_NOW = new Date('2026-10-03T10:00:00Z');
export const TEST_EMAIL = 'student@example.com';
export const TEST_PASSWORD = 'letmein123';
export const TEST_PASSCODE = 'old passcode';

export interface FakeAccountState {
  loggedIn: boolean;
  password: string;
  /** ACCT-7: whether this browser entered the old passcode. */
  claimReady: boolean;
  /** Set right after a reset link. */
  recovering: boolean;
  /** Sign-ups that still need their email confirmed. */
  pending: string[];
  deleted: boolean;
}

export type FakeApi = DataSource & FakeAccountState & { account: AccountApi };

const wrongLogin = () =>
  new DataSourceError(401, 'wrong_login', 'That email and password don’t match.');

/**
 * A stand-in for the API in component tests: the core services on an in-memory store (like demo
 * mode), but in 'api' mode with one account (TEST_EMAIL / TEST_PASSWORD), logged out by default.
 */
export function fakeApi(options: { loggedIn?: boolean; now?: Date } = {}): FakeApi {
  const now = options.now ?? TEST_NOW;
  // Inherit every data method from a demo data source and override only mode and auth.
  const api = Object.create(new DemoDataSource(() => now)) as FakeApi;
  const state: FakeAccountState = {
    loggedIn: options.loggedIn ?? false,
    password: TEST_PASSWORD,
    claimReady: false,
    recovering: false,
    pending: [],
    deleted: false,
  };
  const account: AccountApi = {
    async me() {
      if (!api.loggedIn) throw new DataSourceError(401, 'unauthenticated', 'Please log in.');
      return {
        authenticated: true,
        user: { email: TEST_EMAIL, name: 'Test Student' },
        recovering: api.recovering,
      };
    },
    async login({ email, password }) {
      if (api.pending.includes(email)) {
        throw new DataSourceError(403, 'email_not_confirmed', 'Please confirm your email first.');
      }
      if (email !== TEST_EMAIL || password !== api.password) throw wrongLogin();
      api.loggedIn = true;
      const claimed = api.claimReady;
      api.claimReady = false;
      return { claimed };
    },
    async signUp({ email }) {
      api.pending.push(email);
      return { status: 'confirm_email' };
    },
    async enterPasscode({ passcode }) {
      if (passcode !== TEST_PASSCODE) {
        throw new DataSourceError(401, 'wrong_passcode', 'That passcode isn’t right.');
      }
      api.claimReady = true;
    },
    async forgotPassword() {},
    async resendConfirmation() {},
    async changePassword({ currentPassword, newPassword }) {
      if (!api.recovering && currentPassword !== api.password) {
        throw new DataSourceError(401, 'wrong_password', 'That password isn’t right.');
      }
      api.password = newPassword;
      api.recovering = false;
    },
    async deleteAccount({ password }) {
      if (password !== api.password) {
        throw new DataSourceError(401, 'wrong_password', 'That password isn’t right.');
      }
      api.deleted = true;
      api.loggedIn = false;
    },
    async createClaudeLink() {
      return {
        url: 'https://streakwise.example/mcp/new-token-0123456789abcdefghijklmnopqrstuv',
        hasLink: true,
        lastMcpCallAt: null,
      };
    },
  };
  return Object.assign(api, state, {
    mode: 'api' as const,
    basePath: '',
    account,
    async isAuthenticated(this: FakeApi) {
      return this.loggedIn;
    },
    async logout(this: FakeApi) {
      this.loggedIn = false;
    },
  });
}
