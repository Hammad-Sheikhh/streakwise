import { z } from 'zod';

import { SESSION_SOURCES } from '../domain/types';
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
    'A node id, or a path such as "Improvement Exams > Maths > Chapter 3" (case-insensitive, ' +
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
