import { z } from 'zod';

import {
  REPORT_PERIODS,
  SCORE_KINDS,
  SESSION_SOURCES,
  TOPIC_STATUSES,
  TRACK_COLORS,
} from '../domain/types';

// Inputs from the UI, the API, and MCP. The server validates every request with these (SPEC §B8);
// messages are written for the owner, because the UI shows them as they are.

export const localDateSchema = z.iso.date('Use a date like 2026-10-03.');

const nodeName = z
  .string()
  .trim()
  .min(1, 'Enter a name.')
  .max(60, 'Names can be at most 60 characters.');

export const createNodeInputSchema = z.object({
  parentId: z.uuid().nullable(),
  name: nodeName,
  /** Tracks only; a free palette color is chosen when it's left out. */
  color: z.enum(TRACK_COLORS).optional(),
});
export type CreateNodeInput = z.infer<typeof createNodeInputSchema>;

/** TGT-1: weekly targets are set in half-hour steps; null (or 0) means no target. */
export const weeklyTargetSchema = z
  .number()
  .int()
  .min(0, 'A target can’t be negative.')
  .max(7 * 24 * 60, 'A week only has 168 hours.')
  .multipleOf(30, 'Targets go in half-hour steps.')
  .nullable();

export const updateNodeInputSchema = z
  .object({
    name: nodeName.optional(),
    color: z.enum(TRACK_COLORS).optional(),
    archived: z.boolean().optional(),
    weeklyTargetMinutes: weeklyTargetSchema.optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Nothing to change.',
  });
export type UpdateNodeInput = z.infer<typeof updateNodeInputSchema>;

/** TOP-1: a done topic can be reopened by setting it back to another status. */
export const setTopicStatusInputSchema = z.object({ status: z.enum(TOPIC_STATUSES) });
export type SetTopicStatusInput = z.infer<typeof setTopicStatusInputSchema>;

export const moveNodeInputSchema = z.object({ direction: z.enum(['up', 'down']) });
export type MoveNodeInput = z.infer<typeof moveNodeInputSchema>;

export const MAX_SESSION_MINUTES = 1440;
export const MAX_NOTE_LENGTH = 500;

const minutes = z
  .number()
  .int('Minutes must be a whole number.')
  .min(1, 'A session must be at least 1 minute.')
  .max(MAX_SESSION_MINUTES, 'A session can be at most 24 hours.');

// An empty note is stored as "no note".
const note = z
  .string()
  .trim()
  .max(MAX_NOTE_LENGTH, `Notes can be at most ${MAX_NOTE_LENGTH} characters.`)
  .nullable()
  .transform((value) => (value ? value : null));

export const logSessionInputSchema = z.object({
  nodeId: z.uuid('Choose what you studied.'),
  studiedOn: localDateSchema,
  minutes,
  note: note.optional().transform((value) => value ?? null),
});
export type LogSessionInput = z.input<typeof logSessionInputSchema>;

export const updateSessionInputSchema = z
  .object({
    nodeId: z.uuid('Choose what you studied.').optional(),
    studiedOn: localDateSchema.optional(),
    minutes: minutes.optional(),
    note: note.optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Nothing to change.',
  });
export type UpdateSessionInput = z.input<typeof updateSessionInputSchema>;

export const historyQuerySchema = z.object({
  /** The newest day of the page (default: today). */
  to: localDateSchema.optional(),
  /** The oldest day to include at all (a date-range filter). */
  from: localDateSchema.optional(),
  /** Includes the node's descendants. */
  nodeId: z.uuid().optional(),
  source: z.enum(SESSION_SOURCES).optional(),
});
export type HistoryQuery = z.infer<typeof historyQuerySchema>;

/** MCP-4: lists are capped (default 50, max 200). */
export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 200;
export const listLimitSchema = z
  .number()
  .int()
  .min(1, 'The limit must be at least 1.')
  .max(MAX_LIST_LIMIT, `The limit can be at most ${MAX_LIST_LIMIT}.`)
  .default(DEFAULT_LIST_LIMIT);

export const listSessionsQuerySchema = z
  .object({
    /** Includes the node's descendants. */
    nodeId: z.uuid().optional(),
    from: localDateSchema.optional(),
    to: localDateSchema.optional(),
    source: z.enum(SESSION_SOURCES).optional(),
    limit: listLimitSchema,
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: '"from" must not be after "to".' });
export type ListSessionsQuery = z.input<typeof listSessionsQuerySchema>;

const deadlineTitle = z
  .string()
  .trim()
  .min(1, 'Enter a title.')
  .max(200, 'Titles can be at most 200 characters.');

export const createDeadlineInputSchema = z.object({
  nodeId: z.uuid('Choose what the deadline is for.'),
  title: deadlineTitle,
  dueOn: localDateSchema,
});
export type CreateDeadlineInput = z.infer<typeof createDeadlineInputSchema>;

export const updateDeadlineInputSchema = z
  .object({
    nodeId: z.uuid('Choose what the deadline is for.').optional(),
    title: deadlineTitle.optional(),
    dueOn: localDateSchema.optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Nothing to change.',
  });
export type UpdateDeadlineInput = z.infer<typeof updateDeadlineInputSchema>;

