import type { DataSource } from '@/data/DataSource';
import { DataSourceError } from '@/data/DataSource';
import { DemoDataSource } from '@/data/DemoDataSource';

export const TEST_NOW = new Date('2026-10-03T10:00:00Z');

export type FakeApi = DataSource & { loggedIn: boolean };

/**
 * A stand-in for the API in component tests: the core services on an in-memory store (like demo
 * mode), but in 'api' mode and logged out until the passcode "letmein" is entered.
 */
export function fakeApi(options: { loggedIn?: boolean; now?: Date } = {}): FakeApi {
  const now = options.now ?? TEST_NOW;
  // Inherit every data method from a demo data source and override only mode and auth.
  const api = Object.create(new DemoDataSource(() => now)) as FakeApi;
  return Object.assign(api, {
    mode: 'api' as const,
    basePath: '',
    loggedIn: options.loggedIn ?? false,
    async isAuthenticated(this: FakeApi) {
      return this.loggedIn;
    },
    async login(this: FakeApi, passcode: string) {
      if (passcode !== 'letmein') {
        throw new DataSourceError(401, 'wrong_passcode', 'That passcode isn’t right.');
      }
      this.loggedIn = true;
    },
    async logout(this: FakeApi) {
      this.loggedIn = false;
    },
  });
}
