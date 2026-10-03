import { z } from 'zod';

import { SESSION_SOURCES, TRACK_COLORS } from '../domain/types';

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
