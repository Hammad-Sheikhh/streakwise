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

/** The parts of a session the dashboard calculations need. */
export type SessionFact = Pick<Session, 'nodeId' | 'studiedOn' | 'minutes'>;

export interface Deadline {
  id: string;
  nodeId: string;
  title: string;
  dueOn: string;
  createdAt: string;
}

export interface UpcomingDeadline extends Deadline {
  daysLeft: number;
  /** null when the node has no topics. */
  syllabusLeftPercent: number | null;
}

/** Everything Home shows, from one request (DASH-1). Names and colors come from the tree. */
export interface Dashboard {
  today: string;
  todayMinutes: number;
  streak: { current: number; longest: number };
  /** Visible tracks in display order, with this week's minutes (TGT-2). */
  targets: { trackId: string; minutes: number; targetMinutes: number | null }[];
  /** NEG-1, most neglected first. */
  neglect: { nodeId: string; days: number; neverLogged: boolean }[];
  /** TASK-7: tasks due this week, overdue first, then by due date (weekly ones last). */
  tasksDue: TaskItem[];
  /** DEAD-2/3: the next 3 upcoming deadlines. */
  deadlines: UpcomingDeadline[];
  /** HEAT-1: days with sessions in the last 12 months. */
  heatmap: { start: string; end: string; days: { date: string; minutes: number }[] };
}

/** TRACK-1: time per node in the track (the track itself included) and its latest sessions. */
export interface TrackOverview {
  trackId: string;
  today: string;
  nodes: { nodeId: string; weekMinutes: number; totalMinutes: number }[];
  /** Newest first. */
  recentSessions: Session[];
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
  /** null = "Other": not tied to any track (0002). Such tasks can't be scored. */
  nodeId: string | null;
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

export interface TaskCompletion {
  id: string;
  taskId: string;
  /** The week's Monday for weekly tasks; null for one-off tasks. */
  periodStart: string | null;
  completedAt: string;
  note: string | null;
}

/** A task as the Tasks screen and MCP show it, with its state as of today. */
export interface TaskItem {
  task: Task;
  /** The completion that makes it done today (this week's, for weekly tasks), or null. */
  completion: TaskCompletion | null;
  /** TASK-7. */
  dueThisWeek: boolean;
  overdue: boolean;
  /** TASK-9: direct sub-tasks done vs total; null when it has none. */
  subtasks: { done: number; total: number } | null;
  /** TASK-5: Mondays of the weeks a weekly task was completed, newest first. */
  completedWeeks: string[];
}

export const SCORE_KINDS = ['past_paper', 'quiz', 'mock_test', 'revision', 'other'] as const;
export type ScoreKind = (typeof SCORE_KINDS)[number];

export interface Score {
  id: string;
  nodeId: string;
  /** Set when the score was recorded by completing a scored task. */
  taskCompletionId: string | null;
  kind: ScoreKind;
  title: string;
  /** Local date. */
  takenOn: string;
  score: number;
  maxScore: number;
  note: string | null;
  createdAt: string;
}

export interface Settings {
  /** Empty until the owner enters it (asked for on the first report). */
  studentName: string;
  neglectDays: number;
  lastExportAt: string | null;
  lastMcpCallAt: string | null;
}

/** A new user's settings (SPEC §B4). */
export const DEFAULT_SETTINGS: Readonly<Settings> = {
  studentName: '',
  neglectDays: 3,
  lastExportAt: null,
  lastMcpCallAt: null,
};

/**
 * SET-4, ACCT-8: the user's Claude link. Only a hash is stored, so `url` is set only in the answer
 * that creates the link; `hasLink` says whether one exists.
 */
export interface ClaudeConnection {
  url: string | null;
  hasLink: boolean;
  lastMcpCallAt: string | null;
}

/** Returns the current time. Injected everywhere so tests are deterministic. */
export type Clock = () => Date;

/** Creates a new unique id (UUID v4). Injected for deterministic tests. */
export type IdGenerator = () => string;
