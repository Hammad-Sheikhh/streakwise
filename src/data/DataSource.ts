import type { Settings, TreeNode } from '@/core/domain/types';

// The only way the UI reads or changes data (SPEC §B12). ApiDataSource calls /api; DemoDataSource
// runs the same core services in the browser on an in-memory store.

export type DataSourceMode = 'api' | 'demo';

export interface DataSource {
  readonly mode: DataSourceMode;
  /** Prefix for in-app links: '' for the real app, '/demo' in demo mode. */
  readonly basePath: string;
  isAuthenticated(): Promise<boolean>;
  login(passcode: string): Promise<void>;
  logout(): Promise<void>;
  listTree(): Promise<TreeNode[]>;
  getSettings(): Promise<Settings>;
}

/** A failed request, with the API's error code and a message that is safe to show. */
export class DataSourceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DataSourceError';
  }
}
