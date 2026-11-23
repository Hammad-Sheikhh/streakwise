import { z } from 'zod';

import {
  REPORT_PERIODS,
  REVIEW_RESULTS,
  SCORE_KINDS,
  SESSION_SOURCES,
  TOPIC_STATUSES,
} from '../domain/types.js';
import {
  listLimitSchema,
  MAX_MISTAKE_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_SESSION_MINUTES,
} from './inputs.js';

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

/** MCP-13, MCP-16: a smaller shape for lists. */
const compact = z.boolean().default(false);

const textFilter = (what: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .describe(`Only items whose ${what} (case-insensitive).`);

const minutesSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_SESSION_MINUTES)
  .describe('Duration in whole minutes (1–1440). Convert hours yourself: 1.5 h = 90.');

const noteSchema = z
  .string()
  .trim()
  .max(MAX_NOTE_LENGTH)
  .describe(`A short note (max ${MAX_NOTE_LENGTH} characters).`);

/** At least one field besides the id must be given. */
const somethingToChange = (keys: readonly string[]) => (input: Record<string, unknown>) =>
  keys.some((key) => input[key] !== undefined);

export const getStructureToolSchema = z.object({
  include_archived: z
    .boolean()
    .default(false)
    .describe('Also include archived nodes (flagged "archived": true). Default false.'),
});

