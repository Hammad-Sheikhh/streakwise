import { z } from 'zod';

import {
  MAX_DAY_ENDS_AT_MINUTES,
  REPORT_PERIODS,
  REVIEW_RESULTS,
  SCORE_KINDS,
  SESSION_SOURCES,
  TOPIC_STATUSES,
  TRACK_COLORS,
} from '../domain/types.js';

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
  /** DATA-1: the note contains this text (case-insensitive), across all history. */
  noteContains: z.string().trim().min(1).max(200).optional(),
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
    /** MCP-16: the note contains this text (case-insensitive). */
    noteContains: z.string().trim().min(1).max(200).optional(),
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
  /** EXAM-1. */
  isExam: z.boolean().default(false),
});
export type CreateDeadlineInput = z.input<typeof createDeadlineInputSchema>;

export const updateDeadlineInputSchema = z
  .object({
    nodeId: z.uuid('Choose what the deadline is for.').optional(),
    title: deadlineTitle.optional(),
    dueOn: localDateSchema.optional(),
    isExam: z.boolean().optional(),
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
    /** DAY-1: 00:00 to 06:00 in half-hour steps. */
    dayEndsAtMinutes: z
      .number()
      .int()
      .min(0, 'Choose a time from 00:00 to 06:00.')
      .max(MAX_DAY_ENDS_AT_MINUTES, 'Choose a time from 00:00 to 06:00.')
      .multipleOf(30, 'Choose a time on the hour or half hour.')
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
  /** TASK-11: the day it was done; default today, never in the future. */
  completedOn: localDateSchema.optional(),
});
export type CompleteTaskInput = z.input<typeof completeTaskInputSchema>;

/** TASK-11: which period to untick (the week of this date for weekly tasks; default today). */
export const uncompleteTaskQuerySchema = z.object({ date: localDateSchema.optional() });
export type UncompleteTaskQuery = z.infer<typeof uncompleteTaskQuerySchema>;

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

export const MAX_MISTAKE_LENGTH = 500;

const mistakeText = z
  .string()
  .trim()
  .min(1, 'Describe the mistake.')
  .max(MAX_MISTAKE_LENGTH, `Mistakes can be at most ${MAX_MISTAKE_LENGTH} characters.`);

/** ERR-1: the date defaults to today and can't be in the future (checked by the service). */
export const createMistakeInputSchema = z.object({
  nodeId: z.uuid('Choose what the mistake is about.'),
  text: mistakeText,
  createdOn: localDateSchema.optional(),
});
export type CreateMistakeInput = z.input<typeof createMistakeInputSchema>;

export const updateMistakeInputSchema = z
  .object({
    nodeId: z.uuid('Choose what the mistake is about.').optional(),
    text: mistakeText.optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Nothing to change.',
  });
export type UpdateMistakeInput = z.input<typeof updateMistakeInputSchema>;

/** ERR-2: a review on a day (default today, never in the future). */
export const reviewMistakeInputSchema = z.object({
  result: z.enum(REVIEW_RESULTS, 'Choose right or wrong.'),
  reviewedOn: localDateSchema.optional(),
});
export type ReviewMistakeInput = z.input<typeof reviewMistakeInputSchema>;

export const listMistakesQuerySchema = z.object({
  status: z.enum(['open', 'learned', 'all']).default('all'),
  /** Only open mistakes due on or before this day. */
  dueBy: localDateSchema.optional(),
  /** Includes the node's descendants. */
  nodeId: z.uuid().optional(),
});
export type ListMistakesQuery = z.input<typeof listMistakesQuerySchema>;

const targetLabel = z
  .string()
  .trim()
  .min(1, 'Enter a label, e.g. Mock 1.')
  .max(60, 'Labels can be at most 60 characters.');

const minPercent = z.number().min(0, 'Choose 0 to 100%.').max(100, 'Choose 0 to 100%.');

/** EXAM-3: e.g. Mock 1 · 1 Dec · 60%. */
export const createExamTargetInputSchema = z.object({
  label: targetLabel,
  targetOn: localDateSchema,
  minPercent,
});
export type CreateExamTargetInput = z.input<typeof createExamTargetInputSchema>;

export const updateExamTargetInputSchema = z
  .object({
    label: targetLabel.optional(),
    targetOn: localDateSchema.optional(),
    minPercent: minPercent.optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Nothing to change.',
  });
export type UpdateExamTargetInput = z.input<typeof updateExamTargetInputSchema>;