export const updateSettingsInputSchema = z
  .object({
    studentName: z.string().trim().max(80, 'Names can be at most 80 characters.').optional(),
    neglectDays: z
      .number()
      .int()
      .min(1, 'Choose 1 to 14 days.')
      .max(14, 'Choose 1 to 14 days.')
      .optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Nothing to change.',
  });
export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;

const taskTitle = z
  .string()
  .trim()
  .min(1, 'Enter a title.')
  .max(120, 'Titles can be at most 120 characters.');

// An empty description is stored as "no description".
const taskDescription = z
  .string()
  .trim()
  .max(2000, 'Descriptions can be at most 2000 characters.')
  .nullable()
  .transform((value) => (value ? value : null));

const maxScore = z.number().positive('The maximum must be more than 0.').max(100_000);

/** TASK-2: either a due date or weekly recurrence; scored tasks need a default maximum. */
export const createTaskInputSchema = z
  .object({
    /** null = "Other" (no track). */
    nodeId: z.uuid('Choose what the task is for.').nullable(),
    parentTaskId: z.uuid().nullable().default(null),
    title: taskTitle,
    description: taskDescription.optional().transform((value) => value ?? null),
    dueOn: localDateSchema.nullable().default(null),
    recurrence: z.enum(['none', 'weekly']).default('none'),
    isScored: z.boolean().default(false),
    defaultMaxScore: maxScore.nullable().default(null),
  })
  .refine((t) => t.recurrence === 'none' || t.dueOn === null, {
    message: 'Weekly tasks don’t have a due date.',
    path: ['dueOn'],
  })
  .refine((t) => !t.isScored || t.defaultMaxScore !== null, {
    message: 'Enter the usual maximum score.',
    path: ['defaultMaxScore'],
  })
  .refine((t) => !t.isScored || t.nodeId !== null, {
    message: 'Scored tasks need a track or subject, so the score has somewhere to go.',
    path: ['isScored'],
  });
export type CreateTaskInput = z.input<typeof createTaskInputSchema>;

/** TASK-8. The combined result is checked again by the service (weekly vs due date, scored max). */
export const updateTaskInputSchema = z
  .object({
    nodeId: z.uuid('Choose what the task is for.').nullable().optional(),
    title: taskTitle.optional(),
    description: taskDescription.optional(),
    dueOn: localDateSchema.nullable().optional(),
    recurrence: z.enum(['none', 'weekly']).optional(),
    isScored: z.boolean().optional(),
    defaultMaxScore: maxScore.nullable().optional(),
    archived: z.boolean().optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Nothing to change.',
  });
export type UpdateTaskInput = z.input<typeof updateTaskInputSchema>;

/** TASK-6: scored tasks need a score; the maximum defaults to the task's default max. */
export const completeTaskInputSchema = z.object({
  score: z.number().min(0, 'A score can’t be negative.').optional(),
  maxScore: maxScore.optional(),
  kind: z.enum(SCORE_KINDS).default('other'),
  note: note.optional().transform((value) => value ?? null),
});
export type CompleteTaskInput = z.input<typeof completeTaskInputSchema>;

const scoreTitle = z
  .string()
  .trim()
  .min(1, 'Enter a title.')
  .max(120, 'Titles can be at most 120 characters.');
const scoreValue = z.number().min(0, 'A score can’t be negative.').max(100_000);

/** SCORE-1. The service also checks that the date isn't in the future. */
export const createScoreInputSchema = z
  .object({
    nodeId: z.uuid('Choose what the score is for.'),
    kind: z.enum(SCORE_KINDS),
    title: scoreTitle,
    takenOn: localDateSchema,
    score: scoreValue,
    maxScore,
    note: note.optional().transform((value) => value ?? null),
  })
  .refine((s) => s.score <= s.maxScore, {
    message: 'The score can’t be more than the maximum.',
    path: ['score'],
  });
export type CreateScoreInput = z.input<typeof createScoreInputSchema>;

/** SCORE-1. The combined result is checked again by the service (score ≤ max, date). */
export const updateScoreInputSchema = z
  .object({
    nodeId: z.uuid('Choose what the score is for.').optional(),
    kind: z.enum(SCORE_KINDS).optional(),
    title: scoreTitle.optional(),
    takenOn: localDateSchema.optional(),
    score: scoreValue.optional(),
    maxScore: maxScore.optional(),
    note: note.optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Nothing to change.',
  });
export type UpdateScoreInput = z.input<typeof updateScoreInputSchema>;

/** REP-1–5: which report to build. `from`/`to` are used only for a custom range (REP-3). */
export const reportQuerySchema = z
  .object({
    period: z.enum(REPORT_PERIODS, 'Choose a period.'),
    from: localDateSchema.optional(),
    to: localDateSchema.optional(),
    includeNotes: z.boolean().default(false),
  })
  .refine((q) => q.period !== 'custom' || (q.from !== undefined && q.to !== undefined), {
    message: 'Choose a start and an end date.',
  });
export type ReportQuery = z.input<typeof reportQuerySchema>;

/** SHARE-5/6: a link expires after 7 or 30 days, or never (null). */
export const SHARE_EXPIRY_DAYS = [7, 30] as const;

export const createShareInputSchema = z.object({
  report: reportQuerySchema,
  expiresInDays: z.union([z.literal(7), z.literal(30), z.null()]).default(30),
});
export type CreateShareInput = z.input<typeof createShareInputSchema>;
