import { z } from 'zod';

import {
  CHANGE_ACTIONS,
  CHANGE_ENTITIES,
  MISTAKE_STATUSES,
  REPORT_PERIODS,
  REVIEW_RESULTS,
  SCORE_KINDS,
  SESSION_SOURCES,
  TOPIC_STATUSES,
  TRACK_COLORS,
} from '../domain/types.js';
import type {
  ChangeEntry,
  ClaudeConnection,
  Dashboard,
  Deadline,
  DataExport,
  ExamTarget,
  ExamView,
  MistakesOverview,
  HistoryPage,
  Mistake,
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
} from '../domain/types.js';

// Shapes of domain objects as they cross the API, so the browser can check what it receives.

const timestamp = z.iso.datetime({ offset: true });

export const treeNodeSchema = z.object({
  id: z.uuid(),
  parentId: z.uuid().nullable(),
  depth: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  name: z.string().min(1).max(60),
  color: z.enum(TRACK_COLORS).nullable(),
  sortOrder: z.number().int(),
  weeklyTargetMinutes: z.number().int().min(0).nullable(),
  topicStatus: z.enum(TOPIC_STATUSES).nullable(),
  topicDoneAt: timestamp.nullable(),
  archivedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
}) satisfies z.ZodType<TreeNode>;

export const sessionSchema = z.object({
  id: z.uuid(),
  nodeId: z.uuid(),
  studiedOn: z.iso.date(),
  minutes: z.number().int().min(1).max(1440),
  note: z.string().max(500).nullable(),
  source: z.enum(SESSION_SOURCES),
  createdAt: timestamp,
  updatedAt: timestamp,
}) satisfies z.ZodType<Session>;

export const historyPageSchema = z.object({
  days: z.array(
    z.object({
      date: z.iso.date(),
      totalMinutes: z.number().int().min(0),
      sessions: z.array(sessionSchema),
    }),
  ),
  nextTo: z.iso.date().nullable(),
}) satisfies z.ZodType<HistoryPage>;

export const deadlineSchema = z.object({
  id: z.uuid(),
  nodeId: z.uuid(),
  title: z.string().min(1).max(200),
  dueOn: z.iso.date(),
  isExam: z.boolean(),
  createdAt: timestamp,
}) satisfies z.ZodType<Deadline>;

const minutes = z.number().int().min(0);

export const examTargetSchema = z.object({
  id: z.uuid(),
  deadlineId: z.uuid(),
  label: z.string().min(1).max(60),
  targetOn: z.iso.date(),
  minPercent: z.number().min(0).max(100),
  createdAt: timestamp,
  updatedAt: timestamp,
}) satisfies z.ZodType<ExamTarget>;

export const trackOverviewSchema = z.object({
  trackId: z.uuid(),
  today: z.iso.date(),
  nodes: z.array(z.object({ nodeId: z.uuid(), weekMinutes: minutes, totalMinutes: minutes })),
  recentSessions: z.array(sessionSchema),
}) satisfies z.ZodType<TrackOverview>;

export const settingsSchema = z.object({
  studentName: z.string().max(80),
  neglectDays: z.number().int().min(1).max(14),
  dayEndsAtMinutes: z.number().int().min(0).max(360),
  lastExportAt: timestamp.nullable(),
  lastMcpCallAt: timestamp.nullable(),
}) satisfies z.ZodType<Settings>;

export const claudeConnectionSchema = z.object({
  url: z.url().nullable(),
  hasLink: z.boolean(),
  lastMcpCallAt: timestamp.nullable(),
}) satisfies z.ZodType<ClaudeConnection>;

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export const taskSchema = z.object({
  id: z.uuid(),
  nodeId: z.uuid().nullable(),
  parentTaskId: z.uuid().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().nullable(),
  dueOn: z.iso.date().nullable(),
  recurrence: z.enum(['none', 'weekly']),
  isScored: z.boolean(),
  defaultMaxScore: z.number().positive().nullable(),
  sortOrder: z.number().int(),
  archivedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
}) satisfies z.ZodType<Task>;

