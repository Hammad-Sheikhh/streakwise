import type { z } from 'zod';

import { invalid } from '../domain/errors';

/**
 * Validates service input. Services check their own input so every caller (API, MCP, demo mode)
 * gets the same rules; a problem becomes a 'validation' DomainError with a readable message.
 */
export function parseInput<S extends z.ZodType>(schema: S, value: z.input<S>): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw invalid('validation', result.error.issues[0]?.message ?? 'Invalid input.');
  }
  return result.data;
}
