// Domain types shared by the UI, the API, MCP, and demo mode (SPEC §B3).
// Dates are local calendar dates as `YYYY-MM-DD`; timestamps are ISO 8601 strings in UTC.

export const TRACK_COLORS = [
  'amber',
  'blue',
  'violet',
  'emerald',
  'rose',
  'cyan',
  'orange',
  'slate',
] as const;
export type TrackColor = (typeof TRACK_COLORS)[number];

export const TOPIC_STATUSES = ['not_started', 'in_progress', 'done'] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

/** 1 = track, 2 = subtask, 3 = topic. */
export type NodeDepth = 1 | 2 | 3;
export const MAX_DEPTH = 3;

export interface TreeNode {
  id: string;
  parentId: string | null;
  depth: NodeDepth;
  name: string;
  /** Tracks only. */
  color: TrackColor | null;
  sortOrder: number;
  /** Tracks only. */
  weeklyTargetMinutes: number | null;
  /** Topics only. */
  topicStatus: TopicStatus | null;
  topicDoneAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const SESSION_SOURCES = ['app', 'claude'] as const;
export type SessionSource = (typeof SESSION_SOURCES)[number];

export interface Session {
  id: string;
  nodeId: string;
  /** Local date (Asia/Karachi). */
  studiedOn: string;
  minutes: number;
  note: string | null;
  source: SessionSource;
  createdAt: string;
  updatedAt: string;
}

/** One day of History (HIST-1): its sessions, newest first, and their total. */
export interface HistoryDay {
  date: string;
  totalMinutes: number;
  sessions: Session[];
}

export interface HistoryPage {
  days: HistoryDay[];
  /** Where the next (older) page starts, or null when there's nothing older. */
  nextTo: string | null;
}

export type TaskRecurrence = 'none' | 'weekly';

export interface Task {
  id: string;
  nodeId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  dueOn: string | null;
  recurrence: TaskRecurrence;
  isScored: boolean;
  defaultMaxScore: number | null;
  sortOrder: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  /** Empty until the owner enters it (asked for on the first report). */
  studentName: string;
  neglectDays: number;
  lastExportAt: string | null;
  lastMcpCallAt: string | null;
}

/** Returns the current time. Injected everywhere so tests are deterministic. */
export type Clock = () => Date;

/** Creates a new unique id (UUID v4). Injected for deterministic tests. */
export type IdGenerator = () => string;