export const taskCompletionSchema = z.object({
  id: z.uuid(),
  taskId: z.uuid(),
  periodStart: z.iso.date().nullable(),
  completedAt: timestamp,
  completedOn: z.iso.date(),
  note: z.string().max(500).nullable(),
}) satisfies z.ZodType<TaskCompletion>;

export const mistakeSchema = z.object({
  id: z.uuid(),
  nodeId: z.uuid(),
  text: z.string().min(1).max(500),
  createdOn: z.iso.date(),
  source: z.enum(SESSION_SOURCES),
  status: z.enum(MISTAKE_STATUSES),
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  anchorOn: z.iso.date(),
  nextDueOn: z.iso.date().nullable(),
  reviewCount: z.number().int().min(0),
  lastReviewedOn: z.iso.date().nullable(),
  lastResult: z.enum(REVIEW_RESULTS).nullable(),
  learnedOn: z.iso.date().nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
}) satisfies z.ZodType<Mistake>;

export const changeEntrySchema = z.object({
  id: z.uuid(),
  at: timestamp,
  source: z.enum(SESSION_SOURCES),
  entity: z.enum(CHANGE_ENTITIES),
  entityId: z.uuid(),
  action: z.enum(CHANGE_ACTIONS),
  summary: z.string().max(200),
  before: z.unknown(),
  after: z.unknown(),
  undoneAt: timestamp.nullable(),
}) satisfies z.ZodType<ChangeEntry>;

export const mistakesOverviewSchema = z.object({
  today: z.iso.date(),
  due: z.array(mistakeSchema),
  all: z.array(mistakeSchema),
  modules: z.array(
    z.object({ moduleId: z.uuid(), open: z.number().int(), learned: z.number().int() }),
  ),
}) satisfies z.ZodType<MistakesOverview>;

export const taskItemSchema = z.object({
  task: taskSchema,
  completion: taskCompletionSchema.nullable(),
  dueThisWeek: z.boolean(),
  overdue: z.boolean(),
  subtasks: z.object({ done: minutes, total: minutes }).nullable(),
  completedWeeks: z.array(z.iso.date()),
}) satisfies z.ZodType<TaskItem>;

export const scoreSchema = z.object({
  id: z.uuid(),
  nodeId: z.uuid(),
  taskCompletionId: z.uuid().nullable(),
  kind: z.enum(SCORE_KINDS),
  title: z.string().min(1).max(200),
  takenOn: z.iso.date(),
  score: z.number().min(0),
  maxScore: z.number().positive(),
  note: z.string().max(500).nullable(),
  createdAt: timestamp,
}) satisfies z.ZodType<Score>;

export const dashboardSchema = z.object({
  today: z.iso.date(),
  todayMinutes: minutes,
  streak: z.object({ current: minutes, longest: minutes }),
  targets: z.array(z.object({ trackId: z.uuid(), minutes, targetMinutes: minutes.nullable() })),
  neglect: z.array(z.object({ nodeId: z.uuid(), days: minutes, neverLogged: z.boolean() })),
  tasksDue: z.array(taskItemSchema),
  deadlines: z.array(
    deadlineSchema.extend({
      daysLeft: minutes,
      syllabusLeftPercent: z.number().min(0).max(100).nullable(),
    }),
  ),
  heatmap: z.object({
    start: z.iso.date(),
    end: z.iso.date(),
    days: z.array(z.object({ date: z.iso.date(), minutes })),
  }),
  backupDue: z.boolean(),
  todayCard: z.object({
    task: taskItemSchema.nullable(),
    subtasks: z.array(taskItemSchema),
    minutes: z.array(z.object({ nodeId: z.uuid(), minutes })),
    pace: z.array(
      z.object({
        trackId: z.uuid(),
        minutes,
        targetMinutes: minutes,
        neededPerDay: minutes,
        met: z.boolean(),
      }),
    ),
  }),
  mistakesDue: minutes,
}) satisfies z.ZodType<Dashboard>;

const examSummarySchema = z.object({
  deadlineId: z.uuid(),
  title: z.string(),
  dueOn: z.iso.date(),
  nodeId: z.uuid(),
  daysLeft: z.number().int(),
});

