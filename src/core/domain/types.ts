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
  /** EXAM-1: shown with an "Exam" badge and in the exam view. */
  isExam: boolean;
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
  /** SET-3: no export yet, or the last one is more than 30 days old. */
  backupDue: boolean;
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
  /** The week's Monday for weekly tasks (the week of `completedOn`); null for one-off tasks. */
  periodStart: string | null;
  /** When the tick was made (a real instant). */
  completedAt: string;
  /** TASK-11: the study day it counts for; today or any earlier day. Reports use this. */
  completedOn: string;
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
  /** DAY-1: study before this many minutes after midnight counts for the day before (0–360). */
  dayEndsAtMinutes: number;
  lastExportAt: string | null;
  lastMcpCallAt: string | null;
}

/** A new user's settings (SPEC §B4). */
export const DEFAULT_SETTINGS: Readonly<Settings> = {
  studentName: '',
  neglectDays: 3,
  dayEndsAtMinutes: 0,
  lastExportAt: null,
  lastMcpCallAt: null,
};

/** DAY-1: the latest "My day ends at" (06:00), in minutes after midnight. */
export const MAX_DAY_ENDS_AT_MINUTES = 360;

export const MISTAKE_STATUSES = ['open', 'learned'] as const;
export type MistakeStatus = (typeof MISTAKE_STATUSES)[number];

export const REVIEW_RESULTS = ['right', 'wrong'] as const;
export type ReviewResult = (typeof REVIEW_RESULTS)[number];

/** ERR (SPEC §B3.7): a mistake to review +1, +3, and +7 days after its anchor date (§B9.13). */
export interface Mistake {
  id: string;
  nodeId: string;
  text: string;
  /** The study day it was noted. */
  createdOn: string;
  source: SessionSource;
  status: MistakeStatus;
  /** 1, 2, or 3: which review comes next. */
  step: 1 | 2 | 3;
  /** The day the schedule counts from (creation, or the last wrong review). */
  anchorOn: string;
  /** null once learned. */
  nextDueOn: string | null;
  reviewCount: number;
  lastReviewedOn: string | null;
  lastResult: ReviewResult | null;
  learnedOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CHANGE_ENTITIES = [
  'session',
  'score',
  'task',
  'completion',
  'mistake',
  'node',
  'deadline',
  'exam_target',
] as const;
export type ChangeEntity = (typeof CHANGE_ENTITIES)[number];

export const CHANGE_ACTIONS = [
  'create',
  'update',
  'delete',
  'complete',
  'uncomplete',
  'archive',
  'unarchive',
  'review',
] as const;
export type ChangeAction = (typeof CHANGE_ACTIONS)[number];

/**
 * UNDO (SPEC §B3.8): one recorded change. `before` and `after` are JSON snapshots of the item
 * (null when it didn't exist), which undo uses to put things back.
 */
export interface ChangeEntry {
  id: string;
  at: string;
  source: SessionSource;
  entity: ChangeEntity;
  entityId: string;
  action: ChangeAction;
  /** One line for the Recent changes list, e.g. "Logged 45m · Exam Prep > Flashcards". */
  summary: string;
  before: unknown;
  after: unknown;
  undoneAt: string | null;
}

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

/** REP-1–3: the periods a report can cover. */
export const REPORT_PERIODS = ['today', 'yesterday', 'this_week', 'last_week', 'custom'] as const;
export type ReportPeriodKind = (typeof REPORT_PERIODS)[number];

/** REP-3: the longest custom range, in days. */
export const MAX_REPORT_DAYS = 92;

/**
 * REP-4: everything a report shows. It is self-contained (names and paths instead of ids), so a
 * shared link can store it as a frozen snapshot (SHARE-1) and render it without the tree.
 */
export interface Report {
  studentName: string;
  period: {
    kind: ReportPeriodKind;
    /** e.g. "This week". */
    label: string;
    from: string;
    to: string;
    /** Week periods show % of each track's weekly target. */
    isWeek: boolean;
  };
  generatedAt: string;
  includesNotes: boolean;
  totals: {
    minutes: number;
    sessions: number;
    activeDays: number;
    /** Days in the period (up to today). */
    days: number;
    /** As of the end of the period (or today, if the period includes today). */
    streak: number;
  };
  /** Tracks in display order: visible ones, plus archived ones with time in the period. */
  tracks: {
    name: string;
    color: TrackColor | null;
    minutes: number;
    /** Week periods only. */
    targetMinutes: number | null;
    targetPercent: number | null;
    /** Subtasks with time in the period. */
    subtasks: { name: string; minutes: number }[];
  }[];
  topicsStudied: { path: string; minutes: number }[];
  topicsDone: { path: string; doneOn: string }[];
  tasksCompleted: {
    title: string;
    /** null for "Other" tasks. */
    path: string | null;
    completedOn: string;
    score: { score: number; maxScore: number; percent: number } | null;
  }[];
  /** Oldest first. */
  scores: {
    date: string;
    path: string;
    kind: ScoreKind;
    title: string;
    score: number;
    maxScore: number;
    percent: number;
  }[];
  /** NEG-1 as of the end of the period, most neglected first. */
  neglected: { path: string; days: number; neverLogged: boolean }[];
  /** The next 3 deadlines from today. */
  deadlines: {
    title: string;
    path: string;
    dueOn: string;
    daysLeft: number;
    syllabusLeftPercent: number | null;
  }[];
  /** REP-5: empty unless notes were included. Oldest first. */
  notes: { date: string; path: string; minutes: number; note: string }[];
}

/** SHARE-3: a shared link as Settings lists it (the snapshot itself stays on the server). */
export interface SharedReportLink {
  id: string;
  slug: string;
  periodLabel: string;
  createdAt: string;
  /** null = never expires (SHARE-6). */
  expiresAt: string | null;
  revokedAt: string | null;
}

/** SHARE-1: what the public page reads. */
export interface SharedReport extends SharedReportLink {
  snapshot: Report;
}

/** SHARE-4: whether a link still shows its report. */
export type ShareStatus = 'active' | 'expired' | 'revoked';

/** SET-2: everything the user has, as one JSON file. */
export interface DataExport {
  app: 'Streakwise';
  formatVersion: 1;
  exportedAt: string;
  settings: Pick<Settings, 'studentName' | 'neglectDays'>;
  nodes: TreeNode[];
  sessions: Session[];
  tasks: Task[];
  taskCompletions: TaskCompletion[];
  scores: Score[];
  deadlines: Deadline[];
  /** The links only; their snapshots can be rebuilt from the data above. */
  sharedReports: SharedReportLink[];
}
