import { z } from 'zod';

import { TOPIC_STATUSES, TRACK_COLORS } from '../domain/types';
import type { Settings, TreeNode } from '../domain/types';

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

export const settingsSchema = z.object({
  studentName: z.string().max(80),
  neglectDays: z.number().int().min(1).max(14),
  lastExportAt: timestamp.nullable(),
  lastMcpCallAt: timestamp.nullable(),
}) satisfies z.ZodType<Settings>;

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
