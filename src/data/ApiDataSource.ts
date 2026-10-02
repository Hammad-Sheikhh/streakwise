import { z } from 'zod';

import { meSchema } from '@/core/schemas/auth';
import { apiErrorSchema, settingsSchema, treeNodeSchema } from '@/core/schemas/domain';

import { DataSourceError } from './DataSource';
import type { DataSource } from './DataSource';

const treeResponse = z.object({ nodes: z.array(treeNodeSchema) });
const settingsResponse = z.object({ settings: settingsSchema });

export class ApiDataSource implements DataSource {
  readonly mode = 'api';
  readonly basePath = '';

  constructor(private readonly fetchFn: typeof fetch = (...args) => fetch(...args)) {}

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    init: { method?: 'GET' | 'POST'; body?: unknown } = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchFn(`/api/${path}`, {
        method: init.method ?? 'GET',
        credentials: 'same-origin',
        headers: init.body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      throw new DataSourceError(0, 'network', 'Can’t reach the server. Check your connection.');
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(body);
      throw parsed.success
        ? new DataSourceError(response.status, parsed.data.error.code, parsed.data.error.message)
        : new DataSourceError(
            response.status,
            'unexpected',
            'Something went wrong. Please try again.',
          );
    }
    return schema.parse(body);
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      return (await this.request('auth/me', meSchema)).authenticated;
    } catch (error) {
      if (error instanceof DataSourceError && error.status === 401) return false;
      throw error;
    }
  }

  async login(passcode: string): Promise<void> {
    await this.request('auth/login', meSchema, { method: 'POST', body: { passcode } });
  }

  async logout(): Promise<void> {
    await this.request('auth/logout', meSchema, { method: 'POST', body: {} });
  }

  async listTree() {
    return (await this.request('nodes', treeResponse)).nodes;
  }

  async getSettings() {
    return (await this.request('settings', settingsResponse)).settings;
  }
}
