import type {
  ClaudeConnection,
  Dashboard,
  DataExport,
  Deadline,
  HistoryPage,
  Report,
  Score,
  Session,
  Settings,
  SharedReportLink,
  Task,
  TaskCompletion,
  TaskItem,
  TrackOverview,
  TreeNode,
} from '@/core/domain/types';
import type {
  CompleteTaskInput,
  CreateDeadlineInput,
  CreateScoreInput,
  CreateShareInput,
  CreateTaskInput,
  UpdateTaskInput,
  CreateNodeInput,
  UpdateDeadlineInput,
  HistoryQuery,
  LogSessionInput,
  MoveNodeInput,
  ReportQuery,
  SetTopicStatusInput,
  UpdateNodeInput,
  UpdateScoreInput,
  UpdateSessionInput,
  UpdateSettingsInput,
} from '@/core/schemas/inputs';

import type { AccountApi } from './AccountApi';

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
  logout(): Promise<void>;
  /** Accounts (ACCT); null in demo mode. */
  readonly account: AccountApi | null;

  listTree(): Promise<TreeNode[]>;
  addNode(input: CreateNodeInput): Promise<TreeNode>;
  updateNode(id: string, input: UpdateNodeInput): Promise<TreeNode>;
  deleteNode(id: string): Promise<void>;
  moveNode(id: string, input: MoveNodeInput): Promise<void>;
  setTopicStatus(id: string, input: SetTopicStatusInput): Promise<TreeNode>;

  getHistory(query: HistoryQuery): Promise<HistoryPage>;
  logSession(input: LogSessionInput): Promise<Session>;
  updateSession(id: string, input: UpdateSessionInput): Promise<Session>;
  deleteSession(id: string): Promise<void>;
  recentNodeIds(): Promise<string[]>;

  getDashboard(): Promise<Dashboard>;

  /** TRACK-1. */
  getTrackOverview(trackId: string): Promise<TrackOverview>;

  listDeadlines(): Promise<Deadline[]>;
  addDeadline(input: CreateDeadlineInput): Promise<Deadline>;
  updateDeadline(id: string, input: UpdateDeadlineInput): Promise<Deadline>;
  deleteDeadline(id: string): Promise<void>;

  /** TASK-1: every task with its state as of today, in display order. */
  listTasks(options?: { includeArchived?: boolean }): Promise<TaskItem[]>;
  createTask(input: CreateTaskInput): Promise<Task>;
  updateTask(id: string, input: UpdateTaskInput): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  completeTask(id: string, input: CompleteTaskInput): Promise<TaskCompletion>;
  uncompleteTask(completionId: string): Promise<void>;

  /** SCORE-1, SCORE-3: newest first. */
  listScores(): Promise<Score[]>;
  addScore(input: CreateScoreInput): Promise<Score>;
  updateScore(id: string, input: UpdateScoreInput): Promise<Score>;
  deleteScore(id: string): Promise<void>;

  getSettings(): Promise<Settings>;
  updateSettings(input: UpdateSettingsInput): Promise<Settings>;
  /** SET-4. Not available in demo mode (DEMO-5). */
  getClaudeConnection(): Promise<ClaudeConnection>;

  /** REP-9: built by the shared `buildReport`. */
  buildReport(query: ReportQuery): Promise<Report>;
  /** SHARE-1, SHARE-3. Not available in demo mode (DEMO-5). */
  createShare(input: CreateShareInput): Promise<SharedReportLink>;
  listShares(): Promise<SharedReportLink[]>;
  revokeShare(id: string): Promise<SharedReportLink>;
  /** SET-2: everything, and records the export time. */
  exportData(): Promise<DataExport>;
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
