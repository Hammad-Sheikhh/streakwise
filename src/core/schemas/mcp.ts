import { z } from 'zod';

import { REPORT_PERIODS, SCORE_KINDS, SESSION_SOURCES, TOPIC_STATUSES } from '../domain/types';
import { listLimitSchema, MAX_NOTE_LENGTH, MAX_SESSION_MINUTES } from './inputs';

// MCP-8: input schemas for the Claude (MCP) tools. Descriptions are written for an AI reader; the
// SDK turns them into the JSON Schema Claude sees. Node and date references are resolved by the
// tools (MCP-5, MCP-6) before the core services validate the result again.

const nodeRef = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .describe(
    'A node id, or a path such as "School Subjects > Maths > Chapter 3" (case-insensitive, ' +
      '">"-separated). The end of a path or a unique partial name such as "maths" also works.',
  );

const dateRef = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .describe('"today", "yesterday", or a date as YYYY-MM-DD (Asia/Karachi).');

const limit = listLimitSchema.describe('Maximum number of items to return (1–200, default 50).');

export const getStructureToolSchema = z.object({
  include_archived: z
    .boolean()
    .default(false)
    .describe('Also include archived nodes (flagged "archived": true). Default false.'),
});

export const logSessionToolSchema = z.object({
  node: nodeRef.describe(`What was studied. ${nodeRef.description}`),
  minutes: z
    .number()
    .int()
    .min(1)
    .max(MAX_SESSION_MINUTES)
    .describe('Duration in whole minutes (1–1440). Convert hours yourself: 1.5 h = 90.'),
  date: dateRef.default('today').describe(`The day studied. ${dateRef.description} Default today.`),
  note: z
    .string()
    .trim()
    .max(MAX_NOTE_LENGTH)
    .optional()
    .describe(`Optional short note (max ${MAX_NOTE_LENGTH} characters).`),
});

export const listSessionsToolSchema = z.object({
  node: nodeRef.optional().describe(`Only this node and its descendants. ${nodeRef.description}`),
  from: dateRef.optional().describe(`Earliest day, inclusive. ${dateRef.description}`),
  to: dateRef.optional().describe(`Latest day, inclusive. ${dateRef.description}`),
  source: z
    .enum(SESSION_SOURCES)
    .optional()
    .describe('"app" (logged in the app) or "claude" (logged through this connection).'),
  limit,
});

export const deleteSessionToolSchema = z.object({
  session_id: z.uuid().describe('The id of the session, from list_sessions or log_session.'),
});

export const getProgressToolSchema = z.object({});

export const findGapsToolSchema = z.object({
  limit: limit.describe('Maximum items per list (1–200, default 50).'),
});

export const addNodeToolSchema = z.object({
  parent: nodeRef.describe(
    `The parent: a track (to add a subtask) or a subtask (to add a topic). ${nodeRef.description}`,
  ),
  name: z.string().trim().min(1).max(60).describe('Name of the new node (1–60 characters).'),
});

export const listDeadlinesToolSchema = z.object({
  include_past: z.boolean().default(false).describe('Also include deadlines that have passed.'),
  limit,
});

export const setTopicStatusToolSchema = z.object({
  topic: nodeRef.describe(`The topic (level 3). ${nodeRef.description}`),
  status: z
    .enum(TOPIC_STATUSES)
    .describe('not_started, in_progress, or done. A done topic can be reopened.'),
});

export const listTasksToolSchema = z.object({
  node: nodeRef
    .optional()
    .describe(`Only tasks on this node or anything under it. ${nodeRef.description}`),
  status: z
    .enum(['open', 'done', 'due_this_week', 'all'])
    .default('open')
    .describe(
      '"open" (not done; weekly tasks not done this week), "done", "due_this_week" (weekly tasks ' +
        'not done this week plus one-off tasks due by Sunday, overdue included), or "all". ' +
        'Default "open".',
    ),
  include_archived: z.boolean().default(false).describe('Also include archived tasks.'),
  limit,
});

const maxScore = z.number().positive().max(100_000);

export const addTaskToolSchema = z
  .object({
    title: z.string().trim().min(1).max(120).describe('Task title (1–120 characters).'),
    node: nodeRef
      .optional()
      .describe(
        `What the task is for. Leave out for a task not tied to any track ("Other"; it can't ` +
          `be scored). ${nodeRef.description}`,
      ),
    parent_task_id: z
      .uuid()
      .optional()
      .describe('Makes it a sub-task of this task (id from list_tasks). Sub-tasks nest freely.'),
    description: z.string().trim().max(2000).optional().describe('Optional details.'),
    weekly: z
      .boolean()
      .default(false)
      .describe('true = due every week (Mon–Sun) until done that week; no due date allowed.'),
    due_date: dateRef
      .optional()
      .describe(`Optional due date for a one-off task. ${dateRef.description}`),
    scored: z
      .boolean()
      .default(false)
      .describe('true = completing it records a score (needs default_max_score).'),
    default_max_score: maxScore.optional().describe('Usual maximum score, for scored tasks.'),
  })
  .refine((t) => !(t.weekly && t.due_date), {
    message: 'Weekly tasks can’t have a due date.',
    path: ['due_date'],
  })
  .refine((t) => !t.scored || t.default_max_score !== undefined, {
    message: 'Scored tasks need default_max_score.',
    path: ['default_max_score'],
  });

export const completeTaskToolSchema = z.object({
  task_id: z.uuid().describe('The task id, from list_tasks or add_task.'),
  score: z
    .number()
    .min(0)
    .optional()
    .describe('Required for scored tasks, not allowed otherwise. Must be ≤ the maximum.'),
  max_score: maxScore
    .optional()
    .describe('Maximum score; defaults to the task’s default_max_score.'),
  kind: z
    .enum(SCORE_KINDS)
    .default('other')
    .describe('Kind of the score recorded for a scored task. Default "other".'),
  note: z.string().trim().max(MAX_NOTE_LENGTH).optional().describe('Optional short note.'),
});

export const logScoreToolSchema = z.object({
  node: nodeRef.describe(`What the score is for. ${nodeRef.description}`),
  kind: z.enum(SCORE_KINDS).describe('past_paper, quiz, mock_test, revision, or other.'),
  title: z.string().trim().min(1).max(120).describe('e.g. "2023 Paper 1".'),
  score: z.number().min(0).describe('Points scored (≥ 0, ≤ max_score).'),
  max_score: maxScore.describe('Maximum possible points (> 0).'),
  date: dateRef
    .default('today')
    .describe(`When it was taken; not in the future. ${dateRef.description} Default today.`),
  note: z.string().trim().max(MAX_NOTE_LENGTH).optional().describe('Optional short note.'),
});

export const getReportToolSchema = z.object({
  period: z
    .enum(REPORT_PERIODS)
    .default('this_week')
    .describe(
      'today, yesterday, this_week (Monday to Sunday), last_week, or custom (needs from and to, ' +
        'at most 92 days). Default this_week.',
    ),
  from: dateRef.optional().describe(`First day of a custom period. ${dateRef.description}`),
  to: dateRef.optional().describe(`Last day of a custom period. ${dateRef.description}`),
  include_notes: z
    .boolean()
    .default(false)
    .describe('Include session notes (private by default). Default false.'),
});