const mockCellSchema = z.object({
  scoreId: z.uuid(),
  score: z.number().min(0),
  maxScore: z.number().positive(),
  percent: z.number().min(0),
  takenOn: z.iso.date(),
});

export const examViewSchema = z.object({
  today: z.iso.date(),
  exams: z.array(examSummarySchema),
  exam: z
    .object({
      summary: examSummarySchema,
      targets: z.array(examTargetSchema),
      modules: z.array(z.object({ id: z.string(), name: z.string() })),
      series: z.array(
        z.object({
          moduleId: z.string(),
          points: z.array(
            z.object({ date: z.iso.date(), percent: z.number().min(0), title: z.string() }),
          ),
        }),
      ),
      mocks: z.array(
        z.object({
          title: z.string(),
          firstDate: z.iso.date(),
          cells: z.record(z.string(), mockCellSchema.nullable()),
          average: z.number().nullable(),
          target: z.object({ label: z.string(), minPercent: z.number() }).nullable(),
        }),
      ),
    })
    .nullable(),
}) satisfies z.ZodType<ExamView>;

const percent = z.number().min(0);

/** REP-4. Also checks snapshots read back from the database before the public page shows them. */
export const reportSchema = z.object({
  studentName: z.string().max(80),
  period: z.object({
    kind: z.enum(REPORT_PERIODS),
    label: z.string(),
    from: z.iso.date(),
    to: z.iso.date(),
    isWeek: z.boolean(),
  }),
  generatedAt: timestamp,
  includesNotes: z.boolean(),
  totals: z.object({
    minutes,
    sessions: minutes,
    activeDays: minutes,
    days: minutes,
    streak: minutes,
  }),
  tracks: z.array(
    z.object({
      name: z.string(),
      color: z.enum(TRACK_COLORS).nullable(),
      minutes,
      targetMinutes: minutes.nullable(),
      targetPercent: percent.nullable(),
      subtasks: z.array(z.object({ name: z.string(), minutes })),
    }),
  ),
  topicsStudied: z.array(z.object({ path: z.string(), minutes })),
  topicsDone: z.array(z.object({ path: z.string(), doneOn: z.iso.date() })),
  tasksCompleted: z.array(
    z.object({
      title: z.string(),
      path: z.string().nullable(),
      completedOn: z.iso.date(),
      score: z.object({ score: percent, maxScore: z.number().positive(), percent }).nullable(),
    }),
  ),
  scores: z.array(
    z.object({
      date: z.iso.date(),
      path: z.string(),
      kind: z.enum(SCORE_KINDS),
      title: z.string(),
      score: percent,
      maxScore: z.number().positive(),
      percent,
    }),
  ),
  neglected: z.array(z.object({ path: z.string(), days: minutes, neverLogged: z.boolean() })),
  deadlines: z.array(
    z.object({
      title: z.string(),
      path: z.string(),
      dueOn: z.iso.date(),
      daysLeft: z.number().int(),
      syllabusLeftPercent: z.number().min(0).max(100).nullable(),
    }),
  ),
  notes: z.array(z.object({ date: z.iso.date(), path: z.string(), minutes, note: z.string() })),
}) satisfies z.ZodType<Report>;

export const sharedReportLinkSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(16).max(64),
  periodLabel: z.string(),
  createdAt: timestamp,
  expiresAt: timestamp.nullable(),
  revokedAt: timestamp.nullable(),
}) satisfies z.ZodType<SharedReportLink>;

export const dataExportSchema = z.object({
  app: z.literal('Streakwise'),
  formatVersion: z.literal(1),
  exportedAt: timestamp,
  settings: z.object({ studentName: z.string(), neglectDays: z.number().int() }),
  nodes: z.array(treeNodeSchema),
  sessions: z.array(sessionSchema),
  tasks: z.array(taskSchema),
  taskCompletions: z.array(taskCompletionSchema),
  scores: z.array(scoreSchema),
  deadlines: z.array(deadlineSchema),
  sharedReports: z.array(sharedReportLinkSchema),
}) satisfies z.ZodType<DataExport>;