export const logSessionToolSchema = z.object({
  node: nodeRef.describe(`What was studied. ${nodeRef.description}`),
  minutes: minutesSchema,
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
  note_contains: textFilter('note contains this text, e.g. "Day 3"'),
  compact: compact.describe(
    'true = each session is only id, date, minutes, path, and the first 80 characters of the ' +
      'note ("…" when cut). Default false.',
  ),
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
  compact: compact.describe(
    'true = each task is only id, title, and path, plus parentTaskId, dueOn, done, scored, ' +
      'weekly, overdue, and subtasks {done, total} only when they carry information (set or ' +
      'true); never the description. A sub-task leaves out path when it is the same as its ' +
      'parent task. Prefer this for overviews, then get_task for one task in full. Default false.',
  ),
  due_from: dateRef
    .optional()
    .describe(`Only one-off tasks due on or after this day. ${dateRef.description}`),
  due_to: dateRef
    .optional()
    .describe(`Only one-off tasks due on or before this day. ${dateRef.description}`),
  title_contains: textFilter('title contains this text, e.g. "Day 3"'),
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
  date: dateRef
    .default('today')
    .describe(
      `The day it was done (for a weekly task: its week). Not in the future. ${dateRef.description} ` +
        'Default today.',
    ),
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

const taskId = z.uuid().describe('The task id, from list_tasks or get_task.');

export const getTaskToolSchema = z.object({ task_id: taskId });

export const getLatestNoteToolSchema = z.object({
  prefix: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe('How the note starts, e.g. "Day" (case-insensitive).'),
  node: nodeRef
    .optional()
    .describe(`Only sessions on this node or under it. ${nodeRef.description}`),
});

export const updateSessionToolSchema = z
  .object({
    session_id: z.uuid().describe('The session id, from list_sessions or log_session.'),
    minutes: minutesSchema.optional(),
    note: noteSchema.nullable().optional().describe('The new note; null removes it.'),
    date: dateRef.optional().describe(`The day studied; not in the future. ${dateRef.description}`),
    node: nodeRef.optional().describe(`Move it to this node. ${nodeRef.description}`),
  })
  .refine(somethingToChange(['minutes', 'note', 'date', 'node']), {
    message: 'Give at least one of minutes, note, date, or node.',
  });

export const uncompleteTaskToolSchema = z.object({
  task_id: taskId,
  date: dateRef
    .default('today')
    .describe(
      'Which completion to remove: for a weekly task, the one for the week containing this ' +
        `day. ${dateRef.description} Default today.`,
    ),
});

const scoreId = z.uuid().describe('The score id, from list_scores or log_score.');

export const listScoresToolSchema = z.object({
  node: nodeRef.optional().describe(`Only scores on this node or under it. ${nodeRef.description}`),
  from: dateRef.optional().describe(`Earliest day, inclusive. ${dateRef.description}`),
  to: dateRef.optional().describe(`Latest day, inclusive. ${dateRef.description}`),
  kind: z.enum(SCORE_KINDS).optional().describe('Only this kind of score.'),
  title_contains: textFilter('title contains this text, e.g. "Mock 2"'),
  limit,
});

export const updateScoreToolSchema = z
  .object({
    score_id: scoreId,
    score: z.number().min(0).optional().describe('Points scored (at most the maximum).'),
    max_score: maxScore.optional().describe('Maximum possible points (more than 0).'),
    title: z.string().trim().min(1).max(120).optional().describe('e.g. "Mock 2".'),
    note: noteSchema.nullable().optional().describe('The new note; null removes it.'),
    date: dateRef
      .optional()
      .describe(`When it was taken; not in the future. ${dateRef.description}`),
    kind: z
      .enum(SCORE_KINDS)
      .optional()
      .describe('past_paper, quiz, mock_test, revision, or other.'),
  })
  .refine(somethingToChange(['score', 'max_score', 'title', 'note', 'date', 'kind']), {
    message: 'Give at least one field to change.',
  });

export const deleteScoreToolSchema = z.object({ score_id: scoreId });

export const updateTaskToolSchema = z
  .object({
    task_id: taskId,
    title: z.string().trim().min(1).max(120).optional().describe('New title (1–120 characters).'),
    description: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional()
      .describe('New details; null removes them.'),
    due_date: dateRef
      .nullable()
      .optional()
      .describe(`New due date for a one-off task; null removes it. ${dateRef.description}`),
    weekly: z
      .boolean()
      .optional()
      .describe('true = due every week (any due date is removed); false = one-off.'),
    scored: z.boolean().optional().describe('true = completing it records a score.'),
    default_max_score: maxScore
      .nullable()
      .optional()
      .describe('Usual maximum score; needed when scored.'),
  })
  .refine(
    somethingToChange([
      'title',
      'description',
      'due_date',
      'weekly',
      'scored',
      'default_max_score',
    ]),
    { message: 'Give at least one field to change.' },
  );

export const deleteTaskToolSchema = z.object({
  task_id: taskId,
  include_subtasks: z
    .boolean()
    .default(false)
    .describe(
      'Must be true to delete a task that has sub-tasks (they are deleted too). Default false, ' +
        'which refuses and says how many sub-tasks there are.',
    ),
});

export const updateNodeToolSchema = z
  .object({
    node: nodeRef.describe(`The node to change. ${nodeRef.description}`),
    name: z.string().trim().min(1).max(60).optional().describe('New name (1–60 characters).'),
    weekly_target: z
      .number()
      .int()
      .min(0)
      .max(7 * 24 * 60)
      .nullable()
      .optional()
      .describe(
        'Tracks only: the weekly target in minutes, in half-hour steps (e.g. 300); null removes it.',
      ),
  })
  .refine(somethingToChange(['name', 'weekly_target']), {
    message: 'Give a name or a weekly_target.',
  });

export const archiveNodeToolSchema = z.object({
  node: nodeRef.describe(`The node to hide, with everything under it. ${nodeRef.description}`),
});

export const unarchiveNodeToolSchema = z.object({
  node: nodeRef.describe(`The archived node to bring back. ${nodeRef.description}`),
});

export const logSessionsToolSchema = z.object({
  sessions: z
    .array(logSessionToolSchema)
    .min(1)
    .max(10)
    .describe('1–10 sessions, each with the log_session fields. All are saved, or none.'),
});

const mistakeId = z.uuid().describe('The mistake id, from list_due_mistakes or add_mistake.');

export const addMistakeToolSchema = z.object({
  node: nodeRef.describe(`What the mistake is about. ${nodeRef.description}`),
  text: z
    .string()
    .trim()
    .min(1)
    .max(MAX_MISTAKE_LENGTH)
    .describe(
      `The mistake and the correct version, e.g. "der Tisch, not die Tisch" (max ${MAX_MISTAKE_LENGTH} characters).`,
    ),
  date: dateRef
    .default('today')
    .describe(`When it was made; not in the future. ${dateRef.description} Default today.`),
});

export const listDueMistakesToolSchema = z.object({
  node: nodeRef
    .optional()
    .describe(`Only mistakes on this node or under it. ${nodeRef.description}`),
  date: dateRef
    .default('today')
    .describe(`Due on or before this day. ${dateRef.description} Default today.`),
  limit,
});

export const reviewMistakeToolSchema = z.object({
  mistake_id: mistakeId,
  result: z
    .enum(REVIEW_RESULTS)
    .describe(
      '"right" moves it to the next review (learned after the third); "wrong" starts it again.',
    ),
});
