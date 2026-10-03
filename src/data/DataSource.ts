import type {
  Dashboard,
  Deadline,
  HistoryPage,
  Session,
  Settings,
  TreeNode,
} from '@/core/domain/types';
import type {
  CreateDeadlineInput,
  CreateNodeInput,
  UpdateDeadlineInput,
  HistoryQuery,
  LogSessionInput,
  MoveNodeInput,
  UpdateNodeInput,
  UpdateSessionInput,
  UpdateSettingsInput,
} from '@/core/schemas/inputs';

// The only way the UI reads or changes data (SPEC §B12). ApiDataSource calls /api; DemoDataSource
// runs the same core services in the browser on an in-memory store.

export type DataSourceMode = 'api' | 'demo';

export interface DataSource {
  readonly mode: DataSourceMode;
  /** Prefix for in-app links: '' for the real app, '/demo' in demo mode. */
  readonly basePath: string;
  /** The current time; demo mode and tests can fix it. */
  now(): Date;
  isAuthenticated(): Promise<boolean>;
  login(passcode: string): Promise<void>;
  logout(): Promise<void>;

  listTree(): Promise<TreeNode[]>;
  addNode(input: CreateNodeInput): Promise<TreeNode>;
  updateNode(id: string, input: UpdateNodeInput): Promise<TreeNode>;
  deleteNode(id: string): Promise<void>;
  moveNode(id: string, input: MoveNodeInput): Promise<void>;

  getHistory(query: HistoryQuery): Promise<HistoryPage>;
  logSession(input: LogSessionInput): Promise<Session>;
  updateSession(id: string, input: UpdateSessionInput): Promise<Session>;
  deleteSession(id: string): Promise<void>;
  recentNodeIds(): Promise<string[]>;

  getDashboard(): Promise<Dashboard>;

  listDeadlines(): Promise<Deadline[]>;
  addDeadline(input: CreateDeadlineInput): Promise<Deadline>;
  updateDeadline(id: string, input: UpdateDeadlineInput): Promise<Deadline>;
  deleteDeadline(id: string): Promise<void>;

  getSettings(): Promise<Settings>;
  updateSettings(input: UpdateSettingsInput): Promise<Settings>;
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
