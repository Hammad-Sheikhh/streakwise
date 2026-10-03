import { z } from 'zod';

import { SESSION_SOURCES, TOPIC_STATUSES, TRACK_COLORS } from '../domain/types';
import type {
  ClaudeConnection,
  Dashboard,
  Deadline,
  HistoryPage,
  Session,
  Settings,
  TreeNode,
} from '../domain/types';

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
  createdAt: timestamp,
}) satisfies z.ZodType<Deadline>;

const minutes = z.number().int().min(0);

export const dashboardSchema = z.object({
  today: z.iso.date(),
  todayMinutes: minutes,
  streak: z.object({ current: minutes, longest: minutes }),
  targets: z.array(z.object({ trackId: z.uuid(), minutes, targetMinutes: minutes.nullable() })),
  neglect: z.array(z.object({ nodeId: z.uuid(), days: minutes, neverLogged: z.boolean() })),
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
}) satisfies z.ZodType<Dashboard>;

export const settingsSchema = z.object({
  studentName: z.string().max(80),
  neglectDays: z.number().int().min(1).max(14),
  lastExportAt: timestamp.nullable(),
  lastMcpCallAt: timestamp.nullable(),
}) satisfies z.ZodType<Settings>;

export const claudeConnectionSchema = z.object({
  url: z.url().nullable(),
  lastMcpCallAt: timestamp.nullable(),
}) satisfies z.ZodType<ClaudeConnection>;

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
